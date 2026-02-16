"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPut } from "@/lib/api";

type PlanLimits = {
  plan: string;
  max_positions: number;
  max_global_exposure_usd: number;
  max_single_position_usd: number;
  target_loss_min: number;
  target_loss_max: number;
  allowed_symbols: string[];
  allowed_timeframes: string[];
  allowed_trade_modes: string[];
};

type BotConfig = {
  bot_enabled: boolean;
  symbols: string[];
  timeframes: string[];
  trade_mode: string;
  target_loss_usd: number;
  max_global_exposure: number;
  max_single_pos_exposure: number;
  max_positions: number;
  plan_limits?: PlanLimits;
};

const TRADE_MODE_LABELS: Record<string, string> = {
  BOTH: "Long e Short",
  LONG_ONLY: "Apenas Long",
  SHORT_ONLY: "Apenas Short",
};

export default function BotPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [symbolsInput, setSymbolsInput] = useState<string[]>([]);
  const [timeframesInput, setTimeframesInput] = useState<string[]>([]);
  const [targetLoss, setTargetLoss] = useState(5);
  const [maxPositions, setMaxPositions] = useState(2);
  const [maxGlobalExposure, setMaxGlobalExposure] = useState(2500);
  const [maxSinglePosition, setMaxSinglePosition] = useState(1250);

  const limits = config?.plan_limits;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const data = await apiGet<BotConfig>("/bot/config", session.access_token);
        setConfig(data);
        setSymbolsInput(data.symbols ?? []);
        setTimeframesInput(data.timeframes ?? []);
        setTargetLoss(data.target_loss_usd ?? 5);
        setMaxPositions(data.max_positions ?? 2);
        setMaxGlobalExposure(data.max_global_exposure ?? 2500);
        setMaxSinglePosition(data.max_single_pos_exposure ?? 1250);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleToggle(enabled: boolean) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiPut("/bot/config", { bot_enabled: enabled }, session.access_token);
      setConfig((c) => (c ? { ...c, bot_enabled: enabled } : null));
      setMessage({ type: "ok", text: enabled ? "Bot ligado. Pode levar até 30 segundos para iniciar." : "Bot desligado." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao atualizar." });
    } finally {
      setSaving(false);
    }
  }

  function clampValue(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!limits) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    const tl = clampValue(targetLoss, limits.target_loss_min, limits.target_loss_max);
    const mp = clampValue(maxPositions, 1, limits.max_positions);
    const mge = Math.min(maxGlobalExposure, limits.max_global_exposure_usd);
    const msp = Math.min(maxSinglePosition, limits.max_single_position_usd);
    try {
      await apiPut(
        "/bot/config",
        {
          symbols: symbolsInput,
          timeframes: timeframesInput,
          trade_mode: config?.trade_mode ?? "BOTH",
          target_loss_usd: tl,
          max_global_exposure: mge,
          max_single_pos_exposure: msp,
          max_positions: mp,
        },
        session.access_token
      );
      setConfig((c) =>
        c
          ? {
              ...c,
              symbols: symbolsInput,
              timeframes: timeframesInput,
              target_loss_usd: tl,
              max_positions: mp,
              max_global_exposure: mge,
              max_single_pos_exposure: msp,
            }
          : null
      );
      setTargetLoss(tl);
      setMaxPositions(mp);
      setMaxGlobalExposure(mge);
      setMaxSinglePosition(msp);
      setMessage({ type: "ok", text: "Configuração salva. O bot será reiniciado em até 30 segundos se estiver ligado." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  function toggleSymbol(s: string) {
    setSymbolsInput((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort()
    );
  }

  function toggleTimeframe(t: string) {
    setTimeframesInput((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()
    );
  }

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Carregando…</p>;
  if (!limits) return <p className="text-gray-500 dark:text-gray-400">Carregando limites do plano…</p>;

  const symbolsOptions = limits.allowed_symbols;
  const timeframesOptions = limits.allowed_timeframes;
  const tradeModeOptions = limits.allowed_trade_modes;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Controle do bot</h1>

      <div className="card max-w-xl mb-8 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-gray-900 dark:text-white">Ligar / desligar</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              O bot só opera quando está ligado e com carteira e Telegram configurados.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle(!config?.bot_enabled)}
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              config?.bot_enabled
                ? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
            }`}
          >
            {config?.bot_enabled ? "Desligar" : "Ligar"}
          </button>
        </div>
        {message && (
          <p className={`mt-3 text-sm ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="card max-w-xl dark:bg-gray-800 dark:border-gray-700">
        <h2 className="font-medium text-gray-900 dark:text-white mb-4">Configurações</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Plano atual: <strong className="capitalize">{limits.plan}</strong>
        </p>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Símbolos</label>
            <div className="flex flex-wrap gap-2">
              {symbolsOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymbol(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    symbolsInput.includes(s)
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timeframes</label>
            <div className="flex flex-wrap gap-2">
              {timeframesOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTimeframe(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    timeframesInput.includes(t)
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="trade_mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Modo
            </label>
            <select
              id="trade_mode"
              value={config?.trade_mode ?? "BOTH"}
              onChange={(e) => setConfig((c) => (c ? { ...c, trade_mode: e.target.value } : null))}
              className="input-field max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {tradeModeOptions.map((m) => (
                <option key={m} value={m}>
                  {TRADE_MODE_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </div>

          <hr className="border-gray-200 dark:border-gray-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">Controles de risco</h3>

          <div className="space-y-4">
            <div title={`Limite do plano: ${limits.target_loss_min} – ${limits.target_loss_max} USD`}>
              <label htmlFor="target_loss" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target loss (USD)
              </label>
              <input
                id="target_loss"
                type="number"
                min={limits.target_loss_min}
                max={limits.target_loss_max}
                step={1}
                value={targetLoss}
                onChange={(e) => setTargetLoss(Number(e.target.value) || limits.target_loss_min)}
                className="input-field max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Plano: {limits.target_loss_min} – {limits.target_loss_max} USD
              </p>
            </div>
            <div title={`Limite do plano: 1 – ${limits.max_positions}`}>
              <label htmlFor="max_positions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trades simultâneos
              </label>
              <input
                id="max_positions"
                type="number"
                min={1}
                max={limits.max_positions}
                step={1}
                value={maxPositions}
                onChange={(e) => setMaxPositions(Math.min(Number(e.target.value) || 1, limits.max_positions))}
                className="input-field max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Plano: até {limits.max_positions}
              </p>
            </div>
            <div title={`Limite do plano: até ${limits.max_global_exposure_usd} USD`}>
              <label htmlFor="max_global" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Patrimônio exposto (total)
              </label>
              <input
                id="max_global"
                type="number"
                min={0}
                max={limits.max_global_exposure_usd}
                step={100}
                value={maxGlobalExposure}
                onChange={(e) =>
                  setMaxGlobalExposure(Math.min(Number(e.target.value) || 0, limits.max_global_exposure_usd))
                }
                className="input-field max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Plano: até {limits.max_global_exposure_usd.toLocaleString()} USD
              </p>
            </div>
            <div title={`Limite do plano: até ${limits.max_single_position_usd} USD`}>
              <label htmlFor="max_single" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Patrimônio por trade
              </label>
              <input
                id="max_single"
                type="number"
                min={0}
                max={limits.max_single_position_usd}
                step={100}
                value={maxSinglePosition}
                onChange={(e) =>
                  setMaxSinglePosition(Math.min(Number(e.target.value) || 0, limits.max_single_position_usd))
                }
                className="input-field max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Plano: até {limits.max_single_position_usd.toLocaleString()} USD
              </p>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </form>
      </div>
    </div>
  );
}
