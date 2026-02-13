-- Migration: Criação de tabelas para SaaS multiusuário
-- Data: 2026-02-12

-- 1. Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, cancelled, expired
    subscription_tier VARCHAR(50) DEFAULT 'basic', -- basic, pro, enterprise
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status, subscription_tier);

-- 2. Tabela de contas de trading
CREATE TABLE IF NOT EXISTS trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    encrypted_private_key TEXT NOT NULL, -- Chave criptografada
    encryption_salt VARCHAR(255) NOT NULL, -- Salt único por chave
    network VARCHAR(20) DEFAULT 'mainnet', -- mainnet, testnet
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_trading_accounts_user ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_active ON trading_accounts(user_id, is_active);

-- 3. Modificar bot_config para multiusuário
-- Adiciona colunas se não existirem
DO $$ 
BEGIN
    -- Adiciona user_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='user_id') THEN
        ALTER TABLE bot_config ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Adiciona trading_account_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='trading_account_id') THEN
        ALTER TABLE bot_config ADD COLUMN trading_account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE;
    END IF;
    
    -- Adiciona bot_enabled se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='bot_enabled') THEN
        ALTER TABLE bot_config ADD COLUMN bot_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Adiciona updated_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='updated_at') THEN
        ALTER TABLE bot_config ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Adiciona campos de risco se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='target_loss_usd') THEN
        ALTER TABLE bot_config ADD COLUMN target_loss_usd FLOAT DEFAULT 5.0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='max_global_exposure') THEN
        ALTER TABLE bot_config ADD COLUMN max_global_exposure FLOAT DEFAULT 5000.0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='max_single_pos_exposure') THEN
        ALTER TABLE bot_config ADD COLUMN max_single_pos_exposure FLOAT DEFAULT 2500.0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_config' AND column_name='max_positions') THEN
        ALTER TABLE bot_config ADD COLUMN max_positions INTEGER DEFAULT 2;
    END IF;
END $$;

-- Cria índice único por usuário (um config por usuário)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_config_user ON bot_config(user_id) WHERE user_id IS NOT NULL;

-- 4. Tabela de configuração Telegram
CREATE TABLE IF NOT EXISTS telegram_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_token VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    bot_token_sender VARCHAR(255), -- Opcional
    chat_id_sender VARCHAR(255),   -- Opcional
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_configs_user ON telegram_configs(user_id);

-- 5. Adicionar user_id nas tabelas existentes
DO $$
BEGIN
    -- bot_tracker
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_tracker' AND column_name='user_id') THEN
        ALTER TABLE bot_tracker ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_bot_tracker_user ON bot_tracker(user_id, symbol);
    END IF;
    
    -- bot_history
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bot_history' AND column_name='user_id') THEN
        ALTER TABLE bot_history ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_bot_history_user ON bot_history(user_id, symbol, timeframe);
    END IF;
    
    -- trades_database
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='trades_database' AND column_name='user_id') THEN
        ALTER TABLE trades_database ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_trades_database_user ON trades_database(user_id, closed_at);
    END IF;
END $$;

-- 6. Tabela de status das instâncias
CREATE TABLE IF NOT EXISTS instance_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    process_id INTEGER, -- PID do processo
    status VARCHAR(50) DEFAULT 'stopped', -- stopped, starting, running, stopping, error
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_status_user ON instance_status(user_id);
CREATE INDEX IF NOT EXISTS idx_instance_status_heartbeat ON instance_status(last_heartbeat);
