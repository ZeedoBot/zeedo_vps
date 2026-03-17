"use client";

import Link from "next/link";
import Image from "next/image";
import { SiInstagram, SiTiktok, SiX } from "react-icons/si";
import { useState, type ReactNode } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 49,
    recommended: false,
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
      "Alvos e Stop Personalizados",
    ],
    cta: "Começar",
  },
  {
    id: "satoshi",
    name: "Satoshi",
    price: 299,
    recommended: false,
    features: [
      "Ativos: Todos disponíveis",
      "Timeframes: 5m, 15m, 30m, 1h, 4h e 1d",
      "Trades simultâneos: Ilimitado",
      "Segunda entrada automática",
      "Função Only",
      "Alvos e Stop Personalizados",
      "Mentoria Individual Mensal",
    ],
    cta: "Começar",
  },
] as const;

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
    desc: "Cadastre-se em segundos e escolha o plano que mais faz sentido para você.",
    icon: "1",
  },
  {
    title: "Conecte ao Zeedo",
    desc: "Vincule sua carteira e conecte seu Telegram.",
    icon: "2",
  },
  {
    title: "Configure e ative",
    desc: "Defina ativos, timeframes e o gerenciamento de risco. Pronto: uma vez ligado, o Zeedo opera sozinho.",
    icon: "3",
  },
];

