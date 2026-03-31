"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPut } from "@/lib/api";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { IoNotificationsOutline, IoPower } from "react-icons/io5";

const PERIOD_OPTIONS = [
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "1 mês" },
  { value: "180d", label: "6 meses" },
  { value: "365d", label: "1 ano" },
  { value: "all", label: "Todo período" },
  { value: "custom", label: "Por data" },
] as const;

function filterTradesByPeriod<T extends { time: number }>(
  trades: T[],
  period: string,
  dateFrom: string | null,
  dateTo: string | null
): T[] {
  const now = Date.now();
  let startMs = 0;
  let endMs = Infinity;
  if (period === "custom" && dateFrom && dateTo) {
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    startMs = d1.setHours(0, 0, 0, 0);
    endMs = d2.setHours(23, 59, 59, 999);
  } else if (period !== "all") {
    const days = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : period === "180d" ? 180 : 365;
    startMs = now - days * 24 * 60 * 60 * 1000;
  }
  return trades.filter((t) => t.time >= startMs && t.time <= endMs);
}

type Trade = {
  trade_id: string;
  oid: string;
  token: string;
  side: string;
  tf: string;
  pnl_usd: number;
  size_usd: number;
  time: number;
  pnl_pct?: number | null;
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
type BotConfig = {
  symbols: string[];
  timeframes: string[];
  trial_ended?: boolean;
  signal_mode?: boolean;
};
type WalletStatus = { connected: boolean; wallet_address: string | null };
type TelegramStatus = { connected: boolean };

function groupTradesById(trades: Trade[]) {
  const map = new Map<string, { pnl: number; token: string; side: string; tf: string; time: number; pnl_pct?: number | null }>();
  for (const t of trades) {
    const key = t.trade_id !== "-" ? t.trade_id : t.oid;
    const existing = map.get(key);
    const pnl = t.pnl_usd;
    if (!existing) {
      map.set(key, { pnl, token: t.token, side: t.side, tf: t.tf, time: t.time, pnl_pct: t.pnl_pct });
    } else {
      existing.pnl += pnl;
      if (t.time > existing.time) {
        existing.time = t.time;
        existing.pnl_pct = t.pnl_pct;
      }
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
  
  // Calcula Lucro % Total somando os PNL % individuais de cada trade
  // Isso garante que depósitos/saques não distorçam o resultado
  const tradesWithPct = grouped.filter(t => t.pnl_pct !== undefined && t.pnl_pct !== null);
  const pnlPct = tradesWithPct.length > 0 
    ? tradesWithPct.reduce((sum, t) => sum + (t.pnl_pct || 0), 0)
    : (balance > 0 ? (totalPnl / balance) * 100 : 0); // Fallback para trades sem pnl_pct

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
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [botToggling, setBotToggling] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  async function toggleBot() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setBotToggling(true);
    setError("");
    try {
      const isRunning = botStatus?.status === "running";
      await apiPut("/bot/config", { bot_enabled: !isRunning }, session.access_token);
      setBotStatus({ status: !isRunning ? "running" : "stopped" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar status do bot.";
      setError(msg);
      if (msg.includes("trial") || msg.includes("plano") || msg.includes("planos")) {
        setTimeout(() => { window.location.href = "/choose-plan"; }, 1500);
      }
    } finally {
      setBotToggling(false);
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const [ov, bot, config, wallet, telegram] = await Promise.all([
          apiGet<OverviewData>("/dashboard/overview", session.access_token),
          apiGet<BotStatus>("/bot/status", session.access_token),
          apiGet<BotConfig>("/bot/config", session.access_token),
          apiGet<WalletStatus>("/wallet/status", session.access_token),
          apiGet<TelegramStatus>("/telegram/status", session.access_token),
        ]);
        if (config?.trial_ended) {
          window.location.href = "/choose-plan";
          return;
        }
        setOverview(ov);
        setBotStatus(bot);
        setBotConfig(config);
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
  const filteredTrades = filterTradesByPeriod(
    trades,
    periodFilter,
    dateFrom || null,
    dateTo || null
  );
  const metrics = computeMetrics(filteredTrades, balance);
  const groupedWithKeys = metrics.grouped as GroupedTrade[];
  const bySide = groupBy(groupedWithKeys, "side");
  const byTf = groupBy(groupedWithKeys, "tf");
  const byToken = groupBy(groupedWithKeys, "token");

  const emptySymbolsOrTimeframes =
    botStatus?.status === "running" &&
    (!(botConfig?.symbols?.length ?? 0) || !(botConfig?.timeframes?.length ?? 0));

  const hasDataToShow =
    (overview?.trades?.length ?? 0) > 0 ||
    (overview?.open_positions?.length ?? 0) > 0 ||
    (overview?.pending_positions?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white">
        Dashboard
      </h1>
      <p className={`text-zeedo-black/60 dark:text-zeedo-white/60 -mt-4 ${hasDataToShow ? "hidden sm:block" : ""}`}>
        Acompanhe o status do seu bot, carteira e performance em um só lugar.
      </p>

      {emptySymbolsOrTimeframes && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
          <p className="font-medium">
            Símbolos (ou Timeframes) vazios! Zeedo ativo, mas não retornará nenhum trade. Escolha pelo menos uma opção na aba Configurações do Bot!
          </p>
          <a href="/dashboard/bot" className="text-sm underline mt-1 inline-block hover:text-amber-600 dark:hover:text-amber-300">
            Ir para Configurações do Bot →
          </a>
        </div>
      )}

      {/* Layout responsivo:
          - Mobile: cards de status primeiro (compactos)
          - Desktop: abre direto no painel/gráfico; cards descem para depois do gráfico */}
      <div className="flex flex-col gap-8">
        {/* Cards de status + aviso Modo Sinal (logo abaixo dos cards no mobile e no desktop) */}
        <div className="order-1 lg:order-3 space-y-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <a href="/dashboard/wallet" className="rounded-lg border border-zeedo-orange/20 p-2 sm:p-4 block">
            <h2 className="text-[10px] sm:text-sm font-medium text-zeedo-orange mb-1 truncate">
              Carteira
            </h2>
            <p className="text-sm sm:text-lg font-medium text-zeedo-black dark:text-zeedo-white truncate">
              {walletStatus?.connected ? "Conectado" : "Não conectado"}
            </p>
            <span className="hidden sm:inline-block text-sm text-zeedo-orange hover:underline mt-2">
              {walletStatus?.connected ? "Alterar" : "Conectar"}
            </span>
          </a>

          <a href="/dashboard/telegram" className="rounded-lg border border-zeedo-orange/20 p-2 sm:p-4 block">
            <h2 className="text-[10px] sm:text-sm font-medium text-zeedo-orange mb-1 truncate">
              Telegram
            </h2>
            <p className="text-sm sm:text-lg font-medium text-zeedo-black dark:text-zeedo-white truncate">
              {telegramStatus?.connected ? "Conectado" : "Não conectado"}
            </p>
            <span className="hidden sm:inline-block text-sm text-zeedo-orange hover:underline mt-2">
              {telegramStatus?.connected ? "Alterar" : "Conectar"}
            </span>
          </a>

          <div className="rounded-lg border border-zeedo-orange/20 p-2 sm:p-4 min-w-0">
            <h2 className="text-[10px] sm:text-sm font-medium text-zeedo-orange mb-1 truncate">
              Bot
            </h2>
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={`min-w-0 flex-1 text-sm sm:text-lg font-medium truncate ${botStatus?.status === "running" ? "text-green-600" : "text-red-600"}`}>
                {botStatus?.status === "running" ? "Ligado" : "Desligado"}
              </p>
              {botStatus?.status === "running" ? (
                <button
                  type="button"
                  onClick={toggleBot}
                  disabled={botToggling}
                  aria-label="Desligar bot"
                  className="shrink-0 inline-flex items-center justify-center p-1.5 rounded-lg border border-red-500/60 text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <IoPower className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleBot}
                  disabled={botToggling || !walletStatus?.connected || !telegramStatus?.connected}
                  aria-label="Ligar bot"
                  className="shrink-0 inline-flex items-center justify-center p-1.5 rounded-lg border border-green-500/60 text-green-600 hover:bg-green-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IoPower className="h-5 w-5" />
                </button>
              )}
            </div>
            {botStatus?.status !== "running" && (!walletStatus?.connected || !telegramStatus?.connected) && (
              <p className="hidden sm:block text-xs text-zeedo-black/60 dark:text-zeedo-white/60 mt-1">
                Conecte a carteira e o Telegram para ligar o bot.
              </p>
            )}
            <a href="/dashboard/bot" className="hidden sm:block text-sm text-zeedo-orange hover:underline mt-2">
              Configurar
            </a>
          </div>
        </div>
        {botConfig?.signal_mode && (
            <a
              href="/dashboard/bot"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zeedo-orange hover:underline"
            >
              <IoNotificationsOutline className="h-3 w-3 shrink-0 text-zeedo-orange opacity-90" aria-hidden />
              Modo Sinal Ativado
            </a>
        )}
        </div>

        {/* Painel de Performance */}
        <section className="order-2 lg:order-1">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white">
            Performance
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="rounded-lg border border-zeedo-orange/40 bg-transparent px-3 py-2 text-sm text-zeedo-black dark:text-zeedo-white focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-zeedo-black text-zeedo-white">
                  {o.label}
                </option>
              ))}
            </select>
            {periodFilter === "custom" && (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-zeedo-orange/40 bg-transparent px-3 py-2 text-sm text-zeedo-black dark:text-zeedo-white focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange"
                />
                <span className="text-zeedo-black/60 dark:text-zeedo-white/60">até</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-zeedo-orange/40 bg-transparent px-3 py-2 text-sm text-zeedo-black dark:text-zeedo-white focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange"
                />
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MetricCard label="Saldo Hyperliquid" value={`$${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
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
          <section className="order-3 lg:order-2">
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            Curva de Crescimento
          </h2>
          <div className="h-64 rounded-xl border border-zeedo-orange/20 bg-white dark:bg-zeedo-black p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.growthData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(249,115,22,0.12)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(249,115,22,0.8)" }} stroke="rgba(249,115,22,0.3)" />
                <YAxis tick={{ fontSize: 11, fill: "rgba(249,115,22,0.8)" }} stroke="rgba(249,115,22,0.3)" tickFormatter={(v) => `$${v.toFixed(0)}`} />
                <Tooltip
                  formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL Acum."]}
                  contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(249,115,22,0.4)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                  labelStyle={{ color: "#f97316" }}
                />
                <Area type="monotone" dataKey="balance" stroke="#f97316" strokeWidth={2} fill="url(#growthGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </section>
        )}
      </div>

      {/* Performance por Lado, TF e Token */}
      {(bySide.length > 0 || byTf.length > 0 || byToken.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
            Analytics
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {bySide.length > 0 && (
              <div className="rounded-xl border border-zeedo-orange/20 bg-white dark:bg-zeedo-black p-4">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white mb-3">Performance por Lado</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySide} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradPosSide" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barGradNegSide" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(249,115,22,0.12)" vertical={false} />
                      <XAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "rgba(249,115,22,0.8)" }} stroke="rgba(249,115,22,0.2)" />
                      <YAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: "rgba(249,115,22,0.7)" }} stroke="rgba(249,115,22,0.2)" />
                      <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL"]} contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(249,115,22,0.4)", borderRadius: 8 }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        {bySide.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "url(#barGradPosSide)" : "url(#barGradNegSide)"} />
                        ))}
                      </Bar>
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
              <div className="rounded-xl border border-zeedo-orange/20 bg-white dark:bg-zeedo-black p-4">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white mb-3">Performance por Timeframe</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byTf} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradPosTf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barGradNegTf" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(249,115,22,0.12)" vertical={false} />
                      <XAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "rgba(249,115,22,0.8)" }} stroke="rgba(249,115,22,0.2)" />
                      <YAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: "rgba(249,115,22,0.7)" }} stroke="rgba(249,115,22,0.2)" />
                      <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL"]} contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(249,115,22,0.4)", borderRadius: 8 }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        {byTf.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "url(#barGradPosTf)" : "url(#barGradNegTf)"} />
                        ))}
                      </Bar>
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
              <div className="rounded-xl border border-zeedo-orange/20 bg-white dark:bg-zeedo-black p-4">
                <h3 className="font-medium text-zeedo-black dark:text-zeedo-white mb-3">Performance por Token</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byToken} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradPosToken" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barGradNegToken" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(249,115,22,0.12)" vertical={false} />
                      <XAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "rgba(249,115,22,0.8)" }} stroke="rgba(249,115,22,0.2)" />
                      <YAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: "rgba(249,115,22,0.7)" }} stroke="rgba(249,115,22,0.2)" />
                      <Tooltip formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, "PnL"]} contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(249,115,22,0.4)", borderRadius: 8 }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        {byToken.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "url(#barGradPosToken)" : "url(#barGradNegToken)"} />
                        ))}
                      </Bar>
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
            Histórico
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
            <table className="min-w-full divide-y divide-zeedo-orange/20">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
                    Data
                  </th>
                  <th className="hidden sm:table-cell px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">
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
                    // Usa pnl_pct da API (baseado no saldo no momento do trade)
                    // Se não disponível, calcula usando saldo atual (fallback para trades antigos)
                    const pnlPct = t.pnl_pct !== undefined && t.pnl_pct !== null 
                      ? t.pnl_pct 
                      : (balance > 0 ? (t.pnl / balance) * 100 : 0);
                    
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
                        <td className="hidden sm:table-cell px-4 py-2 text-sm font-mono">{t.id}</td>
                        <td className="px-4 py-2 text-sm">{t.token}</td>
                        <td className="px-4 py-2 text-sm">{t.tf}</td>
                        <td className="px-4 py-2 text-sm">{t.side}</td>
                        <td className={`px-4 py-2 text-sm text-right ${t.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${t.pnl.toFixed(2)}
                        </td>
                        <td className={`px-4 py-2 text-sm text-right ${t.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pnlPct !== null && pnlPct !== undefined ? pnlPct.toFixed(2) : "-"}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
