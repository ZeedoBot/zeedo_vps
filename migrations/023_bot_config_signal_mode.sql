-- Modo Sinal: não executa trades automaticamente; apenas alertas e trades bloqueados.
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS signal_mode BOOLEAN NOT NULL DEFAULT FALSE;
