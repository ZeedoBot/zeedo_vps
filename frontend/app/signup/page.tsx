"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

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
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
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
      setTimeout(() => router.push("/login"), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
        <div className="card w-full max-w-md text-center">
          <p className="text-green-700 dark:text-green-400 font-medium">Conta criada com sucesso.</p>
          <p className="text-gray-600 dark:text-zeedo-white/70 text-sm mt-3">
            Verifique o e-mail <strong>{email}</strong> e confirme sua conta pelo link enviado antes de fazer login.
          </p>
          <p className="text-gray-500 dark:text-zeedo-white/50 text-xs mt-4">Redirecionando para o login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Criar conta</h1>
        <p className="text-gray-600 dark:text-zeedo-white/80 text-sm mb-6">Preencha seus dados para começar.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zeedo-white/90 mb-1">
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zeedo-white/90 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-zeedo-white/90 mb-1">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              placeholder="Repita a senha"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-zeedo-white/60">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-zeedo-orange hover:underline">
            Entrar
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-gray-500 dark:text-zeedo-white/50">
          Ao criar conta, você aceita os{" "}
          <Link href="/termos" className="text-zeedo-orange hover:underline">Termos de Uso</Link>
          {" e a "}
          <Link href="/privacidade" className="text-zeedo-orange hover:underline">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
