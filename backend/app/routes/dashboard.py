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


class ExecuteBlockedTradeBody(BaseModel):
    id: str = Field(..., description="UUID do trade bloqueado")


class CancelPendingPositionBody(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)


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
    r = supabase.table("trades_database").select("trade_id, symbol, side, tf, oid, raw, pnl_usd, closed_at, account_value_at_trade").eq("user_id", user_id).order("closed_at", desc=False).execute()
    if not r.data:
        return []
    min_ts_ms = _get_user_created_at_ms(user_id)
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

        # Filtra: apenas trades após criação da conta no Zeedo
        if min_ts_ms is not None and ts > 0 and ts < min_ts_ms:
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
            "token": row.get("symbol", raw.get("coin", "?")),
            "side": row.get("side", "?"),
            "tf": row.get("tf", "-"),
            "pnl_usd": pnl_usd,
            "pnl_pct": pnl_pct,
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

    blocked = []
    try:
        supabase = get_supabase()
        bt = supabase.table("blocked_trades").select("id, symbol, tf, side, entry_px, entry2_px, stop_real, qty, reason, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        if bt.data:
            for row in bt.data:
                blocked.append({
                    "id": str(row.get("id", "")),
                    "symbol": row.get("symbol", ""),
                    "tf": row.get("tf", "-"),
                    "side": row.get("side", ""),
                    "entry_px": float(row.get("entry_px", 0)),
                    "entry2_px": float(row.get("entry2_px", 0)),
                    "stop_real": float(row.get("stop_real", 0)),
                    "qty": float(row.get("qty", 0)),
                    "reason": row.get("reason", ""),
                    "created_at": row.get("created_at"),
                })
    except Exception as e:
        logger.warning(f"Erro ao buscar blocked_trades: {e}")

    return {
        "balance": balance,
        "trades": trades,
        "open_positions": active_positions,
        "pending_positions": pending_positions,
        "blocked_trades": blocked,
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
    if not tracker.data:
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
    try:
        ord_resp = requests.post(
            HYPERLIQUID_API,
            json={"type": "openOrders", "user": wallet},
            timeout=10,
        )
        ord_resp.raise_for_status()
        orders = ord_resp.json() or []
    except requests.RequestException as e:
        logger.warning(f"Erro Hyperliquid openOrders: {e}")
        raise HTTPException(status_code=502, detail="Não foi possível consultar ordens abertas.")

    for order in orders:
        coin = (order.get("coin") or "").upper()
        if coin != symbol:
            continue
        if bool(order.get("reduceOnly")):
            continue
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
            "entry2_px": float(row.get("entry2_px", 0)),
            "stop_real": float(row.get("stop_real", 0)),
            "qty": float(row.get("qty", 0)),
            "reason": row.get("reason", ""),
            "created_at": row.get("created_at"),
        })
    return {"blocked_trades": out}


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
    entry2_px = float(row.get("entry2_px", 0))
    stop_real = float(row.get("stop_real", 0))
    qty = float(row.get("qty", 0))
    signal_ts = int(row.get("signal_ts", 0))
    tech_base = float(row.get("tech_base", 0) or 0)
    setup_high = float(row.get("setup_high", 0) or 0)
    setup_low = float(row.get("setup_low", 0) or 0)

    if not symbol or entry_px <= 0 or qty <= 0:
        raise HTTPException(status_code=400, detail="Dados do trade inválidos.")

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

    # Entry2: busca config
    cfg = supabase.table("bot_config").select("entry2_enabled").eq("user_id", user_id).limit(1).execute()
    entry2_enabled = True
    if cfg.data and len(cfg.data) > 0:
        entry2_enabled = bool(cfg.data[0].get("entry2_enabled", True))

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

    second_qty = qty if entry2_enabled else 0
    qty_entry_1 = qty
    qty_entry_2 = qty + second_qty

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
        "qty_entry_1": qty_entry_1,
        "qty_entry_2": qty_entry_2,
        "trade_id": trade_id,
        "pnl_realized": 0.0,
        "last_size": 0.0,
    }
    if entry2_enabled:
        tracker_data["entry2_px"] = entry2_px
        tracker_data["entry2_qty"] = second_qty
        tracker_data["entry2_placed"] = False
    else:
        tracker_data["entry2_placed"] = True

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

    return {"success": True, "message": f"Trade {symbol} acionado. Ordem limit colocada na entrada 1."}
