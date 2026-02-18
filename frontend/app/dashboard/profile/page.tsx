"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPut } from "@/lib/api";

type Profile = {
  full_name: string | null;
  username: string | null;
  birth_date: string | null;
  country: string | null;
  phone: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const data = await apiGet<Profile>("/profile", session.access_token);
        setProfile(data);
        setFullName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setBirthDate(data.birth_date ?? "");
        setCountry(data.country ?? "");
        setPhone(data.phone ?? "");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await apiPut(
        "/profile",
        {
          full_name: fullName.trim() || null,
          username: username.trim() || null,
          birth_date: birthDate || null,
          country: country.trim() || null,
          phone: phone.trim() || null,
        },
        session.access_token
      );
      setMessage({ type: "ok", text: "Perfil atualizado." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-6">Perfil</h1>
      <div className="card max-w-xl">
        <p className="text-sm text-zeedo-black/70 dark:text-zeedo-white/70 mb-6">
          Complete seu cadastro para se tornar elegível a futuras premiações.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-zeedo-orange mb-1">
              Nome
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zeedo-orange mb-1">
              Nome de usuário
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="Nome de exibição"
            />
          </div>
          <div>
            <label htmlFor="birth_date" className="block text-sm font-medium text-zeedo-orange mb-1">
              Data de nascimento
            </label>
            <input
              id="birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-zeedo-orange mb-1">
              País
            </label>
            <input
              id="country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="input-field"
              placeholder="Ex: Brasil"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-zeedo-orange mb-1">
              Telefone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              placeholder="Ex: +55 11 99999-9999"
            />
          </div>
          {message && (
            <p className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-500"}`}>
              {message.text}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </form>
      </div>
    </div>
  );
}
