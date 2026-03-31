-- Coluna opcional para guardar o preset de estratégia escolhido no dashboard
-- (ex.: CONSERVADOR | MEDIANO | AGRESSIVO | DEGEN | CUSTOM). O app atual não
-- lê nem grava este campo; a coluna permanece no schema se você já aplicou no Supabase.
ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS strategy_preset text;
