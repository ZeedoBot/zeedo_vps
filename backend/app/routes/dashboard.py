"""
Endpoint de overview do dashboard: saldo Hyperliquid, trades, posições e logs.
"""
import logging
import sys
from pathlib import Path
from typing import Any

import requests
from eth_account import Account
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.config import get_settings

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)

HYPERLIQUID_API = "https://api.hyperliquid.xyz/info"
HYPERLIQUID_EXCHANGE = "https://api.hyperliquid.xyz/exchange"


class ClosePositionBody(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)
    pct: float = Field(100.0, ge=1.0, le=100.0)


def _get_wallet_address(user_id: str) -> str | None:
    supabase = get_supabase()
    r = supabase.table("trading_accounts").select("wallet_address").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return None
    return r.data[0].get("wallet_address")


def _fetch_hyperliquid_balance(wallet: str) -> float:
    try:
        resp = requests.post(HYPERLIQUID_API, json={"type": "clearinghouseState", "user": wallet}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        margin = data.get("marginSummary", {}) or {}
        val = margin.get("accountValue")
        return float(val) if val is not None else 0.0
    except Exception as e:
        logger.warning(f"Erro ao buscar saldo Hyperliquid: {e}")
        return 0.0


def _fetch_trades(user_id: str) -> list[dict]:
    supabase = get_supabase()
    r = supabase.table("trades_database").select("trade_id, symbol, side, tf, oid, raw, pnl_usd, closed_at").eq("user_id", user_id).order("closed_at", desc=False).execute()
    if not r.data:
        return []
    out = []
    for row in r.data:
        raw = row.get("raw") or {}
        ts = raw.get("time") or 0
        if isinstance(row.get("closed_at"), str) and "T" in row["closed_at"]:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(row["closed_at"].replace("Z", "+00:00"))
                ts = int(dt.timestamp() * 1000)
            except Exception:
                pass
        out.append({
            "trade_id": row.get("trade_id", "-"),
            "oid": row.get("oid", ""),
            "token": row.get("symbol", raw.get("coin", "?")),
            "side": row.get("side", "?"),
            "tf": row.get("tf", "-"),
            "pnl_usd": float(row.get("pnl_usd", 0) or 0),
            "size_usd": float(raw.get("size_usd", 0) or 0),
            "time": ts,
        })
    return out


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
    r = supabase.table("bot_logs").select("level, symbol, timeframe, event, details, created_at").order("created_at", desc=True).limit(limit).execute()
    if not r.data:
        return []
    return [{"level": x.get("level"), "event": x.get("event"), "details": x.get("details"), "created_at": x.get("created_at")} for x in r.data]


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
                for t in tracker:
                    sym = t.get("symbol", "")
                    if sym in hl_positions_map:
                        hlp = hl_positions_map[sym]
                        t["status"] = "ativa"
                        t["size"] = abs(hlp["szi"])
                        t["unrealized_pnl"] = round(hlp["unrealizedPnl"], 2)
                        active_positions.append(t)
                    else:
                        t["status"] = "pendente"
                        pending_positions.append(t)
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

    return {
        "balance": balance,
        "trades": trades,
        "open_positions": active_positions,
        "pending_positions": pending_positions,
        "logs": logs,
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
