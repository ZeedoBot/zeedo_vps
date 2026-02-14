"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet } from "@/lib/api";

type BotStatus = { status: string; last_heartbeat: string | null };
type WalletStatus = { connected: boolean; wallet_address: string | null };
type TelegramStatus = { connected: boolean };

export default function DashboardPage() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const [bot, wallet, telegram] = await Promise.all([
          apiGet<BotStatus>("/bot/status", session.access_token),
          apiGet<WalletStatus>("/wallet/status", session.access_token),
          apiGet<TelegramStatus>("/telegram/status", session.access_token),
        ]);
        setBotStatus(bot);
        setWalletStatus(wallet);
        setTelegramStatus(telegram);
      } catch (e) {
        setError("Não foi possível carregar os dados. Verifique se a API está rodando.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="text-gray-500">Carregando…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Visão geral</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <h2 className="text-sm font-medium text-gray-500 mb-1">Carteira Hyperliquid</h2>
          <p className="text-lg font-medium text-gray-900">
            {walletStatus?.connected ? walletStatus.wallet_address ?? "Conectada" : "Não conectada"}
          </p>
          <a href="/dashboard/wallet" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
            {walletStatus?.connected ? "Alterar" : "Conectar"}
          </a>
        </div>
        <div className="card">
          <h2 className="text-sm font-medium text-gray-500 mb-1">Telegram</h2>
          <p className="text-lg font-medium text-gray-900">
            {telegramStatus?.connected ? "Conectado" : "Não conectado"}
          </p>
          <a href="/dashboard/telegram" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
            {telegramStatus?.connected ? "Alterar" : "Conectar"}
          </a>
        </div>
        <div className="card">
          <h2 className="text-sm font-medium text-gray-500 mb-1">Bot</h2>
          <p className="text-lg font-medium text-gray-900 capitalize">
            {botStatus?.status === "running" ? "Rodando" : "Parado"}
          </p>
          <a href="/dashboard/bot" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
            Configurar
          </a>
        </div>
      </div>
    </div>
  );
}
