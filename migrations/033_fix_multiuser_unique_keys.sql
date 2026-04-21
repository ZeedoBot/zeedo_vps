-- Migration: Corrige chaves únicas para modo SaaS multiusuário
-- - bot_history: PK não pode ser global (symbol,timeframe). Deve incluir user_id.
-- - trades_database: oid deve ser único por user_id (evita colisões entre usuários)
--
-- Data: 2026-04-21

-- 1) bot_history: garantir user_id preenchido e NÃO NULO
DELETE FROM bot_history WHERE user_id IS NULL;
ALTER TABLE bot_history ALTER COLUMN user_id SET NOT NULL;

-- Remove duplicatas (segurança) mantendo 1 por (user_id,symbol,timeframe)
DELETE FROM bot_history a
USING bot_history b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.symbol = b.symbol
  AND a.timeframe IS NOT DISTINCT FROM b.timeframe;

-- Troca PK antiga (symbol,timeframe) por PK multiusuário
ALTER TABLE bot_history DROP CONSTRAINT IF EXISTS bot_history_pkey;
ALTER TABLE bot_history
  ADD CONSTRAINT bot_history_pkey PRIMARY KEY (user_id, symbol, timeframe);

-- 2) trades_database: garantir user_id preenchido e NÃO NULO
DELETE FROM trades_database WHERE user_id IS NULL;
ALTER TABLE trades_database ALTER COLUMN user_id SET NOT NULL;

-- Ajusta índice único de oid: de global → por user_id
DROP INDEX IF EXISTS idx_trades_oid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_oid_user
ON trades_database (user_id, oid)
WHERE oid IS NOT NULL;

