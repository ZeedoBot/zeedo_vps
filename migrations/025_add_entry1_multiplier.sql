-- Migration: Adiciona configuração da Entrada 1 (trigger fib)
-- Data: 2026-03-25

-- Entrada 1 é aplicada como:
-- LONG:  setup_high - tech_base * entry1_multiplier  (equivale a "entrada -valor")
-- SHORT: setup_low  + tech_base * entry1_multiplier  (equivale a "entrada +valor")
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS entry1_multiplier FLOAT DEFAULT 0.618;

COMMENT ON COLUMN bot_config.entry1_multiplier IS
  'Entrada 1 (trigger fib). Default 0.618 => LONG -0.618 e SHORT +0.618';

