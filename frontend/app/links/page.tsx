import { Suspense } from "react";
import { LinksClient } from "./LinksClient";

export default function LinksPage() {
  return (
    <Suspense fallback={null}>
      <LinksClient />
    </Suspense>
  );
}
