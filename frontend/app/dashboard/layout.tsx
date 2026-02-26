"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";

const mainNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/trades", label: "Trades" },
  { href: "/dashboard/wallet", label: "Carteira" },
  { href: "/dashboard/telegram", label: "Telegram" },
  { href: "/dashboard/bot", label: "Configurações do Bot" },
];

const userMenuNav = [
  { href: "/choose-plan", label: "Alterar Plano" },
  { href: "/dashboard/profile", label: "Perfil" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ email?: string; username?: string } | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function daysUntil(isoDate: string): number {
    const now = new Date();
    const end = new Date(isoDate);
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const me = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/me`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        ).then((r) => r.json());
        const status = (me.subscription_status || "").toLowerCase();
        const tier = (me.subscription_tier || "").toLowerCase();
        if (status === "expired" || status === "inactive") {
          window.location.href = "/choose-plan";
          return;
        }
        setUser({
          email: session.user?.email ?? me.email,
          username: me.username ?? undefined,
        });
        if (status === "trial" && tier === "pro" && me.trial_expires_at) {
          setTrialDaysLeft(daysUntil(me.trial_expires_at));
        }
      } catch {
        setUser({ email: session.user?.email ?? undefined });
      }
      setLoading(false);
    }
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const me = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/me`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        ).then((r) => r.json());
        const status = (me.subscription_status || "").toLowerCase();
        if (status === "expired" || status === "inactive") {
          window.location.href = "/choose-plan";
          return;
        }
        setUser({ email: session.user?.email ?? me.email, username: me.username ?? undefined });
      } catch {
        setUser({ email: session.user?.email ?? undefined });
      }
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
              <img src="/zeedo-logo.png?v=4" alt="Zeedo" className="h-8 w-8 object-contain mix-blend-multiply dark:mix-blend-screen" />
              <span className="hidden sm:inline text-zeedo-black dark:text-zeedo-white">Zeedo</span>
            </Link>
            <nav className="hidden md:flex gap-6 ml-4">
              {mainNav.map(({ href, label }) => (
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
            {trialDaysLeft !== null && (
              <span
                className="hidden sm:inline-flex items-center gap-1 rounded-full bg-zeedo-orange/15 px-3 py-1 text-xs font-medium text-zeedo-orange shrink-0"
                title="Dias restantes no trial Pro grátis"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"} restantes
              </span>
            )}
            <ThemeToggle />
            <span className="hidden lg:inline text-sm text-zeedo-black/60 dark:text-zeedo-white/60 truncate max-w-[140px]">{user?.username || user?.email}</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 text-zeedo-orange hover:bg-zeedo-orange/10 rounded-lg transition-colors"
                aria-label="Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden="true"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-zeedo-orange/20 bg-zeedo-white dark:bg-zeedo-black shadow-lg overflow-hidden">
                    <div className="md:hidden border-b border-zeedo-orange/20 px-4 py-3 space-y-2">
                      {trialDaysLeft !== null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zeedo-orange/15 px-3 py-1.5 text-sm font-medium text-zeedo-orange">
                          {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"} restantes no trial Pro
                        </span>
                      )}
                    </div>
                    <nav className="flex flex-col py-2">
                      <div className="md:hidden">
                        {mainNav.map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMenuOpen(false)}
                            className={`block px-4 py-2.5 text-sm font-medium ${
                              pathname === href ? "text-zeedo-orange bg-zeedo-orange/10" : "text-zeedo-black/70 hover:bg-zeedo-orange/10 dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
                            }`}
                          >
                            {label}
                          </Link>
                        ))}
                        <div className="border-t border-zeedo-orange/20 my-1" />
                      </div>
                      {userMenuNav.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          className={`block px-4 py-2.5 text-sm font-medium ${
                            pathname === href ? "text-zeedo-orange bg-zeedo-orange/10" : "text-zeedo-black/70 hover:bg-zeedo-orange/10 dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                      <div className="border-t border-zeedo-orange/20 my-1" />
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); handleLogout(); }}
                        className="block w-full text-left px-4 py-2.5 text-sm font-medium text-zeedo-black/70 hover:bg-zeedo-orange/10 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
                      >
                        Sair
                      </button>
                    </nav>
                    <div className="md:hidden border-t border-zeedo-orange/20 px-4 py-2">
                      <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60 truncate">{user?.username || user?.email}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
