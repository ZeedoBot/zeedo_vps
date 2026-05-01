"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const FEEDBACK_TYPES = [
  { value: "Feedback Geral", label: "Feedback Geral" },
  { value: "Relatório de bug", label: "Relatório de bug" },
  { value: "Sugestão de funcionalidade", label: "Sugestão de funcionalidade" },
] as const;

const TITLE_MAX = 200;
const DESC_MAX = 2000;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackModal({ open, onClose }: Props) {
  const [feedbackType, setFeedbackType] = useState<string>(FEEDBACK_TYPES[0].value);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = useCallback(() => {
    setFeedbackType(FEEDBACK_TYPES[0].value);
    setTitle("");
    setDescription("");
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = title.trim();
    const d = description.trim();
    if (!t || t.length > TITLE_MAX) {
      setError(`O título deve ter entre 1 e ${TITLE_MAX} caracteres.`);
      return;
    }
    if (!d || d.length > DESC_MAX) {
      setError(`A descrição deve ter entre 1 e ${DESC_MAX} caracteres.`);
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        setError("Sessão expirada. Entre novamente.");
        setSubmitting(false);
        return;
      }
      const { error: insErr } = await supabase.from("feedbacks").insert({
        user_id: user.id,
        feedback_type: feedbackType,
        title: t,
        description: d,
      });
      if (insErr) {
        setError(insErr.message || "Não foi possível enviar. Tente de novo.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
      window.setTimeout(() => {
        reset();
        onClose();
      }, 1200);
    } catch {
      setError("Erro inesperado. Tente de novo.");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 pb-24 sm:pb-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-xl border border-zeedo-orange/30 bg-zeedo-white shadow-xl dark:bg-zeedo-black dark:text-zeedo-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zeedo-orange/20 px-5 py-4">
          <h2 id="feedback-modal-title" className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white">
            Compartilhe sua Opinião
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zeedo-black/60 hover:bg-zeedo-orange/10 hover:text-zeedo-orange dark:text-zeedo-white/60 dark:hover:text-zeedo-orange"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="text-sm text-zeedo-black/75 dark:text-zeedo-white/75">
              Adoraríamos ouvir seu feedback, pedidos de funcionalidades ou relatórios de bugs. Sua opinião nos ajuda a
              melhorar!
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="feedback-type" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zeedo-black dark:text-zeedo-white">
                  <svg className="h-4 w-4 shrink-0 text-zeedo-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Tipo
                </label>
                <select
                  id="feedback-type"
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  className="input-field text-sm"
                  disabled={submitting || success}
                >
                  {FEEDBACK_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="feedback-title" className="mb-1.5 block text-sm font-medium text-zeedo-black dark:text-zeedo-white">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                  placeholder="Resumo breve do seu feedback"
                  className="input-field text-sm"
                  maxLength={TITLE_MAX}
                  disabled={submitting || success}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
                  {title.length}/{TITLE_MAX} caracteres
                </p>
              </div>

              <div>
                <label htmlFor="feedback-desc" className="mb-1.5 block text-sm font-medium text-zeedo-black dark:text-zeedo-white">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="feedback-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  placeholder="Conte-nos mais sobre seu feedback..."
                  rows={5}
                  className="input-field resize-y text-sm min-h-[120px]"
                  maxLength={DESC_MAX}
                  disabled={submitting || success}
                />
                <p className="mt-1 text-xs text-zeedo-black/50 dark:text-zeedo-white/50">
                  {description.length}/{DESC_MAX} caracteres
                </p>
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 text-sm font-medium text-green-600 dark:text-green-400">Feedback enviado. Obrigado!</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-zeedo-orange/20 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zeedo-orange/35 bg-zeedo-white px-4 py-2.5 text-sm font-medium text-zeedo-black hover:bg-zeedo-orange/10 dark:border-zeedo-orange/45 dark:bg-zeedo-black dark:text-zeedo-white dark:hover:bg-zeedo-orange/15"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zeedo-orange px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-zeedo-orange focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zeedo-black"
              disabled={submitting || success}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {submitting ? "Enviando…" : "Enviar Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
