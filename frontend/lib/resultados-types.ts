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
  /** Ex.: 09/02 ou 5/3 */
  dataLabel: string;
  stop: number | null;
  alvo: number | null;
  /** Códigos (LSR, FR/FO, …) ou "-" quando vazio */
  motivos: string;
  /** Coluna "100%": sem motivos de bloqueio para o setup */
  filtro100: boolean;
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

export type ResumoDiario = {
  nome: string;
  diasPositivos: number;
  diasNegativos: number;
  winRateDiasPct: number;
  mediaDiariaBrl: number;
};

export type MesResultadoKey = "FEV" | "MAR";

/** Resumo exibido por mês (tabela + rodapé; diário opcional). */
export type ResumoMesConfig = {
  estrategias: ResumoEstrategia[];
  footerTexto: string;
  diario?: ResumoDiario[];
};
