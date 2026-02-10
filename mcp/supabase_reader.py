"""
Leitura somente-leitura do Supabase usando tabelas normalizadas.
Compartilhado entre MCP (tools) e script de validação.
Usa variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY/SUPABASE_KEY.
"""
import os
from typing import Any, Dict, List, Optional

# Tabelas normalizadas
TABLE_TRACKER = "bot_tracker"
TABLE_HISTORY = "bot_history"
TABLE_TRADES = "trades_database"
TABLE_CONFIG = "bot_config"

_client = None

def get_client():
    """Inicializa cliente Supabase usando variáveis de ambiente."""
    global _client
    if _client is not None:
        return _client
    try:
        from supabase import create_client
    except ImportError:
        raise RuntimeError("supabase-py não está instalado. Execute: pip install supabase")
    url = os.environ.get("SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    if not url or not key:
        raise RuntimeError(
            "Configure SUPABASE_URL e SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY/SUPABASE_KEY no .env"
        )
    _client = create_client(url, key)
    return _client

def get_bot_state_keys() -> Dict[str, Any]:
    """Lista todas as tabelas e seus registros."""
    try:
        client = get_client()
        tracker_count = len(client.table(TABLE_TRACKER).select("symbol").execute().data or [])
        history_count = len(client.table(TABLE_HISTORY).select("symbol").execute().data or [])
        trades_count = len(client.table(TABLE_TRADES).select("id").execute().data or [])
        config_count = len(client.table(TABLE_CONFIG).select("id").execute().data or [])
        return {
            "tables": {
                TABLE_TRACKER: tracker_count,
                TABLE_HISTORY: history_count,
                TABLE_TRADES: trades_count,
                TABLE_CONFIG: config_count,
            },
            "total_records": tracker_count + history_count + trades_count + config_count,
        }
    except Exception as e:
        return {"error": str(e)}

def get_entry_tracker(symbol: Optional[str] = None) -> Dict[str, Any]:
    """Consulta entry_tracker de bot_tracker. Se symbol for passado, retorna só esse símbolo."""
    try:
        client = get_client()
        if symbol is not None:
            result = client.table(TABLE_TRACKER).select("symbol, data").eq("symbol", symbol).limit(1).execute()
            if not result.data:
                return {"symbol": symbol, "data": None, "exists": False}
            return {
                "symbol": symbol,
                "data": result.data[0].get("data"),
                "exists": True,
            }
        
        result = client.table(TABLE_TRACKER).select("symbol, data").execute()
        if not result.data:
            return {"entry_tracker": {}, "symbols": [], "count": 0}
        
        entry_tracker = {}
        for row in result.data:
            sym = row.get("symbol")
            data = row.get("data")
            if sym and data:
                entry_tracker[sym] = data
        
        symbols = list(entry_tracker.keys())
        expected_fields = [
            "side", "tf", "placed_at", "signal_ts", "planned_stop",
            "entry2_px", "entry2_qty", "entry2_placed", "tech_base", "setup_high",
            "setup_low", "entry_px", "qty", "trade_id", "pnl_realized", "last_size",
            "qty_entry_1", "qty_entry_2", "qty_entry_3", "third_entry_placed", "third_entry_px",
            "reentry_candle_ts", "setup_break_candle_ts", "breakeven_moved", "origin",
        ]
        validation = {}
        for sym in symbols:
            sym_data = entry_tracker[sym]
            missing = [f for f in expected_fields if f not in sym_data]
            validation[sym] = {
                "has_all_fields": len(missing) == 0,
                "missing_fields": missing,
                "pnl_realized": sym_data.get("pnl_realized", 0.0),
                "side": sym_data.get("side"),
                "tf": sym_data.get("tf"),
            }
        return {
            "entry_tracker": entry_tracker,
            "symbols": symbols,
            "count": len(symbols),
            "validation": validation,
        }
    except Exception as e:
        return {"error": str(e)}

def get_history_tracker() -> Dict[str, Any]:
    """Consulta history_tracker de bot_history."""
    try:
        client = get_client()
        result = client.table(TABLE_HISTORY).select("symbol, timeframe, last_signal_ts").execute()
        if not result.data:
            return {"history_tracker": {}, "symbols": [], "count": 0}
        
        history_tracker = {}
        for row in result.data:
            symbol = row.get("symbol")
            timeframe = row.get("timeframe")
            timestamp = row.get("last_signal_ts")
            if symbol and timeframe:
                if symbol not in history_tracker:
                    history_tracker[symbol] = {}
                history_tracker[symbol][timeframe] = timestamp
        
        symbols = list(history_tracker.keys())
        return {"history_tracker": history_tracker, "symbols": symbols, "count": len(symbols)}
    except Exception as e:
        return {"error": str(e)}

def get_trades_db(limit: int = 1000, symbol: Optional[str] = None) -> Dict[str, Any]:
    """Consulta trades_db de trades_database com validação de campos."""
    try:
        client = get_client()
        query = client.table(TABLE_TRADES).select("*").order("closed_at", desc=False)
        if symbol is not None:
            query = query.eq("symbol", symbol)
        if limit > 0:
            query = query.limit(limit)
        result = query.execute()
        
        if not result.data:
            return {"trades_db": [], "count": 0, "validation": {}}
        
        trades_db = []
        for row in result.data:
            # Monta objeto no formato esperado (compatível com código)
            trade = {
                "coin": row.get("symbol"),
                "oid": row.get("oid"),
                "time": row.get("raw", {}).get("time") if isinstance(row.get("raw"), dict) else None,
                "closedPnl": row.get("raw", {}).get("closedPnl") if isinstance(row.get("raw"), dict) else None,
                "pnl": row.get("raw", {}).get("pnl") if isinstance(row.get("raw"), dict) else None,
                "fee": row.get("raw", {}).get("fee") if isinstance(row.get("raw"), dict) else None,
                "pnl_usd": float(row.get("pnl_usd", 0)) if row.get("pnl_usd") is not None else 0.0,
                "side": row.get("side"),
                "tf": row.get("tf"),
                "trade_id": row.get("trade_id"),
                "num_fills": row.get("num_fills", 1),
                "dir": row.get("raw", {}).get("dir") if isinstance(row.get("raw"), dict) else None,
            }
            # Inclui todos os campos do raw JSONB
            if isinstance(row.get("raw"), dict):
                trade.update(row["raw"])
            trades_db.append(trade)
        
        expected_fields = [
            "coin", "oid", "time", "closedPnl", "pnl", "fee", "pnl_usd",
            "side", "tf", "trade_id", "num_fills", "dir",
        ]
        validation = {"total_trades": len(trades_db), "fields_analysis": {}, "issues": []}
        for field in expected_fields:
            present_count = sum(1 for t in trades_db if field in t)
            validation["fields_analysis"][field] = {
                "present_in": present_count,
                "missing_in": len(trades_db) - present_count,
                "percentage": (present_count / len(trades_db) * 100) if trades_db else 0,
            }
        for i, trade in enumerate(trades_db):
            issues = []
            if not trade.get("coin") and not trade.get("symbol") and not trade.get("market"):
                issues.append("missing_symbol_field")
            if "closedPnl" not in trade and "pnl" not in trade:
                issues.append("missing_pnl_field")
            if "fee" not in trade:
                issues.append("missing_fee_field")
            pnl_val = trade.get("closedPnl") or trade.get("pnl") or 0
            if not isinstance(pnl_val, (int, float)):
                issues.append("pnl_not_numeric")
            fee_val = trade.get("fee", 0)
            if not isinstance(fee_val, (int, float)):
                issues.append("fee_not_numeric")
            if issues:
                validation["issues"].append({
                    "index": i,
                    "oid": trade.get("oid", "unknown"),
                    "coin": trade.get("coin", trade.get("symbol", "unknown")),
                    "issues": issues,
                })
        return {"trades_db": trades_db, "count": len(trades_db), "validation": validation}
    except Exception as e:
        return {"error": str(e)}

def get_config() -> Dict[str, Any]:
    """Consulta config de bot_config."""
    try:
        client = get_client()
        result = client.table(TABLE_CONFIG).select("symbols, timeframes, trade_mode").limit(1).execute()
        if not result.data:
            return {"config": {}, "exists": False}
        row = result.data[0]
        config = {
            "symbols": row.get("symbols") or [],
            "timeframes": row.get("timeframes") or [],
            "trade_mode": row.get("trade_mode") or "BOTH"
        }
        return {
            "config": config,
            "exists": True,
            "has_symbols": bool(config.get("symbols")),
            "has_timeframes": bool(config.get("timeframes")),
            "has_trade_mode": bool(config.get("trade_mode")),
        }
    except Exception as e:
        return {"error": str(e)}

def validate_pnl_calculation(symbol: Optional[str] = None) -> Dict[str, Any]:
    """Validação cruzada de PnL entre entry_tracker e trades_db."""
    try:
        entry_result = get_entry_tracker(symbol)
        trades_result = get_trades_db(limit=1000, symbol=symbol)
        if "error" in entry_result or "error" in trades_result:
            return {
                "error": "Erro ao buscar dados",
                "entry_error": entry_result.get("error"),
                "trades_error": trades_result.get("error"),
            }
        entry_tracker = entry_result.get("entry_tracker", {})
        trades_db = trades_result.get("trades_db", [])
        validation_report = {"symbols_checked": [], "discrepancies": []}
        symbols_to_check = [symbol] if symbol is not None else list(entry_tracker.keys())
        for sym in symbols_to_check:
            if sym not in entry_tracker:
                continue
            entry_data = entry_tracker[sym]
            expected_pnl = entry_data.get("pnl_realized", 0.0)
            symbol_trades = [t for t in trades_db if t.get("coin") == sym or t.get("symbol") == sym]
            calculated_pnl = 0.0
            for trade in symbol_trades:
                pnl_fill = float(trade.get("closedPnl", 0) or trade.get("pnl", 0) or 0)
                fee = float(trade.get("fee", 0) or 0)
                calculated_pnl += pnl_fill - fee
            discrepancy = abs(expected_pnl - calculated_pnl)
            is_match = discrepancy < 0.01
            validation_report["symbols_checked"].append({
                "symbol": sym,
                "entry_tracker_pnl": expected_pnl,
                "calculated_from_trades": round(calculated_pnl, 6),
                "discrepancy": round(discrepancy, 6),
                "matches": is_match,
                "num_trades": len(symbol_trades),
            })
            if not is_match:
                validation_report["discrepancies"].append({
                    "symbol": sym,
                    "expected": expected_pnl,
                    "calculated": calculated_pnl,
                    "difference": discrepancy,
                })
        return validation_report
    except Exception as e:
        return {"error": str(e)}

def get_schema_info() -> Dict[str, Any]:
    """Retorna schema esperado pelo código."""
    return {
        "tables": {
            TABLE_TRACKER: {
                "structure": {"symbol": "text (primary key)", "data": "jsonb", "updated_at": "timestamptz"},
                "purpose": "Estado atual de cada trade (entry_tracker)",
                "expected_fields_in_data": [
                    "side", "tf", "placed_at", "signal_ts", "planned_stop",
                    "entry2_px", "entry2_qty", "entry2_placed", "tech_base", "setup_high",
                    "setup_low", "entry_px", "qty", "trade_id", "pnl_realized", "last_size",
                    "qty_entry_1", "qty_entry_2", "qty_entry_3", "third_entry_placed", "third_entry_px",
                    "reentry_candle_ts", "setup_break_candle_ts", "breakeven_moved", "origin",
                ],
            },
            TABLE_HISTORY: {
                "structure": {"symbol": "text", "timeframe": "text", "last_signal_ts": "bigint", "PRIMARY KEY": "(symbol, timeframe)"},
                "purpose": "Histórico de sinais por símbolo e timeframe",
            },
            TABLE_TRADES: {
                "structure": {
                    "id": "uuid (primary key)", "trade_id": "text", "symbol": "text",
                    "side": "text", "tf": "text", "oid": "text", "raw": "jsonb",
                    "pnl_usd": "numeric", "num_fills": "integer", "closed_at": "timestamptz",
                },
                "purpose": "Histórico de fills/trades executados",
            },
            TABLE_CONFIG: {
                "structure": {
                    "id": "uuid (primary key)", "symbols": "text[]", "timeframes": "text[]",
                    "trade_mode": "text", "updated_at": "timestamptz",
                },
                "purpose": "Configuração do bot (símbolos, timeframes, modo)",
            },
        },
    }