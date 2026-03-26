-- Preset de estratégia escolhido no dashboard (fonte de verdade para o que está selecionado na UI).
-- NULL = legado / inferir pelos números; demais valores: CONSERVADOR | MEDIANO | AGRESSIVO | DEGEN | CUSTOM
ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS strategy_preset text;

COMMENT ON COLUMN public.bot_config.strategy_preset IS 'CONSERVADOR|MEDIANO|AGRESSIVO|DEGEN|CUSTOM ou NULL (inferir)';
