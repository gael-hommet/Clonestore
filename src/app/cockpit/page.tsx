// src/app/cockpit/page.tsx — P12 Global Cockpit (CloneOS first screen). Gated per-page.
import { GlobalCockpitConsole } from "@/components/cockpit/GlobalCockpitConsole";
import { requireReadyClient } from "@/lib/clonestore/cloneos/require-ready-client";

export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  await requireReadyClient();
  return <GlobalCockpitConsole companyLabel={null} />;
}
