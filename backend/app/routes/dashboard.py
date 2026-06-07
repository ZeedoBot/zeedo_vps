"""
Endpoint de overview do dashboard: saldo Hyperliquid, trades, posições e logs.
"""
import logging
import sys
import time
from pathlib import Path
from typing import Any

import requests
from eth_account import Account
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.config import get_settings
from utils.hyperliquid_balance import fetch_display_account_value_usd
from utils.hyperliquid_symbols import is_spot_coin

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)

HYPERLIQUID_API = "https://api.hyperliquid.xyz/info"
HYPERLIQUID_EXCHANGE = "https://api.hyperliquid.xyz/exchange"


class ClosePositionBody(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)
    pct: float = Field(100.0, ge=1.0, le=100.0)


class ExecuteBlockedTradeBody(BaseModel):
    id: str = Field(..., description="UUID do trade bloqueado")


class RemoveBlockedTradeBody(BaseModel):
    id: str = Field(..., description="UUID do trade bloqueado")


class CancelPendingPositionBody(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)


ALLOWED_TRADE_TFS = frozenset({"-", "15m", "1h", "4h", "12h", "1d", "3d", "1w", "1M"})


class PatchTradeGroupBody(BaseModel):
    """Identificador do grupo no histórico (trade_id ou oid quando trade_id era '-')."""
    group_id: str = Field(..., min_length=1, max_length=128)
    trade_id: str = Field(..., min_length=1, max_length=128)
    tf: str = Field(..., min_length=1, max_length=8)


def _get_wallet_address(user_id: str) -> str | None:
    supabase = get_supabase()
    r = supabase.table("trading_accounts").select("wallet_address").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return None
    return r.data[0].get("wallet_address")


def _fetch_hyperliquid_balance(wallet: str) -> float:
    """Inclui unified account / portfolio margin (spot clearinghouse)."""
    if not wallet:
        return 0.0
    try:
        return fetch_display_account_value_usd(wallet)
    except Exception as e:
        logger.warning(f"Erro ao buscar saldo Hyperliquid: {e}")
        return 0.0


def _get_user_created_at_ms(user_id: str) -> int | None:
    """Retorna created_at do usuário em ms. None = sem filtro."""
    try:
        supabase = get_supabase()
        r = supabase.table("users").select("created_at").eq("id", user_id).limit(1).execute()
        if not r.data or len(r.data) == 0:
            return None
        created = r.data[0].get("created_at")
        if not created:
            return None
        from datetime import datetime
        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00")) if isinstance(created, str) else created
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


def _fetch_trades(user_id: str) -> list[dict]:
    supabase = get_supabase()
    r = supabase.table("trades_database").select(
        "trade_id, symbol, side, tf, oid, pnl_usd, closed_at, account_value_at_trade, time_ms, size_usd"
    ).eq("user_id", user_id).order("closed_at", desc=False).execute()
    if not r.data:
        return []
    min_ts_ms = _get_user_created_at_ms(user_id)
    out = []
    for row in r.data:
        ts = row.get("time_ms") or 0
        if isinstance(row.get("closed_at"), str) and "T" in row["closed_at"]:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(row["closed_at"].replace("Z", "+00:00"))
                ts = int(dt.timestamp() * 1000)
            except Exception:
                pass

        # Filtra: apenas trades após criação da conta no Zeedo
        if min_ts_ms is not None and ts > 0 and ts < min_ts_ms:
            continue

        symbol = row.get("symbol", "?")
        if is_spot_coin(symbol):
            continue

        # Calcula PNL % baseado no saldo da conta no momento do trade
        pnl_usd = float(row.get("pnl_usd", 0) or 0)
        account_value = row.get("account_value_at_trade")
        pnl_pct = None
        if account_value and account_value > 0:
            pnl_pct = (pnl_usd / account_value) * 100
        
        out.append({
            "trade_id": row.get("trade_id", "-"),
            "oid": row.get("oid", ""),
            "token": symbol,
            "side": row.get("side", "?"),
            "tf": row.get("tf", "-"),
            "pnl_usd": pnl_usd,
            "pnl_pct": pnl_pct,
            "account_value_at_trade": float(account_value) if account_value and account_value > 0 else None,
            "size_usd": float(row.get("size_usd", 0) or 0),
            "time": ts,
        })
    return out


