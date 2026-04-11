/** Alvo atingido por estratégia (planilha) ou STOP. */
export type AlvoHit = "1" | "2" | "3" | "STOP";

export type StrategyCol = {
  hit: AlvoHit | null;
  /** Lucro/prejuízo em USD; null = não preenchido na planilha */
  pnlUsd: number | null;
};

export type ResultadoTrade = {
  id: number;
  mes: "FEV" | "MAR";
  symbol: string;
  tf: string;
  side: "LONG" | "SHORT";
  /** Ex.: 09/02 ou 05/03 */
  dataLabel: string;
  stop: number | null;
  alvo: number | null;
  /** Texto da planilha (coluna “Detalhes” na UI): LSR, FR/FO, … ou "-" */
  motivos: string;
  conservador: StrategyCol | null;
  mediano: StrategyCol | null;
  agressivo: StrategyCol | null;
  degen: StrategyCol | null;
};

export type ResumoEstrategia = {
  nome: "CONSERVADOR" | "MEDIANO" | "AGRESSIVO" | "DEGEN";
  lucroUsd: number;
  winRatePct: number;
  ranking: number;
  lucroBrl: number;
};

/** Métricas diárias por estratégia (modal). */
export type ResumoDiario = {
  nome: string;
  diasLucro: number;
  diasPrejuizo: number;
  diasLucroPct: number;
  mediaDiariaUsd: number;
  mediaDiariaBrl: number;
};

export type DiarioFooter = {
  diasLucroPct: number;
  mediaDiariaUsd: number;
  mediaDiariaBrl: number;
};

export type MesResultadoKey = "FEV" | "MAR";

/** Inclui visão agregada de todos os meses. */
export type MesSelecao = MesResultadoKey | "AGG";

/** Resumo exibido por mês (diário opcional + rodapé do diário). */
export type ResumoMesConfig = {
  estrategias: ResumoEstrategia[];
  diario?: ResumoDiario[];
  diarioFooter?: DiarioFooter;
};