const BENEFITS = [
  {
    title: "Operação 24/7",
    desc: "O mercado cripto não para. O Zeedo também não. Já você... pode dormir tranquilo.",
    image: "/Zeedos/4.png?v=2",
  },
  {
    title: "Sem emoção",
    desc: "Decisões baseadas em matemática e regras, não em medo e ganância.",
    image: "/Zeedos/5.png?v=2",
  },
  {
    title: "Controle total",
    desc: "Target loss, exposição, entradas, alvos, stop... Você pode configurar tudo do seu jeito.",
    image: "/Zeedos/6.png?v=2",
  },
  {
    title: "Alertas no Telegram",
    desc: "Sinais, entradas, parciais, lucro... Tudo no seu celular, em tempo real.",
    image: "/Zeedos/7.png?v=2",
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

export default function BotPage() {
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
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zeedo-black/70 hover:text-zeedo-orange dark:text-zeedo-white/70 dark:hover:text-zeedo-orange transition-colors">
              Entrar
            </Link>
            <Link href="/signup" className="btn-primary">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-16 sm:py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-zeedo-orange/5 to-transparent dark:from-zeedo-orange/10" />
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
                  Trade manual é coisa do passado.
                  <br />
                  Automatize e remova toda a emoção, erro humano e cansaço...
                  <br />
                  Deixe a matemática trabalhar por você!
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center lg:items-start">
                  <Link href="/signup" className="btn-primary w-full max-w-xs py-3 text-base sm:w-auto text-center">
                    Começar agora
                  </Link>
                  <Link href="#planos" className="btn-secondary w-full max-w-xs py-3 text-center text-base sm:w-auto">
                    Ver planos
                  </Link>
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
                    src="/Zeedos/1.png?v=2"
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
                  Sem tempo para fazer trades?
                  <br />
                  <span className="text-zeedo-orange">Operar manualmente drena sua energia?</span>
                </h2>
                <p className="mt-6 text-zeedo-black/70 dark:text-zeedo-white/70">
                  Eu criei o{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">Zeedo</span>{" "}
                  com a missão de{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">
                    resolver os dois maiores problemas
                  </span>{" "}
                  de um trader:
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <Image
                      src="/Zeedos/2.png?v=2"
                      alt="Falta de tempo"
                      width={64}
                      height={64}
                      className="h-16 w-16 object-contain"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zeedo-orange">FALTA DE TEMPO</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Image
                      src="/Zeedos/3.png?v=2"
                      alt="Emocional"
                      width={64}
                      height={64}
                      className="h-16 w-16 object-contain"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zeedo-orange">EMOCIONAL</span>
                  </div>
                </div>
                <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
                  Ficar{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">grudado no gráfico</span>, tomando decisões com{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">emoção</span>, perdendo noites de sono... isso não é sustentável.
                  <br />
                  O Zeedo assume o trabalho para você,{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">24 horas por dia</span>, executando uma estratégia baseada em um{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">setup validado, criado em 2021</span>.
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
                <h3 className="text-xl font-bold sm:text-2xl">
                  <span className="text-zeedo-black dark:text-zeedo-white">
                    O Zeedo não é só para
                  </span>
                  <br className="sm:hidden" />
                  <span className="text-zeedo-orange sm:ml-2">
                    Traders Profissionais!
                  </span>
                </h3>
                <p className="mt-6 text-zeedo-black/70 dark:text-zeedo-white/70">
                  O Zeedo é também a solução para{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">iniciantes</span> e para quem nunca fez trade na vida e não sabe nem por onde começar.
                </p>
                <p className="mt-4 text-zeedo-black/70 dark:text-zeedo-white/70">
                  Você não necessita de experiência prévia, pois se trata de um robô que entra e sai dos trades{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">automaticamente</span> e ainda{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">notifica você em tempo real</span>{" "}
                  sobre cada detalhe da operação.
                  <br />
                  Você ainda pode usar os trades que acontecerem para estudar, aprimorar e personalizar sua{" "}
                  <span className="font-semibold text-zeedo-black dark:text-zeedo-white">estratégia própria</span>.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Solução */}
        <motion.section
          className="relative overflow-hidden border-t border-zeedo-orange/20 bg-zeedo-black/5 dark:bg-white/5 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <Image src="/Zeedos/1.png?v=2" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <Image src="/Zeedos/1.png?v=2" alt="" width={200} height={200} className="object-contain opacity-[0.1] dark:opacity-[0.15]" />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl">
            <div className="flex flex-row items-center justify-center gap-2 sm:gap-8 mb-6">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <Image
                    src="/Zeedos/8.png?v=2"
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
                    src="/Zeedos/9.png?v=2"
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
                    src="/Zeedos/10.png?v=2"
                  alt="Relaxe"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                />
                <span className="text-base sm:text-lg font-bold text-zeedo-black dark:text-zeedo-white">Relaxe</span>
              </div>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              O Zeedo trabalha com uma combinação de indicadores:{" "}
              <span className="font-semibold text-zeedo-black dark:text-zeedo-white">
                Divergência, Padrões gráficos, Volume, Fibonacci
              </span>{" "}
              e outros auxiliares.
              <br />
              Mas você não precisa saber isso agora, deixe essa parte com o Zeedo. Ele faz uma varredura no mercado, identifica os padrões e executa a operação em fração de segundos, sempre com{" "}
              <span className="font-semibold text-zeedo-black dark:text-zeedo-white">gerenciamento de risco</span> definido por você.
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
                    width={48}
                    height={48}
                    className="h-12 w-12 object-contain mx-auto"
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
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24"
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
              Em apenas{" "}
              <span className="font-semibold text-zeedo-black dark:text-zeedo-white">3 passos simples</span>{" "}
              você está operando com o Zeedo.
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
              Você ainda terá acesso a um{" "}
              <span className="font-semibold text-zeedo-black dark:text-zeedo-white">
                mini curso introdutório
              </span>, explicando como funciona tudo.
              <br />
              Nesse bônus você terá acesso a 6 aulas iniciais:
            </p>
            <ul className="mt-6 space-y-2 text-zeedo-black/80 dark:text-zeedo-white/80 list-none [&>li]:flex [&>li]:gap-2 [&>li]:items-start">
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Introdução ao Zeedo</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Como criar e conectar a carteira</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Como conectar o Telegram</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Como configurar o Bot</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Dicas de gerenciamento de risco</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Configurações Avançadas</li>
            </ul>
            <p className="mt-8 text-center font-semibold text-zeedo-black dark:text-zeedo-white">
              Extra:
            </p>
            <ul className="mt-4 space-y-2 text-zeedo-black/80 dark:text-zeedo-white/80 list-none [&>li]:flex [&>li]:gap-2 [&>li]:items-start">
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Desvendando todo operacional Zeedo</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> <span className="font-semibold">Acesso ao Suporte Individualizado</span></li>
              <li><span className="text-zeedo-orange text-lg leading-tight">•</span> Acesso à comunidade no Telegram</li>
            </ul>
          </div>
        </motion.section>

        {/* Planos */}
        <motion.section
          id="planos"
          className="border-t border-zeedo-orange/20 px-4 py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold sm:text-3xl">
              Planos
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-zeedo-black/70 dark:text-zeedo-white/70">
              Escolha o que cabe no seu objetivo. Você pode alterar depois.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-3 items-stretch">
              {PLANS.map((plan) => (
                <motion.div
                  key={plan.id}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className={`card relative flex flex-col items-stretch p-6 transition-all hover:ring-2 hover:ring-zeedo-orange cursor-default ${plan.recommended ? "ring-2 ring-zeedo-orange" : ""} ${plan.recommended ? "pt-10" : ""}`}
                >
                  {plan.recommended && (
                    <span className="absolute top-0 left-0 rounded-br-lg bg-zeedo-orange px-2 py-1 text-xs font-medium text-white">
                      Recomendado
                    </span>
                  )}

                  <div className="text-center">
                    <div className="text-lg font-medium text-zeedo-black dark:text-zeedo-white">{plan.name}</div>
                    <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0">
                      {plan.recommended && (
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
                    <Link
                      href="/signup"
                      className={`inline-block rounded-lg px-4 py-2 text-sm font-medium text-center transition-colors min-w-[120px] ${
                        plan.recommended
                          ? "bg-zeedo-orange text-white hover:bg-primary-600"
                          : "border border-zeedo-orange/40 text-zeedo-orange hover:bg-zeedo-orange/10"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </motion.div>
              ))}
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

        {/* CTA final */}
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
              <span className="font-semibold text-zeedo-black dark:text-zeedo-white">Crie sua conta</span>{" "}
              agora e dê o primeiro passo rumo à liberdade.
            </p>
            <div className="mt-8">
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Link href="/signup" className="btn-primary inline-block py-3 px-8 text-base">
                  Criar conta
                </Link>
              </motion.div>
            </div>
            <p className="mt-6 text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
              Já tem conta?{" "}
              <Link href="/login" className="text-zeedo-orange hover:underline">
                Entrar
              </Link>
            </p>
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
