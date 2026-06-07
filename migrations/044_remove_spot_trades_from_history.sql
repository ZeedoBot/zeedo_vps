-- Remove fills spot da Hyperliquid (coin/symbol com prefixo @)

DELETE FROM trades_database
WHERE symbol LIKE '@%';
