// src/lib/pierre/v1/hr-country-execution/evidence.ts
// PHASE 8.12 — the country-execution evidence bundle: exactly which rule snapshot, gate result and
// source pointers applied to a mission — reproducible + auditable. PII-free.
import type { MissionRuleBinding } from "./mission-rule-binding";

export type CountryExecutionEvidence = {
  packId: string;
  jurisdiction: string;
  snapshotId: string;
  snapshotFingerprint: string;
  allRulesVerified: boolean;
  gateAllowed: boolean;
  gateRoute: string;
  blockedFamilies: string[];
  ruleStatuses: Record<string, string>;   // family → status summary
  recordedAt: string;                      // caller-supplied ISO
};

export function buildCountryEvidence(binding: MissionRuleBinding, recordedAt: string): CountryExecutionEvidence {
  const ruleStatuses: Record<string, string> = {};
  for (const r of binding.snapshot.rules) ruleStatuses[r.key] = r.status;
  return {
    packId: binding.packId, jurisdiction: binding.jurisdiction, snapshotId: binding.snapshot.snapshotId,
    snapshotFingerprint: binding.snapshot.fingerprint, allRulesVerified: binding.snapshot.allVerified,
    gateAllowed: binding.gate.allowed, gateRoute: binding.gate.route,
    blockedFamilies: binding.gate.blockedRules.map((b) => b.family), ruleStatuses, recordedAt,
  };
}
