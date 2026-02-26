-- Migration: Remove colunas do bot sender secundário de telegram_configs
-- Data: 2026-02

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'telegram_configs' AND column_name = 'bot_token_sender') THEN
    ALTER TABLE public.telegram_configs DROP COLUMN bot_token_sender;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'telegram_configs' AND column_name = 'chat_id_sender') THEN
    ALTER TABLE public.telegram_configs DROP COLUMN chat_id_sender;
  END IF;
END $$;
