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
  can_customize_targets?: boolean;
  can_customize_stop?: boolean;
};

type BotConfig = {
  bot_enabled: boolean;
  signal_mode?: boolean;
  symbols: string[];
  timeframes: string[];
  trade_mode: string;
  target_loss_usd: number;
  max_single_pos_exposure: number;
  max_positions: number;
  stop_multiplier?: number;
  entry1_multiplier?: number;
  target1_level?: number;
  target1_percent?: number;
  target2_level?: number;
  target2_percent?: number;
  target3_level?: number;
  target3_percent?: number;
  /** CONSERVADOR | MEDIANO | AGRESSIVO | DEGEN | CUSTOM | null (inferir pelos números) */
  strategy_preset?: string | null;
  plan_limits?: PlanLimits;
  /** false = conta com menos de 7 dias; preset Degen bloqueado na UI e na API */
  degen_strategy_unlocked?: boolean;
};

const TRADE_MODE_LABELS: Record<string, string> = {
  BOTH: "Long e Short",
  LONG_ONLY: "Apenas Long",
  SHORT_ONLY: "Apenas Short",
};

type StrategyKey = "CONSERVADOR" | "MEDIANO" | "AGRESSIVO" | "DEGEN" | "CUSTOM";

const STRATEGY_KEYS: StrategyKey[] = ["CONSERVADOR", "MEDIANO", "AGRESSIVO", "DEGEN", "CUSTOM"];

function parseStoredStrategy(v: unknown): StrategyKey | null {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim().toUpperCase();
  return STRATEGY_KEYS.includes(s as StrategyKey) ? (s as StrategyKey) : null;
}

type StrategyPreset = {
  label: string;
  /** Linha curta (ex.: Stop longo) */
  tagline: string;
  /** Segunda linha opcional (ex.: Mediano) */
  taglineSecondary?: string;
  assertividadePct: string;
  /** Sufixo após "Risco : Retorno " (ex.: "~1:1.2") */
  riscoRetorno: string;
  stopMultiplier: string;
  entry1Multiplier: string;
  target1Level: string;
  target1Percent: number;
  target2Level: string;
  target2Percent: number;
  target3Level: string;
  target3Percent: number;
};

const STRATEGY_PRESETS: Record<Exclude<StrategyKey, "CUSTOM">, StrategyPreset> = {
  CONSERVADOR: {
    label: "Conservador",
    tagline: "Stop Longo",
    assertividadePct: "~75%",
    riscoRetorno: "~1:1.2",
    stopMultiplier: "3.1",
    entry1Multiplier: "0.618",
    target1Level: "0.5",
    target1Percent: 5,
    target2Level: "1.6",
    target2Percent: 60,
    target3Level: "3.3",
    target3Percent: 35,
  },
  MEDIANO: {
    label: "Mediano",
    tagline: "Entrada afastada",
    taglineSecondary: "Menos trades ativados",
    assertividadePct: "~60%",
    riscoRetorno: "~1:1.7",
    stopMultiplier: "3.1",
    entry1Multiplier: "1.8",
    target1Level: "-0.618",
    target1Percent: 3,
    target2Level: "0.55",
    target2Percent: 97,
    target3Level: "0",
    target3Percent: 0,
  },
  AGRESSIVO: {
    label: "Agressivo",
    tagline: "Stop curto",
    assertividadePct: "~45%",
    riscoRetorno: "~1:3",
    stopMultiplier: "1.62",
    entry1Multiplier: "0.618",
    target1Level: "0.5",
    target1Percent: 3,
    target2Level: "1.6",
    target2Percent: 22,
    target3Level: "3.3",
    target3Percent: 75,
  },
  DEGEN: {
    label: "Degen",
    tagline: "Stop muito curto!",
    assertividadePct: "~40%",
    riscoRetorno: "~1:5",
    stopMultiplier: "1.39",
    entry1Multiplier: "0.618",
    target1Level: "0.5",
    target1Percent: 3,
    target2Level: "1.6",
    target2Percent: 17,
    target3Level: "3.33",
    target3Percent: 80,
  },
};

