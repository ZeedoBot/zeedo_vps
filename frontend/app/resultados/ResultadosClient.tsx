"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type {
  MesResultadoKey,
  MesSelecao,
  ResumoDiario,
  ResumoEstrategia,
  ResultadoTrade,
  StrategyCol,
} from "@/lib/resultados-types";

const PAGE_SIZE = 50;
const ANO_REF = 2025;
const DEFAULT_TARGET_LOSS_BASE_USD = 25;

type ResultadosMetaRow = {
  id: string;
  target_loss_base_usd: number;
  meses_resultado_ordem: string[];
  selecao_meses_ordem: string[];
  rotulo_selecao_mes: Record<string, string>;
  resultados_meta: unknown;
};

type ResultadosResumoMesRow = {
  mes: string;
  estrategias: ResumoEstrategia[];
  diario: ResumoDiario[] | null;
  diario_footer: { diasLucroPct: number; mediaDiariaUsd: number; mediaDiariaBrl: number } | null;
};

type ResultadosTradeRow = {
  id: number;
  mes: string;
  symbol: string;
  tf: string;
  side: string;
  data_label: string;
  stop: number | null;
  alvo: number | null;
  motivos: string;
  conservador: StrategyCol | null;
  mediano: StrategyCol | null;
  agressivo: StrategyCol | null;
  degen: StrategyCol | null;
};

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(n);
}

/** Rótulos amigáveis na coluna Detalhes (dados da planilha mantêm FR/FO e LE/HE). */
function fmtDetalhes(motivos: string, side: ResultadoTrade["side"]): string {
  let s = motivos;
  if (s.includes("FR/FO")) {
    const repl = side === "LONG" ? "Fraco 24h" : "Forte 24h";
    s = s.replace(/FR\/FO/g, repl);
  }
  if (s.includes("LE/HE")) {
    const repl = side === "LONG" ? "High Extremo" : "Low Extremo";
    s = s.replace(/LE\/HE/g, repl);
  }
  return s;
}

function fmtPnlUsd(n: number | null, factor: number): string {
  if (n === null) return "—";
  const v = n * factor;
  const abs = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return `-$${abs}`;
  return `$${abs}`;
}

function fmtHit(hit: StrategyCol["hit"] | null | undefined): string {
  if (!hit) return "—";
  if (hit === "STOP") return "STOP";
  return `Alvo ${hit}`;
}

