-- Migration: Adiciona UNIQUE constraints para bot_history e bot_tracker
-- Necessário para ON CONFLICT no upsert (save_history_tracker, execute-blocked-trade)

-- Remove duplicatas em bot_history (mantém um por user_id, symbol, timeframe)
DELETE FROM bot_history a
USING bot_history b
WHERE a.ctid < b.ctid
  AND a.user_id IS NOT DISTINCT FROM b.user_id
  AND a.symbol = b.symbol
  AND a.timeframe IS NOT DISTINCT FROM b.timeframe;

-- Remove duplicatas em bot_tracker (mantém um por user_id, symbol)
DELETE FROM bot_tracker a
USING bot_tracker b
WHERE a.ctid < b.ctid
  AND a.user_id IS NOT DISTINCT FROM b.user_id
  AND a.symbol = b.symbol;

-- UNIQUE INDEX nas colunas exatas usadas pelo ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_history_unique_user_symbol_tf
ON bot_history (user_id, symbol, timeframe);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_tracker_unique_user_symbol
ON bot_tracker (user_id, symbol);
