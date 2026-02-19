"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiPost<{ access_token: string; refresh_token: string }>(
        "/auth/login",
        { email_or_username: emailOrUsername.trim(), password },
        undefined
      ).catch((err: Error) => {
        setError(err.message?.includes("401") || err.message?.includes("incorretos") ? "E-mail/nome de usuário ou senha incorretos." : err.message || "Erro ao entrar.");
        return null;
      });
      if (!res?.access_token) return;

      const supabase = createClient();
      const { error: err } = await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token });
      if (err) {
        setError("Erro ao configurar sessão.");
        return;
      }

      try {
        const me = await apiGet<{ subscription_tier?: string }>("/auth/me", res.access_token);
        const hasPlan = me.subscription_tier && ["basic", "pro", "satoshi"].includes(me.subscription_tier);
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
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60 text-sm mb-6">Use e-mail ou nome de usuário e senha para acessar o dashboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="emailOrUsername" className="block text-sm font-medium text-zeedo-orange mb-1">
              E-mail ou nome de usuário
            </label>
            <input
              id="emailOrUsername"
              type="text"
              autoComplete="username"
              required
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="input-field"
              placeholder="seu@email.com ou usuario"
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
        <p className="mt-3 text-center text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
          <Link href="/termos" className="hover:text-zeedo-orange hover:underline">Termos de Uso</Link>
          {" · "}
          <Link href="/privacidade" className="hover:text-zeedo-orange hover:underline">Política de Privacidade</Link>
        </p>
      </div>
    </div>
  );
}
