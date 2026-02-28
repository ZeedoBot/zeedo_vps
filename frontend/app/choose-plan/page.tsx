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
  { id: "satoshi", name: "Satoshi", price: 299, color: "purple" },
] as const;

export default function ChoosePlanPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasPlan, setHasPlan] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("canceled=1")) {
      setCanceled(true);
    }
  }, []);

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
        if (me.subscription_tier && ["basic", "pro", "satoshi"].includes(me.subscription_tier)) {
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
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await apiPost<{ url: string }>(
        "/stripe/create-checkout-session",
        {
          plan: planId,
          success_url: `${origin}/dashboard?checkout=success`,
          cancel_url: `${origin}/choose-plan?canceled=1`,
        },
        session.access_token
      );
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
    } catch (err) {
      console.error("Erro ao criar checkout:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao processar pagamento.";
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
        <h1 className="text-2xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2 text-center">
          Escolha seu plano
        </h1>
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60 mb-8 text-center">
          Selecione o plano que melhor atende às suas necessidades. Você pode alterar depois.
        </p>
        {canceled && (
          <p className="mb-4 text-sm text-amber-600 dark:text-amber-400 text-center">
            Pagamento cancelado. Você pode tentar novamente quando quiser.
          </p>
        )}
        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-3 items-stretch">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleSelect(plan.id)}
              disabled={loading}
              className={`card relative flex flex-col items-stretch p-6 transition-all hover:ring-2 hover:ring-zeedo-orange focus:outline-none focus:ring-2 focus:ring-zeedo-orange disabled:opacity-50 disabled:cursor-not-allowed ${plan.id === "pro" ? "pt-10" : ""}`}
            >
              {plan.id === "pro" && (
                <span className="absolute top-0 left-0 rounded-br-lg bg-zeedo-orange px-2 py-1 text-xs font-medium text-white">
                  Recomendado
                </span>
              )}

              <div className="text-center">
                <div className="text-lg font-medium text-zeedo-black dark:text-zeedo-white">{plan.name}</div>
                <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0">
                  {plan.id === "pro" && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 line-through">De R$129 por</span>
                  )}
                  <span className="text-2xl font-bold text-zeedo-orange">R${plan.price}</span>
                  <span className="text-[0.7rem] text-gray-500 dark:text-gray-400">/mês</span>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col mt-4 min-h-[180px]">
                <div className="w-full space-y-2 text-left">
                  {plan.id === "basic" && (
                    <>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Ativos:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Apenas 6 disponíveis</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Timeframes:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">15m</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Trades Simultâneos:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">1</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Limite:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">$10 por trade</span>
                      </div>
                    </>
                  )}
                  {plan.id === "pro" && (
                    <>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Ativos:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Todos disponíveis (13)</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Timeframes:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">15m, 30m, 1h e 4h</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Trades Simultâneos:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Máx. 5</span>
                      </div>
                      <div className="text-sm pt-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Limite:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">$150 por trade</span>
                      </div>
                      <div className="text-sm pt-2">
                        <div className="font-medium text-gray-700 dark:text-gray-300">Funções Adicionais:</div>
                        <ul className="mt-1 ml-2 text-gray-600 dark:text-gray-400 list-disc space-y-0.5">
                          <li>Segunda entrada automática</li>
                          <li>Only Long/Short</li>
                          <li>Alvos e Stop Personalizados</li>
                        </ul>
                      </div>
                    </>
                  )}
                  {plan.id === "satoshi" && (
                    <>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Ativos:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Todos disponíveis (13)</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Timeframes:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">5m, 15m, 30m, 1h, 4h e 1d</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Trades Simultâneos:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Ilimitado</span>
                      </div>
                      <div className="text-sm pt-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Limite:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">Ilimitado</span>
                      </div>
                      <div className="text-sm pt-2">
                        <div className="font-medium text-gray-700 dark:text-gray-300">Funções Adicionais:</div>
                        <ul className="mt-1 ml-2 text-gray-600 dark:text-gray-400 list-disc space-y-0.5">
                          <li>Segunda entrada automática</li>
                          <li>Only Long/Short</li>
                          <li>Alvos e Stop Personalizados</li>
                          <li>Mentoria Individual Mensal</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mt-auto pt-6 flex flex-col items-center">
                <span className="inline-block rounded-lg bg-zeedo-orange px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors min-w-[120px] text-center">
                  Selecionar
                </span>
              </div>
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
