"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { apiGet, apiPut, apiPost } from "@/lib/api";

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
  
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMessage, setEmailMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "err", text: "As senhas não coincidem." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "err", text: "A nova senha deve ter no mínimo 6 caracteres." });
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await apiPost(
        "/account/change-password",
        { current_password: currentPassword, new_password: newPassword },
        session.access_token
      );
      setPasswordMessage({ type: "ok", text: "Senha alterada com sucesso." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (err) {
      setPasswordMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao alterar senha." });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);
    setChangingEmail(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await apiPost(
        "/account/request-email-change",
        { new_email: newEmail, password: emailPassword },
        session.access_token
      );
      setEmailMessage({ type: "ok", text: `Link de confirmação enviado para ${newEmail}. Verifique seu email.` });
      setNewEmail("");
      setEmailPassword("");
      setTimeout(() => setShowChangeEmail(false), 3000);
    } catch (err) {
      setEmailMessage({ type: "err", text: err instanceof Error ? err.message : "Erro ao solicitar troca de email." });
    } finally {
      setChangingEmail(false);
    }
  }

  if (loading) return <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white">Perfil</h1>
      
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

      <div className="card max-w-xl">
        <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">Segurança</h2>
        <div className="space-y-4">
          <div>
            <button
              type="button"
              onClick={() => {
                setShowChangePassword(!showChangePassword);
                setPasswordMessage(null);
              }}
              className="text-sm font-medium text-zeedo-orange hover:underline"
            >
              {showChangePassword ? "Cancelar" : "Alterar senha"}
            </button>
            {showChangePassword && (
              <form onSubmit={handleChangePassword} className="mt-4 space-y-3 border-t border-zeedo-orange/20 pt-4">
                <div>
                  <label htmlFor="current_password" className="block text-sm font-medium text-zeedo-orange mb-1">
                    Senha atual
                  </label>
                  <input
                    id="current_password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-zeedo-orange mb-1">
                    Nova senha
                  </label>
                  <input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-zeedo-orange mb-1">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field"
                    required
                    minLength={6}
                  />
                </div>
                {passwordMessage && (
                  <p className={`text-sm ${passwordMessage.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                    {passwordMessage.text}
                  </p>
                )}
                <button type="submit" disabled={changingPassword} className="btn-primary">
                  {changingPassword ? "Alterando…" : "Confirmar alteração"}
                </button>
              </form>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setShowChangeEmail(!showChangeEmail);
                setEmailMessage(null);
              }}
              className="text-sm font-medium text-zeedo-orange hover:underline"
            >
              {showChangeEmail ? "Cancelar" : "Alterar email"}
            </button>
            {showChangeEmail && (
              <form onSubmit={handleChangeEmail} className="mt-4 space-y-3 border-t border-zeedo-orange/20 pt-4">
                <div>
                  <label htmlFor="new_email" className="block text-sm font-medium text-zeedo-orange mb-1">
                    Novo email
                  </label>
                  <input
                    id="new_email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email_password" className="block text-sm font-medium text-zeedo-orange mb-1">
                    Senha atual
                  </label>
                  <input
                    id="email_password"
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                {emailMessage && (
                  <p className={`text-sm ${emailMessage.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                    {emailMessage.text}
                  </p>
                )}
                <button type="submit" disabled={changingEmail} className="btn-primary">
                  {changingEmail ? "Enviando…" : "Enviar link de confirmação"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
