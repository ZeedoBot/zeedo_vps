"""
Endpoint de overview do dashboard: saldo Hyperliquid, trades, posições e logs.
"""
import logging
from typing import Any

import requests
from fastapi import APIRouter, Depends

from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)

HYPERLIQUID_API = "https://api.hyperliquid.xyz/info"


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

    # Classifica posições: ativas (no tracker E na Hyperliquid) vs pendentes (só no tracker)
    # Fonte de verdade: bot_tracker. Match com HL para distinguir ativa vs pendente.
    active_positions: list[dict] = []
    pending_positions: list[dict] = []
    if wallet:
        try:
            resp = requests.post(HYPERLIQUID_API, json={"type": "clearinghouseState", "user": wallet}, timeout=10)
            if resp.ok:
                data = resp.json()
                hl_positions = {p["position"]["coin"]: float(p["position"]["szi"]) for p in data.get("assetPositions", []) if float(p["position"]["szi"]) != 0}
                for t in tracker:
                    sym = t.get("symbol", "")
                    if sym in hl_positions:
                        t["status"] = "ativa"
                        t["size"] = abs(hl_positions[sym])
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
