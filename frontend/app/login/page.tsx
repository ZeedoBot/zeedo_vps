"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const router = useRouter();

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage(null);
    setSendingReset(true);
    try {
      await apiPost("/account/request-password-reset", { email: resetEmail }, undefined);
      setResetMessage({ type: "ok", text: "Se o email existir, você receberá um link para redefinir sua senha." });
      setResetEmail("");
    } catch (err) {
      setResetMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao enviar email." });
    } finally {
      setSendingReset(false);
    }
  }

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
        const me = await apiGet<{ subscription_tier?: string; subscription_status?: string }>("/auth/me", res.access_token);
        const status = (me.subscription_status || "").toLowerCase();
        const hasPlan = me.subscription_tier && ["basic", "pro", "satoshi"].includes(me.subscription_tier)
          && (status === "active" || status === "trial");
        if (nextPath === "/segredo") {
          router.push("/segredo");
        } else {
          router.push(hasPlan ? "/dashboard" : "/choose-plan");
        }
      } catch {
        router.push(nextPath === "/segredo" ? "/segredo" : "/choose-plan");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
      <div className="card w-full max-w-md">
        {!showForgotPassword ? (
          <>
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
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetMessage(null);
                }}
                className="text-sm font-medium text-zeedo-orange hover:underline"
              >
                Esqueceu sua senha?
              </button>
            </div>
            <p className="mt-4 text-center text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
              Não tem conta?{" "}
              <Link href={nextPath === "/segredo" ? "/signup?next=/segredo" : "/signup"} className="font-medium text-zeedo-orange hover:underline">
                Criar conta
              </Link>
            </p>
            <p className="mt-3 text-center text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
              <Link href="/termos" className="hover:text-zeedo-orange hover:underline">Termos de Uso</Link>
              {" · "}
              <Link href="/privacidade" className="hover:text-zeedo-orange hover:underline">Política de Privacidade</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-1">Recuperar senha</h1>
            <p className="text-zeedo-black/60 dark:text-zeedo-white/60 text-sm mb-6">
              Digite seu email para receber um link de recuperação de senha.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="reset_email" className="block text-sm font-medium text-zeedo-orange mb-1">
                  E-mail
                </label>
                <input
                  id="reset_email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="input-field"
                  placeholder="seu@email.com"
                />
              </div>
              {resetMessage && (
                <p className={`text-sm ${resetMessage.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                  {resetMessage.text}
                </p>
              )}
              <button type="submit" disabled={sendingReset} className="btn-primary w-full">
                {sendingReset ? "Enviando…" : "Enviar link de recuperação"}
              </button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetMessage(null);
                }}
                className="text-sm font-medium text-zeedo-orange hover:underline"
              >
                Voltar para login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
