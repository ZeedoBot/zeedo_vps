"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";

type Position = {
  symbol: string;
  tf: string;
  side: string;
  entry_px: number;
  usd_val: number;
  planned_stop: number;
  placed_at: number;
  status: string;
  size?: number;
  unrealized_pnl?: number;
};

type BlockedTrade = {
  id: string;
  symbol: string;
  tf: string;
  side: string;
  entry_px: number;
  entry2_px: number;
  stop_real: number;
  qty: number;
  reason: string;
  created_at?: string;
};

type OverviewData = {
  balance: number;
  trades: unknown[];
  open_positions: Position[];
  pending_positions: Position[];
  blocked_trades?: BlockedTrade[];
};

export default function TradesPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [closePct, setClosePct] = useState<Record<string, number>>({});
  const [executingId, setExecutingId] = useState<string | null>(null);

  async function load(showRefreshing = false) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    try {
      if (showRefreshing) setRefreshing(true);
      setError("");
      const ov = await apiGet<OverviewData>("/dashboard/overview", session.access_token);
      setOverview(ov);
    } catch {
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleExecuteBlocked(id: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setExecutingId(id);
    setError("");
    try {
      await apiPost("/dashboard/execute-blocked-trade", { id }, session.access_token);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao acionar trade.");
    } finally {
      setExecutingId(null);
    }
  }

  async function handleClose(symbol: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const pct = closePct[symbol] ?? 100;
    setClosing(symbol);
    setError("");
    try {
      await apiPost("/dashboard/close-position", { symbol, pct }, session.access_token);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar posição.");
    } finally {
      setClosing(null);
    }
  }

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white">
        Trades
      </h1>
      <p className="text-zeedo-black/60 dark:text-zeedo-white/60 -mt-4">
        Posições em aberto e pendentes na sua conta Hyperliquid.
      </p>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white">
              🟢 Posições Ativas
            </h2>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="text-sm text-zeedo-orange hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
          {overview?.open_positions && overview.open_positions.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
              <table className="min-w-full divide-y divide-zeedo-orange/20">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Ticker</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">TF</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Lado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Valor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">PnL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Stop</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Fechar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zeedo-orange/20">
                  {overview.open_positions.map((p) => (
                    <tr key={`${p.symbol}-${p.tf}-${p.side}`}>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.symbol}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.tf}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.side}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.entry_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.usd_val}</td>
                      <td className={`px-4 py-2 text-sm text-right font-medium ${(p.unrealized_pnl ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {p.unrealized_pnl != null ? `${p.unrealized_pnl >= 0 ? "+" : ""}$${p.unrealized_pnl.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">{p.planned_stop ? `$${p.planned_stop.toFixed(2)}` : "-"}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={closePct[p.symbol] ?? 100}
                            onChange={(e) => setClosePct((prev) => ({ ...prev, [p.symbol]: Number(e.target.value) }))}
                            className="rounded border border-zeedo-orange/40 bg-transparent px-2 py-1 text-xs text-zeedo-black dark:text-zeedo-white focus:border-zeedo-orange focus:outline-none"
                          >
                            <option value={100}>100%</option>
                            <option value={50}>50%</option>
                            <option value={25}>25%</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleClose(p.symbol)}
                            disabled={closing === p.symbol}
                            className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/30 disabled:opacity-50 dark:text-red-400"
                          >
                            {closing === p.symbol ? "…" : "Fechar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 py-4">Nenhuma posição ativa.</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            ⏳ Posições Pendentes
          </h2>
          {overview?.pending_positions && overview.pending_positions.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
              <table className="min-w-full divide-y divide-zeedo-orange/20">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Ticker</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">TF</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Lado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Valor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Stop</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zeedo-orange/20">
                  {overview.pending_positions.map((p) => (
                    <tr key={`${p.symbol}-${p.tf}-${p.side}`}>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.symbol}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.tf}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.side}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.entry_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.usd_val}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">{p.planned_stop ? `$${p.planned_stop.toFixed(2)}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 py-4">Nenhuma ordem pendente.</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            🚫 Trades Bloqueados: Ativação Manual
          </h2>
          <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 mb-4">
            Recomendação: Todos trades aqui estão de acordo com o setup, porém tem algum indicador adicional que bloqueou o trade.
            <em className="block mt-2">Isso não significa que é trade ruim.</em>
            Faça sua própria análise, se entender que é uma boa entrada, você pode acionar manualmente com um clique.
          </p>
          {overview?.blocked_trades && overview.blocked_trades.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
              <table className="min-w-full divide-y divide-zeedo-orange/20">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Ticker</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">TF</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Lado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Motivo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">1ª entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">2ª entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Stop</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zeedo-orange/20">
                  {overview.blocked_trades.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{b.symbol}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{b.tf}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{b.side}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black/70 dark:text-zeedo-white/70">
                        {b.reason === "LSR" && "LSR"}
                        {b.reason === "ativo_forte_24h" && "Ativo forte 24h"}
                        {b.reason === "ativo_fraco_24h" && "Ativo fraco 24h"}
                        {b.reason === "high_extremo" && "High extremo"}
                        {b.reason === "low_extremo" && "Low extremo"}
                        {b.reason === "limite_trades" && "Limite de trades"}
                        {b.reason === "symbol_ja_ativo" && "Símbolo já ativo em outro TF"}
                        {!["LSR","ativo_forte_24h","ativo_fraco_24h","high_extremo","low_extremo","limite_trades","symbol_ja_ativo"].includes(b.reason) && b.reason}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${b.entry_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${b.entry2_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${b.stop_real?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`https://app.hyperliquid.xyz/trade/${b.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zeedo-orange hover:underline"
                          >
                            Abrir HL
                          </a>
                          <button
                            type="button"
                            onClick={() => handleExecuteBlocked(b.id)}
                            disabled={executingId === b.id}
                            className="rounded-lg bg-zeedo-orange/20 px-2 py-1 text-xs font-medium text-zeedo-orange hover:bg-zeedo-orange/30 disabled:opacity-50 dark:text-orange-400"
                          >
                            {executingId === b.id ? "…" : "Acionar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 py-4">Nenhum trade bloqueado.</p>
          )}
        </section>
      </div>
    </div>
  );
}
