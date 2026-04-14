/**
 * Rotas públicas de vendas (/, /bot): sempre estética escura.
 * O dashboard e demais páginas continuam com tema via ThemeProvider + toggle.
 */
export default function VendasLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-screen bg-zeedo-black">{children}</div>;
}
