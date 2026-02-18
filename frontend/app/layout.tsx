import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Zeedo – Dashboard",
  description: "Você vive a vida. O Zeedo vive o mercado. Sem emoção, sem cansaço. Apenas a matemática trabalhando por você.",
  icons: {
    icon: "/zeedo-logo.png?v=4",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
