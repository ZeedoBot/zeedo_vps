"""
Controle do bot: ligar/desligar e configurações (símbolos, timeframes, etc.).
O manager (manager.py) lê bot_config e instance_status; não precisamos chamar o manager
diretamente da API — basta atualizar bot_config e o manager reage no próximo ciclo.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/bot", tags=["bot"])


class BotConfigUpdate(BaseModel):
    bot_enabled: Optional[bool] = None
    symbols: Optional[List[str]] = None
    timeframes: Optional[List[str]] = None
    trade_mode: Optional[str] = Field(None, pattern="^(BOTH|LONG_ONLY|SHORT_ONLY)$")
    target_loss_usd: Optional[float] = None
    max_global_exposure: Optional[float] = None
    max_single_pos_exposure: Optional[float] = None
    max_positions: Optional[int] = None


@router.get("/config")
def get_config(user_id: str = Depends(get_current_user_id)):
    """Retorna configuração do bot do usuário (sem dados sensíveis)."""
    supabase = get_supabase()
    r = supabase.table("bot_config").select(
        "symbols, timeframes, trade_mode, bot_enabled, "
        "target_loss_usd, max_global_exposure, max_single_pos_exposure, max_positions, updated_at"
    ).eq("user_id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {
            "bot_enabled": False,
            "symbols": [],
            "timeframes": [],
            "trade_mode": "BOTH",
            "target_loss_usd": 5.0,
            "max_global_exposure": 5000.0,
            "max_single_pos_exposure": 2500.0,
            "max_positions": 2,
        }
    return r.data[0]


@router.put("/config")
def update_config(
    body: BotConfigUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Atualiza configuração. O manager reinicia a instância automaticamente se bot_enabled ou parâmetros mudarem."""
    supabase = get_supabase()
    # Verificar se já existe linha para o usuário
    existing = supabase.table("bot_config").select("id, user_id, trading_account_id").eq("user_id", user_id).limit(1).execute()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        return {"success": True, "message": "Nada a atualizar"}

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

    return {"success": True, "message": "Configuração atualizada. O bot será reiniciado em até 30 segundos se estiver ligado."}


@router.get("/status")
def bot_status(user_id: str = Depends(get_current_user_id)):
    """Status da instância (running/stopped) e último heartbeat."""
    supabase = get_supabase()
    r = supabase.table("instance_status").select("status, last_heartbeat, error_message").eq("user_id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {"status": "stopped", "last_heartbeat": None, "error_message": None}
    row = r.data[0]
    return {
        "status": row.get("status", "stopped"),
        "last_heartbeat": row.get("last_heartbeat"),
        "error_message": row.get("error_message"),
    }
