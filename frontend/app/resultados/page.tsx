import type { Metadata } from "next";
import { ResultadosClient } from "./ResultadosClient";

export const metadata: Metadata = {
  title: "Resultados | Zeedo",
  description:
    "Prova de resultados do Zeedo: trades e desempenho por estratégia (referência de transparência).",
};

export default function ResultadosPage() {
  return <ResultadosClient />;
}
