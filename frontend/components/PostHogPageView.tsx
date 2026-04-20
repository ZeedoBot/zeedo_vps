"use client";

import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Pageviews em navegação client-side (App Router). */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_TOKEN) return;
    if (!pathname) return;
    let url = window.origin + pathname;
    const q = searchParams?.toString();
    if (q) url += `?${q}`;
    const utm_source = searchParams?.get("utm_source") || undefined;
    const utm_medium = searchParams?.get("utm_medium") || undefined;
    const utm_campaign = searchParams?.get("utm_campaign") || undefined;
    const utm_content = searchParams?.get("utm_content") || undefined;
    const utm_term = searchParams?.get("utm_term") || undefined;
    const referrer = document.referrer || undefined;
    let referring_domain: string | undefined = undefined;
    if (referrer) {
      try {
        referring_domain = new URL(referrer).hostname || undefined;
      } catch {
        // ignore
      }
    }
    posthog.capture("$pageview", {
      $current_url: url,
      $referrer: referrer,
      $referring_domain: referring_domain,
      $utm_source: utm_source,
      $utm_medium: utm_medium,
      $utm_campaign: utm_campaign,
      $utm_content: utm_content,
      $utm_term: utm_term,
    });
  }, [pathname, searchParams]);

  return null;
}
