-- Migration: Evita duplicatas em blocked_trades (SaaS multiusuário)
-- Chave natural: user_id + symbol + tf + side + signal_ts
-- Quando o mesmo trade bloqueado for salvo novamente (ex.: reconexão/restart),
-- fazemos upsert no registro existente em vez de criar duplicata.
--
-- Data: 2026-04-21

-- Remove duplicatas mantendo o registro mais recente (maior created_at; fallback por ctid)
DELETE FROM blocked_trades a
USING blocked_trades b
WHERE a.user_id = b.user_id
  AND a.symbol = b.symbol
  AND a.tf = b.tf
  AND a.side = b.side
  AND a.signal_ts = b.signal_ts
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.ctid < b.ctid)
  );

-- Índice único para suportar ON CONFLICT (upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_trades_unique_user_symbol_tf_side_ts
ON blocked_trades (user_id, symbol, tf, side, signal_ts);

