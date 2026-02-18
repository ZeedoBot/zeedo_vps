"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";

type WalletStatus = {
  connected: boolean;
  wallet_address: string | null;
  wallet_address_full?: string;
  network?: string;
};

const RABBY_DOWNLOAD_URL = "https://rabby.io/";

function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 18) return addr || "—";
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
    };
  }
}

export default function WalletPage() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [web3Connecting, setWeb3Connecting] = useState(false);
  const [connectMode, setConnectMode] = useState<"web3" | "manual">("web3");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const data = await apiGet<WalletStatus>("/wallet/status", session.access_token);
        setStatus(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function connectWeb3() {
    if (typeof window === "undefined" || !window.ethereum) {
      setMessage({ type: "err", text: "Instale a Rabby Wallet ou MetaMask para conectar." });
      return;
    }
    setMessage(null);
    setWeb3Connecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (addr) {
        setWalletAddress(addr);
        setConnectMode("web3");
        setMessage({ type: "ok", text: "Carteira conectada. Agora exporte a chave privada e cole abaixo para o bot operar." });
      } else {
        setMessage({ type: "err", text: "Nenhuma conta retornada." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar.";
      setMessage({ type: "err", text: msg });
    } finally {
      setWeb3Connecting(false);
    }
  }

  async function handleDisconnect() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await apiPost("/wallet/disconnect", {}, session.access_token);
      setMessage({ type: "ok", text: "Carteira desconectada." });
      const data = await apiGet<WalletStatus>("/wallet/status", session.access_token);
      setStatus(data);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao desconectar." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!walletAddress.trim() || !privateKey.trim()) {
      setMessage({ type: "err", text: "Preencha o endereço e a chave privada." });
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
        "/wallet/connect",
        { wallet_address: walletAddress.trim(), private_key: privateKey.trim(), network: "mainnet" },
        session.access_token
      );
      setMessage({ type: "ok", text: "Carteira conectada com sucesso." });
      setPrivateKey("");
      setWalletAddress("");
      setConnectMode("web3");
      const data = await apiGet<WalletStatus>("/wallet/status", session.access_token);
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
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Carteira Hyperliquid</h1>
      <div className="card max-w-xl">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Conecte a carteira que o bot usará para operar na Hyperliquid. A chave privada é criptografada e nunca é exibida novamente.
        </p>
        {status?.connected && (
          <div className="mb-4 space-y-3">
            <div className="p-3 rounded-lg border border-green-500/30 text-green-700 dark:text-green-400 text-sm overflow-hidden">
              Conectada:{" "}
              <strong className="break-all" title={status.wallet_address_full ?? status.wallet_address ?? undefined}>
                {truncateAddress(status.wallet_address_full ?? status.wallet_address ?? "")}
              </strong>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={submitting}
              className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-500/40 rounded-lg px-3 py-2"
            >
              Desconectar Carteira
            </button>
            <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">Para trocar de carteira, conecte novamente ou use o formulário abaixo.</p>
          </div>
        )}

        {!status?.connected && (
          <>
            <div className="space-y-4 mb-6">
              <button
                type="button"
                onClick={connectWeb3}
                disabled={web3Connecting}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {web3Connecting ? "Conectando…" : "Conectar com Rabby / MetaMask"}
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zeedo-white dark:bg-zeedo-black px-2 text-zeedo-orange">ou</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConnectMode("manual");
                  setMessage(null);
                }}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
              >
                Conectar manualmente
              </button>
            </div>

            <a
              href={RABBY_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-primary-600 hover:underline dark:text-primary-400 mb-6"
            >
              Não tem uma carteira? Crie agora.
            </a>
          </>
        )}

        {!status?.connected && (connectMode === "manual" || walletAddress) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="wallet" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Endereço da carteira
              </label>
              <input
                id="wallet"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                readOnly={!!walletAddress && connectMode === "web3"}
                className="input-field"
                placeholder="0x..."
                required
              />
            </div>
            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chave privada
              </label>
              <input
                id="key"
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="input-field font-mono"
                placeholder="Mantenha em segredo. Será criptografada no servidor."
                required={!status?.connected}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                A chave nunca é armazenada em texto claro e não será mostrada de novo.
              </p>
            </div>
            {message && (
              <p className={`text-sm ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {message.text}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Salvando…" : status?.connected ? "Atualizar carteira" : "Conectar carteira"}
            </button>
          </form>
        )}

        {status?.connected && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label htmlFor="wallet-update" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereço da carteira</label>
              <input id="wallet-update" type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="input-field" placeholder="0x..." required />
            </div>
            <div>
              <label htmlFor="key-update" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave privada</label>
              <input id="key-update" type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} className="input-field font-mono" placeholder="Chave privada" required autoComplete="off" />
            </div>
            {message && <p className={`text-sm ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{message.text}</p>}
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "Salvando…" : "Atualizar carteira"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
