"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 49,
    features: ["Ativos: BTC e ETH", "Timeframes: 15m", "Trades simultâneos: máx. 2"],
    cta: "Começar",
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    recommended: true,
    features: [
      "Ativos: Todos disponíveis",
      "Timeframes: 15m, 30m, 1h e 4h",
      "Trades simultâneos: máx. 5",
      "Segunda entrada automática",
      "Função Only",
    ],
    cta: "Começar",
  },
  {
    id: "satoshi",
    name: "Satoshi",
    price: 199,
    features: [
      "Ativos: Todos disponíveis",
      "Timeframes: 5m, 15m, 30m, 1h, 4h e 1d",
      "Trades simultâneos: Ilimitado",
      "Segunda entrada automática",
      "Função Only",
    ],
    cta: "Começar",
  },
] as const;

const FAQ = [
  {
    q: "O que é o Zeedo?",
    a: "O Zeedo é um bot de trading automatizado para perpétuos na Hyperliquid. Ele opera 24/7 usando sinais técnicos (divergências e padrões de candlestick) e executa entradas com níveis de Fibonacci, controles de risco e alertas via Telegram.",
  },
  {
    q: "Preciso ficar na frente do computador?",
    a: "Não. O Zeedo trabalha sozinho. Você configura uma vez, conecta sua carteira Hyperliquid e o Telegram, e recebe todas as notificações no celular — entradas, parciais, stops e PnL.",
  },
  {
    q: "O Zeedo funciona na Hyperliquid?",
    a: "Sim. O bot foi desenvolvido para operar exclusivamente na Hyperliquid (perpétuos de cripto). Você precisa de uma carteira compatível (Rabby ou MetaMask) e fundos na rede.",
  },
  {
    q: "É seguro conectar minha carteira?",
    a: "O Zeedo usa a API oficial da Hyperliquid. Sua chave privada é criptografada e armazenada com segurança. O bot só executa trades com base nas regras que você definir. Você mantém controle total sobre limites de perda e exposição.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Você pode desativar o bot e encerrar sua assinatura quando quiser. Nada de fidelidade forçada.",
  },
];

const STEPS = [
  {
    title: "Crie sua conta",
    desc: "Cadastre-se em segundos e escolha o plano que faz sentido para você.",
    icon: "1",
  },
  {
    title: "Conecte carteira e Telegram",
    desc: "Vinculando sua carteira Hyperliquid e o Telegram, você recebe todos os alertas no celular.",
    icon: "2",
  },
  {
    title: "Configure e ative",
    desc: "Defina ativos, timeframes e limites de risco. Uma vez ligado, o Zeedo opera sozinho.",
    icon: "3",
  },
];

const BENEFITS = [
  {
    title: "Operação 24/7",
    desc: "O mercado não para. O Zeedo também não. Sem cansaço, sem distração.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: "Sem emoção",
    desc: "Decisões baseadas em matemática e regras, não em medo ou ganância.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    ),
  },
  {
    title: "Controle total",
    desc: "Target loss, exposição máxima e segunda entrada — tudo configurável por você.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    ),
  },
  {
    title: "Alertas no Telegram",
    desc: "Entradas, parciais, stops e PnL — tudo no seu celular, em tempo real.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
  },
];

