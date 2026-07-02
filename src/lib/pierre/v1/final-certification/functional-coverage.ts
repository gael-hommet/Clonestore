// src/lib/pierre/v1/final-certification/functional-coverage.ts
// PHASE 8.13 — DIMENSION A: functional completeness. Classifies every canon capability into exactly
// one of the 8 certification states from what is ACTUALLY built (VERIFIED_EXISTING proofs, P8.11
// mission packs, P8.12 country engine, provider manual paths). "Functionally certified" means the
// capability has a real governed path — including the legitimate modes the system uses: verified
// automation, after-approval, human decision, governed manual handoff, and EXPLICIT fail-closed. It
// does NOT mean everything runs automatically (that is dimension B).

import type { HrCertificationState, CertificationMode, CapabilityCertification } from "./types";
import { isCertified } from "./types";
import { HR_CAPABILITIES } from "../hr-canon/capability-registry";
import type { HrCapabilityDefinition } from "../hr-canon/types";
import { packsForCapability } from "../hr-mission-packs/registry";
import { evaluateCapabilityGate } from "../hr-country-execution/capability-gate";

const NOW = "2026-07-02T10:00:00.000Z";

function fromPackStatus(pack: { runtimeStatus: string; approvals: unknown[] }): { state: HrCertificationState; mode: CertificationMode; blocker: CapabilityCertification["automationBlocker"] } {
  switch (pack.runtimeStatus) {
    case "IMPLEMENTED": return pack.approvals.length > 0 ? { state: "CERTIFIED_AFTER_APPROVAL", mode: "AFTER_APPROVAL", blocker: "none" } : { state: "CERTIFIED_AUTOMATED", mode: "AUTOMATED", blocker: "none" };
    case "HUMAN_DECISION_REQUIRED": return { state: "CERTIFIED_HUMAN_DECISION", mode: "HUMAN_DECISION", blocker: "human_reserved" };
    case "RUNTIME_READY_EXTERNAL_BLOCKED": return { state: "CERTIFIED_MANUAL_GOVERNED_PATH", mode: "MANUAL_GOVERNED", blocker: "external_provider" };
    case "COUNTRY_RULES_REQUIRED": return { state: "CERTIFIED_FAIL_CLOSED", mode: "FAIL_CLOSED", blocker: "legal_review" };
    default: return { state: "NOT_CERTIFIED", mode: "FAIL_CLOSED", blocker: "none" };
  }
}

export function classifyCapability(cap: HrCapabilityDefinition): CapabilityCertification {
  const packs = packsForCapability(cap.id);
  const packIds = packs.map((p) => p.id);
  const base = (state: HrCertificationState, mode: CertificationMode | null, blocker: CapabilityCertification["automationBlocker"], evidence: string[], rationale: string): CapabilityCertification =>
    ({ capabilityId: cap.id, domain: cap.domain, implementation: cap.implementation, autonomy: cap.autonomy, missionPackIds: packIds, state, mode, automationBlocker: blocker, evidenceRefs: evidence, rationale });

  // 1) already-verified capabilities (proven in prior P8 phases)
  if (cap.implementation === "VERIFIED_EXISTING") {
    const ev = cap.evidence.map((e) => `${e.kind}:${e.ref}`);
    if (cap.autonomy === "execute_autonomous") return base("CERTIFIED_AUTOMATED", "AUTOMATED", "none", ev, "verified autonomous capability");
    if (cap.autonomy === "human_only" || cap.autonomy === "forbidden") return base("CERTIFIED_HUMAN_DECISION", "HUMAN_DECISION", "human_reserved", ev, "verified, human-reserved");
    return base("CERTIFIED_AFTER_APPROVAL", "AFTER_APPROVAL", "none", ev, "verified, executes after validation");
  }
  // 2) legally-reserved human-only
  if (cap.implementation === "HUMAN_ONLY") return base("CERTIFIED_HUMAN_DECISION", "HUMAN_DECISION", "human_reserved", ["canon:HUMAN_ONLY"], "legally-reserved human decision (Pierre assists/records only)");
  // 3) realized by a P8.11 mission pack
  if (packs.length > 0) {
    const r = fromPackStatus(packs[0]);
    return base(r.state, r.mode, r.blocker, [`pack:${packs[0].id} (compiles on real runtime)`], `realized by mission pack (${packs[0].runtimeStatus})`);
  }
  // 4) no pack — country / external dependent (the 32 P8.12 gaps land here)
  const countryDependent = cap.countryRuleDependencies.some((d) => d.required) || cap.implementation === "LEGAL_CONTENT_REQUIRED";
  const externalDependent = cap.integrationDependencies.some((d) => d.system !== "none" && d.status !== "available") || cap.implementation === "EXTERNAL_DEPENDENCY";
  if (externalDependent) return base("CERTIFIED_MANUAL_GOVERNED_PATH", "MANUAL_GOVERNED", "external_provider", ["provider-integrations: governed manual handoff (submit → routed_to_manual, no fabricated success)"], "external provider not integrated → governed manual path");
  if (countryDependent) {
    // VERIFY the real capability-level gate actually fails closed (not a mere label).
    const gate = evaluateCapabilityGate(cap.id, "FR", NOW);
    if (!gate.allowed && gate.requiredFamilies.length > 0)
      return base("CERTIFIED_FAIL_CLOSED", "FAIL_CLOSED", "legal_review", [`hr-country-execution/capability-gate.ts (invoked: FR blocked=${!gate.allowed}, families=${gate.requiredFamilies.length}, route=${gate.route})`], "country rule not VERIFIED → explicit fail-closed via a real invocable capability gate + governed fallback");
    return base("NOT_CERTIFIED", null, "legal_review", [], "country-dependent but the capability gate did not fail closed as expected");
  }
  // 5) genuinely nothing built
  return base("NOT_CERTIFIED", null, "none", [], "no governed path built");
}

export type FunctionalCoverage = {
  totalCapabilities: number;
  certified: number;
  notCertified: number;
  functionallyComplete: boolean;
  byState: Record<string, number>;
  byAutomationBlocker: Record<string, number>;
  entries: CapabilityCertification[];
  uncertifiedIds: string[];
};

export function certifyAllCapabilities(): FunctionalCoverage {
  const entries = HR_CAPABILITIES.map(classifyCapability);
  const byState: Record<string, number> = {}; const byAutomationBlocker: Record<string, number> = {};
  for (const e of entries) { byState[e.state] = (byState[e.state] ?? 0) + 1; byAutomationBlocker[e.automationBlocker] = (byAutomationBlocker[e.automationBlocker] ?? 0) + 1; }
  const certified = entries.filter((e) => isCertified(e.state)).length;
  const uncertifiedIds = entries.filter((e) => !isCertified(e.state)).map((e) => e.capabilityId);
  return { totalCapabilities: entries.length, certified, notCertified: uncertifiedIds.length, functionallyComplete: uncertifiedIds.length === 0, byState, byAutomationBlocker, entries, uncertifiedIds };
}
