"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet } from "@/lib/api";

type TelegramStatus = { connected: boolean; chat_id_masked?: string | null };
type ConnectLink = { url: string; bot_username: string };

export default function TelegramPage() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [connectLink, setConnectLink] = useState<ConnectLink | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const qrCodeUrl = connectLink?.url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(connectLink.url)}`
    : "";

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

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Carregando…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-6">Telegram</h1>
      <div className="card max-w-xl">
        {status?.connected && !showChangeForm ? (
          <div className="space-y-4">
            <p className="text-lg font-medium text-zeedo-black dark:text-zeedo-white">Telegram Conectado</p>
            {status.chat_id_masked && (
              <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60">ID: {status.chat_id_masked}</p>
            )}
            <button
              type="button"
              onClick={() => setShowChangeForm(true)}
              className="inline-block text-sm font-medium text-zeedo-orange px-3 py-2 border border-zeedo-orange/40 rounded-lg hover:bg-zeedo-orange/10"
            >
              Alterar
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 mb-4">
              {status?.connected ? "Conecte outra conta para alterar." : "Receba notificações do bot diretamente no seu Telegram. O bot já está configurado — você só precisa conectar sua conta."}
            </p>
            {(showChangeForm || !status?.connected) && connectLink && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleConnect}
                  className="btn-primary w-full"
                >
                  Conectar Telegram
                </button>
                <p className="text-xs text-zeedo-black/60 dark:text-zeedo-white/60">
                  Será aberto o app do Telegram. Toque em <strong>Iniciar</strong> e as notificações serão enviadas para a sua conversa.
                </p>
                <p className="text-xs text-zeedo-orange/90 dark:text-zeedo-orange/90 mt-2">
                  Já conectou? Atualize a página para ver o status atualizado.
                </p>
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="text-sm text-zeedo-orange hover:underline"
                >
                  {showQrCode ? "Ocultar QR Code" : "Desktop sem Telegram? Escaneie o QR Code com seu celular"}
                </button>
                {showQrCode && qrCodeUrl && (
                  <div className="rounded-lg border border-zeedo-orange/20 bg-zeedo-orange/5 p-4 space-y-3">
                    <p className="text-xs text-zeedo-black/70 dark:text-zeedo-white/70">
                      Escaneie com a camera do celular para abrir o Telegram no mesmo link de conexao automatica.
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl}
                      alt="QR Code para conectar Telegram"
                      className="mx-auto h-56 w-56 rounded-md border border-zeedo-orange/20 bg-white p-2"
                    />
                  </div>
                )}
              </div>
            )}
            {showChangeForm && status?.connected && (
              <button
                type="button"
                onClick={() => setShowChangeForm(false)}
                className="mt-4 text-sm text-zeedo-black/60 dark:text-zeedo-white/60 hover:underline"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
        {!status?.connected && !connectLink && !showChangeForm && (
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
