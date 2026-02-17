-- Migration: Limpeza de tabelas não usadas e políticas duplicadas
-- Data: 2026-02-16
-- Executar no SQL Editor do Supabase

-- ============================================================================
-- 1. REMOVER TABELAS NÃO UTILIZADAS
-- ============================================================================
-- bot_state e bot_runtime_state não são usadas pelo storage, bot ou backend.

DROP TABLE IF EXISTS public.bot_state CASCADE;
DROP TABLE IF EXISTS public.bot_runtime_state CASCADE;

-- ============================================================================
-- 2. REMOVER POLÍTICAS DUPLICADAS "Service role access"
-- ============================================================================
-- Essas políticas usam USING (true) e duplicam "Service role full access X"
-- que já existe e usa auth.role() = 'service_role' corretamente.

DROP POLICY IF EXISTS "Service role access" ON public.bot_config;
DROP POLICY IF EXISTS "Service role access" ON public.bot_history;
DROP POLICY IF EXISTS "Service role access" ON public.bot_logs;
DROP POLICY IF EXISTS "Service role access" ON public.bot_tracker;
DROP POLICY IF EXISTS "Service role access" ON public.trades_database;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
