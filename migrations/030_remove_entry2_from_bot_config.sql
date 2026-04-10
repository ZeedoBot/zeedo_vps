-- Remove colunas da segunda entrada (uma entrada apenas + ajuste por fib -1.8 no código para Conservador/Mediano).
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_enabled;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_multiplier;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_adjust_last_target;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_target1_level;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_target1_percent;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_target2_level;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_target2_percent;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_target3_level;
ALTER TABLE bot_config DROP COLUMN IF EXISTS entry2_target3_percent;
