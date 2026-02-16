"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";

type TelegramStatus = { connected: boolean; chat_id_masked?: string | null };
type ConnectLink = { url: string; bot_username: string };

export default function TelegramPage() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [connectLink, setConnectLink] = useState<ConnectLink | null>(null);
  const [chatIdManual, setChatIdManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const [statusData, linkData] = await Promise.all([
          apiGet<TelegramStatus>("/telegram/status", session.access_token),
          apiGet<ConnectLink>("/telegram/connect-link", session.access_token).catch(() => null),
        ]);
        setStatus(statusData);
        setConnectLink(linkData ?? null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleConnect() {
    if (connectLink?.url) {
      window.open(connectLink.url, "_blank");
      setMessage({ type: "ok", text: "Abra o Telegram e toque em Iniciar. Em seguida, volte aqui e recarregue a página." });
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!chatIdManual.trim()) {
      setMessage({ type: "err", text: "Informe seu Chat ID." });
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage({ type: "err", text: "Sessão expirada. Faça login novamente." });
        return;
      }
      await apiPost("/telegram/connect", { chat_id: chatIdManual.trim() }, session.access_token);
      setMessage({ type: "ok", text: "Telegram conectado com sucesso." });
      setChatIdManual("");
      const data = await apiGet<TelegramStatus>("/telegram/status", session.access_token);
      setStatus(data);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao conectar." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Carregando…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Telegram</h1>
      <div className="card max-w-xl dark:bg-zeedo-black/80 dark:border-zeedo-white/10">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Receba notificações do bot diretamente no seu Telegram. O bot já está configurado — você só precisa conectar sua conta.
        </p>
        {status?.connected && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-sm">
            ✓ Conectado {status.chat_id_masked ? `(ID: ${status.chat_id_masked})` : ""}
          </div>
        )}
        {!status?.connected && connectLink && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleConnect}
              className="btn-primary w-full"
            >
              Conectar Telegram
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Será aberto o app do Telegram. Toque em <strong>Iniciar</strong> e as notificações serão enviadas para a sua conversa.
            </p>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {showManual ? "Ocultar" : "Ou informar Chat ID manualmente"}
            </button>
            {showManual && (
              <form onSubmit={handleManualSubmit} className="pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4">
                <div>
                  <label htmlFor="chat_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chat ID (obtido com @userinfobot no Telegram)
                  </label>
                  <input
                    id="chat_id"
                    type="text"
                    value={chatIdManual}
                    onChange={(e) => setChatIdManual(e.target.value)}
                    className="input-field"
                    placeholder="Ex: 123456789"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Salvando…" : "Conectar"}
                </button>
              </form>
            )}
          </div>
        )}
        {!status?.connected && !connectLink && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Bot do Telegram não configurado. Entre em contato com o suporte.
          </p>
        )}
        {message && (
          <p className={`mt-4 text-sm ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
