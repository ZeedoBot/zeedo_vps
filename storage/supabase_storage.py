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
TABLE_BLOCKED = "blocked_trades"

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
        # Checkpoint em memória para reduzir egress:
        # por usuário, guarda o maior closed_at já visto no get_trades_db().
        self._trades_last_closed_at: dict[str, str] = {}
        # Cache em memória (por usuário) para manter semântica do get_trades_db():
        # sync_trade_history espera uma "base" para montar processed_oids.
        self._trades_cache: dict[str, list[dict]] = {}
    
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
        """
        Salva entry_tracker em bot_tracker (upsert por symbol).
        Remove do banco os symbols que não estão mais em data (equivalente ao LocalStorage,
        que sobrescreve o arquivo inteiro). Assim entry_tracker.pop(sym) + save persiste a remoção.
        """
        if not self._client or not isinstance(data, dict):
            return
        try:
            user_id = user_id or self._user_id
            current_symbols = set(data.keys()) if data else set()
            # Busca symbols atuais no DB para este user
            query = self._client.table(TABLE_TRACKER).select("symbol")
            if user_id:
                query = query.eq("user_id", user_id)
            r = query.execute()
            db_symbols = {row["symbol"] for row in (r.data or []) if row.get("symbol")}
            # Remove do banco os symbols que não estão mais no data
            to_delete = db_symbols - current_symbols
            if to_delete:
                for symbol in to_delete:
                    q = self._client.table(TABLE_TRACKER).delete().eq("symbol", symbol)
                    if user_id:
                        q = q.eq("user_id", user_id)
                    q.execute()
            # Upsert cada symbol que está no data
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
        """Salva history_tracker em bot_history (upsert por user_id+symbol+timeframe quando multiusuário)."""
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
        """Retorna trades_db carregando de trades_database (cache incremental + janela recente).

        No modo SaaS (com user_id), mantém em memória apenas trades dentro de uma janela recente
        para:
        - reduzir egress/custo no bootstrap (não baixar histórico inteiro),
        - manter `processed_oids` pequeno e evitar reprocessamentos.
        """
        if not self._client:
            return []
        try:
            user_id = user_id or self._user_id
            select_cols = (
                "trade_id, symbol, side, tf, oid, pnl_usd, num_fills, closed_at, "
                "account_value_at_trade, time_ms, px, sz, fee, closed_pnl, dir, size_usd"
            )

            # Janela de retenção (alinhada ao lookback do bot).
            import datetime
            LOOKBACK_HOURS = 48
            now = datetime.datetime.now(datetime.timezone.utc)
            cutoff_dt = now - datetime.timedelta(hours=LOOKBACK_HOURS)
            cutoff_iso = cutoff_dt.isoformat()
            cutoff_ms = int(cutoff_dt.timestamp() * 1000)

            def _prune_cache(trades: list[dict]) -> list[dict]:
                """Remove itens fora da janela recente (por time_ms ou closed_at)."""
                kept: list[dict] = []
                for t in trades or []:
                    ts = t.get("time") or t.get("time_ms")
                    try:
                        ts_i = int(ts) if ts is not None else 0
                    except Exception:
                        ts_i = 0
                    if ts_i and ts_i < cutoff_ms:
                        continue
                    kept.append(t)
                return kept

            # Se já temos cache, só busca incrementais e retorna a lista completa em memória.
            has_cache = bool(user_id and self._trades_cache.get(user_id))
            if not user_id:
                # Modo legado (sem user_id): mantém comportamento atual.
                r = self._client.table(TABLE_TRADES).select(select_cols).order("closed_at", desc=False).execute()
            else:
                last_seen = self._trades_last_closed_at.get(user_id)
                if last_seen and has_cache:
                    # Incremental: traz a borda também (closed_at pode repetir em execuções simultâneas).
                    # Duplicatas são filtradas por `oid` ao anexar no cache.
                    r = (
                        self._client.table(TABLE_TRADES)
                        .select(select_cols)
                        .eq("user_id", user_id)
                        .gte("closed_at", last_seen)
                        .gte("closed_at", cutoff_iso)
                        .order("closed_at", desc=False)
                        .execute()
                    )
                else:
                    # Bootstrap: carrega todos os trades recentes (janela) para iniciar com OIDs completos.
                    r = (
                        self._client.table(TABLE_TRADES)
                        .select(select_cols)
                        .eq("user_id", user_id)
                        .gte("closed_at", cutoff_iso)
                        .order("closed_at", desc=False)
                        .execute()
                    )
            if not r.data:
                if user_id and has_cache:
                    self._trades_cache[user_id] = _prune_cache(self._trades_cache[user_id])
                    return self._trades_cache[user_id]
                return self._trades_cache.get(user_id, []) if user_id else []

            # Atualiza checkpoint (maior closed_at visto) se possível
            if user_id:
                try:
                    max_closed = None
                    for row in r.data:
                        ca = row.get("closed_at")
                        if isinstance(ca, str) and ca:
                            if max_closed is None or ca > max_closed:
                                max_closed = ca
                    if max_closed:
                        prev = self._trades_last_closed_at.get(user_id)
                        if prev is None or max_closed > prev:
                            self._trades_last_closed_at[user_id] = max_closed
                except Exception:
                    pass

            rows = r.data
            # Mantém somente janela recente no retorno (segurança extra).
            try:
                rows = [x for x in rows if not isinstance(x.get("closed_at"), str) or x["closed_at"] >= cutoff_iso]
            except Exception:
                pass

            # Converte registros da tabela para formato esperado pelo código
            fetched: list[dict] = []
            for row in rows:
                # Timestamp preferencial: time_ms (ms). Fallback: closed_at ISO.
                ts = row.get("time_ms")
                if ts is None or ts == 0:
                    ca = row.get("closed_at")
                    # Supabase pode devolver closed_at como ISO string ou datetime
                    if isinstance(ca, str):
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(ca.replace("Z", "+00:00"))
                            ts = int(dt.timestamp() * 1000)
                        except Exception:
                            ts = None
                    elif isinstance(ca, datetime.datetime):
                        try:
                            dt = ca
                            if dt.tzinfo is None:
                                dt = dt.replace(tzinfo=datetime.timezone.utc)
                            ts = int(dt.timestamp() * 1000)
                        except Exception:
                            ts = None
                # Monta objeto no formato esperado (compatível com sync_trade_history)
                trade = {
                    "coin": row.get("symbol"),
                    "oid": row.get("oid"),
                    "time": ts,
                    "closedPnl": row.get("closed_pnl"),
                    "pnl": row.get("closed_pnl"),
                    "fee": row.get("fee"),
                    "pnl_usd": float(row.get("pnl_usd", 0)) if row.get("pnl_usd") is not None else 0.0,
                    "side": row.get("side"),
                    "tf": row.get("tf"),
                    "trade_id": row.get("trade_id"),
                    "num_fills": row.get("num_fills", 1),
                    "dir": row.get("dir"),
                    "px": row.get("px"),
                    "sz": row.get("sz"),
                    "size_usd": row.get("size_usd"),
                    "account_value_at_trade": row.get("account_value_at_trade"),
                }
                fetched.append(trade)

            if user_id:
                if not has_cache:
                    self._trades_cache[user_id] = _prune_cache(fetched)
                else:
                    # Anexa apenas o que ainda não existe (por oid) para não duplicar
                    existing_oids = {str(t.get("oid")) for t in self._trades_cache[user_id] if t.get("oid")}
                    for t in fetched:
                        oid = str(t.get("oid") or "")
                        if oid and oid not in existing_oids:
                            self._trades_cache[user_id].append(t)
                            existing_oids.add(oid)
                    self._trades_cache[user_id] = _prune_cache(self._trades_cache[user_id])
                return self._trades_cache[user_id]

            return fetched
        except Exception as e:
            logging.error(f"Supabase get_trades_db: {e}")
            return []

    def save_trades_db(self, data: list, user_id: str = None) -> None:
        """Salva trades em trades_database (idempotente por UNIQUE(user_id, oid))."""
        if not self._client or not isinstance(data, list):
            return
        try:
            user_id = user_id or self._user_id
            # Prepara registros para inserção/upsert (o banco garante idempotência via UNIQUE(user_id, oid)).
            new_trades: list[dict] = []
            import datetime
            for trade in data:
                oid = str(trade.get("oid") or "")
                if not oid:
                    continue
                # Calcula closed_at a partir do timestamp do trade
                trade_time = trade.get("time") or trade.get("t") or trade.get("timestamp")
                time_ms = None
                if trade_time:
                    # Converte timestamp (ms) para datetime
                    try:
                        time_ms = int(trade_time)
                        closed_at = datetime.datetime.fromtimestamp(int(trade_time) / 1000, tz=datetime.timezone.utc)
                    except (ValueError, TypeError, OSError):
                        closed_at = datetime.datetime.now(datetime.timezone.utc)
                else:
                    closed_at = datetime.datetime.now(datetime.timezone.utc)
                
                def _to_float(x):
                    try:
                        if x is None:
                            return None
                        if isinstance(x, (int, float)):
                            return float(x)
                        s = str(x).strip()
                        if s == "" or s.lower() == "none":
                            return None
                        return float(s)
                    except Exception:
                        return None

                px = _to_float(trade.get("px"))
                sz = _to_float(trade.get("sz"))
                fee = _to_float(trade.get("fee"))
                closed_pnl = _to_float(trade.get("closedPnl"))
                if closed_pnl is None:
                    closed_pnl = _to_float(trade.get("pnl"))
                size_usd = _to_float(trade.get("size_usd"))
                if size_usd is None and px is not None and sz is not None:
                    size_usd = px * sz

                record = {
                    "trade_id": trade.get("trade_id", "-"),
                    "symbol": trade.get("coin") or trade.get("symbol"),
                    "side": trade.get("side"),
                    "tf": trade.get("tf", "-"),
                    "oid": oid,
                    "pnl_usd": trade.get("pnl_usd", 0.0),
                    "num_fills": trade.get("num_fills", 1),
                    "closed_at": closed_at.isoformat(),  # Supabase aceita ISO string
                    "time_ms": time_ms,
                    "px": px,
                    "sz": sz,
                    "fee": fee,
                    "closed_pnl": closed_pnl,
                    "dir": trade.get("dir"),
                    "size_usd": size_usd,
                    "account_value_at_trade": trade.get("account_value_at_trade"),
                }
                if user_id:
                    record["user_id"] = user_id
                new_trades.append(record)
            
            if new_trades:
                # UPSERT por UNIQUE(user_id, oid) torna a operação idempotente sem precisar ler OIDs.
                # Se o registro já existir, ele será mantido/atualizado sem criar duplicata.
                self._client.table(TABLE_TRADES).upsert(new_trades, on_conflict="user_id,oid").execute()
                logging.info(f"💾 {len(new_trades)} trade(s) enviados para o Supabase (idempotente)")
        except Exception as e:
            logging.error(f"Supabase save_trades_db: {e}")

    def _degen_strategy_unlocked(self, user_id: str) -> bool:
        """Degen só após 7 dias desde users.created_at; sem data → não libera."""
        from datetime import datetime, timedelta, timezone

        ms = self.get_user_created_at_timestamp_ms(user_id)
        if ms is None:
            return False
        created = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        return datetime.now(timezone.utc) >= created + timedelta(days=7)

    def get_config(self, user_id: str = None) -> dict:
        """Retorna config carregando de bot_config."""
        if not self._client:
            return {}
        try:
            user_id = user_id or self._user_id
            query = self._client.table(TABLE_CONFIG).select(
                "symbols, timeframes, trade_mode, signal_mode, strategy_preset, stop_multiplier, entry1_multiplier, "
                "target1_level, target1_percent, target2_level, target2_percent, target3_level, target3_percent"
            )
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            r = query.limit(1).execute()
            if not r.data or len(r.data) == 0:
                return {}
            row = r.data[0]
            out = {
                "symbols": row.get("symbols") or [],
                "timeframes": row.get("timeframes") or [],
                "trade_mode": row.get("trade_mode") or "BOTH",
                "signal_mode": bool(row.get("signal_mode", False)),
                "strategy_preset": row.get("strategy_preset"),
                "stop_multiplier": row.get("stop_multiplier", 1.8),
                "entry1_multiplier": row.get("entry1_multiplier", 0.618),
                "target1_level": row.get("target1_level", 0.618),
                "target1_percent": row.get("target1_percent", 50),
                "target2_level": row.get("target2_level", 1.0),
                "target2_percent": row.get("target2_percent", 50),
                "target3_level": row.get("target3_level"),
                "target3_percent": row.get("target3_percent", 0),
            }
            # Conta com menos de 7 dias: não opera como DEGEN (alinha ao preset Mediano).
            preset = str(out.get("strategy_preset") or "").strip().upper()
            if preset == "DEGEN" and user_id and not self._degen_strategy_unlocked(user_id):
                out["strategy_preset"] = "MEDIANO"
                out["stop_multiplier"] = 2.0
                out["entry1_multiplier"] = 0.618
                out["target1_level"] = 0.5
                out["target1_percent"] = 3
                out["target2_level"] = 1.6
                out["target2_percent"] = 62
                out["target3_level"] = 4.4
                out["target3_percent"] = 35
            return out
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
            r = self._client.table("telegram_configs").select("bot_token, chat_id").eq("user_id", user_id).limit(1).execute()
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
            }
        except Exception as e:
            logging.error(f"Supabase get_telegram_config: {e}")
            return None

    def save_blocked_trade(self, data: dict, user_id: str = None) -> None:
        """Salva trade bloqueado para exibição e acionamento manual."""
        if not self._client or not data or not data.get("symbol"):
            return
        try:
            uid = user_id or self._user_id
            if not uid:
                logging.warning("save_blocked_trade: user_id ausente, não foi possível salvar")
                return
            record = {
                "user_id": uid,
                "symbol": data["symbol"],
                "tf": data["tf"],
                "side": data["side"],
                "entry_px": float(data["entry_px"]),
                "stop_real": float(data["stop_real"]),
                "qty": float(data["qty"]),
                "reason": data["reason"],
                "signal_ts": int(data["signal_ts"]),
                "tech_base": float(data.get("tech_base", 0) or 0),
                "setup_high": float(data.get("setup_high", 0) or 0),
                "setup_low": float(data.get("setup_low", 0) or 0),
                "target1_level": float(data.get("target1_level", 0.618) or 0.618),
            }
            # Mantém o registro mais antigo: se já existir (unique key), ignoramos a duplicata.
            try:
                self._client.table(TABLE_BLOCKED).insert(record).execute()
                logging.info(f"blocked_trade salvo: {data.get('symbol')} {data.get('tf')} ({data.get('reason')})")
            except Exception as ie:
                msg = str(ie)
                # PostgREST/Supabase pode retornar 409/23505 para duplicata
                if "23505" in msg or "duplicate" in msg.lower() or "409" in msg:
                    logging.info(
                        f"blocked_trade duplicado ignorado: {data.get('symbol')} {data.get('tf')} ({data.get('reason')})"
                    )
                else:
                    raise
        except Exception as e:
            logging.error(f"Supabase save_blocked_trade: {e}", exc_info=True)

    def expire_blocked_trades(self, user_id: str, all_mids: dict, target1_level: float = 0.5) -> int:
        """Remove blocked_trades expirados (preço atingiu fib 0.5 sintético ou Stop). `target1_level` legado, ignorado."""
        if not self._client or not all_mids:
            return 0
        try:
            uid = user_id or self._user_id
            if not uid:
                return 0
            r = self._client.table(TABLE_BLOCKED).select(
                "id, symbol, side, entry_px, stop_real, tech_base, setup_high, setup_low, created_at"
            ).eq("user_id", uid).execute()
            if not r.data:
                return 0
            import time as _time
            now_sec = _time.time()
            grace_minutes = 5  # Não expira trades criados há menos de 5 min
            to_delete = []
            for row in r.data:
                created = row.get("created_at")
                if created:
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00")) if isinstance(created, str) else created
                        age_sec = now_sec - dt.timestamp()
                        if age_sec < grace_minutes * 60:
                            continue  # Mantém; muito recente
                    except Exception:
                        pass
                sym = row.get("symbol", "")
                px = float(all_mids.get(sym, 0) or 0)
                if px <= 0:
                    continue
                stop = float(row.get("stop_real", 0))
                tech = float(row.get("tech_base", 0) or 0)
                setup_high = float(row.get("setup_high", 0) or 0)
                setup_low = float(row.get("setup_low", 0) or 0)
                t1 = 0.5  # igual ao cancel de ordens pendentes no bot; não usa target1_level do preset
                side = (row.get("side") or "long").lower()
                expired = False
                # Stop: sempre verifica
                if side == "long":
                    if px <= stop:
                        expired = True
                    else:
                        tp1 = setup_high + (tech * t1)
                        if px >= tp1:
                            expired = True
                else:
                    if px >= stop:
                        expired = True
                    else:
                        tp1 = setup_low - (tech * t1)
                        if px <= tp1:
                            expired = True
                if expired:
                    to_delete.append(row.get("id"))
            for bid in to_delete:
                if bid:
                    self._client.table(TABLE_BLOCKED).delete().eq("id", bid).execute()
            return len(to_delete)
        except Exception as e:
            logging.error(f"Supabase expire_blocked_trades: {e}")
            return 0