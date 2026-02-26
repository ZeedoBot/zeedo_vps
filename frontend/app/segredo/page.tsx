"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function SegredoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cpf, setCpf] = useState("");
  const [trialStatus, setTrialStatus] = useState<"none" | "active" | "ended" | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoggedIn(false);
        setSessionChecked(true);
        return;
      }
      setIsLoggedIn(true);
      try {
        const me = await apiGet<{ subscription_tier?: string; subscription_status?: string }>("/auth/me", session.access_token);
        // Redireciona só se tiver plano ativo (basic/pro/satoshi comprado ou trial Pro resgatado). Sem plano (inactive) = vê formulário CPF.
        const hasActivePlan = me.subscription_tier && ["basic", "pro", "satoshi"].includes(me.subscription_tier)
          && (me.subscription_status === "active" || me.subscription_status === "trial");
        if (hasActivePlan) {
          router.replace("/dashboard");
          return;
        }
        const st = await apiGet<{ status: string }>("/trial/status", session.access_token);
        setTrialStatus(st.status as "none" | "active" | "ended");
        if (st.status === "active") {
          router.replace("/dashboard");
          return;
        }
      } catch {
        setTrialStatus("none");
      }
      setSessionChecked(true);
    }
    check();
  }, [router]);

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length <= 11) setCpf(formatCpf(raw));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }
    const raw = cpf.replace(/\D/g, "");
    if (raw.length !== 11) {
      setError("Informe um CPF válido com 11 dígitos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiPost("/trial/claim", { cpf: raw }, session.access_token);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ativar trial.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando…</p>
      </div>
    );
  }

  if (isLoggedIn && trialStatus === "ended") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
        <ThemeToggle />
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <Image src="/zeedo-robot-segredo.png" alt="Zeedo" width={200} height={200} className="object-contain" priority />
          </div>
          <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2">
            Trial já utilizado
          </h1>
          <p className="text-zeedo-black/60 dark:text-zeedo-white/60 mb-6">
            Você já utilizou seu período de teste. Assine um plano para continuar usando o Zeedo.
          </p>
          <Link
            href="/choose-plan"
            className="inline-block rounded-lg bg-zeedo-orange px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <Image src="/zeedo-robot-segredo.png" alt="Zeedo" width={220} height={220} className="object-contain" priority />
          </div>
          <h1 className="text-2xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2">
            Parabéns. Você acabou de ganhar 30 dias grátis de acesso ao plano Pro!
          </h1>
          <p className="text-zeedo-black/60 dark:text-zeedo-white/60 mb-8 text-sm">
            Crie sua conta para resgatar seu benefício e começar a operar com o Zeedo Pro.
          </p>
          <Link
            href="/signup?next=/segredo"
            className="inline-block rounded-lg bg-zeedo-orange px-6 py-3 text-base font-medium text-white hover:opacity-90 transition-opacity"
          >
            Criar conta e resgatar
          </Link>
          <p className="mt-6 text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
            Já tem conta?{" "}
            <Link href="/login?next=/segredo" className="text-zeedo-orange hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/zeedo-robot-segredo.png" alt="Zeedo" width={220} height={220} className="object-contain" priority />
        </div>
        <h1 className="text-2xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2 text-center">
          Parabéns. Você acabou de ganhar 30 dias grátis de acesso ao plano Pro!
        </h1>
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60 mb-6 text-center text-sm">
          Informe seu CPF para ativar o benefício.
        </p>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-zeedo-orange mb-2">
              CPF
            </label>
            <input
              id="cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              className="input-field w-full"
              maxLength={14}
            />
            <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60 mt-1">
              Seu CPF será validado e não será armazenado. Apenas um hash é guardado para evitar fraudes.
            </p>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || cpf.replace(/\D/g, "").length !== 11}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Ativando…" : "Ativar teste grátis"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
          <Link href="/dashboard" className="text-zeedo-orange hover:underline">
            Voltar ao dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
