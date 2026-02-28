-- Migration: Adiciona configurações customizáveis de alvos (TPs) e stop loss
-- Data: 2026-02-16

-- Adiciona colunas em bot_config para alvos e stop customizados
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS stop_multiplier FLOAT DEFAULT 1.8;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_multiplier FLOAT DEFAULT 1.414;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry2_adjust_last_target BOOLEAN DEFAULT true;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS target1_level FLOAT DEFAULT 0.618;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS target1_percent INT DEFAULT 100;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS target2_level FLOAT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS target2_percent INT DEFAULT 0;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS target3_level FLOAT DEFAULT NULL;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS target3_percent INT DEFAULT 0;

-- Adiciona colunas em plan_limits para controlar se pode customizar
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_customize_targets BOOLEAN DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_customize_stop BOOLEAN DEFAULT false;

-- Atualiza permissões por plano
UPDATE plan_limits SET
  can_customize_targets = false,
  can_customize_stop = false,
  updated_at = NOW()
WHERE plan = 'basic';

UPDATE plan_limits SET
  can_customize_targets = true,
  can_customize_stop = true,
  updated_at = NOW()
WHERE plan = 'pro';

UPDATE plan_limits SET
  can_customize_targets = true,
  can_customize_stop = true,
  updated_at = NOW()
WHERE plan = 'satoshi';

-- Comentários
COMMENT ON COLUMN bot_config.stop_multiplier IS 'Multiplicador do stop loss (ex: 1.8 = -1.8 fib). Padrão: 1.8';
COMMENT ON COLUMN bot_config.entry2_multiplier IS 'Multiplicador fibonacci da entrada 2 (ex: 1.414 = -1.414 fib). Padrão: 1.414. Range: 0.619-5.0';
COMMENT ON COLUMN bot_config.entry2_adjust_last_target IS 'Se true, quando entrada 2 executar, último alvo vai para 0.0 (retorno ao setup). Padrão: true';
COMMENT ON COLUMN bot_config.target1_level IS 'Nível fibonacci do alvo 1 (ex: 0.618). OBRIGATÓRIO. Padrão: 0.618';
COMMENT ON COLUMN bot_config.target1_percent IS 'Percentual da posição a sair no alvo 1 (0-100). OBRIGATÓRIO. Padrão: 50';
COMMENT ON COLUMN bot_config.target2_level IS 'Nível fibonacci do alvo 2 (ex: 1.0). NULL = desativado';
COMMENT ON COLUMN bot_config.target2_percent IS 'Percentual da posição a sair no alvo 2 (0-100). Padrão: 50';
COMMENT ON COLUMN bot_config.target3_level IS 'Nível fibonacci do alvo 3 (ex: 1.618). NULL = desativado';
COMMENT ON COLUMN bot_config.target3_percent IS 'Percentual da posição a sair no alvo 3 (0-100). Padrão: 0';
COMMENT ON COLUMN plan_limits.can_customize_targets IS 'Se o plano permite customizar alvos (TPs)';
COMMENT ON COLUMN plan_limits.can_customize_stop IS 'Se o plano permite customizar stop loss';
