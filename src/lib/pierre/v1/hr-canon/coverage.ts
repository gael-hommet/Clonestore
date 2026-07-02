// src/lib/pierre/v1/hr-canon/coverage.ts
// PHASE 8.10 — coverage analytics over the capability registry: distribution by domain, status,
// autonomy, lifecycle stage and target phase, plus readiness ratios. Pure functions over the
// registry — the numbers the coverage matrix, gap register and verify script all consume.

import type { HrCapabilityDefinition, HrDomainId, HrImplementationStatus, HrTargetPhase } from "./types";
import { HR_DOMAINS } from "./domains";

const READY: HrImplementationStatus[] = ["VERIFIED_EXISTING"];

export type DomainCoverage = {
  domain: HrDomainId;
  name: string;
  total: number;
  byStatus: Record<string, number>;
  verified: number;
  readinessPct: number; // verified / total
};

export function coverageByDomain(caps: readonly HrCapabilityDefinition[]): DomainCoverage[] {
  return HR_DOMAINS.map((d) => {
    const list = caps.filter((c) => c.domain === d.id);
    const byStatus: Record<string, number> = {};
    for (const c of list) byStatus[c.implementation] = (byStatus[c.implementation] ?? 0) + 1;
    const verified = list.filter((c) => READY.includes(c.implementation)).length;
    return { domain: d.id, name: d.name, total: list.length, byStatus, verified, readinessPct: list.length ? +((verified / list.length) * 100).toFixed(1) : 0 };
  });
}

export function countBy<T extends string>(caps: readonly HrCapabilityDefinition[], key: (c: HrCapabilityDefinition) => T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of caps) out[key(c)] = (out[key(c)] ?? 0) + 1;
  return out;
}

export type CanonCoverage = {
  totalCapabilities: number;
  domainsCovered: number;
  byStatus: Record<string, number>;
  byAutonomy: Record<string, number>;
  byTargetPhase: Record<HrTargetPhase, number>;
  verified: number;
  verifiedPct: number;
  countryDependent: number;
  externalDependent: number;
  humanOnly: number;
  byDomain: DomainCoverage[];
};

export function computeCoverage(caps: readonly HrCapabilityDefinition[]): CanonCoverage {
  const byStatus = countBy(caps, (c) => c.implementation);
  const verified = byStatus["VERIFIED_EXISTING"] ?? 0;
  const byTargetPhase = countBy(caps, (c) => c.targetPhase) as Record<HrTargetPhase, number>;
  return {
    totalCapabilities: caps.length,
    domainsCovered: new Set(caps.map((c) => c.domain)).size,
    byStatus,
    byAutonomy: countBy(caps, (c) => c.autonomy),
    byTargetPhase,
    verified,
    verifiedPct: caps.length ? +((verified / caps.length) * 100).toFixed(1) : 0,
    countryDependent: caps.filter((c) => c.countryRuleDependencies.some((d) => d.required)).length,
    externalDependent: caps.filter((c) => c.integrationDependencies.some((d) => d.status !== "available" && d.system !== "none")).length,
    humanOnly: caps.filter((c) => c.implementation === "HUMAN_ONLY" || c.autonomy === "human_only" || c.autonomy === "forbidden").length,
    byDomain: coverageByDomain(caps),
  };
}
