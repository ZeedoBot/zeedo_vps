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
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const utm_source = params.get("utm_source");
      const utm_medium = params.get("utm_medium");
      const utm_campaign = params.get("utm_campaign");
      const utm_content = params.get("utm_content");
      const utm_term = params.get("utm_term");
      const referrer = document.referrer || null;
      posthog.register_once(
        {
          initial_referrer: referrer,
          initial_landing_url: url.toString(),
          initial_utm_source: utm_source,
          initial_utm_medium: utm_medium,
          initial_utm_campaign: utm_campaign,
          initial_utm_content: utm_content,
          initial_utm_term: utm_term,
        },
        "initial_tracking_set",
      );
    } catch {
      // ignore
    }
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
