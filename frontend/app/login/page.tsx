"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
        return;
      }
      const session = data?.session;
      if (!session?.access_token) {
        router.push("/choose-plan");
        router.refresh();
        return;
      }
      try {
        const me = await apiGet<{ subscription_tier?: string }>("/auth/me", session.access_token);
        const hasPlan = me.subscription_tier && ["basic", "pro", "enterprise"].includes(me.subscription_tier);
        router.push(hasPlan ? "/dashboard" : "/choose-plan");
      } catch {
        router.push("/choose-plan");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-1">Entrar</h1>
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60 text-sm mb-6">Use seu e-mail e senha para acessar o dashboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zeedo-orange mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zeedo-orange mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
          Não tem conta?{" "}
          <Link href="/signup" className="font-medium text-zeedo-orange hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
