"use client";

import Link from "next/link";
import Image from "next/image";
import { SiInstagram, SiTiktok, SiX } from "react-icons/si";
import { useState, type ReactNode } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

const RABBY_URL = "https://rabby.io";

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "O que é o Zeedo?",
    a: (
      <>
        O Zeedo é um robô inteligente que opera automaticamente no mercado de criptomoedas 24 horas por dia, na plataforma Hyperliquid.
        <br /><br />
        Ele analisa o mercado em tempo real, identifica oportunidades com base em um setup de trade validado e aprimorado desde 2021 e entra nas operações de forma estratégica, sempre com controle de risco.
        <br /><br />
        Além disso, você recebe alertas no Telegram e pode acompanhar tudo de forma simples, sem precisar ficar olhando gráficos o dia inteiro.
      </>
    ),
  },
  {
    q: "Preciso ficar na frente do computador?",
    a: (
      <>
        Não.
        <br /><br />
        O Zeedo trabalha sozinho. Você configura uma vez, conecta sua carteira na Hyperliquid e seu Telegram, e recebe todas as notificações no celular: entradas, parciais, stops e lucros.
        <br /><br />
        Você pode testar diferentes estratégias e personalizar o Zeedo da sua forma.
        <br /><br />
        Se você é um trader experiente, pode automatizar parcialmente e utilizar o Zeedo como um motor para potencializar seus ganhos.
        <br /><br />
        Se você não tem muita experiência ou não tem tempo, então deixe 100% com o Zeedo.
      </>
    ),
  },
  {
    q: "Por que Hyperliquid?",
    a: (
      <>
        O Zeedo foi desenvolvido para operar exclusivamente na Hyperliquid, por ser a maior corretora descentralizada do mundo, focada em criptomoedas.
        <br /><br />
        Resumindo, menos burocracia e mais segurança.
        <br /><br />
        Para utilizar, você precisa apenas de:
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          <li>Uma carteira compatível, como a Rabby ou MetaMask.</li>
          <li>Saldo mínimo para usar como margem</li>
        </ul>
        <br />
        Se você ainda não possui uma carteira, não se preocupe, é muito simples, basta baixar a extensão{" "}
        <a href={RABBY_URL} target="_blank" rel="noopener noreferrer" className="text-zeedo-orange hover:underline">
          aqui
        </a>
        {" "}e criar sua carteira de forma gratuita em menos de 2 minutos.
        <br /><br />
        A conexão é simples e você mantém total controle da sua carteira o tempo todo.
      </>
    ),
  },
  {
    q: "É seguro conectar minha carteira?",
    a: (
      <>
        O Zeedo utiliza a API oficial da Hyperliquid para executar as operações.
        <br /><br />
        <strong>Importante:</strong> não utilizamos a chave privada da sua carteira. O sistema usa apenas a chave da API, que é criptografada e armazenada com alto padrão de segurança.
        <br /><br />
        Além disso, a API utilizada não possui permissão para realizar saques. O Zeedo só pode abrir e fechar operações dentro das regras que você definir.
        <br /><br />
        Você mantém controle total sobre:
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          <li>Limites de perda</li>
          <li>Tamanho das posições</li>
          <li>Exposição ao risco</li>
          <li>Capital utilizado</li>
        </ul>
        <br />
        Seu saldo continua sob seu controle.
        <br /><br />
        Se você ainda tem receio, recomendamos utilizar uma carteira &quot;virgem&quot;, onde você adiciona apenas o valor destinado à margem dos trades.
      </>
    ),
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: (
      <>
        Sim. Você pode cancelar a recorrência da assinatura a qualquer momento, evitando a próxima cobrança. Não existe fidelidade forçada além do período do plano já contratado.
        <br /><br />
        Além disso, oferecemos garantia incondicional de 7 dias. Se dentro dos primeiros 7 dias você decidir que o Zeedo não é para você, basta solicitar o cancelamento e receberá o reembolso.
      </>
    ),
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
    image: "/Zeedos/4.png",
  },
  {
    title: "Sem emoção",
    desc: "Decisões baseadas em matemática e regras, não em medo ou ganância.",
    image: "/Zeedos/5.png",
  },
  {
    title: "Controle total",
    desc: "Target loss, exposição máxima e segunda entrada, tudo configurável por você.",
    image: "/Zeedos/6.png",
  },
  {
    title: "Alertas no Telegram",
    desc: "Entradas, parciais, stops e PnL, tudo no seu celular, em tempo real.",
    image: "/Zeedos/7.png",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function EarlyAccessForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("early_access_signups").insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      if (insertError) throw insertError;
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-zeedo-orange/30 bg-zeedo-orange/10 p-8 text-center">
        <p className="text-lg font-medium text-zeedo-orange">✓ Cadastro realizado!</p>
        <p className="mt-2 text-zeedo-black/70 dark:text-zeedo-white/70">
          Você será avisado assim que o Zeedo estiver disponível.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
      <div>
        <label htmlFor="early-name" className="mb-1 block text-sm font-medium text-zeedo-black dark:text-zeedo-white">
          Nome
        </label>
        <input
          id="early-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="w-full rounded-lg border border-zeedo-orange/30 bg-white px-4 py-3 text-zeedo-black placeholder:text-zeedo-black/40 focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange dark:bg-zeedo-black/50 dark:text-zeedo-white dark:placeholder:text-zeedo-white/40"
        />
      </div>
      <div>
        <label htmlFor="early-email" className="mb-1 block text-sm font-medium text-zeedo-black dark:text-zeedo-white">
          Email
        </label>
        <input
          id="early-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="w-full rounded-lg border border-zeedo-orange/30 bg-white px-4 py-3 text-zeedo-black placeholder:text-zeedo-black/40 focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange dark:bg-zeedo-black/50 dark:text-zeedo-white dark:placeholder:text-zeedo-white/40"
        />
      </div>
      <div>
        <label htmlFor="early-phone" className="mb-1 block text-sm font-medium text-zeedo-black dark:text-zeedo-white">
          Telefone (WhatsApp)
        </label>
        <input
          id="early-phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(00) 00000-0000"
          className="w-full rounded-lg border border-zeedo-orange/30 bg-white px-4 py-3 text-zeedo-black placeholder:text-zeedo-black/40 focus:border-zeedo-orange focus:outline-none focus:ring-1 focus:ring-zeedo-orange dark:bg-zeedo-black/50 dark:text-zeedo-white dark:placeholder:text-zeedo-white/40"
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-3 disabled:opacity-70"
      >
        {loading ? "Enviando…" : "Garantir acesso antecipado"}
      </button>
    </form>
  );
}

