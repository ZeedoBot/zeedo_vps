"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type Trade = {
  trade_id: string;
  oid: string;
  token: string;
  side: string;
  tf: string;
  pnl_usd: number;
  size_usd: number;
  time: number;
};

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
  trades: Trade[];
  open_positions: Position[];
  pending_positions: Position[];
};

type BotStatus = { status: string };
type WalletStatus = { connected: boolean; wallet_address: string | null };
type TelegramStatus = { connected: boolean };

function groupTradesById(trades: Trade[]) {
  const map = new Map<string, { pnl: number; token: string; side: string; tf: string; time: number }>();
  for (const t of trades) {
    const key = t.trade_id !== "-" ? t.trade_id : t.oid;
    const existing = map.get(key);
    const pnl = t.pnl_usd;
    if (!existing) {
      map.set(key, { pnl, token: t.token, side: t.side, tf: t.tf, time: t.time });
    } else {
      existing.pnl += pnl;
      if (t.time > existing.time) existing.time = t.time;
    }
  }
  return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
}

function computeMetrics(trades: Trade[], balance: number) {
  const grouped = groupTradesById(trades);
  const totalPnl = grouped.reduce((s, t) => s + t.pnl, 0);
  const wins = grouped.filter((t) => t.pnl > 0);
  const losses = grouped.filter((t) => t.pnl < -1);
  const total = wins.length + losses.length;
  const winrate = total > 0 ? (wins.length / total) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const payoff = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const pnlPct = balance > 0 ? (totalPnl / balance) * 100 : 0;

  const sortedTrades = [...trades].sort((a, b) => a.time - b.time);
  const growthData: { time: number; date: string; balance: number }[] = [];
  let cum = 0;
  if (sortedTrades.length > 0) {
    growthData.push({
      time: sortedTrades[0].time - 1,
      date: "",
      balance: 0,
    });
  }
  for (const t of sortedTrades) {
    cum += t.pnl_usd;
    growthData.push({
      time: t.time,
      date: new Date(t.time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      balance: cum,
    });
  }

  return {
    totalPnl,
    totalTrades: grouped.length,
    winrate,
    avgWin,
    avgLoss,
    payoff,
    pnlPct,
    grouped,
    growthData,
  };
}

type GroupedTrade = { id: string; pnl: number; side: string; tf: string; token: string };
function groupBy(arr: GroupedTrade[], key: keyof GroupedTrade) {
  const map = new Map<string, { pnl: number; qty: number }>();
  for (const t of arr) {
    const k = String(t[key] ?? "-");
    const cur = map.get(k) ?? { pnl: 0, qty: 0 };
    cur.pnl += t.pnl;
    cur.qty += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([k, v]) => ({ name: k, ...v }));
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const [ov, bot, wallet, telegram] = await Promise.all([
          apiGet<OverviewData>("/dashboard/overview", session.access_token),
          apiGet<BotStatus>("/bot/status", session.access_token),
          apiGet<WalletStatus>("/wallet/status", session.access_token),
          apiGet<TelegramStatus>("/telegram/status", session.access_token),
        ]);
        setOverview(ov);
        setBotStatus(bot);
        setWalletStatus(wallet);
        setTelegramStatus(telegram);
      } catch (e) {
        setError("Não foi possível carregar os dados. Verifique se a API está rodando.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const balance = overview?.balance ?? 0;
  const trades = overview?.trades ?? [];
  const metrics = computeMetrics(trades, balance);
  const groupedWithKeys = metrics.grouped as GroupedTrade[];
  const bySide = groupBy(groupedWithKeys, "side");
  const byTf = groupBy(groupedWithKeys, "tf");
  const byToken = groupBy(groupedWithKeys, "token");

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white">
        Visão geral
      </h1>
      <p className="text-zeedo-black/60 dark:text-zeedo-white/60 -mt-4">
        Acompanhe o status do seu bot, carteira e performance em um só lugar.
      </p>

      {/* Cards de status */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zeedo-orange/20 p-4">
          <h2 className="text-sm font-medium text-zeedo-orange mb-1">
            Carteira Hyperliquid
          </h2>
          <p className="text-lg font-medium text-zeedo-black dark:text-zeedo-white">
            {walletStatus?.connected ? walletStatus.wallet_address ?? "Conectada" : "Não conectada"}
          </p>
          <a
            href="/dashboard/wallet"
            className="text-sm text-zeedo-orange hover:underline mt-2 inline-block"
          >
            {walletStatus?.connected ? "Alterar" : "Conectar"}
          </a>
        </div>
        <div className="rounded-lg border border-zeedo-orange/20 p-4">
          <h2 className="text-sm font-medium text-zeedo-orange mb-1">
            Telegram
          </h2>
          <p className="text-lg font-medium text-zeedo-black dark:text-zeedo-white">
            {telegramStatus?.connected ? "Conectado" : "Não conectado"}
          </p>
          <a
            href="/dashboard/telegram"
            className="text-sm text-zeedo-orange hover:underline mt-2 inline-block"
          >
            {telegramStatus?.connected ? "Alterar" : "Conectar"}
          </a>
        </div>
        <div className="rounded-lg border border-zeedo-orange/20 p-4">
          <h2 className="text-sm font-medium text-zeedo-orange mb-1">
            Bot
          </h2>
          <p className="text-lg font-medium text-zeedo-black dark:text-zeedo-white capitalize">
            {botStatus?.status === "running" ? "Rodando" : "Parado"}
          </p>
          <a
            href="/dashboard/bot"
            className="text-sm text-zeedo-orange hover:underline mt-2 inline-block"
          >
            Configurar
          </a>
        </div>
      </div>

      {/* Painel de Performance */}
      <section>
        <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
          📊 Painel de Lucros e Performance
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MetricCard label="Saldo Hyperliquid" value={`$${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
          <MetricCard label="Total Trades" value={String(metrics.totalTrades)} />
          <MetricCard label="Taxa de Acerto" value={`${metrics.winrate.toFixed(1)}%`} />
          <MetricCard label="Lucro" value={`$${metrics.totalPnl.toFixed(2)}`} />
          <MetricCard label="Média Lucro" value={`$${metrics.avgWin.toFixed(2)}`} />
          <MetricCard label="Média Prejuízo" value={`$${metrics.avgLoss.toFixed(2)}`} />
          <MetricCard label="Payoff" value={metrics.payoff.toFixed(2)} />
          <MetricCard label="Lucro %" value={`${metrics.pnlPct.toFixed(2)}%`} />
        </div>
      </section>

      {/* Gráfico de Crescimento */}
      {metrics.growthData.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            Curva de Crescimento
          </h2>
          <div className="h-64 rounded-lg border border-zeedo-orange/20 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.growthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zeedo-orange/20" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#f97316" />
                <YAxis tick={{ fontSize: 12 }} stroke="#f97316" tickFormatter={(v) => `$${v.toFixed(0)}`} />
                <Tooltip
                  formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL Acum."]}
                  contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #f97316" }}
                />
                <Line type="monotone" dataKey="balance" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Performance por Lado, TF e Token */}
      {(bySide.length > 0 || byTf.length > 0 || byToken.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            Analytics
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {bySide.length > 0 && (
              <div className="rounded-lg border border-zeedo-orange/20 p-4">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white mb-2">Performance por Lado</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySide} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" width={60} />
                      <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL"]} />
                      <Bar dataKey="pnl" fill="#f97316" name="PnL" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-zeedo-orange">
                      <th className="text-left">Lado</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySide.map((r) => (
                      <tr key={r.name} className="border-t border-zeedo-orange/20">
                        <td>{r.name}</td>
                        <td className="text-right">{r.qty}</td>
                        <td className={`text-right ${r.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${r.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {byTf.length > 0 && (
              <div className="rounded-lg border border-zeedo-orange/20 p-4">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white mb-2">Performance por Timeframe</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTf} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" width={50} />
                      <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL"]} />
                      <Bar dataKey="pnl" fill="#f97316" name="PnL" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-zeedo-orange">
                      <th className="text-left">TF</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTf.map((r) => (
                      <tr key={r.name} className="border-t border-zeedo-orange/20">
                        <td>{r.name}</td>
                        <td className="text-right">{r.qty}</td>
                        <td className={`text-right ${r.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${r.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {byToken.length > 0 && (
              <div className="rounded-lg border border-zeedo-orange/20 p-4">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white mb-2">Performance por Token</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byToken} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" width={50} />
                      <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL"]} />
                      <Bar dataKey="pnl" fill="#f97316" name="PnL" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-zeedo-orange">
                      <th className="text-left">Token</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byToken.map((r) => (
                      <tr key={r.name} className="border-t border-zeedo-orange/20">
                        <td>{r.name}</td>
                        <td className="text-right">{r.qty}</td>
                        <td className={`text-right ${r.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${r.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Detalhamento agrupado por Trade ID */}
      {metrics.grouped.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            📋 Detalhamento (Agrupado por Trade ID)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
            <table className="min-w-full divide-y divide-zeedo-orange/20">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
                    Data
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
                    Token
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
                    TF
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
                    Side
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">
                    PnL ($)
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">
                    PnL (%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zeedo-orange/20">
                {[...metrics.grouped]
                  .sort((a, b) => b.time - a.time)
                  .map((t) => {
                    const pnlPct = balance > 0 ? (t.pnl / balance) * 100 : 0;
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">
                          {new Date(t.time).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2 text-sm font-mono">{t.id}</td>
                        <td className="px-4 py-2 text-sm">{t.token}</td>
                        <td className="px-4 py-2 text-sm">{t.tf}</td>
                        <td className="px-4 py-2 text-sm">{t.side}</td>
                        <td className={`px-4 py-2 text-sm text-right ${t.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${t.pnl.toFixed(2)}
                        </td>
                        <td className={`px-4 py-2 text-sm text-right ${t.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Posições em aberto e pendentes */}
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
                      <tr key={p.symbol}>
                        <td className="px-4 py-2 text-sm">{p.symbol}</td>
                        <td className="px-4 py-2 text-sm">{p.tf}</td>
                        <td className="px-4 py-2 text-sm">{p.side}</td>
                        <td className="px-4 py-2 text-sm text-right">${p.entry_px?.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right">${p.usd_val}</td>
                        <td className="px-4 py-2 text-sm text-right">${p.planned_stop?.toFixed(2)}</td>
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
                      <tr key={p.symbol}>
                        <td className="px-4 py-2 text-sm">{p.symbol}</td>
                        <td className="px-4 py-2 text-sm">{p.tf}</td>
                        <td className="px-4 py-2 text-sm">{p.side}</td>
                        <td className="px-4 py-2 text-sm text-right">${p.entry_px?.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-right">${p.usd_val}</td>
                        <td className="px-4 py-2 text-sm text-right">${p.planned_stop?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zeedo-white/60 py-4">Nenhuma ordem pendente.</p>
            )}
          </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zeedo-orange/20 p-3">
      <p className="text-xs font-medium text-zeedo-orange truncate">{label}</p>
      <p className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white truncate">{value}</p>
    </div>
  );
}
