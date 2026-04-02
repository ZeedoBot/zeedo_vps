-- Basic: apenas Modo Sinal (sem trades automáticos na prática), 9 ativos, TFs 15m/30m/1h
-- Força signal_mode no bot_config para assinantes basic (consistência com API)

UPDATE plan_limits SET
  allowed_symbols = ARRAY['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'HYPE', 'LINK', 'AVAX', 'DOGE']::text[],
  allowed_timeframes = ARRAY['15m', '30m', '1h']::text[],
  updated_at = NOW()
WHERE plan = 'basic';

UPDATE bot_config SET signal_mode = true
WHERE user_id IN (
  SELECT id FROM users WHERE lower(coalesce(subscription_tier, 'basic')) = 'basic'
);
