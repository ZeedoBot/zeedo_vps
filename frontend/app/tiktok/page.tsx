import { redirect } from "next/navigation";

export default function TikTokRedirect() {
  redirect("/links?utm_source=tiktok&utm_medium=bio&utm_campaign=azevedocrypto");
}