const UPGRADE_TOOLTIP_STRATEGIES =
  "Faça Upgrade para o Plano Pro para automatizar seus Trades e testar diferentes Estratégias validadas e pré definidas.";
const UPGRADE_TOOLTIP_RISK =
  "Faça Upgrade para o Plano Pro para automatizar seus Trades e personalizar seu próprio gerenciamento de risco de forma automática.";
const DEGEN_LOCK_MESSAGE =
  "Devido ao alto risco e baixo WinRate, essa estratégia só é liberada após uma semana de uso. Primeiro, entenda como as estratégias do Zeedo funcionam antes de usá-la.";

function ProPlanLockHint({
  message,
  hintKey,
  openKey,
  setOpenKey,
}: {
  message: string;
  hintKey: "risk" | "strategy";
  openKey: "risk" | "strategy" | null;
  setOpenKey: (k: "risk" | "strategy" | null) => void;
}) {
  const open = openKey === hintKey;
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zeedo-orange hover:bg-zeedo-orange/15 focus:outline-none focus:ring-2 focus:ring-zeedo-orange"
        title={message}
        aria-expanded={open}
        aria-label="Informação sobre upgrade ao plano Pro"
        onClick={() => setOpenKey(open ? null : hintKey)}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-30 mt-1 w-[min(100vw-2rem,18rem)] rounded-lg border border-zeedo-orange/25 bg-zeedo-white p-2 text-xs text-zeedo-black shadow-md dark:bg-zeedo-black dark:text-zeedo-white">
          {message}
        </span>
      ) : null}
    </span>
  );
}

