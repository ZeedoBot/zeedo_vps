import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade – Zeedo",
  description: "Política de privacidade do serviço Zeedo.",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-zeedo-white dark:bg-zeedo-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zeedo-orange hover:underline mb-6 inline-block">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2">
          Política de Privacidade
        </h1>
        <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-zeedo-black/90 dark:text-zeedo-white/90 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">1. Introdução</h2>
            <p>
              Esta Política de Privacidade descreve como o Zeedo coleta, usa, armazena e protege
              seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD -
              Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">2. Dados Coletados</h2>
            <p>Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Dados de cadastro:</strong> e-mail, nome, nome de usuário, data de
                nascimento, país e telefone (quando fornecidos)
              </li>
              <li>
                <strong>Dados de autenticação:</strong> credenciais de acesso (armazenadas de forma
                segura via Supabase Auth)
              </li>
              <li>
                <strong>Dados financeiros:</strong> endereço da carteira conectada; armazenamos a
                chave da API Wallet (criptografada) para permitir operações do bot – sem permissão de saque
              </li>
              <li>
                <strong>Dados de uso:</strong> histórico de operações, configurações do bot,
                interações com o dashboard
              </li>
              <li>
                <strong>Dados de integração:</strong> ID do chat do Telegram, quando conectado
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">3. Finalidade do Tratamento</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Fornecer e operar o Serviço</li>
              <li>Autenticar e gerenciar sua conta</li>
              <li>Executar operações de trading conforme sua configuração</li>
              <li>Enviar notificações via Telegram (quando configurado)</li>
              <li>Melhorar o Serviço e a experiência do usuário</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">4. Base Legal</h2>
            <p>
              O tratamento dos dados está fundamentado em: execução de contrato (prestação do
              Serviço), consentimento (quando aplicável), cumprimento de obrigação legal e
              legítimo interesse (melhoria e segurança do Serviço).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">5. Compartilhamento</h2>
            <p>
              Seus dados podem ser compartilhados com: (a) provedores de infraestrutura (Supabase,
              Hyperliquid, etc.) necessários à operação do Serviço; (b) autoridades, quando exigido
              por lei. Não vendemos seus dados a terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">6. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
              criptografia da chave da API Wallet e uso de padrões de segurança na autenticação e
              transmissão de dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">7. Seus Direitos (LGPD)</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a eliminação dos dados (observadas as exceções legais)</li>
              <li>Revogar o consentimento</li>
            </ul>
            <p className="mt-2">
              Para exercer esses direitos, entre em contato conosco através dos canais disponíveis
              no Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">8. Retenção</h2>
            <p>
              Mantemos seus dados pelo tempo necessário à prestação do Serviço e ao cumprimento
              de obrigações legais. Após o encerramento da conta, os dados podem ser mantidos por
              período determinado por lei ou política interna.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">9. Alterações</h2>
            <p>
              Esta Política pode ser alterada a qualquer momento. Alterações significativas serão
              comunicadas através do Serviço. Recomendamos a revisão periódica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-zeedo-orange mb-2">10. Contato</h2>
            <p>
              Para dúvidas sobre privacidade ou para exercer seus direitos, entre em contato
              através dos canais disponíveis no Serviço.
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
