import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso Antecipado – Zeedo",
  description:
    "Garanta seu acesso antecipado ao Zeedo. Bot de trading automatizado para Hyperliquid. Seja um dos primeiros.",
  openGraph: {
    title: "Acesso Antecipado – Zeedo",
    description: "Garanta seu acesso antecipado ao Zeedo. Cadastre-se e seja avisado assim que estivermos prontos.",
  },
};

export default function AcessoAntecipadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
