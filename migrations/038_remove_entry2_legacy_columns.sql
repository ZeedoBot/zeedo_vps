-- Remove colunas legadas da segunda entrada (produto = uma entrada apenas).
ALTER TABLE blocked_trades DROP COLUMN IF EXISTS entry2_px;
ALTER TABLE plan_limits DROP COLUMN IF EXISTS allowed_entry2;
