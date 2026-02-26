-- Tabela para capturar leads de acesso antecipado (futuros clientes)
-- Permite INSERT anônimo; SELECT/UPDATE/DELETE apenas para service_role

CREATE TABLE IF NOT EXISTS early_access_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_early_access_signups_email ON early_access_signups(email);
CREATE INDEX IF NOT EXISTS idx_early_access_signups_created_at ON early_access_signups(created_at DESC);

ALTER TABLE early_access_signups ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (anon ou auth) pode inserir
CREATE POLICY "Anyone can insert early access signup"
    ON early_access_signups FOR INSERT
    WITH CHECK (true);

-- Apenas service_role pode ler e gerenciar
CREATE POLICY "Service role full access early_access_signups"
    ON early_access_signups FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE early_access_signups IS 'Leads de acesso antecipado - captura nome, email e telefone de futuros clientes.';
