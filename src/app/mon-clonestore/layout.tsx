// src/app/mon-clonestore/layout.tsx — P12 Mon CloneStore (compte/admin). Requiert une session ;
// n'affaiblit pas l'auth. Accessible aux clients même onboarding incomplet (contrairement au cockpit).
import { redirect } from "next/navigation";
import { resolveClientReadiness } from "@/lib/clonestore/cloneos/client-readiness";

export const dynamic = "force-dynamic";

export default async function MonCloneStoreLayout({ children }: { children: React.ReactNode }) {
  const state = await resolveClientReadiness();
  if (!state.connected) redirect("/login");
  return <>{children}</>;
}
