import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  RESUMO_FEV,
  RESUMO_MAR,
  RESUMO_MAR_DIARIO,
  RESULTADOS_META,
  RESULTADOS_TRADES,
} from "@/lib/resultados-data";
import type { ResultadoTrade, StrategyCol } from "@/lib/resultados-types";

export const metadata: Metadata = {
  title: "Resultados | Zeedo",
  description:
    "Prova de resultados do Zeedo: trades ativados e desempenho por estratégia (dados de referência da planilha interna).",
};

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(n);
}

function fmtPnlUsd(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
}

function cellStrategy(col: StrategyCol | null): ReactNode {
  if (!col || (col.hit === null && col.pnlUsd === null)) {
    return <span className="text-zeedo-black/35 dark:text-zeedo-white/35">—</span>;
  }
  const hit = col.hit ?? "—";
  const pnl = col.pnlUsd;
  const pnlClass =
    pnl === null
      ? "text-zeedo-black/50 dark:text-zeedo-white/50"
      : pnl < 0
        ? "text-red-600 dark:text-red-400 font-medium"
        : pnl > 0
          ? "text-emerald-600 dark:text-emerald-400 font-medium"
          : "text-zeedo-black/60 dark:text-zeedo-white/60";
  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span className="text-[0.65rem] uppercase tracking-wide text-zeedo-black/50 dark:text-zeedo-white/50">{hit}</span>
      <span className={pnlClass}>{fmtPnlUsd(pnl)}</span>
    </div>
  );
}

function isLinhaPendente(t: ResultadoTrade): boolean {
  return t.symbol.trim() === "";
}

function SimNao(v: boolean): ReactNode {
  return (
    <span
      className={
        v
          ? "rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "rounded px-1.5 py-0.5 text-xs font-medium bg-red-500/15 text-red-700 dark:text-red-300"
      }
    >
      {v ? "Sim" : "Não"}
    </span>
  );
}

