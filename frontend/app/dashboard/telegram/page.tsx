"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";

type TelegramStatus = { connected: boolean; chat_id_masked?: string | null };

export default function TelegramPage() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const data = await apiGet<TelegramStatus>("/telegram/status", session.access_token);
        setStatus(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!botToken.trim() || !chatId.trim()) {
      setMessage({ type: "err", text: "Preencha o token e o ID/username." });
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
      await apiPost(
        "/telegram/connect",
        { bot_token: botToken.trim(), chat_id: chatId.trim() },
        session.access_token
      );
      setMessage({ type: "ok", text: "Telegram conectado com sucesso." });
      setBotToken("");
      setChatId("");
      const data = await apiGet<TelegramStatus>("/telegram/status", session.access_token);
      setStatus(data);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao conectar." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-gray-500">Carregando…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Telegram</h1>
      <div className="card max-w-xl">
        <p className="text-sm text-gray-600 mb-4">
          Crie um bot com o @BotFather no Telegram e use o token aqui. Para receber notificações, informe seu Chat ID (obtido com @userinfobot) ou username.
        </p>
        {status?.connected && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm">
            Conectado {status.chat_id_masked ? `(ID: ${status.chat_id_masked})` : ""}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="bot_token" className="block text-sm font-medium text-gray-700 mb-1">
              Token do bot
            </label>
            <input
              id="bot_token"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="input-field"
              placeholder="123456:ABC..."
              required={!status?.connected}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="chat_id" className="block text-sm font-medium text-gray-700 mb-1">
              Chat ID ou username
            </label>
            <input
              id="chat_id"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="input-field"
              placeholder="Ex: 123456789 ou @seu_usuario"
              required={!status?.connected}
            />
          </div>
          {message && (
            <p className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Salvando…" : status?.connected ? "Atualizar" : "Conectar Telegram"}
          </button>
        </form>
      </div>
    </div>
  );
}
