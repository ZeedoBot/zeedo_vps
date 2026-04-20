"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TikTokRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/links?utm_source=tiktok&utm_medium=bio&utm_campaign=azevedocrypto");
  }, [router]);
  return null;
}

