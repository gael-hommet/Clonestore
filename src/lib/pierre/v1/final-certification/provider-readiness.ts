// src/lib/pierre/v1/final-certification/provider-readiness.ts
// PHASE 8.13 — DIMENSION B (part): provider launch-readiness. A provider is launch-grade only when
// LIVE-configured and not blocked. Honest here: 0 live, Yousign blocked, every provider has a
// governed manual path. Manual path ≠ integration — this file keeps them distinct.
import { providerSummary, PROVIDER_ADAPTERS } from "../provider-integrations/registry";
import { preflight } from "../provider-integrations/preflight";

export type ProviderReadiness = {
  provider: string;
  status: string;
  liveGrade: boolean;
  manualPathAvailable: boolean;
  blockedReason: string | null;
};

export function providerReadiness(env: NodeJS.ProcessEnv = process.env): { providers: ProviderReadiness[]; liveGrade: number; manualPaths: number; note: string } {
  const providers = PROVIDER_ADAPTERS.map((a) => {
    const pf = preflight(a, env);
    return { provider: a.id, status: pf.status, liveGrade: pf.usable, manualPathAvailable: a.manualHandoff.available, blockedReason: pf.blockedReason };
  });
  const s = providerSummary(env);
  return { providers, liveGrade: s.usable, manualPaths: providers.filter((p) => p.manualPathAvailable).length, note: "manual governed path is NOT a provider integration; liveGrade counts real integrations only" };
}