function fmtUsdPlain(n: number, factor: number): string {
  const v = n * factor;
  return `$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBrlPlain(n: number, factor: number): string {
  const v = n * factor;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cellStrategy(col: StrategyCol | null, factor: number): ReactNode {
  if (!col || (col.hit === null && col.pnlUsd === null)) {
    return <span className="text-zeedo-black/35 dark:text-zeedo-white/35">—</span>;
  }
  const hit = fmtHit(col.hit);
  const pnl = col.pnlUsd;
  const pnlClass =
    pnl === null
      ? "text-zeedo-black/50 dark:text-zeedo-white/50"
      : pnl * factor < 0
        ? "text-red-600 dark:text-red-400 font-medium"
        : pnl * factor > 0
          ? "text-emerald-600 dark:text-emerald-400 font-medium"
          : "text-zeedo-black/60 dark:text-zeedo-white/60";
  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span className="text-[0.65rem] uppercase tracking-wide text-zeedo-black/50 dark:text-zeedo-white/50">{hit}</span>
      <span className={pnlClass}>{fmtPnlUsd(pnl, factor)}</span>
    </div>
  );
}

function corEstrategia(nome: ResumoEstrategia["nome"]): string {
  if (nome === "CONSERVADOR") return "font-medium text-cyan-700 dark:text-cyan-300";
  if (nome === "MEDIANO") return "font-medium text-amber-700 dark:text-amber-300";
  if (nome === "AGRESSIVO") return "font-medium text-zeedo-orange";
  return "font-medium text-red-600 dark:text-red-400";
}

function rotuloEstrategia(nome: ResumoEstrategia["nome"]): string {
  return nome.charAt(0) + nome.slice(1).toLowerCase();
}

/** Ordena por data do trade (DD/MM ou D/M + mês FEV/MAR no mesmo ano). */
function tradeSortKey(t: ResultadoTrade): number {
  const parts = t.dataLabel.split("/").map((x) => parseInt(x.trim(), 10));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return 0;
  const [dia, mesNum] = parts;
  return new Date(ANO_REF, mesNum - 1, dia).getTime();
}

function aggregateResumo(
  meses: MesResultadoKey[],
  resumoPorMes: Record<MesResultadoKey, { estrategias: ResumoEstrategia[] }>,
): ResumoEstrategia[] {
  const nomes: ResumoEstrategia["nome"][] = ["CONSERVADOR", "MEDIANO", "AGRESSIVO", "DEGEN"];
  const rows = nomes.map((nome) => {
    let lucroUsd = 0;
    let lucroBrl = 0;
    let wrSum = 0;
    let n = 0;
    for (const m of meses) {
      const r = resumoPorMes[m]?.estrategias?.find((x) => x.nome === nome);
      if (r) {
        lucroUsd += r.lucroUsd;
        lucroBrl += r.lucroBrl;
        wrSum += r.winRatePct;
        n += 1;
      }
    }
    const winRatePct = n > 0 ? wrSum / n : 0;
    return { nome, lucroUsd, lucroBrl, winRatePct, ranking: 0 };
  });
  return rows
    .sort((a, b) => b.lucroUsd - a.lucroUsd)
    .map((r, i) => ({ ...r, ranking: i + 1 }));
}

function linhaMediaEstrategias(estrategias: ResumoEstrategia[]) {
  const n = estrategias.length;
  if (n === 0) return null;
  const lucroUsd = estrategias.reduce((s, r) => s + r.lucroUsd, 0) / n;
  const lucroBrl = estrategias.reduce((s, r) => s + r.lucroBrl, 0) / n;
  const winRatePct = estrategias.reduce((s, r) => s + r.winRatePct, 0) / n;
  return { lucroUsd, lucroBrl, winRatePct };
}

export function ResultadosClient() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");
  const [MESES_RESULTADO_ORDEM, setMesesResultadoOrdem] = useState<MesResultadoKey[]>(["MAR", "FEV"]);
  const [SELECAO_MESES_ORDEM, setSelecaoMesesOrdem] = useState<MesSelecao[]>(["AGG", "MAR", "FEV"]);
  const [ROTULO_SELECAO_MES, setRotuloSelecaoMes] = useState<Record<MesSelecao, string>>({
    AGG: "Agregado",
    FEV: "Fevereiro",
    MAR: "Março",
  } as Record<MesSelecao, string>);
  const [RESUMO_POR_MES, setResumoPorMes] = useState<Record<MesResultadoKey, { estrategias: ResumoEstrategia[]; diario?: ResumoDiario[]; diarioFooter?: { diasLucroPct: number; mediaDiariaUsd: number; mediaDiariaBrl: number } }>>({
    FEV: { estrategias: [], diario: [], diarioFooter: { diasLucroPct: 0, mediaDiariaUsd: 0, mediaDiariaBrl: 0 } },
    MAR: { estrategias: [], diario: [], diarioFooter: { diasLucroPct: 0, mediaDiariaUsd: 0, mediaDiariaBrl: 0 } },
  });
  const [RESULTADOS_TRADES, setResultadosTrades] = useState<ResultadoTrade[]>([]);

  const [mes, setMes] = useState<MesSelecao>("MAR");
  const [targetLossUsd, setTargetLossUsd] = useState<number | "">(DEFAULT_TARGET_LOSS_BASE_USD);
  const [pagina, setPagina] = useState(0);
  const [modalDiario, setModalDiario] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const supabase = createClient();

        const { data: meta, error: metaErr } = await supabase
          .from("resultados_meta")
          .select("id,target_loss_base_usd,meses_resultado_ordem,selecao_meses_ordem,rotulo_selecao_mes,resultados_meta")
          .eq("id", "default")
          .single<ResultadosMetaRow>();
        if (metaErr || !meta) throw new Error(metaErr?.message || "Meta não encontrada.");

        const { data: resumoRows, error: resumoErr } = await supabase
          .from("resultados_resumo_mes")
          .select("mes,estrategias,diario,diario_footer")
          .in("mes", meta.meses_resultado_ordem)
          .order("mes", { ascending: true })
          .returns<ResultadosResumoMesRow[]>();
        if (resumoErr) throw new Error(resumoErr.message);

        const { data: tradeRows, error: tradesErr } = await supabase
          .from("resultados_trades")
          .select("id,mes,symbol,tf,side,data_label,stop,alvo,motivos,conservador,mediano,agressivo,degen")
          .order("id", { ascending: true })
          .returns<ResultadosTradeRow[]>();
        if (tradesErr) throw new Error(tradesErr.message);

        const meses = (meta.meses_resultado_ordem || []).filter(Boolean) as MesResultadoKey[];
        const selecao = (meta.selecao_meses_ordem || []).filter(Boolean) as MesSelecao[];
        const rotulos = meta.rotulo_selecao_mes as Record<MesSelecao, string>;

        const resumoMap: Record<string, any> = {};
        for (const row of resumoRows || []) {
          resumoMap[row.mes] = {
            estrategias: row.estrategias || [],
            diario: row.diario || undefined,
            diarioFooter: row.diario_footer || undefined,
          };
        }

        const trades = (tradeRows || []).map<ResultadoTrade>((r) => ({
          id: r.id,
          mes: r.mes as ResultadoTrade["mes"],
          symbol: r.symbol,
          tf: r.tf,
          side: r.side as ResultadoTrade["side"],
          dataLabel: r.data_label,
          stop: r.stop,
          alvo: r.alvo,
          motivos: r.motivos,
          conservador: r.conservador,
          mediano: r.mediano,
          agressivo: r.agressivo,
          degen: r.degen,
        }));

        const fallbackMeses: MesResultadoKey[] = meses.length ? meses : ["MAR", "FEV"];
        const fallbackSelecao: MesSelecao[] = ["AGG", ...fallbackMeses];

        setMesesResultadoOrdem(meses.length ? meses : ["MAR", "FEV"]);
        setSelecaoMesesOrdem(selecao.length ? selecao : fallbackSelecao);
        setRotuloSelecaoMes((rotulos as any) || (ROTULO_SELECAO_MES as any));
        setResumoPorMes((resumoMap as any) || RESUMO_POR_MES);
        setResultadosTrades(trades);

        const base = Number(meta.target_loss_base_usd);
        setTargetLossUsd(Number.isFinite(base) && base > 0 ? base : DEFAULT_TARGET_LOSS_BASE_USD);
        setMes((meses[0] as MesSelecao) || "MAR");
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Não foi possível carregar os resultados.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetLossVal =
    typeof targetLossUsd === "number" && !Number.isNaN(targetLossUsd) && targetLossUsd >= 1
      ? targetLossUsd
      : DEFAULT_TARGET_LOSS_BASE_USD;
  const factor = targetLossVal / DEFAULT_TARGET_LOSS_BASE_USD;

  const resumoLinhas = useMemo(() => {
    if (mes === "AGG") return aggregateResumo(MESES_RESULTADO_ORDEM, RESUMO_POR_MES as any);
    return (RESUMO_POR_MES as any)[mes as MesResultadoKey].estrategias as ResumoEstrategia[];
  }, [mes, MESES_RESULTADO_ORDEM, RESUMO_POR_MES]);

  const mediaResumo = useMemo(() => linhaMediaEstrategias(resumoLinhas), [resumoLinhas]);

  const tradesOrdenados = useMemo(() => {
    const list = mes === "AGG" ? [...RESULTADOS_TRADES] : RESULTADOS_TRADES.filter((t) => t.mes === mes);
    return list.sort((a, b) => tradeSortKey(a) - tradeSortKey(b));
  }, [mes, RESULTADOS_TRADES]);

  const totalPaginas = Math.max(1, Math.ceil(tradesOrdenados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);

  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas - 1));
  }, [mes, totalPaginas]);

  const tradesPagina = useMemo(() => {
    const start = paginaSegura * PAGE_SIZE;
    return tradesOrdenados.slice(start, start + PAGE_SIZE);
  }, [tradesOrdenados, paginaSegura]);

  const configDiario =
    mes !== "AGG" ? RESUMO_POR_MES[mes as MesResultadoKey].diario : undefined;
  const footerDiario =
    mes !== "AGG" ? RESUMO_POR_MES[mes as MesResultadoKey].diarioFooter : undefined;

  return (
    <div className="dark min-h-screen bg-zeedo-black text-zeedo-white">
      <header className="border-b border-zeedo-orange/15 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zeedo-orange">Zeedo</p>
            <h1 className="text-xl font-semibold sm:text-2xl">Prova de resultados</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/" className="text-zeedo-orange hover:underline font-medium">
              Voltar
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md px-2 py-1 text-zeedo-orange hover:bg-zeedo-orange/10"
              title="Dashboard"
              aria-label="Ir ao dashboard"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10.5L12 3l9 7.5V21a1.5 1.5 0 01-1.5 1.5h-4.5V15a1.5 1.5 0 00-1.5-1.5h-3A1.5 1.5 0 009 15v7.5H4.5A1.5 1.5 0 013 21v-10.5z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-10">
        {loading && (
          <div className="rounded-lg border border-zeedo-orange/15 bg-zeedo-black/40 p-4 text-sm text-zeedo-white/70">
            Carregando resultados…
          </div>
        )}
        {!loading && loadError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {loadError}
          </div>
        )}
        <p className="text-sm text-zeedo-black/70 dark:text-zeedo-white/70 leading-relaxed max-w-3xl">
          Histórico completo de trades usados como referência de transparência. Todos os trades sinalizados pelo Zeedo são
          mostrados aqui, o resultado financeiro da operação dependa do valor de Target Loss que você desejar simular.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-2">
            Filtro de Mês e Target Loss
          </h2>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={mes}
              onChange={(e) => {
                setMes(e.target.value as MesSelecao);
                setPagina(0);
              }}
              className="rounded-lg border border-zeedo-orange/30 bg-zeedo-white px-3 py-1.5 text-base font-semibold text-zeedo-black dark:bg-zeedo-black dark:text-zeedo-white dark:border-zeedo-orange/40 min-w-[10rem]"
            >
              {SELECAO_MESES_ORDEM.map((m) => (
                <option key={m} value={m}>
                  {ROTULO_SELECAO_MES[m]}
                </option>
              ))}
            </select>
            <label className="flex flex-wrap items-center gap-2 text-sm text-zeedo-black dark:text-zeedo-white">
              <span className="text-xs font-medium uppercase tracking-wide text-zeedo-orange">Target Loss (USD)</span>
              <input
                type="text"
                inputMode="numeric"
                min={1}
                step={1}
                value={targetLossUsd}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    setTargetLossUsd("");
                    return;
                  }
                  // aceita somente dígitos (sem ponto/vírgula)
                  if (!/^\d+$/.test(raw)) return;
                  const v = Number(raw);
                  if (!Number.isNaN(v) && v >= 1) setTargetLossUsd(v);
                }}
                onBlur={() => {
                  if (targetLossUsd === "") setTargetLossUsd(DEFAULT_TARGET_LOSS_BASE_USD);
                }}
                className="w-24 rounded-lg border border-zeedo-orange/30 bg-zeedo-white px-2 py-1 text-base tabular-nums dark:bg-zeedo-black dark:text-zeedo-white dark:border-zeedo-orange/40"
              />
            </label>
          </div>

          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-3">Resumo</h2>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={mes === "AGG" || !configDiario?.length}
              onClick={() => setModalDiario(true)}
              className="rounded-lg border border-zeedo-orange/40 bg-zeedo-orange/10 px-3 py-1.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
              title={mes === "AGG" ? "Escolha um mês para ver o diário" : undefined}
            >
              Ver métricas diárias
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-zeedo-black/[0.04] dark:bg-white/[0.06] text-left">
                  <th className="p-2 font-medium">Estratégia</th>
                  <th className="p-2 font-medium">Lucro ($)</th>
                  <th className="p-2 font-medium">Lucro (R$)</th>
                  <th className="p-2 font-medium">WinRate</th>
                  <th className="p-2 font-medium">Rank</th>
                </tr>
              </thead>
              <tbody>
                {resumoLinhas.map((r) => (
                  <tr key={r.nome} className="border-t border-zeedo-orange/10">
                    <td className="p-2">
                      <span className={corEstrategia(r.nome)}>{rotuloEstrategia(r.nome)}</span>
                    </td>
                    <td className="p-2">{fmtUsdPlain(r.lucroUsd, factor)}</td>
                    <td className="p-2">{fmtBrlPlain(r.lucroBrl, factor)}</td>
                    <td className="p-2">{r.winRatePct.toFixed(2).replace(".", ",")}%</td>
                    <td className="p-2">{r.ranking}</td>
                  </tr>
                ))}
                {mediaResumo ? (
                  <tr className="border-t border-purple-500/30 bg-purple-500/10">
                    <td className="p-2">
                      <span className="font-medium text-purple-700 dark:text-purple-300">Média</span>
                    </td>
                    <td className="p-2">{fmtUsdPlain(mediaResumo.lucroUsd, factor)}</td>
                    <td className="p-2">{fmtBrlPlain(mediaResumo.lucroBrl, factor)}</td>
                    <td className="p-2">{mediaResumo.winRatePct.toFixed(2).replace(".", ",")}%</td>
                    <td className="p-2 text-zeedo-black/50 dark:text-zeedo-white/50">—</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {mes === "FEV" ? (
            <p className="mt-2 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
              *Fevereiro contém apenas 19 trades, o Zeedo ainda não armazenava todo o histórico de trades, apenas os acionados.
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-1">
            Histórico dos Trades: {ROTULO_SELECAO_MES[mes]}
          </h2>
          <p className="mb-3 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
            Cada estratégia mostra o alvo atingido e o Lucro/Prejuízo em dólar (USD), proporcional ao Target Loss escolhido.
          </p>

          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20 shadow-sm">
            <table className="w-full min-w-[960px] text-xs sm:text-sm">
              <thead>
                <tr className="bg-zeedo-black/[0.06] dark:bg-white/[0.08] text-left">
                  <th className="sticky left-0 z-10 bg-zeedo-black/[0.06] px-2 py-2 font-medium dark:bg-white/[0.08]">
                    Símbolo
                  </th>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">TF</th>
                  <th className="px-2 py-2 font-medium">Lado</th>
                  {/* Resultados no mobile (entre Lado e Stop) */}
                  <th className="px-2 py-2 font-medium bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 min-w-[6.5rem] sm:hidden">
                    Conservador
                  </th>
                  <th className="px-2 py-2 font-medium bg-amber-500/10 text-amber-900 dark:text-amber-200 min-w-[6.5rem] sm:hidden">
                    Mediano
                  </th>
                  <th className="px-2 py-2 font-medium bg-zeedo-orange/15 text-zeedo-black dark:text-zeedo-white min-w-[6.5rem] sm:hidden">
                    Agressivo
                  </th>
                  <th className="px-2 py-2 font-medium bg-red-500/10 text-red-800 dark:text-red-200 min-w-[6.5rem] sm:hidden">
                    Degen
                  </th>
                  <th className="px-2 py-2 font-medium">Stop</th>
                  <th className="px-2 py-2 font-medium">Alvo</th>
                  <th className="px-2 py-2 font-medium min-w-[5rem]">Detalhes</th>
                  {/* Resultados no desktop (mantém no fim) */}
                  <th className="hidden px-2 py-2 font-medium border-l border-zeedo-orange/20 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 min-w-[6.5rem] sm:table-cell">
                    Conservador
                  </th>
                  <th className="hidden px-2 py-2 font-medium bg-amber-500/10 text-amber-900 dark:text-amber-200 min-w-[6.5rem] sm:table-cell">
                    Mediano
                  </th>
                  <th className="hidden px-2 py-2 font-medium bg-zeedo-orange/15 text-zeedo-black dark:text-zeedo-white min-w-[6.5rem] sm:table-cell">
                    Agressivo
                  </th>
                  <th className="hidden px-2 py-2 font-medium bg-red-500/10 text-red-800 dark:text-red-200 min-w-[6.5rem] sm:table-cell">
                    Degen
                  </th>
                </tr>
              </thead>
              <tbody>
                {tradesPagina.map((t) => (
                  <tr key={`${t.mes}-${t.id}`} className="border-t border-zeedo-orange/10">
                    <td className="sticky left-0 z-10 bg-zeedo-white px-2 py-1.5 font-medium whitespace-nowrap dark:bg-zeedo-black">
                      {t.symbol || "—"}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.dataLabel}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.tf || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.side}</td>
                    {/* Resultados no mobile (entre Lado e Stop) */}
                    <td className="px-2 py-1.5 bg-cyan-500/5 sm:hidden">{cellStrategy(t.conservador, factor)}</td>
                    <td className="px-2 py-1.5 bg-amber-500/5 sm:hidden">{cellStrategy(t.mediano, factor)}</td>
                    <td className="px-2 py-1.5 bg-zeedo-orange/5 sm:hidden">{cellStrategy(t.agressivo, factor)}</td>
                    <td className="px-2 py-1.5 bg-red-500/5 sm:hidden">{cellStrategy(t.degen, factor)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtNum(t.stop)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtNum(t.alvo)}</td>
                    <td className="px-2 py-1.5 text-zeedo-black/80 dark:text-zeedo-white/80">
                      {fmtDetalhes(t.motivos, t.side)}
                    </td>
                    {/* Resultados no desktop (mantém no fim) */}
                    <td className="hidden border-l border-zeedo-orange/15 px-2 py-1.5 bg-cyan-500/5 sm:table-cell">
                      {cellStrategy(t.conservador, factor)}
                    </td>
                    <td className="hidden px-2 py-1.5 bg-amber-500/5 sm:table-cell">{cellStrategy(t.mediano, factor)}</td>
                    <td className="hidden px-2 py-1.5 bg-zeedo-orange/5 sm:table-cell">{cellStrategy(t.agressivo, factor)}</td>
                    <td className="hidden px-2 py-1.5 bg-red-500/5 sm:table-cell">{cellStrategy(t.degen, factor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-zeedo-black/55 dark:text-zeedo-white/55">
              {tradesOrdenados.length} {tradesOrdenados.length === 1 ? "linha" : "linhas"}
              {tradesOrdenados.length > PAGE_SIZE
                ? ` · Página ${paginaSegura + 1} de ${totalPaginas} (${PAGE_SIZE} por página)`
                : null}
            </p>
            {tradesOrdenados.length > PAGE_SIZE ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={paginaSegura <= 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  className="rounded border border-zeedo-orange/30 px-2 py-1 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={paginaSegura >= totalPaginas - 1}
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  className="rounded border border-zeedo-orange/30 px-2 py-1 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-10 text-center">
            <div className="mx-auto max-w-2xl px-2">
              <p className="text-2xl font-semibold text-zeedo-white sm:text-3xl">
                Achou esses resultados satisfatórios?
              </p>
              <p className="mt-2 text-lg text-zeedo-white/75">Eles podem ser seus...</p>
              <p className="mt-4 text-base text-zeedo-white/75 sm:text-lg">
                Clique no botão abaixo e deixe o Zeedo operar por você!
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href={`/signup?next=${encodeURIComponent("/choose-plan?plan=pro")}`}
                  className="inline-flex items-center justify-center rounded-xl bg-zeedo-orange px-10 py-4 text-base font-semibold text-white shadow-lg shadow-black/30 hover:opacity-90 sm:text-lg"
                >
                  Eu Quero!
                </Link>
              </div>
            </div>
          </div>
        </section>

        {modalDiario && configDiario && footerDiario ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diario-titulo"
            onClick={() => setModalDiario(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zeedo-orange/25 bg-zeedo-white p-5 shadow-xl dark:bg-zeedo-black dark:text-zeedo-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 id="diario-titulo" className="text-lg font-semibold">
                  Diário — {ROTULO_SELECAO_MES[mes as MesResultadoKey]}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalDiario(false)}
                  className="rounded-lg border border-zeedo-orange/30 px-2 py-1 text-sm hover:bg-zeedo-orange/10"
                >
                  Fechar
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-zeedo-black text-zeedo-white dark:bg-zeedo-white/10">
                      <th className="p-2 text-left font-medium">Estratégia</th>
                      <th className="p-2 text-left font-medium bg-emerald-500/15">Média Diária ($)</th>
                      <th className="p-2 text-left font-medium bg-emerald-500/15">Média Diária (R$)</th>
                      <th className="p-2 text-left font-medium">Dias Lucro</th>
                      <th className="p-2 text-left font-medium">Dias Prejuízo</th>
                      <th className="p-2 text-left font-medium">Dias Lucro (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configDiario.map((r: ResumoDiario) => (
                      <tr key={r.nome} className="border-t border-zeedo-orange/10">
                        <td className="p-2 font-medium">{r.nome}</td>
                        <td className="p-2 bg-emerald-500/5">{fmtUsdPlain(r.mediaDiariaUsd, factor)}</td>
                        <td className="p-2 bg-emerald-500/5">{fmtBrlPlain(r.mediaDiariaBrl, factor)}</td>
                        <td className="p-2 text-emerald-600 dark:text-emerald-400">{r.diasLucro}</td>
                        <td className="p-2 text-red-600 dark:text-red-400">{r.diasPrejuizo}</td>
                        <td className="p-2">{r.diasLucroPct}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-zeedo-orange/30 bg-emerald-500/10 font-semibold">
                      <td className="p-2">Média diária</td>
                      <td className="p-2">{fmtUsdPlain(footerDiario.mediaDiariaUsd, factor)}</td>
                      <td className="p-2">{fmtBrlPlain(footerDiario.mediaDiariaBrl, factor)}</td>
                      <td className="p-2 text-zeedo-black/50 dark:text-zeedo-white/50">—</td>
                      <td className="p-2 text-zeedo-black/50 dark:text-zeedo-white/50">—</td>
                      <td className="p-2">{footerDiario.diasLucroPct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="border-t border-zeedo-orange/15 pt-8 text-center text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
          <Link href="/signup" className="hover:text-zeedo-orange hover:underline">
            Criar conta
          </Link>
          {" · "}
          <Link href="/login" className="hover:text-zeedo-orange hover:underline">
            Login
          </Link>
        </footer>
      </main>
    </div>
  );
}
