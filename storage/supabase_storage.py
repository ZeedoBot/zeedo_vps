import datetime
import logging
import os
from typing import Any
from .base import StorageBase

# Desabilita logs HTTP das bibliotecas usadas pelo Supabase
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Tabelas normalizadas
TABLE_TRACKER = "bot_tracker"
TABLE_HISTORY = "bot_history"
TABLE_TRADES = "trades_database"
TABLE_CONFIG = "bot_config"

class SupabaseStorage(StorageBase):
    """Persistência no Supabase usando tabelas normalizadas; mesma semântica que LocalStorage."""

    def __init__(self, url: str = None, key: str = None, user_id: str = None):
        self._url = url or os.environ.get("SUPABASE_URL")
        self._key = key or os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")
        self._user_id = user_id  # user_id opcional para multiusuário
        self._client = None
        if self._url and self._key:
            try:
                from supabase import create_client
                self._client = create_client(self._url, self._key)
            except Exception as e:
                logging.error(f"Erro ao criar cliente Supabase: {e}")
                raise
    
    def set_user_id(self, user_id: str):
        """Define user_id para operações multiusuário."""
        self._user_id = user_id

    def get_entry_tracker(self, user_id: str = None) -> dict:
        """Retorna entry_tracker carregando de bot_tracker."""
        if not self._client:
            return {}
        try:
            user_id = user_id or self._user_id
            query = self._client.table(TABLE_TRACKER).select("symbol, data")
            
            # Filtra por user_id se disponível
            if user_id:
                query = query.eq("user_id", user_id)
            
            r = query.execute()
            if not r.data:
                return {}
            # Converte lista de {symbol, data} para dict {symbol: data}
            result = {}
            for row in r.data:
                symbol = row.get("symbol")
                data = row.get("data")
                if symbol and data:
                    result[symbol] = data
            return result
        except Exception as e:
            logging.error(f"Supabase get_entry_tracker: {e}")
            return {}

    def save_entry_tracker(self, data: dict, user_id: str = None) -> None:
        """Salva entry_tracker em bot_tracker (upsert por symbol)."""
        if not self._client or not isinstance(data, dict):
            return
        try:
            user_id = user_id or self._user_id
            # Upsert cada symbol individualmente
            for symbol, symbol_data in data.items():
                if symbol and isinstance(symbol_data, dict):
                    record = {
                        "symbol": symbol,
                        "data": symbol_data
                    }
                    if user_id:
                        record["user_id"] = user_id
                    self._client.table(TABLE_TRACKER).upsert(
                        record,
                        on_conflict="symbol" if not user_id else "user_id,symbol"
                    ).execute()
        except Exception as e:
            logging.error(f"Supabase save_entry_tracker: {e}")

    def get_history_tracker(self, user_id: str = None) -> dict:
        """Retorna history_tracker carregando de bot_history."""
        if not self._client:
            return {}
        try:
            user_id = user_id or self._user_id
            query = self._client.table(TABLE_HISTORY).select("symbol, timeframe, last_signal_ts")
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            r = query.execute()
            if not r.data:
                return {}
            # Converte lista para dict {symbol: {timeframe: timestamp}}
            result = {}
            for row in r.data:
                symbol = row.get("symbol")
                timeframe = row.get("timeframe")
                timestamp = row.get("last_signal_ts")
                if symbol and timeframe:
                    if symbol not in result:
                        result[symbol] = {}
                    result[symbol][timeframe] = timestamp
            return result
        except Exception as e:
            logging.error(f"Supabase get_history_tracker: {e}")
            return {}

    def save_history_tracker(self, data: dict, user_id: str = None) -> None:
        """Salva history_tracker em bot_history (upsert por symbol+timeframe)."""
        if not self._client or not isinstance(data, dict):
            return
        try:
            user_id = user_id or self._user_id
            # Upsert cada combinação symbol+timeframe
            for symbol, timeframes in data.items():
                if symbol and isinstance(timeframes, dict):
                    for timeframe, timestamp in timeframes.items():
                        if timeframe:
                            record = {
                                "symbol": symbol,
                                "timeframe": timeframe,
                                "last_signal_ts": timestamp
                            }
                            if user_id:
                                record["user_id"] = user_id
                            self._client.table(TABLE_HISTORY).upsert(
                                record,
                                on_conflict="symbol,timeframe" if not user_id else "user_id,symbol,timeframe"
                            ).execute()
        except Exception as e:
            logging.error(f"Supabase save_history_tracker: {e}")

    def get_trades_db(self, user_id: str = None) -> list:
        """Retorna trades_db carregando de trades_database."""
        if not self._client:
            return []
        try:
            user_id = user_id or self._user_id
            # Ordena por closed_at DESC para manter ordem cronológica
            query = self._client.table(TABLE_TRADES).select("*").order("closed_at", desc=False)
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            r = query.execute()
            if not r.data:
                return []
            # Converte registros da tabela para formato esperado pelo código
            result = []
            for row in r.data:
                # Monta objeto no formato esperado (compatível com sync_trade_history)
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
                result.append(trade)
            return result
        except Exception as e:
            logging.error(f"Supabase get_trades_db: {e}")
            return []

    def save_trades_db(self, data: list, user_id: str = None) -> None:
        """Salva novos trades em trades_database (apenas novos, não sobrescreve)."""
        if not self._client or not isinstance(data, list):
            return
        try:
            user_id = user_id or self._user_id
            # Busca OIDs já processados (filtrado por user_id se disponível)
            query = self._client.table(TABLE_TRADES).select("oid")
            if user_id:
                query = query.eq("user_id", user_id)
            existing_r = query.execute()
            existing_oids = {str(row.get("oid")) for row in (existing_r.data or []) if row.get("oid")}
            
            # Insere apenas trades novos
            new_trades = []
            for trade in data:
                oid = str(trade.get("oid") or "")
                if oid and oid not in existing_oids:
                    # Calcula closed_at a partir do timestamp do trade
                    trade_time = trade.get("time") or trade.get("t") or trade.get("timestamp")
                    if trade_time:
                        # Converte timestamp (ms) para datetime
                        try:
                            closed_at = datetime.datetime.fromtimestamp(int(trade_time) / 1000, tz=datetime.timezone.utc)
                        except (ValueError, TypeError, OSError):
                            closed_at = datetime.datetime.now(datetime.timezone.utc)
                    else:
                        closed_at = datetime.datetime.now(datetime.timezone.utc)
                    
                    # Prepara registro para inserção
                    record = {
                        "trade_id": trade.get("trade_id", "-"),
                        "symbol": trade.get("coin") or trade.get("symbol"),
                        "side": trade.get("side"),
                        "tf": trade.get("tf", "-"),
                        "oid": oid,
                        "raw": trade,  # Armazena objeto completo no JSONB raw
                        "pnl_usd": trade.get("pnl_usd", 0.0),
                        "num_fills": trade.get("num_fills", 1),
                        "closed_at": closed_at.isoformat(),  # Supabase aceita ISO string
                    }
                    if user_id:
                        record["user_id"] = user_id
                    new_trades.append(record)
                    existing_oids.add(oid)  # Evita duplicatas na mesma execução
            
            if new_trades:
                self._client.table(TABLE_TRADES).insert(new_trades).execute()
                logging.info(f"💾 {len(new_trades)} novos trades salvos no Supabase")
        except Exception as e:
            logging.error(f"Supabase save_trades_db: {e}")

    def get_config(self, user_id: str = None) -> dict:
        """Retorna config carregando de bot_config."""
        if not self._client:
            return {}
        try:
            user_id = user_id or self._user_id
            query = self._client.table(TABLE_CONFIG).select("symbols, timeframes, trade_mode")
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            r = query.limit(1).execute()
            if not r.data or len(r.data) == 0:
                return {}
            row = r.data[0]
            return {
                "symbols": row.get("symbols") or [],
                "timeframes": row.get("timeframes") or [],
                "trade_mode": row.get("trade_mode") or "BOTH"
            }
        except Exception as e:
            logging.error(f"Supabase get_config: {e}")
            return {}

    def get_user_created_at_timestamp_ms(self, user_id: str = None) -> int | None:
        """Retorna created_at do usuário em ms (para filtrar trades antigos). None = sem filtro."""
        if not self._client:
            return None
        try:
            uid = user_id or self._user_id
            if not uid:
                return None
            r = self._client.table("users").select("created_at").eq("id", uid).limit(1).execute()
            if not r.data or len(r.data) == 0:
                return None
            created = r.data[0].get("created_at")
            if not created:
                return None
            # created é ISO string; converte para ms
            from datetime import datetime
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created
            return int(dt.timestamp() * 1000)
        except Exception as e:
            logging.error(f"Supabase get_user_created_at_timestamp_ms: {e}")
            return None

    def get_telegram_config(self, user_id: str = None) -> dict | None:
        """Retorna config do Telegram (bot_token, chat_id) do usuário."""
        if not self._client:
            return None
        try:
            user_id = user_id or self._user_id
            if not user_id:
                return None
            r = self._client.table("telegram_configs").select("bot_token, chat_id, bot_token_sender, chat_id_sender").eq("user_id", user_id).limit(1).execute()
            if not r.data or len(r.data) == 0:
                return None
            row = r.data[0]
            token = row.get("bot_token") or ""
            chat = row.get("chat_id") or ""
            if not token or not chat:
                return None
            return {
                "bot_token": token,
                "chat_id": chat,
                "bot_token_sender": row.get("bot_token_sender") or "",
                "chat_id_sender": row.get("chat_id_sender") or "",
            }
        except Exception as e:
            logging.error(f"Supabase get_telegram_config: {e}")
            return None