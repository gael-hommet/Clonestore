// src/lib/pierre/v1/hr-canon/gap-registry.ts
// PHASE 8.10 — the exact P8.11 / P8.12 build list, derived from every non-verified capability.
// P8.11 = build/verify runtime workflows (MISSING / PARTIAL / CONTRACT_ONLY / IMPLEMENTED_UNVERIFIED
// / EXTERNAL_DEPENDENCY that is a workflow gap). P8.12 = country legal rules (LEGAL_CONTENT_REQUIRED
// + anything with required country rule dependencies). HUMAN_ONLY stays human. This is the anti-
// improvisation contract: P8.11/P8.12 must only build what is listed here.

import type { HrCapabilityDefinition, HrTargetPhase } from "./types";
import { HR_CAPABILITIES } from "./capability-registry";

export type GapEntry = {
  id: string;
  domain: string;
  label: string;
  status: string;
  targetPhase: HrTargetPhase;
  autonomy: string;
  riskLevel: string;
  legalSensitivity: string;
  countryRuleFamilies: string[];
  integrations: string[];
  outstandingCertification: string[];
};

function toGap(c: HrCapabilityDefinition): GapEntry {
  return {
    id: c.id, domain: c.domain, label: c.label, status: c.implementation, targetPhase: c.targetPhase,
    autonomy: c.autonomy, riskLevel: c.risk.level, legalSensitivity: c.risk.legalSensitivity,
    countryRuleFamilies: c.countryRuleDependencies.filter((d) => d.required).map((d) => d.ruleFamily),
    integrations: c.integrationDependencies.filter((d) => d.system !== "none").map((d) => `${d.system}:${d.status}`),
    outstandingCertification: c.certificationCriteria.filter((k) => !k.met).map((k) => k.id),
  };
}

export const GAP_REGISTRY: readonly GapEntry[] = HR_CAPABILITIES
  .filter((c) => c.implementation !== "VERIFIED_EXISTING")
  .map(toGap);

export const P811_GAPS: readonly GapEntry[] = GAP_REGISTRY.filter((g) => g.targetPhase === "P8.11");
export const P812_GAPS: readonly GapEntry[] = GAP_REGISTRY.filter((g) => g.targetPhase === "P8.12");
export const HUMAN_ONLY_GAPS: readonly GapEntry[] = GAP_REGISTRY.filter((g) => g.targetPhase === "HUMAN_ONLY");

export function gapSummary() {
  return {
    total: GAP_REGISTRY.length,
    p811: P811_GAPS.length,
    p812: P812_GAPS.length,
    humanOnly: HUMAN_ONLY_GAPS.length,
    byDomain: GAP_REGISTRY.reduce<Record<string, number>>((a, g) => { a[g.domain] = (a[g.domain] ?? 0) + 1; return a; }, {}),
  };
}
