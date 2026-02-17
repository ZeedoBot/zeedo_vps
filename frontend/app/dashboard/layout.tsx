"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/wallet", label: "Carteira" },
  { href: "/dashboard/telegram", label: "Telegram" },
  { href: "/dashboard/bot", label: "Bot" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
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
      <header className="border-b border-zeedo-orange/20 bg-zeedo-white dark:bg-zeedo-black dark:border-zeedo-orange/20">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-zeedo-black dark:text-zeedo-white">
            <img src="/zeedo-logo.png?v=3" alt="Zeedo" className="h-8 w-8 object-contain mix-blend-multiply dark:mix-blend-screen" />
            <span className="text-zeedo-black dark:text-zeedo-white">Zeedo</span>
          </Link>
          <nav className="flex gap-6">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  pathname === href ? "text-zeedo-orange" : "text-zeedo-black/70 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 truncate max-w-[180px]">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-zeedo-black/70 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
