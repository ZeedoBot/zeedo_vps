-- Migration: Atualiza limites dos planos Basic, Pro e Satoshi
-- Data: 2026-02

-- Garante colunas extras em plan_limits se usadas pelo backend
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_limits' AND column_name='target_loss_min') THEN
    ALTER TABLE plan_limits ADD COLUMN target_loss_min FLOAT DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_limits' AND column_name='target_loss_max') THEN
    ALTER TABLE plan_limits ADD COLUMN target_loss_max FLOAT DEFAULT 150;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_limits' AND column_name='allowed_timeframes') THEN
    ALTER TABLE plan_limits ADD COLUMN allowed_timeframes TEXT[] DEFAULT ARRAY['15m','30m','1h','4h'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_limits' AND column_name='allowed_entry2') THEN
    ALTER TABLE plan_limits ADD COLUMN allowed_entry2 BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_limits' AND column_name='allowed_trade_modes') THEN
    ALTER TABLE plan_limits ADD COLUMN allowed_trade_modes TEXT[] DEFAULT ARRAY['BOTH','LONG_ONLY','SHORT_ONLY'];
  END IF;
END $$;

-- Basic: 6 tokens, 15m, target loss 3-5, 1 trade
-- max_single_position_usd = valor original (patrimônio por trade)
UPDATE plan_limits SET
  max_positions = 1,
  max_single_position_usd = 2500,
  max_global_exposure_usd = 5000,
  allowed_symbols = ARRAY['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'HYPE'],
  allowed_timeframes = ARRAY['15m'],
  target_loss_min = 3,
  target_loss_max = 5,
  allowed_entry2 = false,
  updated_at = NOW()
WHERE plan = 'basic';

-- Pro: target loss 3-150
UPDATE plan_limits SET
  max_single_position_usd = 10000,
  max_global_exposure_usd = 20000,
  target_loss_min = 3,
  target_loss_max = 150,
  allowed_entry2 = true,
  updated_at = NOW()
WHERE plan = 'pro';

-- Satoshi: target loss 3-999999 (ilimitado), patrimônio ilimitado
INSERT INTO plan_limits (plan, max_positions, max_global_exposure_usd, max_single_position_usd, allowed_symbols, allowed_timeframes, target_loss_min, target_loss_max, allowed_entry2)
VALUES (
  'satoshi',
  999,
  999999,
  999999,
  ARRAY['BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'SUI', 'HYPE', 'XRP', 'AAVE', 'DOGE', 'BNB', 'ADA', 'UNI'],
  ARRAY['5m', '15m', '30m', '1h', '4h', '1d'],
  3,
  999999,
  true
)
ON CONFLICT (plan) DO UPDATE SET
  max_positions = 999,
  max_global_exposure_usd = 999999,
  max_single_position_usd = 999999,
  target_loss_min = 3,
  target_loss_max = 999999,
  allowed_entry2 = true,
  updated_at = NOW();
