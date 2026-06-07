-- Remove 5m do Satoshi; adiciona 12h, 3d, 1w e 1M em todos os planos

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '30m', '1h', '12h', '3d', '1w', '1M']::text[],
  updated_at = NOW()
WHERE plan = 'basic';

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '30m', '1h', '4h', '12h', '3d', '1w', '1M']::text[],
  updated_at = NOW()
WHERE plan = 'pro';

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '30m', '1h', '4h', '1d', '12h', '3d', '1w', '1M']::text[],
  updated_at = NOW()
WHERE plan = 'satoshi';

-- Remove 5m de configs salvas (ex.: assinantes Satoshi)
UPDATE bot_config
SET timeframes = array_remove(timeframes, '5m')
WHERE '5m' = ANY(timeframes);
