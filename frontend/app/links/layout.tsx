import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Links | Zeedo",
  description: "Redes sociais e acesso antecipado do Zeedo.",
};

export default function LinksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
