-- =============================================================================
-- Copiar trades entre contas (trades_database), com PnL e % efetivos 4× maiores
-- Origem: ac5ba10a-99fb-48d8-a320-58be3488e3fd
-- Destino: e916c1cd-9cc7-47b8-a200-befbae73722e
--
-- Regras:
-- - pnl_usd: valor × 4 (NULL permanece NULL)
-- - account_value_at_trade: igual ao registro de origem → no dashboard,
--   pnl_pct = (pnl_usd / account_value) * 100 fica 4× o original
-- - raw (jsonb): closedPnl, pnl, fee e pnl_usd multiplicados por 4 quando existirem,
--   para manter coerência com pnl_usd da linha (fee × 4 preserva o “net” relativo)
--
-- Idempotência: não insere se já existir o mesmo trade_id + closed_at no destino.
-- # Documentação: 2026-04-16
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
  CASE
    WHEN s.raw IS NULL THEN NULL::jsonb
    ELSE
      s.raw
      || CASE
           WHEN s.raw ? 'closedPnl' THEN jsonb_build_object(
             'closedPnl',
             to_jsonb((s.raw->>'closedPnl')::numeric * 4)
           )
           ELSE '{}'::jsonb
         END
      || CASE
           WHEN s.raw ? 'pnl' THEN jsonb_build_object(
             'pnl',
             to_jsonb((s.raw->>'pnl')::numeric * 4)
           )
           ELSE '{}'::jsonb
         END
      || CASE
           WHEN s.raw ? 'fee' THEN jsonb_build_object(
             'fee',
             to_jsonb((s.raw->>'fee')::numeric * 4)
           )
           ELSE '{}'::jsonb
         END
      || CASE
           WHEN s.raw ? 'pnl_usd' THEN jsonb_build_object(
             'pnl_usd',
             to_jsonb((s.raw->>'pnl_usd')::numeric * 4)
           )
           ELSE '{}'::jsonb
         END
  END AS raw,
  s.pnl_usd * 4 AS pnl_usd,
  s.num_fills,
  s.closed_at,
  s.account_value_at_trade,
  'e916c1cd-9cc7-47b8-a200-befbae73722e'::uuid
FROM trades_database s
WHERE s.user_id = 'ac5ba10a-99fb-48d8-a320-58be3488e3fd'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM trades_database d
    WHERE d.user_id = 'e916c1cd-9cc7-47b8-a200-befbae73722e'::uuid
      AND d.trade_id = s.trade_id
      AND d.closed_at IS NOT DISTINCT FROM s.closed_at
  );