export default function BotPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [symbolsInput, setSymbolsInput] = useState<string[]>([]);
  const [timeframesInput, setTimeframesInput] = useState<string[]>([]);
  const [targetLoss, setTargetLoss] = useState<number | "">(5);
  const [maxPositions, setMaxPositions] = useState<number | "">(2);
  const [signalMode, setSignalMode] = useState(false);
  const [lockHintOpen, setLockHintOpen] = useState<"risk" | "strategy" | null>(null);
  const [degenStrategyUnlocked, setDegenStrategyUnlocked] = useState(true);
  const [degenLockHintOpen, setDegenLockHintOpen] = useState(false);

  // Estados para alvos e stop customizados
  const [stopMultiplier, setStopMultiplier] = useState<number | string>("1.8");
  const [entry1Multiplier, setEntry1Multiplier] = useState<number | string>("0.618");
  const [target1Level, setTarget1Level] = useState<number | string>("0.618");
  const [target1Percent, setTarget1Percent] = useState<number | "">(50);
  const [target2Level, setTarget2Level] = useState<number | string>("1.0");
  const [target2Percent, setTarget2Percent] = useState<number | "">(50);
  const [target3Level, setTarget3Level] = useState<number | string>("0");
  const [target3Percent, setTarget3Percent] = useState<number | "">(0);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>("CUSTOM");

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
        setSignalMode(
          data.plan_limits?.plan === "basic" ? true : (data.signal_mode ?? false),
        );

        const inferred = detectStrategy({
          stopMultiplier: data.stop_multiplier,
          entry1Multiplier: data.entry1_multiplier,
          target1Level: data.target1_level,
          target1Percent: data.target1_percent,
          target2Level: data.target2_level ?? 0,
          target2Percent: data.target2_percent ?? 0,
          target3Level: data.target3_level ?? 0,
          target3Percent: data.target3_percent ?? 0,
        });
        const stored = parseStoredStrategy(data.strategy_preset);
        const degenOk = data.degen_strategy_unlocked !== false;
        setDegenStrategyUnlocked(degenOk);
        let strategy: StrategyKey = stored ?? inferred;
        if (!degenOk && strategy === "DEGEN") {
          strategy = "MEDIANO";
          const m = STRATEGY_PRESETS.MEDIANO;
          setStopMultiplier(m.stopMultiplier);
          setEntry1Multiplier(m.entry1Multiplier);
          setTarget1Level(m.target1Level);
          setTarget1Percent(m.target1Percent);
          setTarget2Level(m.target2Level);
          setTarget2Percent(m.target2Percent);
          setTarget3Level(m.target3Level);
          setTarget3Percent(m.target3Percent);
        } else {
          setStopMultiplier((data.stop_multiplier ?? 1.8).toString());
          setEntry1Multiplier((data.entry1_multiplier ?? 0.618).toString());
          setTarget1Level((data.target1_level ?? 0.618).toString());
          setTarget1Percent(data.target1_percent ?? 50);
          setTarget2Level((data.target2_level ?? 1.0).toString());
          setTarget2Percent(data.target2_percent ?? 50);
          setTarget3Level((data.target3_level ?? 0).toString());
          setTarget3Percent(data.target3_percent ?? 0);
        }
        setSelectedStrategy(strategy);
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
  function normalizeDecimalInput(val: string | number): string {
    const str = typeof val === 'number' ? val.toString() : val;
    return str.replace(',', '.');
  }

  // Valida se é um número decimal válido (aceita vírgula ou ponto)
  function isValidDecimal(val: string): boolean {
    if (val === "" || val === "." || val === "," || val === "0." || val === "0,") return true;
    return /^\d*[.,]?\d*$/.test(val);
  }

  function isValidSignedDecimal(val: string): boolean {
    if (val === "" || val === "-" || val === "." || val === "," || val === "-." || val === "-," || val === "0." || val === "0,") return true;
    return /^-?\d*[.,]?\d*$/.test(val);
  }

  function toNumber(value: unknown, fallback: number): number {
    if (typeof value === "number" && !isNaN(value)) return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(",", "."));
      if (!isNaN(parsed)) return parsed;
    }
    return fallback;
  }

  function isSameValue(a: number, b: number, tolerance = 0.001): boolean {
    return Math.abs(a - b) <= tolerance;
  }

  function matchesPreset(
    values: {
      stopMultiplier: number;
      entry1Multiplier: number;
      target1Level: number;
      target1Percent: number;
      target2Level: number;
      target2Percent: number;
      target3Level: number;
      target3Percent: number;
    },
    preset: StrategyPreset,
  ): boolean {
    return (
      isSameValue(values.stopMultiplier, toNumber(preset.stopMultiplier, 0)) &&
      isSameValue(values.entry1Multiplier, toNumber(preset.entry1Multiplier, 0)) &&
      isSameValue(values.target1Level, toNumber(preset.target1Level, 0)) &&
      values.target1Percent === preset.target1Percent &&
      isSameValue(values.target2Level, toNumber(preset.target2Level, 0)) &&
      values.target2Percent === preset.target2Percent &&
      isSameValue(values.target3Level, toNumber(preset.target3Level, 0)) &&
      values.target3Percent === preset.target3Percent
    );
  }

  function detectStrategy(values: {
    stopMultiplier?: number | string | null;
    entry1Multiplier?: number | string | null;
    target1Level?: number | string | null;
    target1Percent?: number | string | null;
    target2Level?: number | string | null;
    target2Percent?: number | string | null;
    target3Level?: number | string | null;
    target3Percent?: number | string | null;
  }): StrategyKey {
    const normalized = {
      stopMultiplier: toNumber(values.stopMultiplier, 1.8),
      entry1Multiplier: toNumber(values.entry1Multiplier, 0.618),
      target1Level: toNumber(values.target1Level, 0.618),
      target1Percent: Math.round(toNumber(values.target1Percent, 50)),
      target2Level: toNumber(values.target2Level, 0),
      target2Percent: Math.round(toNumber(values.target2Percent, 0)),
      target3Level: toNumber(values.target3Level, 0),
      target3Percent: Math.round(toNumber(values.target3Percent, 0)),
    };

    const order: Exclude<StrategyKey, "CUSTOM">[] = ["CONSERVADOR", "MEDIANO", "AGRESSIVO", "DEGEN"];
    for (const key of order) {
      if (matchesPreset(normalized, STRATEGY_PRESETS[key])) {
        return key;
      }
    }
    return "CUSTOM";
  }

  function applyStrategyPreset(key: Exclude<StrategyKey, "CUSTOM">) {
    const preset = STRATEGY_PRESETS[key];
    setStopMultiplier(preset.stopMultiplier);
    setEntry1Multiplier(preset.entry1Multiplier);
    setTarget1Level(preset.target1Level);
    setTarget1Percent(preset.target1Percent);
    setTarget2Level(preset.target2Level);
    setTarget2Percent(preset.target2Percent);
    setTarget3Level(preset.target3Level);
    setTarget3Percent(preset.target3Percent);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!limits) return;
    if (selectedStrategy === "DEGEN" && !degenStrategyUnlocked) {
      setMessage({ type: "err", text: DEGEN_LOCK_MESSAGE });
      return;
    }
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    const tl = clampValue(typeof targetLoss === "number" ? targetLoss : limits.target_loss_min, limits.target_loss_min, limits.target_loss_max);
    const mp = clampValue(typeof maxPositions === "number" ? maxPositions : 1, 1, limits.max_positions);
    const msp = limits.max_single_position_usd;
    const presetForSave: StrategyPreset | null =
      selectedStrategy !== "CUSTOM"
        ? STRATEGY_PRESETS[selectedStrategy as Exclude<StrategyKey, "CUSTOM">]
        : null;
    try {
      const isBasicSave = limits.plan === "basic";
      const payload: Record<string, unknown> = {
        symbols: symbolsInput,
        timeframes: timeframesInput,
        trade_mode: config?.trade_mode ?? "BOTH",
        signal_mode: isBasicSave ? true : signalMode,
      };
      if (!isBasicSave) {
        payload.target_loss_usd = tl;
        payload.max_global_exposure = limits.max_global_exposure_usd;
        payload.max_single_pos_exposure = msp;
        payload.max_positions = mp;
      }

      if (!isBasicSave && limits?.can_customize_stop) {
        const stopSrc = presetForSave?.stopMultiplier ?? stopMultiplier;
        const entry1Src = presetForSave?.entry1Multiplier ?? entry1Multiplier;
        const stopNormalized = typeof stopSrc === "string" ? normalizeDecimalInput(stopSrc) : stopSrc.toString();
        const stopNum = parseFloat(stopNormalized);
        if (!isNaN(stopNum)) {
          payload.stop_multiplier = stopNum;
        }
        const entry1Normalized = typeof entry1Src === "string" ? normalizeDecimalInput(entry1Src) : entry1Src.toString();
        const entry1Num = parseFloat(entry1Normalized);
        if (!isNaN(entry1Num)) {
          payload.entry1_multiplier = entry1Num;
        }
      }
      if (!isBasicSave && limits?.can_customize_targets) {
        const t1Src = presetForSave?.target1Level ?? target1Level;
        const t1p = presetForSave?.target1Percent ?? target1Percent;
        const t1Normalized = typeof t1Src === "string" ? normalizeDecimalInput(t1Src) : t1Src.toString();
        const t1Level = parseFloat(t1Normalized);
        if (!isNaN(t1Level)) payload.target1_level = t1Level;
        if (typeof t1p === "number") payload.target1_percent = t1p;
        
        // Alvo 2 é opcional
        const t2Src = presetForSave?.target2Level ?? target2Level;
        const t2p = presetForSave?.target2Percent ?? target2Percent;
        const t2Normalized = typeof t2Src === "string" ? normalizeDecimalInput(t2Src) : t2Src.toString();
        const t2Level = parseFloat(t2Normalized);
        if (!isNaN(t2Level) && t2Level > 0 && typeof t2p === "number" && t2p > 0) {
          payload.target2_level = t2Level;
          payload.target2_percent = t2p;
        } else {
          payload.target2_level = null;
          payload.target2_percent = 0;
        }
        
        // Alvo 3 é opcional
        const t3Src = presetForSave?.target3Level ?? target3Level;
        const t3p = presetForSave?.target3Percent ?? target3Percent;
        const t3Normalized = typeof t3Src === "string" ? normalizeDecimalInput(t3Src) : t3Src.toString();
        const t3Level = parseFloat(t3Normalized);
        if (!isNaN(t3Level) && t3Level > 0 && typeof t3p === "number" && t3p > 0) {
          payload.target3_level = t3Level;
          payload.target3_percent = t3p;
        } else {
          payload.target3_level = null;
          payload.target3_percent = 0;
        }
      }
      if (!isBasicSave && (limits?.can_customize_targets || limits?.can_customize_stop)) {
        payload.strategy_preset = selectedStrategy;
      }

      await apiPut(
        "/bot/config",
        payload,
        session.access_token
      );
      if (!isBasicSave && selectedStrategy !== "CUSTOM") {
        applyStrategyPreset(selectedStrategy as Exclude<StrategyKey, "CUSTOM">);
      }
      setConfig((c) =>
        c
          ? {
              ...c,
              symbols: symbolsInput,
              timeframes: timeframesInput,
              ...(isBasicSave
                ? { signal_mode: true as boolean }
                : {
                    target_loss_usd: tl,
                    max_positions: mp,
                    max_single_pos_exposure: msp,
                    signal_mode: signalMode,
                    strategy_preset:
                      limits?.can_customize_targets || limits?.can_customize_stop
                        ? selectedStrategy
                        : c.strategy_preset,
                  }),
            }
          : null
      );
      if (!isBasicSave) {
        setTargetLoss(tl);
        setMaxPositions(mp);
      }
      if (isBasicSave) {
        setSignalMode(true);
      }
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
  const isBasicPlan = limits.plan === "basic";

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
          Opções em laranja significam ativos.
          <br />
          Não esqueça de sempre clicar em Salvar Configurações.
        </p>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zeedo-orange mb-2">Símbolos</label>
            <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
              {symbolsOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymbol(s)}
                  className={`w-full rounded-lg px-2 py-1 text-xs sm:w-auto sm:px-3 sm:py-1.5 sm:text-sm border transition-colors ${
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
            <div className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap">
              {timeframesOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTimeframe(t)}
                  className={`w-full rounded-lg px-2 py-1 text-xs sm:w-auto sm:px-3 sm:py-1.5 sm:text-sm border transition-colors ${
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
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {tradeModeOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setConfig((c) => (c ? { ...c, trade_mode: m } : null))}
                  className={`w-full rounded-lg px-2 py-1 text-xs sm:w-auto sm:px-3 sm:py-1.5 sm:text-sm border transition-colors ${
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-zeedo-orange">Modo Sinal:</span>
              {isBasicPlan ? (
                <>
                  <span
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-zeedo-orange opacity-90"
                    aria-hidden
                  >
                    <span className="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0" />
                  </span>
                  <span className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">Sempre ativado</span>
                </>
              ) : (
                <>
                  <label htmlFor="signal-mode" className="sr-only">
                    Modo Sinal
                  </label>
                  <button
                    type="button"
                    id="signal-mode"
                    role="switch"
                    aria-checked={signalMode}
                    onClick={() => setSignalMode((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-zeedo-orange focus:ring-offset-2 ${
                      signalMode ? "bg-zeedo-orange" : "bg-zeedo-black/30 dark:bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                        signalMode ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
                    {signalMode ? "Ativado" : "Desativado"}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
              {isBasicPlan
                ? "No plano Basic o Zeedo envia apenas sinais (Telegram); não executa trades automaticamente pela plataforma."
                : "Ative o Modo Sinal se não desejar que o Zeedo ative nenhum trade automáticamente."}
            </p>
          </div>

          <hr className="border-zeedo-orange/20" />
          {isBasicPlan ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white">Controles de risco</h3>
                <ProPlanLockHint
                  message={UPGRADE_TOOLTIP_RISK}
                  hintKey="risk"
                  openKey={lockHintOpen}
                  setOpenKey={setLockHintOpen}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white">Estratégias</h3>
                <ProPlanLockHint
                  message={UPGRADE_TOOLTIP_STRATEGIES}
                  hintKey="strategy"
                  openKey={lockHintOpen}
                  setOpenKey={setLockHintOpen}
                />
              </div>
            </div>
          ) : (
            <>
          <h3 className="font-medium text-zeedo-black dark:text-zeedo-white">Controles de risco</h3>

          <div className="space-y-4">
            <div title={`Limite do plano: ${limits.target_loss_min} – ${limits.target_loss_max} USD`}>
              <label htmlFor="target_loss" className="block text-sm font-medium text-zeedo-orange mb-1">
                Target Loss
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
                {limits.plan === "satoshi" ? "Ilimitado" : `Máx. ${limits.target_loss_min} – ${limits.target_loss_max} USD`}
              </p>
              <p className="mt-1 text-xs text-zeedo-black/70 dark:text-zeedo-white/70">
                Valor em USD que você arrisca por trade.
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
                {limits.plan === "satoshi" ? "Ilimitado" : `Máx. ${limits.max_positions}`}
              </p>
            </div>
          </div>
            </>
          )}

          {/* Estratégias (apenas Pro e Satoshi) */}
          {(limits?.can_customize_targets || limits?.can_customize_stop) && (
            <>
              <hr className="border-zeedo-orange/20" />
              <h3 className="font-medium text-zeedo-black dark:text-zeedo-white">
                Estratégias
              </h3>
              <div className="space-y-2">
                {(Object.entries(STRATEGY_PRESETS) as [Exclude<StrategyKey, "CUSTOM">, StrategyPreset][]).map(([key, preset]) => {
                  const degenLocked = key === "DEGEN" && !degenStrategyUnlocked;
                  if (degenLocked) {
                    return (
                      <span key={key} className="relative block w-full">
                        <button
                          type="button"
                          title={DEGEN_LOCK_MESSAGE}
                          aria-expanded={degenLockHintOpen}
                          onClick={() => setDegenLockHintOpen((o) => !o)}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm border border-dashed border-zeedo-orange/40 text-zeedo-black/50 dark:text-zeedo-white/50 bg-zeedo-black/[0.02] dark:bg-white/[0.04] cursor-pointer hover:bg-zeedo-orange/5"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>{preset.label}</span>
                            <svg
                              className="h-4 w-4 shrink-0 text-zeedo-orange/70"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                          </span>
                        </button>
                        {degenLockHintOpen ? (
                          <span className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border border-zeedo-orange/25 bg-zeedo-white p-2 text-xs text-zeedo-black shadow-md dark:bg-zeedo-black dark:text-zeedo-white">
                            {DEGEN_LOCK_MESSAGE}
                          </span>
                        ) : null}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDegenLockHintOpen(false);
                        setSelectedStrategy(key);
                        applyStrategyPreset(key);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm border transition-colors ${
                        selectedStrategy === key
                          ? "bg-zeedo-orange text-white border-zeedo-orange"
                          : "border-zeedo-orange/30 text-zeedo-black dark:text-zeedo-white hover:bg-zeedo-orange/10"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSelectedStrategy("CUSTOM")}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm border transition-colors ${
                    selectedStrategy === "CUSTOM"
                      ? "bg-zeedo-orange text-white border-zeedo-orange"
                      : "border-zeedo-orange/30 text-zeedo-black dark:text-zeedo-white hover:bg-zeedo-orange/10"
                  }`}
                >
                  Personalizada (Avançado)
                </button>
              </div>

              {selectedStrategy !== "CUSTOM" ? (
                <div className="rounded-lg border border-zeedo-orange/30 bg-zeedo-orange/5 p-4 space-y-1">
                  <p className="text-sm font-semibold text-zeedo-black dark:text-zeedo-white">
                    {STRATEGY_PRESETS[selectedStrategy].label}
                  </p>
                  <p className="text-xs text-zeedo-black/80 dark:text-zeedo-white/80">
                    {STRATEGY_PRESETS[selectedStrategy].tagline}
                  </p>
                  {STRATEGY_PRESETS[selectedStrategy].taglineSecondary ? (
                    <p className="text-xs text-zeedo-black/80 dark:text-zeedo-white/80">
                      {STRATEGY_PRESETS[selectedStrategy].taglineSecondary}
                    </p>
                  ) : null}
                  <p className="text-xs text-zeedo-black/70 dark:text-zeedo-white/70">
                    Assertividade Média: {STRATEGY_PRESETS[selectedStrategy].assertividadePct}
                  </p>
                  <p className="text-xs text-zeedo-black/70 dark:text-zeedo-white/70">
                    Risco : Retorno {STRATEGY_PRESETS[selectedStrategy].riscoRetorno}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                  Ajuste manual de entradas, stop e alvos.
                </p>
              )}

              {/* Aviso para iniciantes */}
              {selectedStrategy === "CUSTOM" && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex gap-3">
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        Atenção
                      </p>
                      <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                        Se você é iniciante e não assistiu as aulas, não altere nada aqui.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Redefinir Padrão */}
              {selectedStrategy === "CUSTOM" && (
                <button
                  type="button"
                  onClick={() => {
                    setStopMultiplier("1.8");
                    setEntry1Multiplier("0.618");
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
              
              {selectedStrategy === "CUSTOM" && limits?.can_customize_stop && (
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
                            setStopMultiplier(clampValue(num, 1.0, 10.0).toString());
                          } else {
                            setStopMultiplier("1.8");
                          }
                        }
                      }}
                      className="input-field max-w-xs"
                    />
                  </div>

                  <div>
                    <label htmlFor="entry1_multiplier" className="block text-sm font-medium text-zeedo-orange mb-1">
                      Entrada (Fib / trigger)
                    </label>
                    <input
                      id="entry1_multiplier"
                      type="text"
                      inputMode="decimal"
                      value={entry1Multiplier}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isValidDecimal(val)) {
                          setEntry1Multiplier(val);
                        }
                      }}
                      onBlur={() => {
                        const normalized = normalizeDecimalInput(entry1Multiplier);
                        if (normalized === "" || normalized === ".") {
                          setEntry1Multiplier("0.618");
                        } else {
                          const num = Number(normalized);
                          if (!isNaN(num)) {
                            setEntry1Multiplier(clampValue(num, 0.0, 3.0).toString());
                          } else {
                            setEntry1Multiplier("0.618");
                          }
                        }
                      }}
                      className="input-field max-w-xs"
                    />
                  </div>
                </div>
              )}

              {selectedStrategy === "CUSTOM" && limits?.can_customize_targets && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-zeedo-orange mb-1">
                      Alvos de Realização
                    </h3>
                    <p className="text-sm text-zeedo-black/70 dark:text-zeedo-white/70 leading-tight">
                      Alvo 1 é obrigatório.<br />
                      Alvos 2 e 3 são opcionais (deixe em 0 para desativar).<br />
                      A soma dos percentuais deve ser 100%.
                    </p>
                  </div>
                  
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