export default function ResultadosPage() {
  const pendentes = RESULTADOS_TRADES.filter(isLinhaPendente).length;

  return (
    <div className="min-h-screen bg-zeedo-white dark:bg-zeedo-black text-zeedo-black dark:text-zeedo-white">
      <header className="border-b border-zeedo-orange/15 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zeedo-orange">Zeedo</p>
            <h1 className="text-xl font-semibold sm:text-2xl">Prova de resultados</h1>
          </div>
          <Link href="/página-inicial" className="text-sm text-zeedo-orange hover:underline">
            ← Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-10">
        <p className="text-sm text-zeedo-black/70 dark:text-zeedo-white/70 leading-relaxed max-w-3xl">
          Histórico de sinais e trades usados como referência de transparência. Target loss de referência:{" "}
          <strong>${RESULTADOS_META.targetLossUsd}</strong> por trade. Dólar (Fev/Mar):{" "}
          <strong>R$ {RESULTADOS_META.dolarBrlFev.toFixed(2).replace(".", ",")}</strong>. Os PnLs por estratégia
          nas linhas de fevereiro e em parte de março podem ser completados em{" "}
          <code className="rounded bg-zeedo-black/5 px-1 py-0.5 text-xs dark:bg-white/10">lib/resultados-data.ts</code>
          .
        </p>

        {pendentes > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-100">
            {pendentes} linha(s) com símbolo vazio (IDs 30–50, 55–75 e 100): reserve para copiar da planilha o trecho que ainda não foi transcrito.
          </p>
        )}

        {/* Resumo Fevereiro */}
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-3">Resumo — Fevereiro</h2>
          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-zeedo-black/[0.04] dark:bg-white/[0.06] text-left">
                  <th className="p-2 font-medium">Estratégia</th>
                  <th className="p-2 font-medium">Lucro (USD)</th>
                  <th className="p-2 font-medium">Win rate</th>
                  <th className="p-2 font-medium">Ranking</th>
                  <th className="p-2 font-medium">Lucro (R$)</th>
                </tr>
              </thead>
              <tbody>
                {RESUMO_FEV.map((r) => (
                  <tr key={r.nome} className="border-t border-zeedo-orange/10">
                    <td className="p-2">
                      <span
                        className={
                          r.nome === "CONSERVADOR"
                            ? "font-medium text-cyan-700 dark:text-cyan-300"
                            : r.nome === "MEDIANO"
                              ? "font-medium text-amber-700 dark:text-amber-300"
                              : r.nome === "AGRESSIVO"
                                ? "font-medium text-zeedo-orange"
                                : "font-medium text-red-600 dark:text-red-400"
                        }
                      >
                        {r.nome.charAt(0) + r.nome.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="p-2">${r.lucroUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">{r.winRatePct.toFixed(2).replace(".", ",")}%</td>
                    <td className="p-2">{r.ranking}</td>
                    <td className="p-2">
                      R${" "}
                      {r.lucroBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zeedo-black/55 dark:text-zeedo-white/55">
            Média das estratégias (Fev): ~US$ 364,39 · Win rate médio ~60,53% · Média 30 dias US$ 910,99 · Média diária
            ~US$ 30,37 (~R$ 157,90).
          </p>
        </section>

        {/* Resumo Março */}
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-3">Resumo — Março</h2>
          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-zeedo-black/[0.04] dark:bg-white/[0.06] text-left">
                  <th className="p-2 font-medium">Estratégia</th>
                  <th className="p-2 font-medium">Lucro (USD)</th>
                  <th className="p-2 font-medium">Win rate</th>
                  <th className="p-2 font-medium">Ranking</th>
                  <th className="p-2 font-medium">Lucro (R$)</th>
                </tr>
              </thead>
              <tbody>
                {RESUMO_MAR.map((r) => (
                  <tr key={r.nome} className="border-t border-zeedo-orange/10">
                    <td className="p-2">
                      <span
                        className={
                          r.nome === "CONSERVADOR"
                            ? "font-medium text-cyan-700 dark:text-cyan-300"
                            : r.nome === "MEDIANO"
                              ? "font-medium text-amber-700 dark:text-amber-300"
                              : r.nome === "AGRESSIVO"
                                ? "font-medium text-zeedo-orange"
                                : "font-medium text-red-600 dark:text-red-400"
                        }
                      >
                        {r.nome.charAt(0) + r.nome.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="p-2">${r.lucroUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">{r.winRatePct.toFixed(2).replace(".", ",")}%</td>
                    <td className="p-2">{r.ranking}</td>
                    <td className="p-2">
                      R${" "}
                      {r.lucroBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zeedo-black/55 dark:text-zeedo-white/55">
            Média (Mar): US$ 1.987,23 · Win rate médio 53,37% · Média 30 dias US$ 2.055,75 · Média diária US$ 68,53
            (~R$ 356,33).
          </p>

          <h3 className="text-base font-medium mt-6 mb-2">Desempenho por dia (Março)</h3>
          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-zeedo-black/[0.04] dark:bg-white/[0.06] text-left">
                  <th className="p-2 font-medium">Estratégia</th>
                  <th className="p-2 font-medium">Dias +</th>
                  <th className="p-2 font-medium">Dias −</th>
                  <th className="p-2 font-medium">% dias</th>
                  <th className="p-2 font-medium">Média diária (R$)</th>
                </tr>
              </thead>
              <tbody>
                {RESUMO_MAR_DIARIO.map((r) => (
                  <tr key={r.nome} className="border-t border-zeedo-orange/10">
                    <td className="p-2 font-medium">{r.nome}</td>
                    <td className="p-2 text-emerald-600 dark:text-emerald-400">{r.diasPositivos}</td>
                    <td className="p-2 text-red-600 dark:text-red-400">{r.diasNegativos}</td>
                    <td className="p-2">{r.winRateDiasPct}%</td>
                    <td className="p-2">
                      R${" "}
                      {r.mediaDiariaBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tabela de trades */}
        <section>
          <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-3">
            Trades ({RESULTADOS_TRADES.length} linhas)
          </h2>
          <p className="mb-3 text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
            <strong>100%</strong>: sem motivos de bloqueio no setup. <strong>Motivos</strong>: filtros (ex.: LSR, FR/FO,
            LE/HE). <strong>Ativou</strong>: o Zeedo executou o trade. Cada estratégia mostra o alvo atingido (1, 2, 3 ou
            STOP) e o PnL em USD quando disponível na planilha.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zeedo-orange/20 shadow-sm">
            <table className="w-full min-w-[1100px] text-xs sm:text-sm">
              <thead>
                <tr className="bg-zeedo-black/[0.06] dark:bg-white/[0.08] text-left">
                  <th className="sticky left-0 z-10 bg-zeedo-black/[0.06] px-2 py-2 font-medium dark:bg-white/[0.08]">#</th>
                  <th className="px-2 py-2 font-medium">Mês</th>
                  <th className="px-2 py-2 font-medium">Símbolo</th>
                  <th className="px-2 py-2 font-medium">TF</th>
                  <th className="px-2 py-2 font-medium">Lado</th>
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Stop</th>
                  <th className="px-2 py-2 font-medium">Alvo</th>
                  <th className="px-2 py-2 font-medium">100%</th>
                  <th className="px-2 py-2 font-medium min-w-[5rem]">Motivos</th>
                  <th className="px-2 py-2 font-medium">Ativou</th>
                  <th className="px-2 py-2 font-medium border-l border-zeedo-orange/20 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 min-w-[4.5rem]">
                    Cons.
                  </th>
                  <th className="px-2 py-2 font-medium bg-amber-500/10 text-amber-900 dark:text-amber-200 min-w-[4.5rem]">
                    Med.
                  </th>
                  <th className="px-2 py-2 font-medium bg-zeedo-orange/15 text-zeedo-black dark:text-zeedo-white min-w-[4.5rem]">
                    Agr.
                  </th>
                  <th className="px-2 py-2 font-medium bg-red-500/10 text-red-800 dark:text-red-200 min-w-[4.5rem]">
                    Degen
                  </th>
                </tr>
              </thead>
              <tbody>
                {RESULTADOS_TRADES.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-t border-zeedo-orange/10 ${
                      isLinhaPendente(t) ? "bg-amber-500/[0.06] dark:bg-amber-500/10" : ""
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-zeedo-white px-2 py-1.5 font-mono dark:bg-zeedo-black">{t.id}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.mes}</td>
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{t.symbol || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.tf || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.side}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{t.dataLabel}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtNum(t.stop)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtNum(t.alvo)}</td>
                    <td className="px-2 py-1.5">{SimNao(t.filtro100)}</td>
                    <td className="px-2 py-1.5 text-zeedo-black/80 dark:text-zeedo-white/80">{t.motivos}</td>
                    <td className="px-2 py-1.5">{SimNao(t.ativouBot)}</td>
                    <td className="border-l border-zeedo-orange/15 px-2 py-1.5 bg-cyan-500/5">{cellStrategy(t.conservador)}</td>
                    <td className="px-2 py-1.5 bg-amber-500/5">{cellStrategy(t.mediano)}</td>
                    <td className="px-2 py-1.5 bg-zeedo-orange/5">{cellStrategy(t.agressivo)}</td>
                    <td className="px-2 py-1.5 bg-red-500/5">{cellStrategy(t.degen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="border-t border-zeedo-orange/15 pt-8 text-center text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
          <Link href="/página-inicial" className="hover:text-zeedo-orange hover:underline">
            Página inicial
          </Link>
          {" · "}
          <Link href="/login" className="hover:text-zeedo-orange hover:underline">
            Entrar
          </Link>
        </footer>
      </main>
    </div>
  );
}