def _fetch_hl_open_entry_orders(wallet: str) -> tuple[bool, dict[str, list[dict]]]:
    """
    Ordens de entrada abertas (reduceOnly=false) agrupadas por moeda.
    Usa frontendOpenOrders — mesmo endpoint do bot.py (openOrders pode omitir ordens).
    """
    try:
        resp = requests.post(
            HYPERLIQUID_API,
            json={"type": "frontendOpenOrders", "user": wallet},
            timeout=10,
        )
        resp.raise_for_status()
        orders = resp.json() or []
        by_coin: dict[str, list[dict]] = {}
        for order in orders:
            if bool(order.get("reduceOnly")):
                continue
            coin = (order.get("coin") or "").upper()
            if coin:
                by_coin.setdefault(coin, []).append(order)
        return True, by_coin
    except Exception as e:
        logger.warning(f"frontendOpenOrders Hyperliquid: {e}")
        return False, {}


def _symbols_with_open_entry_orders(wallet: str) -> tuple[bool, set[str]]:
    ok, by_coin = _fetch_hl_open_entry_orders(wallet)
    return ok, set(by_coin.keys())


def _fetch_tracker(user_id: str) -> list[dict]:
    supabase = get_supabase()
    r = supabase.table("bot_tracker").select("symbol, data").eq("user_id", user_id).execute()
    if not r.data:
        return []
    out = []
    for row in r.data:
        d = row.get("data") or {}
        qty = d.get("qty") or d.get("last_size") or d.get("size", 0)
        entry = d.get("entry_px") or d.get("entry", 0)
        usd_val = float(qty) * float(entry) if qty and entry else 0
        placed = d.get("placed_at") or d.get("opened_at", 0)
        stop = d.get("planned_stop", 0)
        tf = d.get("tf") or "-"
        side = (d.get("side") or "long").upper()
        out.append({
            "symbol": row.get("symbol", ""),
            "tf": tf if tf else "-",
            "side": side[:5],
            "entry_px": float(entry),
            "usd_val": round(usd_val, 0),
            "planned_stop": float(stop),
            "placed_at": placed,
            "data": d,
        })
    return out


