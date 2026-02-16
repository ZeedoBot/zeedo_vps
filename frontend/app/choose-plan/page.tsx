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
      const result = await apiPost("/plans/choose", { plan: planId }, session.access_token);
      if (result) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Erro ao selecionar plano:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao salvar plano.";
      setError(errorMessage.includes("fetch") ? "Erro de conexão. Verifique se a API está rodando." : errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black relative">
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
              <span className="mt-1 text-sm text-gray-500 dark:text-gray-400 mb-4">/mês</span>
              
              <div className="w-full mt-4 space-y-2 text-left">
                {plan.id === "basic" && (
                  <>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Ativos:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">BTC e ETH</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Timeframes:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">15m</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Trades Simultâneos:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Máx. 2</span>
                    </div>
                  </>
                )}
                {plan.id === "pro" && (
                  <>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Ativos:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Todos disponíveis</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Timeframes:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">15m, 30m, 1h e 4h</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Trades Simultâneos:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Máx. 5</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">+</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Função Only Short ou Only Long</span>
                    </div>
                  </>
                )}
                {plan.id === "enterprise" && (
                  <>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Ativos:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Todos disponíveis</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Timeframes:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">5m, 15m, 30m, 1h, 4h e 1d</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Trades Simultâneos:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Ilimitado</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">+</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Função Only Short ou Only Long</span>
                    </div>
                  </>
                )}
              </div>
              
              <span className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
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
