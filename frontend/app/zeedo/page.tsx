import { redirect } from "next/navigation";

export default function ZeedoRedirect() {
  redirect("/?utm_source=instagram&utm_medium=bio&utm_campaign=zeedo");
}

