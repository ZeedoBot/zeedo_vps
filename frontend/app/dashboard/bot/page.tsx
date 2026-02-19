"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  allowed_entry2?: boolean;
};

type BotConfig = {
  bot_enabled: boolean;
  entry2_enabled?: boolean;
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
  const [entry2Enabled, setEntry2Enabled] = useState(true);

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
        setEntry2Enabled(data.entry2_enabled ?? true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      const payload: Record<string, unknown> = {
        symbols: symbolsInput,
        timeframes: timeframesInput,
        trade_mode: config?.trade_mode ?? "BOTH",
        target_loss_usd: tl,
        max_global_exposure: mge,
        max_single_pos_exposure: msp,
        max_positions: mp,
      };
      if (limits?.allowed_entry2) {
        payload.entry2_enabled = entry2Enabled;
      }
      await apiPut(
        "/bot/config",
        payload,
        session.access_token
      );
      setConfig((c) =>
        c
          ? {
              ...c,
              symbols: symbolsInput,
              timeframes: timeframesInput,
              entry2_enabled: limits?.allowed_entry2 ? entry2Enabled : c.entry2_enabled,
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

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;
  if (!limits) return <p className="text-gray-500 dark:text-gray-400">Carregando limites do plano…</p>;

  const symbolsOptions = limits.allowed_symbols;
  const timeframesOptions = limits.allowed_timeframes;
  const tradeModeOptions = limits.allowed_trade_modes;

  return (
    <div>
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-6">Configurações do bot</h1>

      <div className="card max-w-xl">
        <h2 className="font-medium text-zeedo-black dark:text-zeedo-white mb-4">Configurações</h2>
        <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 mb-4">
          Plano atual: <strong className="capitalize">{limits.plan}</strong>
          {" "}
          <Link href="/choose-plan" className="text-xs text-zeedo-orange hover:underline">Upgrade</Link>
        </p>
        <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60 mb-4">
          Clique nas opções que você deseja que o Zeedo opere.
          <br />
          Símbolos e timeframes em laranja significam ativos.
          <br />
          Não esqueça de sempre clicar em Salvar Configurações.
        </p>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zeedo-orange mb-2">Símbolos</label>
            <div className="flex flex-wrap gap-2">
              {symbolsOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymbol(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                    symbolsInput.includes(s)
                      ? "bg-zeedo-orange text-white border-zeedo-orange"
                      : "border-zeedo-orange/30 text-zeedo-black dark:text-zeedo-white hover:bg-zeedo-orange/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zeedo-orange mb-2">Timeframes</label>
            <div className="flex flex-wrap gap-2">
              {timeframesOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTimeframe(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                    timeframesInput.includes(t)
                      ? "bg-zeedo-orange text-white border-zeedo-orange"
                      : "border-zeedo-orange/30 text-zeedo-black dark:text-zeedo-white hover:bg-zeedo-orange/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="trade_mode" className="block text-sm font-medium text-zeedo-orange mb-1">
              Modo
            </label>
            <select
              id="trade_mode"
              value={config?.trade_mode ?? "BOTH"}
              onChange={(e) => setConfig((c) => (c ? { ...c, trade_mode: e.target.value } : null))}
              className="input-field max-w-xs"
            >
              {tradeModeOptions.map((m) => (
                <option key={m} value={m}>
                  {TRADE_MODE_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </div>

          <div className={`flex flex-wrap items-center gap-3 ${!limits?.allowed_entry2 ? "opacity-60" : ""}`}>
            <label htmlFor="entry2" className={`text-sm font-medium text-zeedo-orange ${limits?.allowed_entry2 ? "cursor-pointer" : "cursor-not-allowed"}`}>
              2ª entrada (-1.414 fib)
            </label>
            <button
              type="button"
              id="entry2"
              role="switch"
              aria-checked={limits?.allowed_entry2 ? entry2Enabled : false}
              aria-disabled={!limits?.allowed_entry2}
              onClick={() => limits?.allowed_entry2 && setEntry2Enabled((v) => !v)}
              disabled={!limits?.allowed_entry2}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-zeedo-orange focus:ring-offset-2 ${
                !limits?.allowed_entry2
                  ? "cursor-not-allowed bg-zeedo-black/20 dark:bg-white/10"
                  : `cursor-pointer ${entry2Enabled ? "bg-zeedo-orange" : "bg-zeedo-black/30 dark:bg-white/20"}`
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  limits?.allowed_entry2 && entry2Enabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
            {limits?.allowed_entry2 ? (
              <span className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
                {entry2Enabled ? "Ativada" : "Desativada"}
              </span>
            ) : (
              <span className="text-sm text-amber-600 dark:text-amber-500">
                Indisponível no plano atual. Faça upgrade para o plano Pro para ter acesso.
              </span>
            )}
          </div>

          <hr className="border-zeedo-orange/20" />
          <h3 className="font-medium text-zeedo-black dark:text-zeedo-white">Controles de risco</h3>

          <div className="space-y-4">
            <div title={`Limite do plano: ${limits.target_loss_min} – ${limits.target_loss_max} USD`}>
              <label htmlFor="target_loss" className="block text-sm font-medium text-zeedo-orange mb-1">
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
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                Plano: {limits.target_loss_min} – {limits.target_loss_max} USD
              </p>
            </div>
            <div title={`Limite do plano: 1 – ${limits.max_positions}`}>
              <label htmlFor="max_positions" className="block text-sm font-medium text-zeedo-orange mb-1">
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
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                Plano: até {limits.max_positions}
              </p>
            </div>
            <div title={`Limite do plano: até ${limits.max_global_exposure_usd} USD`}>
              <label htmlFor="max_global" className="block text-sm font-medium text-zeedo-orange mb-1">
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
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                Plano: até {limits.max_global_exposure_usd.toLocaleString()} USD
              </p>
            </div>
            <div title={`Limite do plano: até ${limits.max_single_position_usd} USD`}>
              <label htmlFor="max_single" className="block text-sm font-medium text-zeedo-orange mb-1">
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
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
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
