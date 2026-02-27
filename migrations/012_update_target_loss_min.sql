-- Migration: Atualiza target_loss_min para 1 USD em todos os planos
-- Data: 2026-02

-- Atualiza Basic: target loss mínimo de 3 para 1
UPDATE plan_limits SET
  target_loss_min = 1,
  updated_at = NOW()
WHERE plan = 'basic';

-- Atualiza Pro: target loss mínimo de 3 para 1
UPDATE plan_limits SET
  target_loss_min = 1,
  updated_at = NOW()
WHERE plan = 'pro';

-- Atualiza Satoshi: target loss mínimo de 3 para 1
UPDATE plan_limits SET
  target_loss_min = 1,
  updated_at = NOW()
WHERE plan = 'satoshi';

COMMENT ON TABLE plan_limits IS 'Limites por plano - target_loss_min atualizado para 1 USD em todos os planos';
