"""
Controle do bot: ligar/desligar e configurações (símbolos, timeframes, etc.).
O manager (manager.py) lê bot_config e instance_status; não precisamos chamar o manager
diretamente da API — basta atualizar bot_config e o manager reage no próximo ciclo.
Validação contra plan_limits por plano do usuário.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.services.telegram_service import send_telegram_to_user

ALL_SYMBOLS = ["BTC", "ETH", "SOL", "AVAX", "LINK", "SUI", "HYPE", "XRP", "AAVE", "DOGE", "BNB", "ADA", "UNI"]

router = APIRouter(prefix="/bot", tags=["bot"])


def _get_plan_limits(supabase, user_id: str) -> dict:
    """Retorna limites do plano do usuário."""
    ur = supabase.table("users").select("subscription_tier").eq("id", user_id).limit(1).execute()
    plan = "basic"
    if ur.data and len(ur.data) > 0:
        plan = (ur.data[0].get("subscription_tier") or "basic").lower()
        if plan not in ("basic", "pro", "satoshi"):
            plan = "basic"
    r = supabase.table("plan_limits").select("*").eq("plan", plan).limit(1).execute()
    if not r.data or len(r.data) == 0:
        r = supabase.table("plan_limits").select("*").eq("plan", "basic").limit(1).execute()
    row = r.data[0] if r.data else {}
    allowed = row.get("allowed_symbols") or []
    return {
        "plan": plan,
        "max_positions": int(row.get("max_positions", 2)),
        "max_global_exposure_usd": float(row.get("max_global_exposure_usd", 5000)),
        "max_single_position_usd": float(row.get("max_single_position_usd", 2500)),
        "target_loss_min": float(row.get("target_loss_min", 5)),
        "target_loss_max": float(row.get("target_loss_max", 20)),
        "allowed_symbols": allowed if allowed else ALL_SYMBOLS,
        "allowed_timeframes": row.get("allowed_timeframes") or ["15m"],
        "allowed_trade_modes": row.get("allowed_trade_modes") or ["BOTH"],
        "allowed_entry2": bool(row.get("allowed_entry2", False)),
        "can_customize_targets": bool(row.get("can_customize_targets", False)),
        "can_customize_stop": bool(row.get("can_customize_stop", False)),
    }


class BotConfigUpdate(BaseModel):
    bot_enabled: Optional[bool] = None
    entry2_enabled: Optional[bool] = None
    symbols: Optional[List[str]] = None
    timeframes: Optional[List[str]] = None
    trade_mode: Optional[str] = Field(None, pattern="^(BOTH|LONG_ONLY|SHORT_ONLY)$")
    target_loss_usd: Optional[float] = None
    max_global_exposure: Optional[float] = None
    max_single_pos_exposure: Optional[float] = None
    max_positions: Optional[int] = None
    stop_multiplier: Optional[float] = Field(None, ge=1.0, le=3.0)
    entry2_multiplier: Optional[float] = Field(None, ge=0.619, le=5.0)
    entry2_adjust_last_target: Optional[bool] = None
    target1_level: Optional[float] = Field(None, ge=0.0, le=5.0)
    target1_percent: Optional[int] = Field(None, ge=1, le=100)
    target2_level: Optional[float] = Field(None, ge=0.0, le=5.0)
    target2_percent: Optional[int] = Field(None, ge=0, le=100)
    target3_level: Optional[float] = Field(None, ge=0.0, le=5.0)
    target3_percent: Optional[int] = Field(None, ge=0, le=100)


@router.get("/config")
def get_config(user_id: str = Depends(get_current_user_id)):
    """Retorna configuração do bot do usuário + limites do plano."""
    supabase = get_supabase()
    ur = supabase.table("users").select("subscription_status").eq("id", user_id).limit(1).execute()
    sub_status = (ur.data[0].get("subscription_status") or "").lower() if ur.data else ""
    trial_ended = sub_status == "expired"
    limits = _get_plan_limits(supabase, user_id)
    r = supabase.table("bot_config").select(
        "symbols, timeframes, trade_mode, bot_enabled, entry2_enabled, "
        "target_loss_usd, max_global_exposure, max_single_pos_exposure, max_positions, "
        "stop_multiplier, entry2_multiplier, entry2_adjust_last_target, "
        "target1_level, target1_percent, target2_level, target2_percent, target3_level, target3_percent, updated_at"
    ).eq("user_id", user_id).limit(1).execute()
    out = {
        "bot_enabled": False,
        "entry2_enabled": True,
        "symbols": [],
        "timeframes": [],
        "trade_mode": "BOTH",
        "target_loss_usd": 5.0,
        "max_global_exposure": 5000.0,
        "max_single_pos_exposure": 2500.0,
        "max_positions": 2,
        "stop_multiplier": 1.8,
        "entry2_multiplier": 1.414,
        "entry2_adjust_last_target": True,
        "target1_level": 0.618,
        "target1_percent": 50,
        "target2_level": 1.0,
        "target2_percent": 50,
        "target3_level": None,
        "target3_percent": 0,
    }
    if r.data and len(r.data) > 0:
        out.update(r.data[0])
    out["plan_limits"] = limits
    out["trial_ended"] = trial_ended
    return out


@router.put("/config")
def update_config(
    body: BotConfigUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Atualiza configuração. Valida contra limites do plano."""
    supabase = get_supabase()
    limits = _get_plan_limits(supabase, user_id)
    payload = body.model_dump(exclude_none=True)
    if not payload:
        return {"success": True, "message": "Nada a atualizar"}

    # Validação contra plan_limits
    if body.entry2_enabled is not None and body.entry2_enabled and not limits.get("allowed_entry2", False):
        raise HTTPException(400, "Entrada 2 disponível apenas nos planos Pro e Enterprise.")
    if body.target_loss_usd is not None:
        if body.target_loss_usd < limits["target_loss_min"] or body.target_loss_usd > limits["target_loss_max"]:
            raise HTTPException(400, f"target_loss deve estar entre {limits['target_loss_min']} e {limits['target_loss_max']} (plano {limits['plan']})")
    if body.max_positions is not None:
        if body.max_positions < 1 or body.max_positions > limits["max_positions"]:
            raise HTTPException(400, f"max_positions deve estar entre 1 e {limits['max_positions']} (plano {limits['plan']})")
    if body.max_global_exposure is not None:
        if body.max_global_exposure > limits["max_global_exposure_usd"]:
            raise HTTPException(400, f"max_global_exposure máximo: {limits['max_global_exposure_usd']} (plano {limits['plan']})")
    if body.max_single_pos_exposure is not None:
        if body.max_single_pos_exposure > limits["max_single_position_usd"]:
            raise HTTPException(400, f"max_single_pos_exposure máximo: {limits['max_single_position_usd']} (plano {limits['plan']})")
    if body.symbols is not None:
        allowed = set(s.upper() for s in limits["allowed_symbols"])
        for s in body.symbols:
            if s.upper() not in allowed:
                raise HTTPException(400, f"Símbolo {s} não permitido no plano {limits['plan']}")
    if body.timeframes is not None:
        allowed_tf = set(limits["allowed_timeframes"])
        for t in body.timeframes:
            if t not in allowed_tf:
                raise HTTPException(400, f"Timeframe {t} não permitido no plano {limits['plan']}")
    if body.trade_mode is not None:
        if body.trade_mode not in limits["allowed_trade_modes"]:
            raise HTTPException(400, f"Modo {body.trade_mode} não permitido no plano {limits['plan']}")
    
    # Validação de alvos e stop customizados (apenas Pro e Satoshi)
    can_customize_targets = limits.get("can_customize_targets", False)
    can_customize_stop = limits.get("can_customize_stop", False)
    
    if body.stop_multiplier is not None and not can_customize_stop:
        raise HTTPException(400, "Customização de stop loss disponível apenas nos planos Pro e Satoshi.")
    
    if body.entry2_multiplier is not None and not can_customize_stop:
        raise HTTPException(400, "Customização da entrada 2 disponível apenas nos planos Pro e Satoshi.")
    
    if any([body.target1_level is not None, body.target1_percent is not None, 
            body.target2_level is not None, body.target2_percent is not None,
            body.target3_level is not None, body.target3_percent is not None]) and not can_customize_targets:
        raise HTTPException(400, "Customização de alvos disponível apenas nos planos Pro e Satoshi.")
    
    # Validação de consistência dos alvos (soma deve ser 100%)
    if any([body.target1_percent is not None, body.target2_percent is not None, body.target3_percent is not None]):
        # Busca valores atuais
        current = supabase.table("bot_config").select("target1_percent, target2_percent, target3_percent").eq("user_id", user_id).limit(1).execute()
        t1 = body.target1_percent if body.target1_percent is not None else (current.data[0].get("target1_percent", 50) if current.data else 50)
        t2 = body.target2_percent if body.target2_percent is not None else (current.data[0].get("target2_percent", 50) if current.data else 50)
        t3 = body.target3_percent if body.target3_percent is not None else (current.data[0].get("target3_percent", 0) if current.data else 0)
        
        # Alvo 1 é obrigatório (deve ter percentual > 0)
        if t1 <= 0:
            raise HTTPException(400, "Alvo 1 é obrigatório e deve ter percentual maior que 0%")
        
        total = t1 + t2 + t3
        if total != 100:
            raise HTTPException(400, f"A soma dos percentuais dos alvos deve ser 100% (atual: {total}%)")

    # Só permite ligar o bot se carteira E telegram estiverem conectados
    if body.bot_enabled is True:
        ur = supabase.table("users").select("subscription_status, subscription_tier").eq("id", user_id).limit(1).execute()
        sub_status = (ur.data[0].get("subscription_status") or "").lower() if ur.data else ""
        if sub_status not in ("active", "trial"):
            raise HTTPException(
                400,
                "Seu período de teste terminou ou você ainda não tem um plano ativo. Acesse a página de planos para continuar.",
            )
        acc = supabase.table("trading_accounts").select("id").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
        tg = supabase.table("telegram_configs").select("id, chat_id").eq("user_id", user_id).limit(1).execute()
        has_wallet = bool(acc.data and len(acc.data) > 0)
        has_telegram = bool(tg.data and len(tg.data) > 0 and (tg.data[0].get("chat_id") or "").strip())
        if not has_wallet:
            raise HTTPException(400, "Conecte a carteira Hyperliquid antes de ligar o bot.")
        if not has_telegram:
            raise HTTPException(400, "Conecte o Telegram antes de ligar o bot.")

    existing = supabase.table("bot_config").select("id, user_id, trading_account_id").eq("user_id", user_id).limit(1).execute()
    if existing.data and len(existing.data) > 0:
        supabase.table("bot_config").update(payload).eq("user_id", user_id).execute()
    else:
        # Primeira vez: trading_account_id pode ser null se usuário ainda não conectou carteira
        acc = supabase.table("trading_accounts").select("id").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
        trading_account_id = acc.data[0]["id"] if acc.data else None
        payload["user_id"] = user_id
        if trading_account_id:
            payload["trading_account_id"] = trading_account_id
        supabase.table("bot_config").insert(payload).execute()

    # Notifica no Telegram quando bot desliga (o "Conectado" vem do instance ao iniciar)
    if body.bot_enabled is not None and not body.bot_enabled:
        send_telegram_to_user(supabase, user_id, "😴 Zeedo Desligado")

    return {"success": True, "message": "Configuração atualizada. O bot será reiniciado em até 30 segundos se estiver ligado."}


@router.get("/status")
def bot_status(user_id: str = Depends(get_current_user_id)):
    """
    Status do bot: usa bot_config.bot_enabled como fonte de verdade para Ligado/Desligado.
    O instance_status reflete o estado real da instância (atualizado pelo manager).
    """
    supabase = get_supabase()
    cfg = supabase.table("bot_config").select("bot_enabled").eq("user_id", user_id).limit(1).execute()
    inst = supabase.table("instance_status").select("status, last_heartbeat, error_message").eq("user_id", user_id).limit(1).execute()
    bot_enabled = bool(cfg.data and len(cfg.data) > 0 and cfg.data[0].get("bot_enabled"))
    status = "stopped"
    last_heartbeat = None
    error_message = None
    if inst.data and len(inst.data) > 0:
        row = inst.data[0]
        status = row.get("status", "stopped")
        last_heartbeat = row.get("last_heartbeat")
        error_message = row.get("error_message")
    # Fonte de verdade: bot_enabled. Se usuário desligou, mostra Desligado imediatamente.
    display_status = "running" if bot_enabled else "stopped"
    return {
        "status": display_status,
        "instance_status": status,
        "bot_enabled": bot_enabled,
        "last_heartbeat": last_heartbeat,
        "error_message": error_message,
    }
