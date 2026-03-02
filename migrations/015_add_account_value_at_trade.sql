-- Adiciona coluna para salvar o saldo da conta no momento do trade
ALTER TABLE trades_database 
ADD COLUMN IF NOT EXISTS account_value_at_trade FLOAT;

-- Comentário: Esta coluna armazena o saldo total da conta (accountValue) 
-- no momento em que o trade foi fechado, permitindo calcular PNL % 
-- de forma precisa mesmo quando o usuário adiciona/remove saldo da corretora.

-- Para trades existentes, podemos tentar estimar baseado no histórico,
-- mas o ideal é que novos trades salvem esse valor automaticamente.
