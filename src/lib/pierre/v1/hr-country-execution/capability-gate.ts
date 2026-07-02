// src/lib/pierre/v1/hr-country-execution/capability-gate.ts
// PHASE 8.13 — a REAL, invocable fail-closed gate at the CAPABILITY level (not just mission packs).
// A standalone country-dependent capability (one with no mission pack) is governed here: invoking it
// resolves its country rule dependencies, freezes a rule snapshot, and FAILS CLOSED unless every
// required rule is VERIFIED + fresh. This is the runtime entry point that makes such capabilities
// genuinely fail-closed-certified (not merely labelled). Pure; nowIso supplied by the caller.

import type { Jurisdiction } from "../hr-canon/country-packs/types";
import { getCapability } from "../hr-canon/capability-registry";
import { COUNTRY_REGISTRY } from "../hr-canon/country-packs";
import { evaluateRules } from "../hr-canon/country-packs/rule-evaluator";
import { freezeRules } from "../hr-canon/country-packs/rule-snapshot";

export type CapabilityGateResult = {
  capabilityId: string;
  jurisdiction: Jurisdiction;
  requiredFamilies: string[];
  allowed: boolean;                 // automated legally-sensitive execution permitted?
  blockedFamilies: string[];
  snapshotId: string | null;
  route: "AUTOMATED_VERIFIED" | "HUMAN_DECISION" | "GOVERNED_MANUAL";
  reason: string;
};

/** Evaluate the fail-closed gate for a single capability + jurisdiction. */
export function evaluateCapabilityGate(capabilityId: string, jurisdiction: Jurisdiction, nowIso: string): CapabilityGateResult {
  const cap = getCapability(capabilityId);
  const requiredFamilies = (cap?.countryRuleDependencies ?? []).filter((d) => d.required).map((d) => d.ruleFamily);
  const pack = COUNTRY_REGISTRY[jurisdiction] ?? null;
  const rules: { rule: import("../hr-canon/country-packs/types").CountryRule; family: string }[] = [];
  const missingFamilies: string[] = [];
  for (const fam of requiredFamilies) {
    const inst = pack?.families.find((f) => f.family === fam);
    if (!inst) { missingFamilies.push(fam); continue; }
    for (const rule of inst.rules) rules.push({ rule, family: fam });
  }
  const snapshot = freezeRules(jurisdiction, rules, nowIso);
  const evaluation = evaluateRules(rules, { nowIso });
  const blockedFamilies = [
    ...missingFamilies,
    ...[...new Set(evaluation.blocked.map((b) => rules.find((r) => r.rule.key === b.key)?.family ?? "unknown"))],
  ];
  const allowed = requiredFamilies.length > 0 && missingFamilies.length === 0 && evaluation.allUsable && snapshot.allVerified;
  const humanReserved = cap?.autonomy === "human_only" || cap?.autonomy === "forbidden";
  const route = allowed ? "AUTOMATED_VERIFIED" : humanReserved ? "HUMAN_DECISION" : "GOVERNED_MANUAL";
  return {
    capabilityId, jurisdiction, requiredFamilies, allowed,
    blockedFamilies: [...new Set(blockedFamilies)], snapshotId: snapshot.snapshotId, route,
    reason: allowed ? "all required rules VERIFIED + fresh" : `fail-closed: rules not VERIFIED → ${route}`,
  };
}
