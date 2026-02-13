-- Migration: Habilitar Row Level Security (RLS) para isolamento de usuários
-- Data: 2026-02-12
-- IMPORTANTE: Esta migration é CRÍTICA para segurança do SaaS multiusuário

-- ============================================================================
-- HABILITAR RLS EM TODAS AS TABELAS MULTIUSUÁRIO
-- ============================================================================

-- 1. users: Usuários só podem ver/editar seus próprios dados
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access"
    ON users FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 2. trading_accounts: Usuários só podem ver/editar suas próprias contas
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading accounts"
    ON trading_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading accounts"
    ON trading_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading accounts"
    ON trading_accounts FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access trading_accounts"
    ON trading_accounts FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 3. telegram_configs: Usuários só podem ver/editar suas próprias configs
ALTER TABLE telegram_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram configs"
    ON telegram_configs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram configs"
    ON telegram_configs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram configs"
    ON telegram_configs FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access telegram_configs"
    ON telegram_configs FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 4. instance_status: Usuários só podem ver status de suas próprias instâncias
ALTER TABLE instance_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instance status"
    ON instance_status FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access instance_status"
    ON instance_status FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 5. bot_config: Usuários só podem ver/editar suas próprias configs
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bot config"
    ON bot_config FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own bot config"
    ON bot_config FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bot config"
    ON bot_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access bot_config"
    ON bot_config FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 6. bot_tracker: Usuários só podem ver/editar seus próprios trackers
ALTER TABLE bot_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bot tracker"
    ON bot_tracker FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own bot tracker"
    ON bot_tracker FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bot tracker"
    ON bot_tracker FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access bot_tracker"
    ON bot_tracker FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 7. bot_history: Usuários só podem ver/editar seus próprios históricos
ALTER TABLE bot_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bot history"
    ON bot_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own bot history"
    ON bot_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bot history"
    ON bot_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access bot_history"
    ON bot_history FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================

-- 8. trades_database: Usuários só podem ver seus próprios trades
ALTER TABLE trades_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
    ON trades_database FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
    ON trades_database FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo (para scripts backend)
CREATE POLICY "Service role full access trades_database"
    ON trades_database FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- NOTA IMPORTANTE:
-- ============================================================================
-- Estas políticas garantem que:
-- 1. Usuários autenticados só veem/editam seus próprios dados
-- 2. Service role (usado pelo backend/scripts) tem acesso total
-- 3. Isolamento total entre usuários
--
-- Para usar com service role (scripts Python), use SUPABASE_SERVICE_KEY
-- Para usar com usuários autenticados (futuro frontend), use SUPABASE_ANON_KEY
-- ============================================================================
