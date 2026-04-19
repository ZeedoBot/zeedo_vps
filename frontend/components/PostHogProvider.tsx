"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHReactProvider } from "posthog-js/react";
import { Suspense, useEffect, useState } from "react";
import { PostHogPageView } from "@/components/PostHogPageView";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    if (!key) {
      setReady(true);
      return;
    }
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: true,
    });
    setReady(true);
  }, []);

  if (!ready) return <>{children}</>;

  if (!process.env.NEXT_PUBLIC_POSTHOG_TOKEN) {
    return <>{children}</>;
  }

  return (
    <PHReactProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHReactProvider>
  );
}
