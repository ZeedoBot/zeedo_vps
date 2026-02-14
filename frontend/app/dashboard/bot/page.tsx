"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPut } from "@/lib/api";

type BotConfig = {
  bot_enabled: boolean;
  symbols: string[];
  timeframes: string[];
  trade_mode: string;
  target_loss_usd: number;
  max_global_exposure: number;
  max_single_pos_exposure: number;
  max_positions: number;
};

const SYMBOLS_OPTIONS = ["BTC", "ETH", "SOL", "DOGE", "AVAX", "LINK", "ARB", "OP", "SUI", "PEPE"];
const TIMEFRAMES_OPTIONS = ["5m", "15m", "30m", "1h", "4h"];

export default function BotPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [symbolsInput, setSymbolsInput] = useState<string[]>([]);
  const [timeframesInput, setTimeframesInput] = useState<string[]>([]);

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

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiPut(
        "/bot/config",
        {
          symbols: symbolsInput,
          timeframes: timeframesInput,
          trade_mode: config?.trade_mode ?? "BOTH",
          target_loss_usd: config?.target_loss_usd ?? 5,
          max_global_exposure: config?.max_global_exposure ?? 5000,
          max_single_pos_exposure: config?.max_single_pos_exposure ?? 2500,
          max_positions: config?.max_positions ?? 2,
        },
        session.access_token
      );
      setConfig((c) => (c ? { ...c, symbols: symbolsInput, timeframes: timeframesInput } : null));
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

  if (loading) return <p className="text-gray-500">Carregando…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Controle do bot</h1>

      <div className="card max-w-xl mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-gray-900">Ligar / desligar</h2>
            <p className="text-sm text-gray-600">O bot só opera quando está ligado e com carteira e Telegram configurados.</p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle(!config?.bot_enabled)}
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              config?.bot_enabled
                ? "bg-red-100 text-red-800 hover:bg-red-200"
                : "bg-green-100 text-green-800 hover:bg-green-200"
            }`}
          >
            {config?.bot_enabled ? "Desligar" : "Ligar"}
          </button>
        </div>
        {message && (
          <p className={`mt-3 text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="card max-w-xl">
        <h2 className="font-medium text-gray-900 mb-4">Configurações</h2>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Símbolos</label>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymbol(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    symbolsInput.includes(s) ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timeframes</label>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTimeframe(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    timeframesInput.includes(t) ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="trade_mode" className="block text-sm font-medium text-gray-700 mb-1">
              Modo
            </label>
            <select
              id="trade_mode"
              value={config?.trade_mode ?? "BOTH"}
              onChange={(e) => setConfig((c) => (c ? { ...c, trade_mode: e.target.value } : null))}
              className="input-field max-w-xs"
            >
              <option value="BOTH">Long e Short</option>
              <option value="LONG_ONLY">Apenas Long</option>
              <option value="SHORT_ONLY">Apenas Short</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </form>
      </div>
    </div>
  );
}
