-- Basic: troca XRP, BNB, DOGE por ADA, AAVE, SUI
UPDATE plan_limits SET
  allowed_symbols = ARRAY['BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'HYPE', 'ADA', 'AAVE', 'SUI']::text[],
  updated_at = NOW()
WHERE plan = 'basic';
