-- Basic: 1h, 4h, 1w | Pro: +1d, -3d

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['1h', '4h', '1w']::text[],
  updated_at = NOW()
WHERE plan = 'basic';

UPDATE plan_limits SET
  allowed_timeframes = ARRAY['15m', '1h', '4h', '12h', '1w', '1M', '1d']::text[],
  updated_at = NOW()
WHERE plan = 'pro';

-- Remove timeframes que não pertencem mais ao plano do usuário
UPDATE bot_config bc
SET timeframes = sub.allowed
FROM (
  SELECT
    bc2.user_id,
    COALESCE(
      array_agg(tf ORDER BY ord) FILTER (WHERE tf = ANY(pl.allowed_timeframes)),
      ARRAY[]::text[]
    ) AS allowed
  FROM bot_config bc2
  JOIN users u ON u.id = bc2.user_id
  JOIN plan_limits pl ON pl.plan = lower(coalesce(u.subscription_tier, 'basic'))
  CROSS JOIN LATERAL unnest(coalesce(bc2.timeframes, ARRAY[]::text[])) WITH ORDINALITY AS t(tf, ord)
  GROUP BY bc2.user_id, pl.allowed_timeframes
) sub
WHERE bc.user_id = sub.user_id;
