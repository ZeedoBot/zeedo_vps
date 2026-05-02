"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import { FcGoogle } from "react-icons/fc";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";

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
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const loginInputClass =
    "block w-full rounded-lg border border-zeedo-orange/35 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/45 " +
    "focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      const dest = nextPath === "/segredo" ? "/segredo" : "/dashboard";
      router.replace(dest);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

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

  function oauthCallbackUrl(): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    if (nextPath === "/segredo") {
      return `${base}/auth/callback?next=${encodeURIComponent("/segredo")}`;
    }
    return `${base}/auth/callback`;
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: oauthCallbackUrl() },
      });
      if (err) setError(err.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar login com Google.");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-black text-white">
      <div className="w-full max-w-md rounded-xl border border-zeedo-orange/20 bg-zeedo-black p-6 sm:p-8">
        {!showForgotPassword ? (
          <>
            <h1 className="text-xl font-semibold text-white">Entrar</h1>
            <p className="mt-1 text-sm text-white/60">
              Google em um clique ou e-mail (ou usuário) e senha.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent py-2.5 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-60 transition-colors"
            >
              <FcGoogle className="h-5 w-5 shrink-0" aria-hidden />
              Continuar com Google
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t border-zeedo-orange/25" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-zeedo-black px-3 text-white/45">ou</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="emailOrUsername" className="sr-only">
                  E-mail ou nome de usuário
                </label>
                <input
                  id="emailOrUsername"
                  type="text"
                  autoComplete="username"
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className={loginInputClass}
                  placeholder="E-mail ou usuário"
                />
              </div>
              <div className="relative">
                <label htmlFor="password" className="sr-only">
                  Senha
                </label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${loginInputClass} pr-12`}
                  placeholder="Senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/45 hover:text-white/75"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <IoEyeOffOutline className="h-5 w-5" aria-hidden />
                  ) : (
                    <IoEyeOutline className="h-5 w-5" aria-hidden />
                  )}
                </button>
              </div>

              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setResetMessage(null);
                  }}
                  className="text-sm font-medium text-zeedo-orange hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-400 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-white/60">
              Não tem conta?{" "}
              <Link
                href={nextPath === "/segredo" ? "/signup?next=/segredo" : "/signup"}
                className="font-medium text-zeedo-orange hover:underline"
              >
                Criar conta
              </Link>
            </p>
            <p className="mt-3 text-center text-xs text-white/50">
              <Link href="/termos" className="hover:text-zeedo-orange hover:underline">
                Termos de Uso
              </Link>
              {" · "}
              <Link href="/privacidade" className="hover:text-zeedo-orange hover:underline">
                Política de Privacidade
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white">Recuperar senha</h1>
            <p className="mt-1 text-sm text-white/60">
              Digite seu e-mail para receber um link de redefinição.
            </p>
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <div>
                <label htmlFor="reset_email" className="sr-only">
                  E-mail
                </label>
                <input
                  id="reset_email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={loginInputClass}
                  placeholder="E-mail"
                />
              </div>
              {resetMessage && (
                <p className={`text-sm ${resetMessage.type === "ok" ? "text-green-400" : "text-red-400"}`}>
                  {resetMessage.text}
                </p>
              )}
              <button type="submit" disabled={sendingReset} className="btn-primary w-full">
                {sendingReset ? "Enviando…" : "Enviar link de recuperação"}
              </button>
            </form>
            <div className="mt-6 text-center">
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-black">
        <p className="text-white/60">Carregando…</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
