-- Remove timeframe 30m de todos os planos e configs salvas

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '1h', '12h', '3d', '1w', '1M']::text[],
  updated_at = NOW()
WHERE plan = 'basic';

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '1h', '4h', '12h', '3d', '1w', '1M']::text[],
  updated_at = NOW()
WHERE plan = 'pro';

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '1h', '4h', '1d', '12h', '3d', '1w', '1M']::text[],
  updated_at = NOW()
WHERE plan = 'satoshi';

UPDATE bot_config
SET timeframes = array_remove(timeframes, '30m')
WHERE '30m' = ANY(timeframes);
