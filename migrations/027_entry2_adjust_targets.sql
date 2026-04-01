-- Migration: Permite customizar alvos após entrada 2
-- Data: 2026-04-01

ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_target1_level FLOAT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_target1_percent INT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_target2_level FLOAT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_target2_percent INT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_target3_level FLOAT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_target3_percent INT DEFAULT NULL;

COMMENT ON COLUMN bot_config.entry2_target1_level IS 'Nível fib do alvo 1 quando entrada 2 executar (pode ser negativo).';
COMMENT ON COLUMN bot_config.entry2_target1_percent IS 'Percentual do alvo 1 quando entrada 2 executar (0-100).';
COMMENT ON COLUMN bot_config.entry2_target2_level IS 'Nível fib do alvo 2 quando entrada 2 executar (pode ser negativo).';
COMMENT ON COLUMN bot_config.entry2_target2_percent IS 'Percentual do alvo 2 quando entrada 2 executar (0-100).';
COMMENT ON COLUMN bot_config.entry2_target3_level IS 'Nível fib do alvo 3 quando entrada 2 executar (pode ser negativo).';
COMMENT ON COLUMN bot_config.entry2_target3_percent IS 'Percentual do alvo 3 quando entrada 2 executar (0-100).';

