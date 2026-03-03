-- Migration: Tabela de trades bloqueados (não acionados automaticamente)
-- Permite ao usuário ver e acionar manualmente pelo site

CREATE TABLE IF NOT EXISTS blocked_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    tf VARCHAR(10) NOT NULL,
    side VARCHAR(10) NOT NULL,
    entry_px FLOAT NOT NULL,
    entry2_px FLOAT NOT NULL,
    stop_real FLOAT NOT NULL,
    qty FLOAT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    signal_ts BIGINT NOT NULL,
    tech_base FLOAT,
    setup_high FLOAT,
    setup_low FLOAT,
    target1_level FLOAT DEFAULT 0.618,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_trades_user ON blocked_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_trades_created ON blocked_trades(created_at);

-- RLS
ALTER TABLE blocked_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocked_trades_user_policy ON blocked_trades;
CREATE POLICY blocked_trades_user_policy ON blocked_trades
    FOR ALL USING (auth.uid() = user_id);

-- Service role pode fazer tudo (backend/bot)
CREATE POLICY "Service role full access blocked_trades"
    ON blocked_trades FOR ALL
    USING (auth.role() = 'service_role');
