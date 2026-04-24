-- Extrai campos úteis de trades_database.raw (JSONB) para colunas e remove raw.
-- Objetivo: reduzir egress e custo de leitura; manter apenas o que o código usa hoje.
--
-- Campos utilizados no código:
-- - time (ms): usado para filtros/ordenação e compatibilidade com formato do bot
-- - size_usd: usado no dashboard para métricas
-- - px/sz: fallback para calcular size_usd
-- - fee / closedPnl (ou pnl): usados para compatibilidade com validações antigas (mcp) e debug
-- - dir: usado como fallback para inferir lado em ferramentas antigas
-- - account_value_at_trade: já existe como coluna (backfill a partir do raw quando possível)

ALTER TABLE trades_database
  ADD COLUMN IF NOT EXISTS time_ms BIGINT,
  ADD COLUMN IF NOT EXISTS px DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sz DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS fee DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS closed_pnl DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dir TEXT,
  ADD COLUMN IF NOT EXISTS size_usd DOUBLE PRECISION;

-- Backfill a partir do raw (quando existir)
UPDATE trades_database
SET
  time_ms = COALESCE(time_ms, NULLIF(raw->>'time', '')::BIGINT),
  px = COALESCE(px, NULLIF(raw->>'px', '')::DOUBLE PRECISION),
  sz = COALESCE(sz, NULLIF(raw->>'sz', '')::DOUBLE PRECISION),
  fee = COALESCE(fee, NULLIF(raw->>'fee', '')::DOUBLE PRECISION),
  closed_pnl = COALESCE(
    closed_pnl,
    NULLIF(raw->>'closedPnl', '')::DOUBLE PRECISION,
    NULLIF(raw->>'pnl', '')::DOUBLE PRECISION
  ),
  dir = COALESCE(dir, NULLIF(raw->>'dir', '')),
  size_usd = COALESCE(
    size_usd,
    NULLIF(raw->>'size_usd', '')::DOUBLE PRECISION,
    (NULLIF(raw->>'px', '')::DOUBLE PRECISION * NULLIF(raw->>'sz', '')::DOUBLE PRECISION)
  ),
  account_value_at_trade = COALESCE(
    account_value_at_trade,
    NULLIF(raw->>'account_value_at_trade', '')::DOUBLE PRECISION
  )
WHERE raw IS NOT NULL;

-- Remove o raw após extração
ALTER TABLE trades_database
  DROP COLUMN IF EXISTS raw;

