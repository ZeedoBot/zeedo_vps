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

type PrepareAgentResponse = {
  agent_address: string;
  nonce: number;
  typed_data: {
    domain: { name: string; version: string; chainId: number; verifyingContract: string };
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  };
};

const RABBY_DOWNLOAD_URL = "https://rabby.io/";

function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 18) return addr || "—";
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

function parseSignature(hexSig: string): { r: string; s: string; v: number } {
  const clean = hexSig.startsWith("0x") ? hexSig.slice(2) : hexSig;
  const r = "0x" + clean.slice(0, 64);
  const s = "0x" + clean.slice(64, 128);
  let v = parseInt(clean.slice(128, 130), 16);
  if (v < 27) v += 27;
  return { r, s, v };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export default function WalletPage() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
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

  async function connectWithApiWallet() {
    if (typeof window === "undefined" || !window.ethereum) {
      setMessage({ type: "err", text: "Instale a Rabby Wallet ou MetaMask para conectar." });
      return;
    }
    setMessage(null);
    setSubmitting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const masterAddress = accounts?.[0];
      if (!masterAddress) {
        setMessage({ type: "err", text: "Nenhuma conta retornada." });
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage({ type: "err", text: "Sessão expirada. Faça login novamente." });
        return;
      }

      const prep = await apiPost<PrepareAgentResponse>("/wallet/prepare-agent", {}, session.access_token);

      const typedData = prep.typed_data;
      const sig = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [masterAddress, JSON.stringify(typedData)],
      }) as string;

      const { r, s, v } = parseSignature(sig);

      await apiPost(
        "/wallet/connect-agent",
        {
          master_address: masterAddress,
          agent_address: prep.agent_address,
          nonce: prep.nonce,
          signature_r: r.startsWith("0x") ? r.slice(2) : r,
          signature_s: s.startsWith("0x") ? s.slice(2) : s,
          signature_v: v,
          network: "mainnet",
        },
        session.access_token
      );

      setMessage({ type: "ok", text: "Carteira conectada com sucesso! O Zeedo usa API Wallet da Hyperliquid (sem permissão de saque)." });
      const data = await apiGet<WalletStatus>("/wallet/status", session.access_token);
      setStatus(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar.";
      setMessage({ type: "err", text: String(msg) });
    } finally {
      setSubmitting(false);
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

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Carregando…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Carteira Hyperliquid</h1>
      <div className="card max-w-xl">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Conecte sua carteira para autorizar o Zeedo a operar na Hyperliquid. Utilizamos API Wallet – o sistema não possui permissão técnica para realizar saques.
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
            <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">Para trocar de carteira, desconecte e conecte novamente.</p>
          </div>
        )}

        {!status?.connected && (
          <>
            <button
              type="button"
              onClick={connectWithApiWallet}
              disabled={submitting}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {submitting ? "Conectando…" : "Conectar com Rabby / MetaMask"}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Você assinará uma mensagem para autorizar o Zeedo. Não é necessário gas. O sistema não pode realizar saques.
            </p>
            <a
              href={RABBY_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-primary-600 hover:underline dark:text-primary-400 mt-4"
            >
              Não tem uma carteira? Crie agora.
            </a>
          </>
        )}

        {message && (
          <p className={`text-sm mt-4 ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
