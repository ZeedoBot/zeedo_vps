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

function formatSignalTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSignalDay(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Alinhado a `_BLOCK_REASON_LABELS` em bot.py; `reason` pode ser "a | b | c". */
const BLOCKED_REASON_LABELS: Record<string, string> = {
  modo_sinal: "Modo Sinal",
  LSR: "LSR",
  high_extremo: "High extremo",
  low_extremo: "Low extremo",
  ativo_fraco_24h: "Ativo fraco 24h",
  ativo_forte_24h: "Ativo forte 24h",
  symbol_ja_ativo: "Símbolo já ativo em outro TF",
  limite_trades: "Limite de trades",
};

/** Última coluna (ações): fixa à direita no mobile. Só borda + fundo opaco (sem sombra larga). */
const STICKY_ACTION_TH_SM =
  "max-md:sticky max-md:right-0 max-md:z-[2] max-md:bg-zeedo-white max-md:dark:bg-zeedo-black max-md:border-l max-md:border-zeedo-orange/25";
const STICKY_ACTION_TD_SM =
  "max-md:sticky max-md:right-0 max-md:z-[1] max-md:bg-zeedo-white max-md:dark:bg-zeedo-black max-md:border-l max-md:border-zeedo-orange/25";
/** Coluna mais larga: link + botão empilhados no mobile */
const STICKY_ACTION_TH_LG =
  "max-md:sticky max-md:right-0 max-md:z-[2] max-md:min-w-[6.75rem] max-md:bg-zeedo-white max-md:dark:bg-zeedo-black max-md:border-l max-md:border-zeedo-orange/25";
const STICKY_ACTION_TD_LG =
  "max-md:sticky max-md:right-0 max-md:z-[1] max-md:min-w-[6.75rem] max-md:bg-zeedo-white max-md:dark:bg-zeedo-black max-md:border-l max-md:border-zeedo-orange/25";

function formatBlockedReasonPart(part: string): string {
  const t = part.trim();
  if (!t) return "";
  if (BLOCKED_REASON_LABELS[t]) return BLOCKED_REASON_LABELS[t];
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function BlockedReasonCell({ reason }: { reason: string }) {
  const parts = reason
    .split(" | ")
    .map((s) => s.trim())
    .filter(Boolean);
  const labels = parts.map(formatBlockedReasonPart).filter(Boolean);
  if (labels.length <= 1) {
    return (
      <span className="text-zeedo-black/70 dark:text-zeedo-white/70">
        {labels[0] ?? formatBlockedReasonPart(reason)}
      </span>
    );
  }
  return (
    <ul className="list-disc list-inside text-zeedo-black/70 dark:text-zeedo-white/70 space-y-0.5 max-w-xs">
      {labels.map((label, i) => (
        <li key={i}>{label}</li>
      ))}
    </ul>
  );
}

type OverviewData = {
  balance: number;
  trades: unknown[];
  open_positions: Position[];
  pending_positions: Position[];
  blocked_trades?: BlockedTrade[];
  subscription_tier?: string;
};

type TradeModalState =
  | { kind: "close"; symbol: string }
  | { kind: "cancel"; symbol: string }
  | { kind: "acionar"; id: string };

const CLOSE_PERCENT_OPTIONS = [25, 50, 75, 100] as const;

export default function TradesPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [cancelingPending, setCancelingPending] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [modal, setModal] = useState<TradeModalState | null>(null);
  const [modalClosePct, setModalClosePct] = useState(100);

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

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  async function handleExecuteBlocked(id: string) {
    if ((overview?.subscription_tier ?? "basic").toLowerCase() === "basic") return;
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
      setModal(null);
    }
  }

  async function handleClose(symbol: string, pct: number) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setClosing(symbol);
    setError("");
    try {
      await apiPost("/dashboard/close-position", { symbol, pct }, session.access_token);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar posição.");
    } finally {
      setClosing(null);
      setModal(null);
    }
  }

  async function handleCancelPending(symbol: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setCancelingPending(symbol);
    setError("");
    try {
      await apiPost("/dashboard/cancel-pending-position", { symbol }, session.access_token);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar pendência.");
    } finally {
      setCancelingPending(null);
      setModal(null);
    }
  }

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;

  const isBasicPlan = (overview?.subscription_tier ?? "basic").toLowerCase() === "basic";

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
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">PnL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Valor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Stop</th>
                    <th className={`px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase ${STICKY_ACTION_TH_SM}`}>Fechar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zeedo-orange/20">
                  {overview.open_positions.map((p) => (
                    <tr key={`${p.symbol}-${p.tf}-${p.side}`}>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.symbol}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.tf}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.side.toUpperCase()}</td>
                      <td className={`px-4 py-2 text-sm text-right font-medium ${(p.unrealized_pnl ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {p.unrealized_pnl != null ? `${p.unrealized_pnl >= 0 ? "+" : ""}$${p.unrealized_pnl.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.entry_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.usd_val}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">{p.planned_stop ? `$${p.planned_stop.toFixed(2)}` : "-"}</td>
                      <td className={`px-4 py-2 text-sm text-right ${STICKY_ACTION_TD_SM}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setModalClosePct(100);
                            setModal({ kind: "close", symbol: p.symbol });
                          }}
                          disabled={closing === p.symbol}
                          className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/30 disabled:opacity-50 dark:text-red-400"
                        >
                          {closing === p.symbol ? "…" : "Fechar"}
                        </button>
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
                    <th className={`px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase ${STICKY_ACTION_TH_SM}`}>Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zeedo-orange/20">
                  {overview.pending_positions.map((p) => (
                    <tr key={`${p.symbol}-${p.tf}-${p.side}`}>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.symbol}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.tf}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{p.side.toUpperCase()}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.entry_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${p.usd_val}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">{p.planned_stop ? `$${p.planned_stop.toFixed(2)}` : "-"}</td>
                      <td className={`px-4 py-2 text-sm text-right ${STICKY_ACTION_TD_SM}`}>
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "cancel", symbol: p.symbol })}
                          disabled={cancelingPending === p.symbol}
                          className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/30 disabled:opacity-50 dark:text-red-400"
                        >
                          {cancelingPending === p.symbol ? "…" : "Cancelar"}
                        </button>
                      </td>
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
            {isBasicPlan ? (
              <span className="block mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
                No plano Basic (apenas Modo Sinal) o botão Acionar não está disponível. Faça upgrade ao Pro para usar acionamento manual pela plataforma.
              </span>
            ) : (
              <span className="block mt-2">
                Faça sua própria análise, se entender que é uma boa entrada, você pode acionar manualmente com um clique.
              </span>
            )}
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-zeedo-orange uppercase">Hora</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">1ª entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">2ª entrada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase">Stop</th>
                    <th className={`px-4 py-2 text-right text-xs font-medium text-zeedo-orange uppercase ${STICKY_ACTION_TH_LG}`}>Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zeedo-orange/20">
                  {overview.blocked_trades.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{b.symbol}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{b.tf}</td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white">{b.side.toUpperCase()}</td>
                      <td className="px-4 py-2 text-sm align-top">
                        <BlockedReasonCell reason={b.reason} />
                      </td>
                      <td className="px-4 py-2 text-sm text-zeedo-black dark:text-zeedo-white whitespace-nowrap">
                        <div className="leading-tight">
                          <div className="text-xs text-zeedo-black/70 dark:text-zeedo-white/70">
                            {formatSignalDay(b.created_at)}
                          </div>
                          <div className="text-sm">{formatSignalTime(b.created_at)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${b.entry_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${b.entry2_px?.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-zeedo-black dark:text-zeedo-white">${b.stop_real?.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-sm text-right ${STICKY_ACTION_TD_LG}`}>
                        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                          <a
                            href={`https://app.hyperliquid.xyz/trade/${b.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zeedo-orange hover:underline whitespace-nowrap"
                          >
                            Ver gráfico
                          </a>
                          <button
                            type="button"
                            onClick={() => !isBasicPlan && setModal({ kind: "acionar", id: b.id })}
                            disabled={isBasicPlan || executingId === b.id}
                            title={
                              isBasicPlan
                                ? "Indisponível no plano Basic. Upgrade ao Pro."
                                : undefined
                            }
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

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pb-24 sm:pb-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-modal-title"
            className="w-full max-w-sm rounded-xl border border-zeedo-orange/30 bg-zeedo-white p-4 shadow-xl dark:bg-zeedo-black dark:text-zeedo-white"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.kind === "close" && (
              <>
                <h2 id="trade-modal-title" className="text-base font-semibold text-zeedo-black dark:text-zeedo-white">
                  Encerrar posição
                </h2>
                <p className="mt-3 text-sm text-zeedo-black/80 dark:text-zeedo-white/80">
                  Você deseja mesmo encerrar esse trade?
                </p>
                <p className="mt-2 text-sm font-medium text-zeedo-orange">
                  Selecione o % que você deseja fechar
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {CLOSE_PERCENT_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setModalClosePct(pct)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        modalClosePct === pct
                          ? "border-zeedo-orange bg-zeedo-orange text-white"
                          : "border-zeedo-orange/40 text-zeedo-black hover:bg-zeedo-orange/10 dark:text-zeedo-white dark:hover:bg-zeedo-orange/20"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleClose(modal.symbol, modalClosePct)}
                    disabled={closing === modal.symbol}
                    className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/30 disabled:opacity-50 dark:text-red-400"
                  >
                    {closing === modal.symbol ? "…" : "Fechar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-zeedo-orange/40 px-4 py-2 text-sm font-medium text-zeedo-black hover:bg-zeedo-orange/10 dark:text-zeedo-white"
                  >
                    Voltar
                  </button>
                </div>
              </>
            )}
            {modal.kind === "cancel" && (
              <>
                <h2 id="trade-modal-title" className="text-base font-semibold text-zeedo-black dark:text-zeedo-white">
                  Cancelar ordem
                </h2>
                <p className="mt-3 text-sm text-zeedo-black/80 dark:text-zeedo-white/80">
                  Você deseja cancelar esse trade?
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleCancelPending(modal.symbol)}
                    disabled={cancelingPending === modal.symbol}
                    className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/30 disabled:opacity-50 dark:text-red-400"
                  >
                    {cancelingPending === modal.symbol ? "…" : "Sim, cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-zeedo-orange/40 px-4 py-2 text-sm font-medium text-zeedo-black hover:bg-zeedo-orange/10 dark:text-zeedo-white"
                  >
                    Voltar
                  </button>
                </div>
              </>
            )}
            {modal.kind === "acionar" && (
              <>
                <h2 id="trade-modal-title" className="text-base font-semibold text-zeedo-black dark:text-zeedo-white">
                  Acionar trade
                </h2>
                <p className="mt-3 text-sm text-zeedo-black/80 dark:text-zeedo-white/80">
                  Você deseja acionar esse trade?
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleExecuteBlocked(modal.id)}
                    disabled={executingId === modal.id}
                    className="rounded-lg bg-zeedo-orange/20 px-4 py-2 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/30 disabled:opacity-50 dark:text-orange-400"
                  >
                    {executingId === modal.id ? "…" : "Sim, acionar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-zeedo-orange/40 px-4 py-2 text-sm font-medium text-zeedo-black hover:bg-zeedo-orange/10 dark:text-zeedo-white"
                  >
                    Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
