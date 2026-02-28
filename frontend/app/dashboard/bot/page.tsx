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
  can_customize_targets?: boolean;
  can_customize_stop?: boolean;
};

type BotConfig = {
  bot_enabled: boolean;
  entry2_enabled?: boolean;
  symbols: string[];
  timeframes: string[];
  trade_mode: string;
  target_loss_usd: number;
  max_single_pos_exposure: number;
  max_positions: number;
  stop_multiplier?: number;
  entry2_multiplier?: number;
  entry2_adjust_last_target?: boolean;
  target1_level?: number;
  target1_percent?: number;
  target2_level?: number;
  target2_percent?: number;
  target3_level?: number;
  target3_percent?: number;
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
  const [targetLoss, setTargetLoss] = useState<number | "">(5);
  const [maxPositions, setMaxPositions] = useState<number | "">(2);
  const [maxSinglePosition, setMaxSinglePosition] = useState<number | "">(1250);
  const [entry2Enabled, setEntry2Enabled] = useState(true);
  
  // Estados para alvos e stop customizados
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopMultiplier, setStopMultiplier] = useState<number | string>("1.8");
  const [entry2Multiplier, setEntry2Multiplier] = useState<number | string>("1.414");
  const [entry2AdjustLastTarget, setEntry2AdjustLastTarget] = useState(true);
  const [target1Level, setTarget1Level] = useState<number | string>("0.618");
  const [target1Percent, setTarget1Percent] = useState<number | "">(50);
  const [target2Level, setTarget2Level] = useState<number | string>("1.0");
  const [target2Percent, setTarget2Percent] = useState<number | "">(50);
  const [target3Level, setTarget3Level] = useState<number | string>("0");
  const [target3Percent, setTarget3Percent] = useState<number | "">(0);

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
        const pl = data.plan_limits;
        setTargetLoss(data.target_loss_usd ?? 5);
        setMaxPositions(data.max_positions ?? 2);
        const maxSingle = data.max_single_pos_exposure ?? 1250;
        setMaxSinglePosition(pl ? Math.min(maxSingle, pl.max_single_position_usd) : maxSingle);
        setEntry2Enabled(data.entry2_enabled ?? true);
        
        // Carrega alvos e stop customizados
        setStopMultiplier((data.stop_multiplier ?? 1.8).toString());
        setEntry2Multiplier((data.entry2_multiplier ?? 1.414).toString());
        setEntry2AdjustLastTarget(data.entry2_adjust_last_target ?? true);
        setTarget1Level((data.target1_level ?? 0.618).toString());
        setTarget1Percent(data.target1_percent ?? 50);
        setTarget2Level((data.target2_level ?? 1.0).toString());
        setTarget2Percent(data.target2_percent ?? 50);
        setTarget3Level((data.target3_level ?? 0).toString());
        setTarget3Percent(data.target3_percent ?? 0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function clampValue(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
  }

  // Normaliza entrada decimal: aceita vírgula ou ponto
  function normalizeDecimalInput(val: string): string {
    return val.replace(',', '.');
  }

  // Valida se é um número decimal válido (aceita vírgula ou ponto)
  function isValidDecimal(val: string): boolean {
    if (val === "" || val === "." || val === "," || val === "0." || val === "0,") return true;
    return /^\d*[.,]?\d*$/.test(val);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!limits) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    const tl = clampValue(typeof targetLoss === "number" ? targetLoss : limits.target_loss_min, limits.target_loss_min, limits.target_loss_max);
    const mp = clampValue(typeof maxPositions === "number" ? maxPositions : 1, 1, limits.max_positions);
    const msp = Math.min(typeof maxSinglePosition === "number" ? maxSinglePosition : 0, limits.max_single_position_usd);
    try {
      const payload: Record<string, unknown> = {
        symbols: symbolsInput,
        timeframes: timeframesInput,
        trade_mode: config?.trade_mode ?? "BOTH",
        target_loss_usd: tl,
        max_global_exposure: limits.max_global_exposure_usd,
        max_single_pos_exposure: msp,
        max_positions: mp,
      };
      if (limits?.allowed_entry2) {
        payload.entry2_enabled = entry2Enabled;
      }
      
      // Adiciona alvos e stop customizados se o plano permitir
      if (limits?.can_customize_stop) {
        const stopNormalized = typeof stopMultiplier === "string" ? normalizeDecimalInput(stopMultiplier) : stopMultiplier.toString();
        const stopNum = parseFloat(stopNormalized);
        if (!isNaN(stopNum)) {
          payload.stop_multiplier = stopNum;
        }
        const entry2Normalized = typeof entry2Multiplier === "string" ? normalizeDecimalInput(entry2Multiplier) : entry2Multiplier.toString();
        const entry2Num = parseFloat(entry2Normalized);
        if (!isNaN(entry2Num)) {
          payload.entry2_multiplier = entry2Num;
        }
        payload.entry2_adjust_last_target = entry2AdjustLastTarget;
      }
      if (limits?.can_customize_targets) {
        const t1Normalized = typeof target1Level === "string" ? normalizeDecimalInput(target1Level) : target1Level.toString();
        const t1Level = parseFloat(t1Normalized);
        if (!isNaN(t1Level)) payload.target1_level = t1Level;
        if (typeof target1Percent === "number") payload.target1_percent = target1Percent;
        
        // Alvo 2 é opcional
        const t2Normalized = typeof target2Level === "string" ? normalizeDecimalInput(target2Level) : target2Level.toString();
        const t2Level = parseFloat(t2Normalized);
        if (!isNaN(t2Level) && t2Level > 0 && typeof target2Percent === "number" && target2Percent > 0) {
          payload.target2_level = t2Level;
          payload.target2_percent = target2Percent;
        } else {
          payload.target2_level = null;
          payload.target2_percent = 0;
        }
        
        // Alvo 3 é opcional
        const t3Normalized = typeof target3Level === "string" ? normalizeDecimalInput(target3Level) : target3Level.toString();
        const t3Level = parseFloat(t3Normalized);
        if (!isNaN(t3Level) && t3Level > 0 && typeof target3Percent === "number" && target3Percent > 0) {
          payload.target3_level = t3Level;
          payload.target3_percent = target3Percent;
        } else {
          payload.target3_level = null;
          payload.target3_percent = 0;
        }
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
              max_single_pos_exposure: msp,
            }
          : null
      );
      setTargetLoss(tl);
      setMaxPositions(mp);
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
            <label className="block text-sm font-medium text-zeedo-orange mb-2">Modo</label>
            <div className="flex flex-wrap gap-2">
              {tradeModeOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setConfig((c) => (c ? { ...c, trade_mode: m } : null))}
                  className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                    (config?.trade_mode ?? "BOTH") === m
                      ? "bg-zeedo-orange text-white border-zeedo-orange"
                      : "border-zeedo-orange/30 text-zeedo-black dark:text-zeedo-white hover:bg-zeedo-orange/10"
                  }`}
                >
                  {TRADE_MODE_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-2 ${!limits?.allowed_entry2 ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="entry2" className={`text-sm font-medium text-zeedo-orange ${limits?.allowed_entry2 ? "cursor-pointer" : "cursor-not-allowed"}`}>
                Segunda entrada:
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
            {limits?.allowed_entry2 && (
              <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                Se estiver ligada, Zeedo colocará uma ordem automática de segunda entrada. Caso você não queira automatizar a segunda entrada, deixe desmarcado.
              </p>
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
                type="text"
                inputMode="numeric"
                value={targetLoss}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === "") {
                    setTargetLoss("");
                    return;
                  }
                  const num = Number(val);
                  if (!isNaN(num)) {
                    setTargetLoss(clampValue(num, limits.target_loss_min, limits.target_loss_max));
                  }
                }}
                onBlur={() => {
                  if (targetLoss === "") {
                    setTargetLoss(limits.target_loss_min);
                  }
                }}
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                Máx. {limits.target_loss_min} – {limits.target_loss_max >= 99999 ? "Ilimitado" : `${limits.target_loss_max} USD`}
              </p>
              <p className="mt-1 text-xs text-zeedo-black/70 dark:text-zeedo-white/70">
                {entry2Enabled
                  ? "O target loss considera a média entre a 1ª e 2ª entrada. Se o stop for acionado apenas com a 1ª entrada, a perda será menor."
                  : "Target loss considera apenas a 1ª entrada."}
              </p>
            </div>
            <div title={`Limite do plano: 1 – ${limits.max_positions}`}>
              <label htmlFor="max_positions" className="block text-sm font-medium text-zeedo-orange mb-1">
                Trades simultâneos
              </label>
              <input
                id="max_positions"
                type="text"
                inputMode="numeric"
                value={maxPositions}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === "") {
                    setMaxPositions("");
                    return;
                  }
                  const num = Number(val);
                  if (!isNaN(num)) {
                    setMaxPositions(clampValue(num, 1, limits.max_positions));
                  }
                }}
                onBlur={() => {
                  if (maxPositions === "") {
                    setMaxPositions(1);
                  }
                }}
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                Máx. {limits.max_positions}
              </p>
            </div>
            <div title={limits.plan === "satoshi" ? "Ilimitado" : `Máx. ${limits.max_single_position_usd} USD`}>
              <label htmlFor="max_single" className="block text-sm font-medium text-zeedo-orange mb-1">
                Patrimônio por trade
              </label>
              <input
                id="max_single"
                type="text"
                inputMode="numeric"
                value={maxSinglePosition}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === "") {
                    setMaxSinglePosition("");
                    return;
                  }
                  const num = Number(val);
                  if (!isNaN(num)) {
                    setMaxSinglePosition(Math.min(num, limits.max_single_position_usd));
                  }
                }}
                onBlur={() => {
                  if (maxSinglePosition === "") {
                    setMaxSinglePosition(0);
                  }
                }}
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                {limits.plan === "satoshi" ? "Ilimitado" : `Máx. ${limits.max_single_position_usd.toLocaleString()} USD`}
              </p>
            </div>
          </div>

          {/* Configurações Avançadas (apenas Pro e Satoshi) */}
          {(limits?.can_customize_targets || limits?.can_customize_stop) && (
            <>
              <hr className="border-zeedo-orange/20" />
              
              {/* Botão para expandir/colapsar */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between rounded-lg bg-zeedo-orange/5 p-4 hover:bg-zeedo-orange/10 transition-colors"
              >
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white">
                  Configurações Avançadas
                </h3>
                <svg
                  className={`h-5 w-5 text-zeedo-orange transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Aviso para iniciantes */}
              {showAdvanced && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex gap-3">
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        ⚠️ Atenção
                      </p>
                      <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                        Se você é iniciante e não assistiu as aulas, não altere nada aqui. As configurações padrão já estão otimizadas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Redefinir Padrão */}
              {showAdvanced && (
                <button
                  type="button"
                  onClick={() => {
                    setStopMultiplier("1.8");
                    setEntry2Multiplier("1.414");
                    setEntry2AdjustLastTarget(true);
                    setTarget1Level("0.618");
                    setTarget1Percent(50);
                    setTarget2Level("1.0");
                    setTarget2Percent(50);
                    setTarget3Level("0");
                    setTarget3Percent(0);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-zeedo-orange/30 bg-zeedo-orange/5 px-4 py-2 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Redefinir Padrão
                </button>
              )}
              
              {showAdvanced && limits?.can_customize_stop && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="stop_multiplier" className="block text-sm font-medium text-zeedo-orange mb-1">
                      Stop Loss
                    </label>
                    <input
                      id="stop_multiplier"
                      type="text"
                      inputMode="decimal"
                      value={stopMultiplier}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isValidDecimal(val)) {
                          setStopMultiplier(val);
                        }
                      }}
                      onBlur={() => {
                        const normalized = normalizeDecimalInput(stopMultiplier);
                        if (normalized === "" || normalized === ".") {
                          setStopMultiplier("1.8");
                        } else {
                          const num = Number(normalized);
                          if (!isNaN(num)) {
                            setStopMultiplier(clampValue(num, 1.0, 3.0).toString());
                          } else {
                            setStopMultiplier("1.8");
                          }
                        }
                      }}
                      className="input-field max-w-xs"
                    />
                    <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                      Stop Padrão: 1.8 | Intervalo: 1.0 a 3.0
                    </p>
                  </div>

                  {limits?.allowed_entry2 && (
                    <>
                      <div>
                        <label htmlFor="entry2_multiplier" className="block text-sm font-medium text-zeedo-orange mb-1">
                          Entrada 2
                        </label>
                        <input
                          id="entry2_multiplier"
                          type="text"
                          inputMode="decimal"
                          value={entry2Multiplier}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isValidDecimal(val)) {
                              setEntry2Multiplier(val);
                            }
                          }}
                          onBlur={() => {
                            const normalized = normalizeDecimalInput(entry2Multiplier);
                            if (normalized === "" || normalized === ".") {
                              setEntry2Multiplier("1.414");
                            } else {
                              const num = Number(normalized);
                              if (!isNaN(num)) {
                                setEntry2Multiplier(clampValue(num, 0.618, 5.0).toString());
                              } else {
                                setEntry2Multiplier("1.414");
                              }
                            }
                          }}
                          className="input-field max-w-xs"
                        />
                        <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                          Entrada 2 Padrão: 1.414 | Intervalo: 0.618 a 5.0
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <span className="text-sm font-medium text-zeedo-black dark:text-zeedo-white">
                            Ajustar alvo após entrada 2?
                          </span>
                          <button
                            type="button"
                            onClick={() => setEntry2AdjustLastTarget(!entry2AdjustLastTarget)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              entry2AdjustLastTarget ? "bg-zeedo-orange" : "bg-zeedo-black/30 dark:bg-white/20"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                entry2AdjustLastTarget ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </label>
                        <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                          Se ativado: Ao pegar a entrada 2, o último alvo será ajustado para um alvo mais acessível.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {showAdvanced && limits?.can_customize_targets && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-zeedo-orange">
                    Alvos de Realização
                  </h3>
                  <p className="text-sm text-zeedo-black/70 dark:text-zeedo-white/70 leading-tight">
                    Alvo 1 é obrigatório.<br />
                    Alvos 2 e 3 são opcionais (deixe em 0 para desativar).<br />
                    A soma dos percentuais deve ser 100%.
                  </p>
                  
                  {/* Alvo 1 - OBRIGATÓRIO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="target1_level" className="block text-sm font-medium text-zeedo-orange mb-1">
                        Alvo 1 (Nível Fib) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="target1_level"
                        type="text"
                        inputMode="decimal"
                        value={target1Level}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isValidDecimal(val)) {
                            setTarget1Level(val);
                          }
                        }}
                        onBlur={() => {
                          const normalized = normalizeDecimalInput(target1Level);
                          if (normalized === "" || normalized === ".") {
                            setTarget1Level("0.618");
                          } else {
                            const num = Number(normalized);
                            if (!isNaN(num)) {
                              setTarget1Level(clampValue(num, 0, 5).toString());
                            } else {
                              setTarget1Level("0.618");
                            }
                          }
                        }}
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                        Ex: 0.618
                      </p>
                    </div>
                    <div>
                      <label htmlFor="target1_percent" className="block text-sm font-medium text-zeedo-orange mb-1">
                        Alvo 1 (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="target1_percent"
                        type="text"
                        inputMode="numeric"
                        value={target1Percent}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === "") {
                            setTarget1Percent("");
                            return;
                          }
                          const num = Number(val);
                          if (!isNaN(num)) {
                            setTarget1Percent(clampValue(num, 0, 100));
                          }
                        }}
                        onBlur={() => {
                          if (target1Percent === "") {
                            setTarget1Percent(50);
                          }
                        }}
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                        1 – 100% (obrigatório)
                      </p>
                    </div>
                  </div>

                  {/* Alvo 2 - OPCIONAL */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="target2_level" className="block text-sm font-medium text-zeedo-orange mb-1">
                        Alvo 2 (Nível Fib)
                      </label>
                      <input
                        id="target2_level"
                        type="text"
                        inputMode="decimal"
                        value={target2Level}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isValidDecimal(val)) {
                            setTarget2Level(val);
                          }
                        }}
                        onBlur={() => {
                          const normalized = normalizeDecimalInput(target2Level);
                          if (normalized === "" || normalized === ".") {
                            setTarget2Level("1.0");
                          } else {
                            const num = Number(normalized);
                            if (!isNaN(num)) {
                              setTarget2Level(clampValue(num, 0, 5).toString());
                            } else {
                              setTarget2Level("1.0");
                            }
                          }
                        }}
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                        Ex: 1.0 (deixe 0 para desativar)
                      </p>
                    </div>
                    <div>
                      <label htmlFor="target2_percent" className="block text-sm font-medium text-zeedo-orange mb-1">
                        Alvo 2 (%)
                      </label>
                      <input
                        id="target2_percent"
                        type="text"
                        inputMode="numeric"
                        value={target2Percent}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === "") {
                            setTarget2Percent("");
                            return;
                          }
                          const num = Number(val);
                          if (!isNaN(num)) {
                            setTarget2Percent(clampValue(num, 0, 100));
                          }
                        }}
                        onBlur={() => {
                          if (target2Percent === "") {
                            setTarget2Percent(0);
                          }
                        }}
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                        0 – 100% (deixe 0 para desativar)
                      </p>
                    </div>
                  </div>

                  {/* Alvo 3 - OPCIONAL */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="target3_level" className="block text-sm font-medium text-zeedo-orange mb-1">
                        Alvo 3 (Nível Fib)
                      </label>
                      <input
                        id="target3_level"
                        type="text"
                        inputMode="decimal"
                        value={target3Level}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isValidDecimal(val)) {
                            setTarget3Level(val);
                          }
                        }}
                        onBlur={() => {
                          const normalized = normalizeDecimalInput(target3Level);
                          if (normalized === "" || normalized === ".") {
                            setTarget3Level("0");
                          } else {
                            const num = Number(normalized);
                            if (!isNaN(num)) {
                              setTarget3Level(clampValue(num, 0, 5).toString());
                            } else {
                              setTarget3Level("0");
                            }
                          }
                        }}
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                        Ex: 1.618 (deixe 0 para desativar)
                      </p>
                    </div>
                    <div>
                      <label htmlFor="target3_percent" className="block text-sm font-medium text-zeedo-orange mb-1">
                        Alvo 3 (%)
                      </label>
                      <input
                        id="target3_percent"
                        type="text"
                        inputMode="numeric"
                        value={target3Percent}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === "") {
                            setTarget3Percent("");
                            return;
                          }
                          const num = Number(val);
                          if (!isNaN(num)) {
                            setTarget3Percent(clampValue(num, 0, 100));
                          }
                        }}
                        onBlur={() => {
                          if (target3Percent === "") {
                            setTarget3Percent(0);
                          }
                        }}
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                        0 – 100% (deixe 0 para desativar)
                      </p>
                    </div>
                  </div>

                  {/* Validação visual da soma */}
                  <div className="rounded-lg bg-zeedo-orange/10 p-3">
                    <p className="text-sm font-medium text-zeedo-black dark:text-zeedo-white">
                      Soma dos alvos: {
                        (typeof target1Percent === "number" ? target1Percent : 0) +
                        (typeof target2Percent === "number" ? target2Percent : 0) +
                        (typeof target3Percent === "number" ? target3Percent : 0)
                      }%
                    </p>
                    {(typeof target1Percent === "number" ? target1Percent : 0) <= 0 && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        ⚠️ Alvo 1 é obrigatório e deve ter percentual maior que 0%
                      </p>
                    )}
                    {((typeof target1Percent === "number" ? target1Percent : 0) +
                      (typeof target2Percent === "number" ? target2Percent : 0) +
                      (typeof target3Percent === "number" ? target3Percent : 0)) !== 100 && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        ⚠️ A soma deve ser exatamente 100%
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </form>
      </div>
    </div>
  );
}
