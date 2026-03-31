-- =============================================================================
-- Copiar trades entre contas (trades_database)
-- Origem: ba320efc-9368-4b92-a697-ba17911e6d47
-- Destino: ac5ba10a-99fb-48d8-a320-58be3488e3fd
--
-- Antes de cada execução: altere COPY_SINCE na cláusula WHERE (data inclusive, UTC).
-- Na próxima vez que for rodar, use normalmente a data de hoje para copiar só o que
-- for novo desde então (evita reprocessar trades antigos).
----
-- # Última documentação: 2026-03-29
-- # Próxima execução: s.closed_at >= '2026-03-10'::timestamptz
-- =============================================================================

INSERT INTO trades_database (
  trade_id,
  symbol,
  side,
  tf,
  oid,
  raw,
  pnl_usd,
  num_fills,
  closed_at,
  account_value_at_trade,
  user_id
)
SELECT
  s.trade_id,
  s.symbol,
  s.side,
  s.tf,
  NULL::text AS oid,
  s.raw,
  s.pnl_usd,
  s.num_fills,
  s.closed_at,
  s.account_value_at_trade,
  'ac5ba10a-99fb-48d8-a320-58be3488e3fd'::uuid
FROM trades_database s
WHERE s.user_id = 'ba320efc-9368-4b92-a697-ba17911e6d47'::uuid
  AND s.closed_at >= '2026-03-10'::timestamptz
  AND NOT EXISTS (
    SELECT 1
    FROM trades_database d
    WHERE d.user_id = 'ac5ba10a-99fb-48d8-a320-58be3488e3fd'::uuid
      AND d.trade_id = s.trade_id
      AND d.closed_at IS NOT DISTINCT FROM s.closed_at
  );