export default function AcessoAntecipadoPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { scrollYProgress } = useScroll();
  const robotY = useTransform(scrollYProgress, [0, 0.3], [0, 80]);
  const robotScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  return (
    <div className="min-h-screen bg-zeedo-white dark:bg-zeedo-black text-zeedo-black dark:text-zeedo-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zeedo-orange/20 bg-zeedo-white/80 dark:bg-zeedo-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/zeedo-logo.png?v=4" alt="Zeedo" width={40} height={40} className="mix-blend-multiply dark:mix-blend-screen" />
            <span className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white">Zeedo</span>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-16 sm:py-24 bg-zeedo-black">
          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
              <motion.div
                className="order-2 lg:order-1 text-center lg:text-left"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  <span className="text-zeedo-black dark:text-zeedo-white">Você vive a vida.</span>
                  <br />
                  <span className="text-zeedo-orange">O Zeedo vive o mercado.</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg text-zeedo-black/70 dark:text-zeedo-white/70 sm:text-xl lg:mx-0 mx-auto">
                  Bot de trading automatizado. Sem emoção, sem cansaço. Apenas a matemática trabalhando por você.
                </p>
                <div className="mt-10 flex justify-center lg:justify-start">
                  <a
                    href="#acesso-antecipado"
                    className="btn-primary w-full max-w-xs py-3 text-base sm:w-auto text-center"
                  >
                    Garantir acesso antecipado
                  </a>
                </div>
              </motion.div>
              <motion.div
                className="order-1 lg:order-2 flex justify-center"
                style={{ y: robotY, scale: robotScale }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
                  <Image
                    src="/Zeedos/1.png"
                    alt="Zeedo - Robô de trading automatizado"
                    width={384}
                    height={384}
                    priority
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Problema */}
        <motion.section
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-3xl space-y-8">
            {/* Bloco 1: O problema */}
            <motion.div
              variants={staggerItem}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-xl px-6 py-8 shadow-lg transition-shadow hover:shadow-xl"
            >
              <div className="relative text-center">
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Você não tem tempo para fazer trades?
                  <br />
                  <span className="text-zeedo-orange">Operar manualmente drena sua energia?</span>
                </h2>
                <p className="mt-6 text-zeedo-black/70 dark:text-zeedo-white/70">
                  Eu criei o Zeedo com a missão de resolver os dois maiores problemas de um trader:
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <Image
                      src="/Zeedos/2.png"
                      alt="Falta de tempo"
                      width={56}
                      height={56}
                      className="h-14 w-14 object-contain"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zeedo-orange">FALTA DE TEMPO</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Image
                      src="/Zeedos/3.png"
                      alt="Emocional"
                      width={56}
                      height={56}
                      className="h-14 w-14 object-contain"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zeedo-orange">EMOCIONAL</span>
                  </div>
                </div>
                <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
                  Ficar grudado no gráfico, tomando decisões com emoção, perdendo noites de sono... isso não é sustentável. O Zeedo assume o trabalho operacional para você, executando uma estratégia baseada em um setup validado desde 2021, rodando 24 horas por dia, sem parar (a não ser que você mande).
                </p>
              </div>
            </motion.div>

            {/* Bloco 2: Mas o Zeedo é só para Traders? */}
            <motion.div
              variants={staggerItem}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-xl border border-zeedo-orange/30 bg-zeedo-black/5 px-6 py-8 shadow-lg transition-shadow hover:border-zeedo-orange/50 hover:shadow-xl dark:bg-white/5"
            >
              <div className="relative text-center">
                <h3 className="text-xl font-bold sm:text-2xl text-zeedo-orange">
                  O Zeedo não é só para Traders Profissionais!
                </h3>
                <p className="mt-6 text-zeedo-black/70 dark:text-zeedo-white/70">
                  O Zeedo ao mesmo tempo é a solução para iniciantes ou até para quem nunca fez um trade na vida e não sabe como começar.
                </p>
                <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
                  Por se tratar de uma automação que analisa o gráfico em tempo real, entra e sai automaticamente dos trades e ainda alerta você na palma da sua mão sobre cada decisão, então você não necessita experiência prévia. Você ainda pode usar os sinais e trades que forem acontecendo para estudar, aprimorar e personalizar sua própria estratégia no futuro.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Solução */}
        <motion.section
          className="relative overflow-hidden border-t border-zeedo-orange/20 bg-zeedo-black px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <Image src="/Zeedos/1.png" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <Image src="/Zeedos/1.png" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl">
            <div className="flex flex-row items-center justify-center gap-2 sm:gap-8 mb-6">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <Image
                  src="/Zeedos/8.png"
                  alt="Configure"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                />
                <span className="text-base sm:text-lg font-bold text-zeedo-black dark:text-zeedo-white">Configure</span>
              </div>
              <div className="flex-shrink-0 h-0.5 w-4 sm:w-12 bg-zeedo-orange/30" />
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <Image
                  src="/Zeedos/9.png"
                  alt="Automatize"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                />
                <span className="text-base sm:text-lg font-bold text-zeedo-black dark:text-zeedo-white">Automatize</span>
              </div>
              <div className="flex-shrink-0 h-0.5 w-4 sm:w-12 bg-zeedo-orange/30" />
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <Image
                  src="/Zeedos/10.png"
                  alt="Relaxe"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                />
                <span className="text-base sm:text-lg font-bold text-zeedo-black dark:text-zeedo-white">Relaxe</span>
              </div>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              O Zeedo trabalha com uma combinação de sinais: divergências, padrões de candlestick, volume e níveis de Fibonacci. Mas você não precisa saber isso, deixe com o Zeedo que ele identifica os setups, executa e te notifica, sempre com gerenciamento de risco definido por você.
            </p>
            <motion.div
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              {BENEFITS.map((b) => (
                <motion.div
                  key={b.title}
                  variants={staggerItem}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="card flex flex-col items-start p-6 cursor-default"
                >
                  <Image
                    src={b.image}
                    alt={b.title}
                    width={40}
                    height={40}
                    className="h-10 w-10 object-contain"
                  />
                  <h3 className="mt-4 font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-zeedo-black/60 dark:text-zeedo-white/60">{b.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Como funciona */}
        <motion.section
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24 bg-[#111111]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
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
              <a href="#acesso-antecipado" className="btn-primary inline-block">
                Garantir acesso antecipado
              </a>
            </div>
          </div>
        </motion.section>

        {/* Bônus */}
        <motion.section
          className="relative overflow-hidden border-t border-zeedo-orange/20 bg-gradient-to-br from-zeedo-orange/10 via-transparent to-zeedo-orange/10 dark:from-zeedo-orange/5 dark:via-transparent dark:to-zeedo-orange/5 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden md:block">
            <Image src="/zeedo-robot.png" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block">
            <Image src="/zeedo-robot.png" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="relative z-10 mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl text-zeedo-orange">
              Bônus exclusivo para ajudar você!
            </h2>
            <p className="mt-6 text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              Você ainda terá acesso a um mini curso introdutório, explicando como funciona tudo. Nesse bônus você terá aulas sobre:
            </p>
            <ul className="mt-6 space-y-2 text-zeedo-black/80 dark:text-zeedo-white/80 list-none [&>li]:flex [&>li]:gap-2 [&>li]:items-start">
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Como configurar o Zeedo</li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Como criar uma carteira</li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Como conectar a carteira na Hyperliquid</li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Como conectar o Telegram para receber todos os sinais no seu celular em tempo real</li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Dicas de gerenciamento de risco</li>
            </ul>
            <p className="mt-8 text-center font-semibold text-zeedo-black dark:text-zeedo-white">
              Extra:
            </p>
            <ul className="mt-4 space-y-2 text-zeedo-black/80 dark:text-zeedo-white/80 list-none [&>li]:flex [&>li]:gap-2 [&>li]:items-start">
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Desvendando o operacional do Zeedo</li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Acesso ao Suporte Individualizado</li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Acesso à comunidade no Telegram</li>
            </ul>
          </div>
        </motion.section>

        {/* Formulário de acesso antecipado */}
        <motion.section
          id="acesso-antecipado"
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Garanta seu acesso antecipado
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              Preencha o formulário e seja avisado assim que o Zeedo estiver disponível. Vagas limitadas.
            </p>
            <div className="mt-12">
              <EarlyAccessForm />
            </div>
          </div>
        </motion.section>

        {/* Prova social */}
        <motion.section
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Me siga nas redes sociais
            </h2>
            <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
              Acompanhe conteúdos diários, dicas e novidades no Instagram, TikTok e X.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://instagram.com/azevedocrypto"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zeedo-orange/40 px-4 py-2.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
              >
                <SiInstagram className="h-5 w-5 shrink-0" /> @azevedocrypto
              </a>
              <a
                href="https://instagram.com/zeedobot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zeedo-orange/40 px-4 py-2.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
              >
                <SiInstagram className="h-5 w-5 shrink-0" /> @zeedobot
              </a>
              <a
                href="https://www.tiktok.com/@zeedobot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zeedo-orange/40 px-4 py-2.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
              >
                <SiTiktok className="h-5 w-5 shrink-0" /> TikTok
              </a>
              <a
                href="https://x.com/zeedobot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zeedo-orange/40 px-4 py-2.5 text-sm font-medium text-zeedo-orange hover:bg-zeedo-orange/10 transition-colors"
              >
                <SiX className="h-5 w-5 shrink-0" /> X (Twitter)
              </a>
            </div>
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Perguntas frequentes
            </h2>
            <div className="mt-12 space-y-2">
              {FAQ.map((item, i) => (
                <motion.div key={i} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-4 py-4 text-left"
                  >
                    <span className="font-medium">{item.q}</span>
                    <motion.span
                      animate={{ rotate: openFaq === i ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="ml-2 shrink-0 text-zeedo-orange"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-zeedo-orange/20 px-4 py-3 text-sm text-zeedo-black/70 dark:text-zeedo-white/70">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* CTA final com formulário */}
        <motion.section
          className="relative overflow-hidden border-t border-zeedo-orange/20 bg-gradient-to-br from-zeedo-orange/10 via-transparent to-zeedo-orange/10 dark:from-zeedo-orange/5 dark:via-transparent dark:to-zeedo-orange/5 px-4 py-20 sm:py-28"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden md:block">
            <Image src="/zeedo-robot.png" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block">
            <Image src="/zeedo-robot.png" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Pronto para deixar o Zeedo trabalhar por você?
            </h2>
            <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
              Crie sua conta em segundos e comece a operar com disciplina e automatização.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  const formSection = document.getElementById('acesso-antecipado');
                  if (formSection) {
                    formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="rounded-lg bg-zeedo-orange px-8 py-3 font-medium text-white transition-all hover:bg-zeedo-orange/90 hover:shadow-lg"
              >
                Garantir acesso antecipado
              </button>
            </div>
          </div>
        </motion.section>
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
