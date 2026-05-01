-- Próxima data de renovação/cobrança (Stripe current_period_end), em UTC.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'subscription_period_end'
  ) THEN
    ALTER TABLE public.users ADD COLUMN subscription_period_end TIMESTAMPTZ;
  END IF;
END $$;
