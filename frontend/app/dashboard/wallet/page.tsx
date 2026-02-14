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

export default function WalletPage() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        { wallet_address: walletAddress.trim(), private_key: privateKey.trim(), network },
        session.access_token
      );
      setMessage({ type: "ok", text: "Carteira conectada com sucesso." });
      setPrivateKey("");
      const data = await apiGet<WalletStatus>("/wallet/status", session.access_token);
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
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Carteira Hyperliquid</h1>
      <div className="card max-w-xl">
        <p className="text-sm text-gray-600 mb-4">
          Conecte a carteira que o bot usará para operar na Hyperliquid. A chave privada é criptografada e nunca é exibida novamente.
        </p>
        {status?.connected && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm">
            Conectada: <strong>{status.wallet_address_full ?? status.wallet_address}</strong> ({status.network ?? "mainnet"})
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wallet" className="block text-sm font-medium text-gray-700 mb-1">
              Endereço da carteira
            </label>
            <input
              id="wallet"
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="input-field"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-1">
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
            <p className="mt-1 text-xs text-gray-500">
              A chave nunca é armazenada em texto claro e não será mostrada de novo.
            </p>
          </div>
          <div>
            <label htmlFor="network" className="block text-sm font-medium text-gray-700 mb-1">
              Rede
            </label>
            <select
              id="network"
              value={network}
              onChange={(e) => setNetwork(e.target.value as "mainnet" | "testnet")}
              className="input-field"
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
            </select>
          </div>
          {message && (
            <p className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Salvando…" : status?.connected ? "Atualizar carteira" : "Conectar carteira"}
          </button>
        </form>
      </div>
    </div>
  );
}