def _fetch_logs(limit: int = 80) -> list[dict]:
    supabase = get_supabase()
    try:
        r = (
            supabase.table("bot_logs")
            .select("level, symbol, timeframe, event, details, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        if not r.data:
            return []
        return [
            {
                "level": x.get("level"),
                "event": x.get("event"),
                "details": x.get("details"),
                "created_at": x.get("created_at"),
            }
            for x in r.data
        ]
    except Exception as e:
        # Se a tabela bot_logs foi removida (ex.: limpeza), não derrubar o dashboard.
        if "PGRST205" in str(e) or "bot_logs" in str(e):
            return []
        logger.warning("Falha ao buscar bot_logs: %s", e)
        return []


@router.patch("/trade-group")
def patch_trade_group(
    body: PatchTradeGroupBody,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """
    Atualiza trade_id e tf de todas as linhas do grupo (parciais com o mesmo id agrupado).
    Permite corrigir MANUAL → id do bot e unir parciais sob o mesmo trade_id.
    """
    new_tf = body.tf.strip()
    if new_tf not in ALLOWED_TRADE_TFS:
        raise HTTPException(
            status_code=400,
            detail=f"TF inválido. Use um de: {', '.join(sorted(ALLOWED_TRADE_TFS))}",
        )
    group_id = body.group_id.strip()
    new_trade_id = body.trade_id.strip()
    if not group_id or not new_trade_id:
        raise HTTPException(status_code=400, detail="group_id e trade_id são obrigatórios.")

    supabase = get_supabase()
    # Busca por .eq (evita .or_ com string — IDs com hífen ex. HYPE-1736 quebram o filtro PostgREST)
    oids: set[str] = set()
    try:
        for col in ("trade_id", "oid"):
            sel = (
                supabase.table("trades_database")
                .select("oid")
                .eq("user_id", user_id)
                .eq(col, group_id)
                .execute()
            )
            for row in sel.data or []:
                oid = row.get("oid")
                if oid is not None and str(oid).strip():
                    oids.add(str(oid).strip())
    except Exception as e:
        logger.error("patch_trade_group lookup: %s", e)
        raise HTTPException(status_code=500, detail="Não foi possível atualizar o histórico.") from e

    if not oids:
        raise HTTPException(status_code=404, detail="Nenhum fill encontrado para este grupo.")

    try:
        r = (
            supabase.table("trades_database")
            .update({"trade_id": new_trade_id, "tf": new_tf})
            .eq("user_id", user_id)
            .in_("oid", list(oids))
            .execute()
        )
    except Exception as e:
        logger.error("patch_trade_group: %s", e)
        raise HTTPException(status_code=500, detail="Não foi possível atualizar o histórico.") from e

    updated = len(r.data or [])
    if updated == 0:
        raise HTTPException(status_code=404, detail="Nenhum fill encontrado para este grupo.")

    # Se houver posição ativa no tracker com o mesmo trade_id antigo, alinha tf/id
    try:
        tr = supabase.table("bot_tracker").select("symbol, data").eq("user_id", user_id).execute()
        for row in tr.data or []:
            data = row.get("data") or {}
            if not isinstance(data, dict):
                continue
            cur_tid = str(data.get("trade_id") or "")
            if cur_tid != group_id:
                continue
            sym = row.get("symbol")
            if not sym:
                continue
            data = {**data, "trade_id": new_trade_id, "tf": new_tf}
            supabase.table("bot_tracker").upsert(
                {"user_id": user_id, "symbol": sym, "data": data},
                on_conflict="user_id,symbol",
            ).execute()
    except Exception as e:
        logger.warning("patch_trade_group tracker sync: %s", e)

    return {"updated": updated, "trade_id": new_trade_id, "tf": new_tf}


@router.get("/overview")
def get_overview(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    """
    Retorna dados para o dashboard de visão geral:
    balance, trades, open_positions, pending_positions, logs.
    """
    wallet = _get_wallet_address(user_id)
    balance = _fetch_hyperliquid_balance(wallet) if wallet else 0.0
    trades = _fetch_trades(user_id)
    tracker = _fetch_tracker(user_id)
    logs = _fetch_logs()

    # Posições ativas: tracker com posição aberta na Hyperliquid
    # Posições pendentes: tracker sem posição (ordem limit aguardando ou setup). Quando o trade
    # encerra, o bot faz entry_tracker.pop() e save — o SupabaseStorage agora remove do banco.
    active_positions: list[dict] = []
    pending_positions: list[dict] = []
    supabase = get_supabase()
    if wallet:
        try:
            resp = requests.post(HYPERLIQUID_API, json={"type": "clearinghouseState", "user": wallet}, timeout=10)
            if resp.ok:
                data = resp.json()
                hl_positions_map = {}
                for p in data.get("assetPositions", []):
                    pos = p.get("position", {})
                    szi = float(pos.get("szi", 0))
                    if szi != 0:
                        coin = pos.get("coin", "")
                        hl_positions_map[coin] = {
                            "szi": szi,
                            "unrealizedPnl": float(pos.get("unrealizedPnl", 0) or 0),
                            "entryPx": float(pos.get("entryPx", 0) or 0),
                        }
                orders_ok, hl_entry_by_coin = _fetch_hl_open_entry_orders(wallet)
                hl_entry_open = set(hl_entry_by_coin.keys())
                for t in tracker:
                    raw_sym = (t.get("symbol") or "").strip()
                    sym_u = raw_sym.upper()
                    if not sym_u:
                        continue
                    hlp = None
                    if raw_sym in hl_positions_map:
                        hlp = hl_positions_map[raw_sym]
                    else:
                        for k, v in hl_positions_map.items():
                            if (k or "").upper() == sym_u:
                                hlp = v
                                break
                    if hlp is not None:
                        t["status"] = "ativa"
                        t["size"] = abs(hlp["szi"])
                        t["unrealized_pnl"] = round(hlp["unrealizedPnl"], 2)
                        active_positions.append(t)
                        continue
                    # Sem posição na HL: só mostra pendente se ainda existir ordem de entrada aberta.
                    # Cancelar na UI da HL remove a ordem mas não apaga bot_tracker — limpamos órfãos aqui.
                    if orders_ok and sym_u not in hl_entry_open:
                        placed_at = float(t.get("placed_at") or 0)
                        if placed_at > 0 and (time.time() - placed_at) < 120:
                            t["status"] = "pendente"
                            pending_positions.append(t)
                            continue
                        try:
                            supabase.table("bot_tracker").delete().eq("user_id", user_id).eq("symbol", raw_sym).execute()
                            logger.info(
                                "bot_tracker órfão removido: user=%s… %s (sem ordem de entrada na HL)",
                                user_id[:8],
                                raw_sym,
                            )
                        except Exception as ex:
                            logger.warning("Falha ao remover bot_tracker órfão %s: %s", raw_sym, ex)
                        continue
                    t["status"] = "pendente"
                    pending_positions.append(t)
                if orders_ok:
                    pending_syms = {(p.get("symbol") or "").upper() for p in pending_positions}
                    active_syms = {(p.get("symbol") or "").upper() for p in active_positions}
                    for sym_u, sym_orders in hl_entry_by_coin.items():
                        if sym_u in pending_syms or sym_u in active_syms:
                            continue
                        o = sym_orders[0]
                        limit_px = float(o.get("limitPx") or 0)
                        sz = float(o.get("sz") or o.get("origSz") or 0)
                        side_raw = o.get("side", "B")
                        side = "LONG" if side_raw == "B" else "SHORT"
                        usd_val = round(sz * limit_px, 0) if limit_px and sz else 0
                        pending_positions.append({
                            "symbol": sym_u,
                            "tf": "-",
                            "side": side[:5],
                            "entry_px": limit_px,
                            "usd_val": usd_val,
                            "planned_stop": 0.0,
                            "placed_at": float(o.get("timestamp") or 0) / 1000.0,
                            "status": "pendente",
                        })
            else:
                for t in tracker:
                    t["status"] = "pendente"
                    pending_positions.append(t)
        except Exception as e:
            logger.warning(f"Erro ao buscar clearinghouseState: {e}")
            for t in tracker:
                t["status"] = "pendente"
                pending_positions.append(t)
    else:
        for t in tracker:
            t["status"] = "pendente"
            pending_positions.append(t)

    blocked = []
    try:
        bt = supabase.table("blocked_trades").select(
            "id, symbol, tf, side, entry_px, stop_real, qty, reason, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()
        if bt.data:
            for row in bt.data:
                blocked.append({
                    "id": str(row.get("id", "")),
                    "symbol": row.get("symbol", ""),
                    "tf": row.get("tf", "-"),
                    "side": row.get("side", ""),
                    "entry_px": float(row.get("entry_px", 0)),
                    "stop_real": float(row.get("stop_real", 0)),
                    "qty": float(row.get("qty", 0)),
                    "reason": row.get("reason", ""),
                    "created_at": row.get("created_at"),
                })
    except Exception as e:
        logger.warning(f"Erro ao buscar blocked_trades: {e}")

    sub_tier = "basic"
    try:
        ur = supabase.table("users").select("subscription_tier").eq("id", user_id).limit(1).execute()
        if ur.data:
            sub_tier = (ur.data[0].get("subscription_tier") or "basic").lower()
    except Exception:
        pass

    return {
        "balance": balance,
        "trades": trades,
        "open_positions": active_positions,
        "pending_positions": pending_positions,
        "blocked_trades": blocked,
        "logs": logs,
        "subscription_tier": sub_tier,
    }


def _get_sz_decimals(meta: dict, coin: str) -> int:
    for u in (meta.get("universe") or []):
        if u.get("name") == coin:
            return int(u.get("szDecimals", 2))
    return 2


@router.post("/close-position")
def close_position(
    body: ClosePositionBody,
    user_id: str = Depends(get_current_user_id),
):
    """
    Fecha posição (total ou parcial) via ordem a mercado na Hyperliquid.
    Requer carteira conectada com API Wallet (agent).
    """
    supabase = get_supabase()
    r = supabase.table("trading_accounts").select(
        "wallet_address, encrypted_private_key, encryption_salt, network"
    ).eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(status_code=400, detail="Conecte a carteira antes de fechar posições.")

    row = r.data[0]
    wallet = row.get("wallet_address")
    enc_key = row.get("encrypted_private_key")
    salt = row.get("encryption_salt")
    if not enc_key or not salt:
        raise HTTPException(status_code=400, detail="Chave da carteira não encontrada. Reconecte a carteira.")

    # Descriptografa
    _root = Path(__file__).resolve().parent.parent.parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from auth.encryption import EncryptionManager
    key = (get_settings().encryption_master_key or "").strip().strip("[]")
    if not key:
        raise HTTPException(status_code=500, detail="Servidor não configurado.")
    enc = EncryptionManager(master_key=key)
    try:
        private_key = enc.decrypt_private_key(enc_key, salt, user_id)
    except Exception as e:
        logger.exception("Erro ao descriptografar chave")
        raise HTTPException(status_code=500, detail="Erro ao acessar carteira.")

    symbol = body.symbol.strip().upper()
    pct = body.pct / 100.0

    # Busca posição atual
    try:
        resp = requests.post(
            HYPERLIQUID_API,
            json={"type": "clearinghouseState", "user": wallet},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        logger.warning(f"Erro Hyperliquid clearinghouseState: {e}")
        raise HTTPException(status_code=502, detail="Não foi possível consultar posições.")

    szi = None
    for p in data.get("assetPositions", []):
        pos = p.get("position", {})
        if (pos.get("coin") or "").upper() == symbol:
            szi = float(pos.get("szi", 0))
            break

    if szi is None or abs(szi) < 1e-8:
        raise HTTPException(status_code=400, detail=f"Sem posição aberta em {symbol}.")

    size_to_close = abs(szi) * pct
    if size_to_close < 1e-8:
        raise HTTPException(status_code=400, detail="Tamanho a fechar muito pequeno.")

    # Meta para sz decimals
    try:
        meta_resp = requests.post(HYPERLIQUID_API, json={"type": "meta"}, timeout=10)
        meta_resp.raise_for_status()
        meta = meta_resp.json()
    except Exception:
        meta = {}
    sz_dec = _get_sz_decimals(meta, symbol)
    size_to_close = round(size_to_close, sz_dec)
    if size_to_close <= 0:
        raise HTTPException(status_code=400, detail="Tamanho arredondado inválido.")

    # Exchange e market_close
    from hyperliquid.exchange import Exchange
    from hyperliquid.utils import constants
    is_mainnet = (row.get("network") or "mainnet") == "mainnet"
    base_url = constants.MAINNET_API_URL if is_mainnet else constants.TESTNET_API_URL
    account = Account.from_key(private_key)
    exchange = Exchange(account, base_url, account_address=wallet)

    try:
        result = exchange.market_close(symbol, sz=size_to_close, px=None, slippage=0.01)
    except Exception as e:
        logger.exception(f"Erro market_close {symbol}: {e}")
        raise HTTPException(status_code=502, detail=f"Erro ao fechar posição: {str(e)}")

    statuses = (result.get("response") or {}).get("data") or {}
    statuses = statuses.get("statuses") or []
    for st in statuses:
        if st.get("error"):
            raise HTTPException(status_code=400, detail=f"Hyperliquid: {st['error']}")

    filled = None
    for st in statuses:
        if "filled" in st:
            filled = st["filled"]
            break

    return {
        "success": True,
        "message": f"Posição {symbol} fechada ({body.pct:.0f}%).",
        "filled": filled,
    }


@router.post("/cancel-pending-position")
def cancel_pending_position(
    body: CancelPendingPositionBody,
    user_id: str = Depends(get_current_user_id),
):
    """
    Cancela ordens pendentes de entrada do símbolo e remove do bot_tracker.
    """
    supabase = get_supabase()
    r = supabase.table("trading_accounts").select(
        "wallet_address, encrypted_private_key, encryption_salt, network"
    ).eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(status_code=400, detail="Conecte a carteira antes de cancelar pendências.")

    row = r.data[0]
    wallet = row.get("wallet_address")
    enc_key = row.get("encrypted_private_key")
    salt = row.get("encryption_salt")
    if not enc_key or not salt:
        raise HTTPException(status_code=400, detail="Chave da carteira não encontrada. Reconecte a carteira.")

    symbol = body.symbol.strip().upper()
    tracker = supabase.table("bot_tracker").select("symbol").eq("user_id", user_id).eq("symbol", symbol).limit(1).execute()
    orders_ok, hl_entry_by_coin = _fetch_hl_open_entry_orders(wallet or "")
    has_hl_entry = orders_ok and symbol in hl_entry_by_coin
    if not tracker.data and not has_hl_entry:
        raise HTTPException(status_code=404, detail=f"Nenhum trade pendente encontrado em {symbol}.")

    # Garante que não há posição aberta para esse símbolo.
    try:
        resp = requests.post(
            HYPERLIQUID_API,
            json={"type": "clearinghouseState", "user": wallet},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        logger.warning(f"Erro Hyperliquid clearinghouseState: {e}")
        raise HTTPException(status_code=502, detail="Não foi possível consultar posições.")

    for p in data.get("assetPositions", []):
        pos = p.get("position", {})
        if (pos.get("coin") or "").upper() == symbol and abs(float(pos.get("szi", 0) or 0)) > 1e-8:
            raise HTTPException(status_code=400, detail=f"{symbol} já está com posição ativa. Use Fechar posição.")

    # Descriptografa chave para assinar cancelamentos na exchange.
    _root = Path(__file__).resolve().parent.parent.parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from auth.encryption import EncryptionManager
    key = (get_settings().encryption_master_key or "").strip().strip("[]")
    if not key:
        raise HTTPException(status_code=500, detail="Servidor não configurado.")
    enc = EncryptionManager(master_key=key)
    try:
        private_key = enc.decrypt_private_key(enc_key, salt, user_id)
    except Exception:
        logger.exception("Erro ao descriptografar chave")
        raise HTTPException(status_code=500, detail="Erro ao acessar carteira.")

    from hyperliquid.exchange import Exchange
    from hyperliquid.utils import constants
    is_mainnet = (row.get("network") or "mainnet") == "mainnet"
    base_url = constants.MAINNET_API_URL if is_mainnet else constants.TESTNET_API_URL
    account = Account.from_key(private_key)
    exchange = Exchange(account, base_url, account_address=wallet)

    # Cancela somente ordens de entrada (reduceOnly=False) do símbolo.
    cancelled = 0
    orders = hl_entry_by_coin.get(symbol, []) if has_hl_entry else []
    if not orders:
        try:
            ord_resp = requests.post(
                HYPERLIQUID_API,
                json={"type": "frontendOpenOrders", "user": wallet},
                timeout=10,
            )
            ord_resp.raise_for_status()
            orders = [
                o for o in (ord_resp.json() or [])
                if (o.get("coin") or "").upper() == symbol and not bool(o.get("reduceOnly"))
            ]
        except requests.RequestException as e:
            logger.warning(f"Erro Hyperliquid frontendOpenOrders: {e}")
            raise HTTPException(status_code=502, detail="Não foi possível consultar ordens abertas.")

    for order in orders:
        oid = order.get("oid")
        if oid is None:
            continue
        try:
            exchange.cancel(symbol, oid)
            cancelled += 1
        except Exception as e:
            logger.error(f"Erro ao cancelar ordem {symbol} oid={oid}: {e}")

    supabase.table("bot_tracker").delete().eq("user_id", user_id).eq("symbol", symbol).execute()

    return {
        "success": True,
        "message": f"Pendência em {symbol} cancelada.",
        "cancelled_orders": cancelled,
    }


@router.get("/blocked-trades")
def get_blocked_trades(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    """Lista trades bloqueados (não acionados) do usuário."""
    supabase = get_supabase()
    r = supabase.table("blocked_trades").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    if not r.data:
        return {"blocked_trades": []}
    out = []
    for row in r.data:
        out.append({
            "id": str(row.get("id", "")),
            "symbol": row.get("symbol", ""),
            "tf": row.get("tf", "-"),
            "side": row.get("side", ""),
            "entry_px": float(row.get("entry_px", 0)),
            "stop_real": float(row.get("stop_real", 0)),
            "qty": float(row.get("qty", 0)),
            "reason": row.get("reason", ""),
            "created_at": row.get("created_at"),
        })
    return {"blocked_trades": out}


@router.post("/remove-blocked-trade")
def remove_blocked_trade(
    body: RemoveBlockedTradeBody,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Remove um trade bloqueado (apenas da lista de bloqueados)."""
    supabase = get_supabase()
    r = supabase.table("blocked_trades").select("id").eq("id", body.id).eq("user_id", user_id).limit(1).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Trade bloqueado não encontrado.")
    supabase.table("blocked_trades").delete().eq("id", body.id).eq("user_id", user_id).execute()
    return {"success": True, "message": "Trade bloqueado removido."}


@router.post("/execute-blocked-trade")
def execute_blocked_trade(
    body: ExecuteBlockedTradeBody,
    user_id: str = Depends(get_current_user_id),
):
    """Aciona manualmente um trade bloqueado: coloca ordem limit e adiciona ao bot_tracker."""
    supabase = get_supabase()
    r = supabase.table("blocked_trades").select("*").eq("id", body.id).eq("user_id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        logger.warning(f"execute-blocked-trade: trade id={body.id} user={user_id} não encontrado")
        raise HTTPException(
            status_code=404,
            detail="Trade bloqueado não encontrado ou já acionado. Se o preço atingiu TP1 ou o stop, o trade foi expirado automaticamente."
        )

    row = r.data[0]
    symbol = (row.get("symbol") or "").strip().upper()
    side = (row.get("side") or "long").lower()
    tf = row.get("tf") or "-"
    entry_px = float(row.get("entry_px", 0))
    stop_real = float(row.get("stop_real", 0))
    qty = float(row.get("qty", 0))
    signal_ts = int(row.get("signal_ts", 0))
    tech_base = float(row.get("tech_base", 0) or 0)
    setup_high = float(row.get("setup_high", 0) or 0)
    setup_low = float(row.get("setup_low", 0) or 0)

    if not symbol or entry_px <= 0 or qty <= 0:
        raise HTTPException(status_code=400, detail="Dados do trade inválidos.")

    ur_tier = supabase.table("users").select("subscription_tier").eq("id", user_id).limit(1).execute()
    tier = (ur_tier.data[0].get("subscription_tier") or "basic").lower() if ur_tier.data else "basic"
    if tier == "basic":
        raise HTTPException(
            status_code=403,
            detail="No plano Basic (apenas Modo Sinal) não é possível acionar trades pela plataforma. Faça upgrade ao Pro para usar esta função.",
        )

    # Busca conta e chave
    acc = supabase.table("trading_accounts").select(
        "wallet_address, encrypted_private_key, encryption_salt, network"
    ).eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if not acc.data or len(acc.data) == 0:
        raise HTTPException(status_code=400, detail="Conecte a carteira antes de acionar trades.")

    acc_row = acc.data[0]
    wallet = acc_row.get("wallet_address")
    enc_key = acc_row.get("encrypted_private_key")
    salt = acc_row.get("encryption_salt")
    if not enc_key or not salt:
        raise HTTPException(status_code=400, detail="Chave da carteira não encontrada. Reconecte a carteira.")

    _root = Path(__file__).resolve().parent.parent.parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from auth.encryption import EncryptionManager
    key = (get_settings().encryption_master_key or "").strip().strip("[]")
    if not key:
        raise HTTPException(status_code=500, detail="Servidor não configurado.")
    enc = EncryptionManager(master_key=key)
    try:
        private_key = enc.decrypt_private_key(enc_key, salt, user_id)
    except Exception:
        logger.exception("Erro ao descriptografar chave")
        raise HTTPException(status_code=500, detail="Erro ao acessar carteira.")

    cfg = supabase.table("bot_config").select("strategy_preset").eq("user_id", user_id).limit(1).execute()
    strategy_preset = ""
    if cfg.data and len(cfg.data) > 0:
        strategy_preset = str(cfg.data[0].get("strategy_preset") or "").strip()

    from hyperliquid.exchange import Exchange
    from hyperliquid.utils import constants
    import time
    is_mainnet = (acc_row.get("network") or "mainnet") == "mainnet"
    base_url = constants.MAINNET_API_URL if is_mainnet else constants.TESTNET_API_URL
    account = Account.from_key(private_key)
    exchange = Exchange(account, base_url, account_address=wallet)

    # Gera trade_id antes de enviar a ordem, para assinar via clientOrderId (evita ser tratado como manual)
    trade_id = f"{symbol}-{int(time.time())}"
    client_oid = f"{trade_id}_{int(time.time()*1000)}".replace(" ", "_").replace("-", "_")

    # round price for exchange
    entry_px_rounded = round(entry_px, 5)
    is_buy = side == "long"
    try:
        res = exchange.order(
            symbol,
            is_buy,
            qty,
            entry_px_rounded,
            {"limit": {"tif": "Gtc"}, "clientOrderId": client_oid},
            reduce_only=False,
        )
    except Exception as e:
        logger.exception(f"Erro order execute-blocked-trade {symbol}: {e}")
        raise HTTPException(status_code=502, detail=f"Erro ao colocar ordem: {str(e)}")

    statuses = (res.get("response") or {}).get("data") or {}
    statuses = statuses.get("statuses") or []
    for st in statuses:
        if st.get("error"):
            raise HTTPException(status_code=400, detail=f"Hyperliquid: {st['error']}")

    tracker_data = {
        "side": side,
        "tf": tf,
        "placed_at": time.time(),
        "signal_ts": signal_ts / 1000.0,
        "planned_stop": stop_real,
        "tech_base": tech_base,
        "setup_high": setup_high,
        "setup_low": setup_low,
        "entry_px": entry_px,
        "qty": qty,
        "qty_entry_1": qty,
        "trade_id": trade_id,
        "pnl_realized": 0.0,
        "last_size": 0.0,
        "strategy_preset": strategy_preset,
    }

    supabase.table("bot_tracker").upsert({
        "user_id": user_id,
        "symbol": symbol,
        "data": tracker_data,
    }, on_conflict="user_id,symbol").execute()

    if signal_ts > 0:
        hist = supabase.table("bot_history").select("symbol, timeframe, last_signal_ts").eq("user_id", user_id).execute()
        hist_map = {}
        if hist.data:
            for h in hist.data:
                s, t = h.get("symbol"), h.get("timeframe")
                if s and t:
                    hist_map[f"{s}_{t}"] = h.get("last_signal_ts", 0)
        key = f"{symbol}_{tf}"
        if signal_ts > hist_map.get(key, 0):
            supabase.table("bot_history").upsert({
                "user_id": user_id,
                "symbol": symbol,
                "timeframe": tf,
                "last_signal_ts": signal_ts,
            }, on_conflict="user_id,symbol,timeframe").execute()

    supabase.table("blocked_trades").delete().eq("id", body.id).eq("user_id", user_id).execute()

    return {"success": True, "message": f"Trade {symbol} acionado. Ordem limit colocada na entrada."}
