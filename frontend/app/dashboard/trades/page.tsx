"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet } from "@/lib/api";

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
};

type OverviewData = {
  balance: number;
  trades: unknown[];
  open_positions: Position[];
  pending_positions: Position[];
};

export default function TradesPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const ov = await apiGet<OverviewData>("/dashboard/overview", session.access_token);
        setOverview(ov);
      } catch {
        setError("Não foi possível carregar os dados.");
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white">
        Trades
      </h1>
      <p className="text-zeedo-black/60 dark:text-zeedo-white/60 -mt-4">
        Posições em aberto e pendentes na sua conta Hyperliquid.
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            🟢 Posições em Aberto
          </h2>
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
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Stop</th>
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
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">{p.planned_stop ? `$${p.planned_stop.toFixed(2)}` : "-"}</td>
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
      </div>
    </div>
  );
}
