"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { FcGoogle } from "react-icons/fc";

function SignupContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const signupInputClass =
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

  function oauthCallbackUrl(): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    if (nextPath === "/segredo") {
      return `${base}/auth/callback?next=${encodeURIComponent("/segredo")}`;
    }
    return `${base}/auth/callback`;
  }

  async function handleGoogleSignup() {
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
      setError(e instanceof Error ? e.message : "Erro ao iniciar cadastro com Google.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const loginPath = nextPath && nextPath === "/segredo" ? "/login?next=/segredo" : "/login";
      const redirectTo = base ? `${base}${loginPath}` : undefined;
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(loginPath), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-black text-white">
        <div className="w-full max-w-md rounded-xl border border-zeedo-orange/20 bg-zeedo-black p-6 sm:p-8 text-center">
          <p className="text-green-400 font-medium">Conta criada com sucesso.</p>
          <p className="text-white/70 text-sm mt-3">
            Verifique o e-mail <strong>{email}</strong> e confirme sua conta pelo link enviado antes de fazer login.
          </p>
          <p className="text-white/50 text-xs mt-4">
            Redirecionando para o login…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-black text-white">
      <div className="w-full max-w-md rounded-xl border border-zeedo-orange/20 bg-zeedo-black p-6 sm:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Zeedo</h1>
          <p className="mt-1.5 text-sm text-white/60">Crie sua conta</p>
        </div>
        <button
          type="button"
          onClick={handleGoogleSignup}
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
              className={signupInputClass}
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={signupInputClass}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zeedo-orange mb-1">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={signupInputClass}
              placeholder="Repita a senha"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-white/50">
          *Um código de confirmação será enviado no seu email, se não chegar confira na caixa de spam.*
        </p>
        <p className="mt-4 text-center text-sm text-white/60">
          Já tem conta?{" "}
          <Link href={nextPath === "/segredo" ? "/login?next=/segredo" : "/login"} className="font-medium text-zeedo-orange hover:underline">
            Entrar
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-white/50">
          Ao criar conta, você aceita os{" "}
          <Link href="/termos" className="text-zeedo-orange hover:underline">Termos de Uso</Link>
          {" e a "}
          <Link href="/privacidade" className="text-zeedo-orange hover:underline">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-black">
        <p className="text-white/60">Carregando…</p>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
