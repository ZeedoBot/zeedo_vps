"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/profile", label: "Perfil" },
  { href: "/dashboard/wallet", label: "Carteira" },
  { href: "/dashboard/telegram", label: "Telegram" },
  { href: "/dashboard/bot", label: "Bot" },
  { href: "/choose-plan", label: "Alterar Plano" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
      else setUser(session.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zeedo-white dark:bg-zeedo-black">
      <header className="border-b border-zeedo-orange/20 bg-zeedo-white dark:bg-zeedo-black dark:border-zeedo-orange/20 sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-zeedo-black dark:text-zeedo-white shrink-0">
              <img src="/zeedo-logo.png?v=3" alt="Zeedo" className="h-8 w-8 object-contain mix-blend-multiply dark:mix-blend-screen" />
              <span className="hidden sm:inline text-zeedo-black dark:text-zeedo-white">Zeedo</span>
            </Link>
            <nav className="hidden md:flex gap-6 ml-4">
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors shrink-0 ${
                    pathname === href ? "text-zeedo-orange" : "text-zeedo-black/70 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <span className="hidden sm:inline text-sm text-zeedo-black/60 dark:text-zeedo-white/60 truncate max-w-[140px]">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-zeedo-black/70 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
            >
              Sair
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-zeedo-orange"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-zeedo-orange/20 bg-zeedo-white dark:bg-zeedo-black">
            <nav className="flex flex-col py-4 px-4 gap-1">
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`py-3 px-4 rounded-lg text-sm font-medium ${
                    pathname === href
                      ? "text-zeedo-orange bg-zeedo-orange/10"
                      : "text-zeedo-black/70 dark:text-zeedo-white/70 hover:bg-zeedo-orange/10"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-zeedo-orange/20 my-2 pt-2 px-4">
                <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60 truncate">{user?.email}</p>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
