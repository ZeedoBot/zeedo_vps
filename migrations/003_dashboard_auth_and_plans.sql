-- Migration: Dashboard SaaS - Sync Auth + Subscriptions/Plans
-- Data: 2026-02-13
-- Pré-requisito: Supabase Auth habilitado. RLS já aplicado em 002.

-- ============================================================================
-- 1. Sincronizar auth.users → public.users (novo cadastro)
-- ============================================================================
-- Quando um usuário se cadastra pelo Supabase Auth, criamos linha em public.users
-- com o mesmo id (auth.uid() = public.users.id).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, subscription_status, subscription_tier)
  VALUES (
    new.id,
    COALESCE(new.email, new.raw_user_meta_data->>'email', ''),
    'trial',
    'basic'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Trigger: após insert em auth.users (executar no SQL Editor do Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. Tabela subscriptions (faturamento futuro)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL DEFAULT 'basic',   -- basic, pro, enterprise
    status VARCHAR(50) NOT NULL DEFAULT 'trialing', -- trialing, active, past_due, cancelled, expired
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access subscriptions"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. Tabela plan_limits (limites por plano)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_limits (
    plan VARCHAR(50) PRIMARY KEY,
    max_positions INTEGER NOT NULL DEFAULT 2,
    max_global_exposure_usd FLOAT NOT NULL DEFAULT 5000.0,
    max_single_position_usd FLOAT NOT NULL DEFAULT 2500.0,
    allowed_symbols TEXT[],  -- NULL = todos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plan_limits (plan, max_positions, max_global_exposure_usd, max_single_position_usd)
VALUES
  ('basic', 2, 5000.0, 2500.0),
  ('pro', 5, 20000.0, 10000.0),
  ('enterprise', 10, 100000.0, 50000.0)
ON CONFLICT (plan) DO NOTHING;

-- ============================================================================
-- 4. View telegram_connections (alias para telegram_configs)
-- ============================================================================
-- Facilita referência "conexão Telegram" no frontend; dados em telegram_configs.
CREATE OR REPLACE VIEW telegram_connections AS
SELECT
    id,
    user_id,
    bot_token IS NOT NULL AND bot_token != '' AS has_bot_token,
    chat_id IS NOT NULL AND chat_id != '' AS has_chat_id,
    created_at,
    updated_at
FROM telegram_configs;

-- Comentário: dados sensíveis (bot_token, chat_id) permanecem só em telegram_configs.
-- A API nunca retorna bot_token; chat_id pode ser mascarado no frontend se necessário.
