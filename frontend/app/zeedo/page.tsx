"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ZeedoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?utm_source=instagram&utm_medium=bio&utm_campaign=zeedo");
  }, [router]);
  return null;
}

