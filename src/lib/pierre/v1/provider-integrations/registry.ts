// src/lib/pierre/v1/provider-integrations/registry.ts
// PHASE 8.12 — the provider registry + preflight rollup. Aggregates the 6 provider adapters and
// reports each one's status (config-only, no network). In this environment all are not_configured or
// blocked (Yousign) — and every one has a governed manual handoff so missions never dead-end.
import type { ProviderAdapter, ProviderId, PreflightResult } from "./types";
import { preflight } from "./preflight";
import { YOUSIGN } from "./providers/yousign";
import { PAYROLL } from "./providers/payroll";
import { IDENTITY } from "./providers/identity";
import { TIME_ATTENDANCE } from "./providers/time-attendance";
import { BENEFITS } from "./providers/benefits";
import { TRAINING } from "./providers/training";

export const PROVIDER_ADAPTERS: readonly ProviderAdapter[] = [YOUSIGN, PAYROLL, IDENTITY, TIME_ATTENDANCE, BENEFITS, TRAINING];
export function getProvider(id: ProviderId): ProviderAdapter | undefined { return PROVIDER_ADAPTERS.find((p) => p.id === id); }

export function preflightAll(env: NodeJS.ProcessEnv = process.env): PreflightResult[] { return PROVIDER_ADAPTERS.map((a) => preflight(a, env)); }

export function providerSummary(env: NodeJS.ProcessEnv = process.env) {
  const pf = preflightAll(env);
  return {
    providers: pf.length,
    byStatus: pf.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {}),
    usable: pf.filter((p) => p.usable).length,
    blocked: pf.filter((p) => p.status === "blocked").map((p) => p.provider),
    allHaveManualPath: PROVIDER_ADAPTERS.every((a) => a.manualHandoff.available),
    preflights: pf,
  };
}
