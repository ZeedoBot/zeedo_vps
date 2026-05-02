"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { apiGet } from "@/lib/api";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"loading" | "error">("loading");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let cancelled = false;

    const oauthError = searchParams.get("error");
    const oauthDesc = searchParams.get("error_description");
    if (oauthError) {
      setState("error");
      setErrorText(
        oauthDesc?.replace(/\+/g, " ") || "Não foi possível entrar com Google. Tente novamente."
      );
      return;
    }

    (async () => {
      const supabase = createClient();
      const code = searchParams.get("code");
      const nextPath = searchParams.get("next");

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token && code) {
        const pkceKey = `supabase_pkce_${code}`;
        const alreadyDone =
          typeof window !== "undefined" && sessionStorage.getItem(pkceKey) === "1";
        if (!alreadyDone) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            if (!cancelled) {
              setState("error");
              setErrorText(exErr.message);
            }
            return;
          }
          if (typeof window !== "undefined") sessionStorage.setItem(pkceKey, "1");
        }
        ({
          data: { session },
        } = await supabase.auth.getSession());
      }

      if (!session?.access_token) {
        if (!cancelled) {
          setState("error");
          setErrorText("Sessão não encontrada. Volte e tente entrar novamente.");
        }
        return;
      }

      const destSegredo = nextPath === "/segredo";
      try {
        const me = await apiGet<{ subscription_tier?: string; subscription_status?: string }>(
          "/auth/me",
          session.access_token
        );
        const status = (me.subscription_status || "").toLowerCase();
        const hasPlan =
          Boolean(me.subscription_tier) &&
          ["basic", "pro", "satoshi"].includes(String(me.subscription_tier).toLowerCase()) &&
          (status === "active" || status === "trial");
        if (cancelled) return;
        if (destSegredo) router.replace("/segredo");
        else router.replace(hasPlan ? "/dashboard" : "/choose-plan");
      } catch {
        if (!cancelled) router.replace(destSegredo ? "/segredo" : "/choose-plan");
      }
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (state === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-zeedo-white dark:bg-zeedo-black">
        <p className="text-sm text-red-600 dark:text-red-400 text-center max-w-md">{errorText}</p>
        <Link href="/login" className="text-sm font-medium text-zeedo-orange hover:underline">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
      <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Concluindo login…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
          <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
