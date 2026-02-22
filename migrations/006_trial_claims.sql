-- Migration: Trial Pro 30 dias - controle por CPF e usuário
-- Cada CPF só pode ativar 1 trial. Cada usuário só pode ter 1 trial na vida.

CREATE TABLE IF NOT EXISTS trial_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cpf_hash VARCHAR(64) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    ended_reason VARCHAR(50),
    profit_at_end FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_claims_cpf_hash ON trial_claims(cpf_hash);
CREATE INDEX IF NOT EXISTS idx_trial_claims_status ON trial_claims(status);
CREATE INDEX IF NOT EXISTS idx_trial_claims_user ON trial_claims(user_id);

ALTER TABLE trial_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trial"
    ON trial_claims FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access trial_claims"
    ON trial_claims FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE trial_claims IS 'Trial Pro 30 dias: 1 por CPF, 1 por usuário. Termina em 30 dias ou $50 lucro.';
