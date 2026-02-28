import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zeedo – Bot de Trading Automatizado para Hyperliquid",
  description:
    "Você vive a vida. O Zeedo vive o mercado. Bot de trading automatizado para perpétuos na Hyperliquid. Sem emoção, sem cansaço. Apenas a matemática trabalhando por você.",
  icons: {
    icon: "/zeedo-logo.png?v=4",
    apple: "/zeedo-logo.png?v=4",
  },
  openGraph: {
    title: "Zeedo – Bot de Trading Automatizado",
    description: "Automatize seus trades na Hyperliquid. Fibonacci, divergências e alertas no Telegram.",
  },
};

export default function BotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
