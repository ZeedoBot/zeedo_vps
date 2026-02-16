"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

const PLANS = [
  { id: "basic", name: "Basic", price: 49, color: "green" },
  { id: "pro", name: "Pro", price: 79, color: "blue" },
  { id: "enterprise", name: "Enterprise", price: 199, color: "purple" },
] as const;

export default function ChoosePlanPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasPlan, setHasPlan] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const me = await apiGet<{ subscription_tier?: string }>("/auth/me", session.access_token);
        if (me.subscription_tier && ["basic", "pro", "enterprise"].includes(me.subscription_tier)) {
          setHasPlan(true);
        }
      } catch {
        // ignore
      }
    }
    check();
  }, [router]);

  async function handleSelect(planId: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiPost("/plans/choose", { plan: planId }, session.access_token);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar plano.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50 dark:bg-gray-900 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
          Escolha seu plano
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
          Selecione o plano que melhor atende às suas necessidades. Você pode alterar depois.
        </p>
        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleSelect(plan.id)}
              disabled={loading}
              className={`
                card flex flex-col items-center p-6 transition-all
                hover:ring-2 hover:ring-primary-500 hover:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
                ${plan.color === "green" ? "border-green-200 dark:border-green-800" : ""}
                ${plan.color === "blue" ? "border-blue-200 dark:border-blue-800" : ""}
                ${plan.color === "purple" ? "border-purple-200 dark:border-purple-800" : ""}
              `}
            >
              <span className="text-lg font-medium text-gray-900 dark:text-white">{plan.name}</span>
              <span className="mt-2 text-2xl font-bold text-primary-600 dark:text-primary-400">
                R${plan.price}
              </span>
              <span className="mt-1 text-sm text-gray-500 dark:text-gray-400">/mês</span>
              <span className="mt-4 text-sm text-gray-600 dark:text-gray-300 text-center">
                {plan.id === "basic" && "BTC, ETH • 15m • Até 2 trades simultâneos"}
                {plan.id === "pro" && "Todos os tokens • 15m–4h • Long/Short • Até 5 trades"}
                {plan.id === "enterprise" && "Ilimitado • Todos timeframes • Long/Short"}
              </span>
              <span className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">
                Selecionar
              </span>
            </button>
          ))}
        </div>
        {hasPlan && (
          <p className="mt-6 text-center">
            <Link
              href="/dashboard"
              className="text-sm text-primary-600 hover:underline dark:text-primary-400"
            >
              Já tenho plano, ir ao dashboard →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
