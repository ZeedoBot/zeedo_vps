-- Migration: Adiciona constraint UNIQUE em chat_id para evitar múltiplos usuários no mesmo chat do Telegram
-- Antes de aplicar, remova duplicatas manualmente se houver.

-- Remove duplicatas (mantém o registro mais recente por chat_id)
DELETE FROM telegram_configs
WHERE id NOT IN (
    SELECT DISTINCT ON (chat_id) id
    FROM telegram_configs
    ORDER BY chat_id, created_at DESC
);

-- Adiciona constraint UNIQUE em chat_id
ALTER TABLE telegram_configs ADD CONSTRAINT telegram_configs_chat_id_unique UNIQUE (chat_id);

COMMENT ON CONSTRAINT telegram_configs_chat_id_unique ON telegram_configs IS 'Impede que múltiplos usuários conectem no mesmo chat do Telegram';
