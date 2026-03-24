-- Remove artefatos do Zeedo Flow (tabela de tendências e colunas associadas).

DROP TABLE IF EXISTS public.flow_trends CASCADE;

ALTER TABLE public.bot_config
  DROP COLUMN IF EXISTS flow_strategy_type;

ALTER TABLE public.bot_config
  DROP COLUMN IF EXISTS strategy;

ALTER TABLE public.bot_tracker
  DROP COLUMN IF EXISTS product;