export default function VendasPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-zeedo-white dark:bg-zeedo-black text-zeedo-black dark:text-zeedo-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zeedo-orange/20 bg-zeedo-white/80 dark:bg-zeedo-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/zeedo-logo.png?v=4" alt="Zeedo" width={40} height={40} className="mix-blend-multiply dark:mix-blend-screen" />
            <span className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white">Zeedo</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zeedo-black/70 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange transition-colors">
              Entrar
            </Link>
            <Link href="/signup" className="btn-primary">
              Criar conta
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 sm:py-28">
          <div className="absolute inset-0 bg-gradient-to-b from-zeedo-orange/5 to-transparent dark:from-zeedo-orange/10" />
          <div className="relative mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              <span className="text-zeedo-black dark:text-zeedo-white">Você vive a vida.</span>
              <br />
              <span className="text-zeedo-orange">O Zeedo vive o mercado.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zeedo-black/70 dark:text-zeedo-white/70 sm:text-xl">
              Bot de trading automatizado para Hyperliquid. Sem emoção, sem cansaço. Apenas a matemática trabalhando por você.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup" className="btn-primary w-full max-w-xs py-3 text-base sm:w-auto">
                Começar agora
              </Link>
              <Link href="#planos" className="btn-secondary w-full max-w-xs py-3 text-center text-base sm:w-auto">
                Ver planos
              </Link>
            </div>
          </div>
        </section>

        {/* Problema */}
        <section className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Operar manualmente drena sua energia
            </h2>
            <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
              Ficar grudado no gráfico, tomando decisões com emoção, perdendo noites de sono — isso não é sustentável. O Zeedo assume o trabalho operacional para você, executando uma estratégia baseada em sinais técnicos e Fibonacci, 24 horas por dia, sem parar.
            </p>
          </div>
        </section>

        {/* Solução */}
        <section className="border-t border-zeedo-orange/20 bg-zeedo-black/5 dark:bg-white/5 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Automatize. Configure. Relaxe.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              Divergências, padrões de candlestick e níveis de Fibonacci — o Zeedo identifica setups e executa na Hyperliquid com controles de risco que você define.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b) => (
                <div key={b.title} className="card flex flex-col items-start p-6">
                  <div className="rounded-lg bg-zeedo-orange/10 p-3 text-zeedo-orange">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {b.icon}
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-zeedo-black/60 dark:text-zeedo-white/60">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Como funciona
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              Em três passos você está operando com o Zeedo.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.icon} className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zeedo-orange text-lg font-bold text-white">
                    {s.icon}
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-zeedo-black/60 dark:text-zeedo-white/60">{s.desc}</p>
                  {s.icon !== "3" && (
                    <div className="absolute top-6 -right-4 hidden h-0.5 w-8 bg-zeedo-orange/30 sm:block" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link href="/signup" className="btn-primary inline-block">
                Criar conta grátis
              </Link>
            </div>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Planos
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              Escolha o que cabe no seu objetivo. Você pode alterar depois.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`card relative flex flex-col p-6 transition-all hover:ring-2 hover:ring-zeedo-orange ${plan.recommended ? "ring-2 ring-zeedo-orange" : ""}`}
                >
                  {plan.recommended && (
                    <span className="absolute top-0 left-0 rounded-br-lg bg-zeedo-orange px-2 py-1 text-xs font-medium text-white">
                      Recomendado
                    </span>
                  )}
                  <div className={plan.recommended ? "pt-8" : ""}>
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-zeedo-orange">R${plan.price}</span>
                      <span className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">/mês</span>
                    </div>
                    <ul className="mt-6 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="text-sm text-zeedo-black/80 dark:text-zeedo-white/80">
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                        plan.recommended
                          ? "bg-zeedo-orange text-white hover:bg-primary-600"
                          : "border border-zeedo-orange/40 text-zeedo-orange hover:bg-zeedo-orange/10"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prova social */}
        <section className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Junte-se à comunidade
            </h2>
            <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
              Acompanhe conteúdos diários, dicas e novidades no Telegram e no TikTok.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://t.me/+YXF26gnIg5U4MTc5"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zeedo-orange/40 px-4 py-2.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
              >
                <span>💬</span> Comunidade Telegram
              </a>
              <a
                href="https://www.tiktok.com/@zeedobot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zeedo-orange/40 px-4 py-2.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
              >
                <span>🎵</span> TikTok
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Perguntas frequentes
            </h2>
            <div className="mt-12 space-y-2">
              {FAQ.map((item, i) => (
                <div
                  key={i}
                  className="card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-4 py-4 text-left"
                  >
                    <span className="font-medium">{item.q}</span>
                    <span className={`ml-2 shrink-0 text-zeedo-orange transition-transform ${openFaq === i ? "rotate-180" : ""}`}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-zeedo-orange/20 px-4 py-3 text-sm text-zeedo-black/70 dark:text-zeedo-white/70">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-zeedo-orange/20 bg-zeedo-orange/5 dark:bg-zeedo-orange/10 px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Pronto para deixar o Zeedo trabalhar por você?
            </h2>
            <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
              Crie sua conta em segundos e comece a operar com disciplina e automatização.
            </p>
            <div className="mt-8">
              <Link href="/signup" className="btn-primary inline-block py-3 px-8 text-base">
                Criar conta
              </Link>
            </div>
            <p className="mt-6 text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
              Já tem conta?{" "}
              <Link href="/login" className="text-zeedo-orange hover:underline">
                Entrar
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zeedo-orange/20 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/zeedo-logo.png?v=4" alt="Zeedo" width={28} height={28} className="mix-blend-multiply dark:mix-blend-screen" />
            <span className="font-medium">Zeedo</span>
          </Link>
          <div className="flex gap-6 text-sm">
            <Link href="/termos" className="text-zeedo-black/60 hover:text-zeedo-orange dark:text-zeedo-white/60 dark:hover:text-zeedo-orange transition-colors">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="text-zeedo-black/60 hover:text-zeedo-orange dark:text-zeedo-white/60 dark:hover:text-zeedo-orange transition-colors">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
