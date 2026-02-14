import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeedo – Dashboard",
  description: "Controle seu bot de trading",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
