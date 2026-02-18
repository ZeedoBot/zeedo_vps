import Link from "next/link";

export const metadata = {
  title: "Termos de Uso – Zeedo",
  description: "Termos de uso do serviço Zeedo.",
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-zeedo-white dark:bg-zeedo-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zeedo-orange hover:underline mb-6 inline-block">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2">
          Termos de Uso
        </h1>
        <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-zeedo-black/90 dark:text-zeedo-white/90 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar o Zeedo (&quot;Serviço&quot;), você concorda em cumprir e estar vinculado aos
              presentes Termos de Uso. Se não concordar com qualquer parte destes termos, não deverá
              utilizar o Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">2. Descrição do Serviço</h2>
            <p>
              O Zeedo é um bot de trading automatizado que opera na plataforma Hyperliquid. O Serviço
              permite que você conecte sua carteira, configure parâmetros de operação e acompanhe o
              desempenho das operações através do dashboard e notificações via Telegram.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">3. Riscos</h2>
            <p>
              O trading de criptoativos e derivativos envolve riscos elevados. Você declara estar
              ciente de que pode perder todo ou parte do capital investido. O Zeedo não garante
              lucros e não se responsabiliza por perdas financeiras decorrentes do uso do Serviço.
              O uso do bot é por sua conta e risco.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">4. Uso Responsável</h2>
            <p>
              Você se compromete a utilizar o Serviço de forma legal e ética. É proibido: (a) usar
              o Serviço para atividades ilícitas; (b) compartilhar credenciais de acesso com
              terceiros; (c) tentar acessar ou interferir em sistemas de outros usuários; (d) violar
              leis ou regulamentos aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">5. Conta e Segurança</h2>
            <p>
              O Zeedo utiliza exclusivamente API Wallet da Hyperliquid. Ao conectar sua carteira, você assina uma autorização para o bot operar em sua conta. O sistema não possui permissão técnica para realizar saques. Não compartilhe o acesso à sua carteira com terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">6. Disponibilidade</h2>
            <p>
              O Serviço é oferecido &quot;como está&quot;. Podemos modificar, suspender ou descontinuar o
              Serviço a qualquer momento, com ou sem aviso prévio. Não nos responsabilizamos por
              indisponibilidades, perdas de dados ou interrupções decorrentes de manutenção ou
              falhas técnicas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">7. Propriedade Intelectual</h2>
            <p>
              O Zeedo, incluindo sua marca, interface, algoritmos e demais componentes, é de
              propriedade exclusiva dos titulares do Serviço. Não é permitida a cópia, modificação
              ou distribuição não autorizada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">8. Alterações</h2>
            <p>
              Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações
              significativas serão comunicadas através do Serviço ou por e-mail. O uso continuado
              após alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">9. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos, entre em contato através dos canais disponíveis no
              Serviço.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-zeedo-orange/20">
          <Link href="/" className="text-zeedo-orange hover:underline">
            Voltar à página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
