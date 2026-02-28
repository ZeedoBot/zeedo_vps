import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acesso Antecipado – Zeedo",
  description:
    "Garanta seu acesso antecipado ao Zeedo. Bot de trading automatizado para Hyperliquid. Seja um dos primeiros.",
  icons: {
    icon: "/zeedo-logo.png?v=5",
    apple: [
      { url: "/apple-touch-icon.png?v=5", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zeedo",
  },
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
