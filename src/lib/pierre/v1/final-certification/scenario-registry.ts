// src/lib/pierre/v1/final-certification/scenario-registry.ts
// PHASE 8.13 — derive runnable certification scenarios (dynamic). Two kinds:
//   (1) PACK scenarios — one per mission pack in its native mode; country-dependent packs also get
//       one per launch country (fail-closed).
//   (2) STANDALONE CAPABILITY scenarios — for canon capabilities that have NO mission pack but ARE
//       country/external-dependent (the P8.12 gap capabilities). These are exercised through the REAL
//       capability-level gate / provider layer so their fail-closed / manual-governed path is
//       genuinely tested, not merely labelled. (Addresses the P8.13 adversarial finding.)

import type { HrCertificationScenario, CertificationMode, TerminalState } from "./types";
import { HR_MISSION_PACKS, packsForCapability } from "../hr-mission-packs/registry";
import { HR_CAPABILITIES } from "../hr-canon/capability-registry";
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";

function modeFor(pack: HrMissionPackDefinition): CertificationMode {
  switch (pack.runtimeStatus) {
    case "IMPLEMENTED": return pack.approvals.length > 0 ? "AFTER_APPROVAL" : "AUTOMATED";
    case "HUMAN_DECISION_REQUIRED": return "HUMAN_DECISION";
    case "RUNTIME_READY_EXTERNAL_BLOCKED": return "MANUAL_GOVERNED";
    case "COUNTRY_RULES_REQUIRED": return "FAIL_CLOSED";
    default: return "FAIL_CLOSED";
  }
}
function terminalFor(mode: CertificationMode): TerminalState {
  switch (mode) {
    case "AUTOMATED": case "AFTER_APPROVAL": return "COMPLETED";
    case "HUMAN_DECISION": return "AWAITING_HUMAN";
    case "MANUAL_GOVERNED": return "AWAITING_EXTERNAL";
    case "FAIL_CLOSED": return "BLOCKED";
  }
}

const FORBIDDEN = ["fabricated_provider_success", "invented_law", "unapproved_mutation", "human_decision_auto_taken"];

export function buildScenarios(): HrCertificationScenario[] {
  const out: HrCertificationScenario[] = [];
  // (1) pack scenarios
  for (const pack of HR_MISSION_PACKS) {
    const mode = modeFor(pack);
    out.push({ id: `cert.pack.${pack.id}.generic`, domain: pack.domain, capabilityIds: pack.capabilityIds, missionPackIds: [pack.id], country: "GENERIC", companyProfile: "synthetic-sme", actorRole: "hr_operator", subjectType: pack.subjectTypes[0] ?? "employee", mode, expectedTerminalState: terminalFor(mode), forbiddenEffects: FORBIDDEN });
    if (pack.countryRuleRequirements.some((r) => r.required)) {
      for (const country of ["FR", "BE", "LU", "CH"] as const) {
        out.push({ id: `cert.pack.${pack.id}.${country}`, domain: pack.domain, capabilityIds: pack.capabilityIds, missionPackIds: [pack.id], country, companyProfile: "synthetic-sme", actorRole: "hr_operator", subjectType: pack.subjectTypes[0] ?? "employee", mode: "FAIL_CLOSED", expectedTerminalState: "BLOCKED", forbiddenEffects: FORBIDDEN });
      }
    }
  }
  // (2) standalone capability scenarios (no pack) — exercised via the real capability gate / provider
  for (const cap of HR_CAPABILITIES) {
    if (packsForCapability(cap.id).length > 0) continue;
    if (cap.implementation === "VERIFIED_EXISTING" || cap.implementation === "HUMAN_ONLY") continue;
    const countryDependent = cap.countryRuleDependencies.some((d) => d.required) || cap.implementation === "LEGAL_CONTENT_REQUIRED";
    const externalDependent = cap.integrationDependencies.some((d) => d.system !== "none" && d.status !== "available") || cap.implementation === "EXTERNAL_DEPENDENCY";
    if (externalDependent) {
      out.push({ id: `cert.cap.${cap.id}.external`, domain: cap.domain, capabilityIds: [cap.id], missionPackIds: [], country: "GENERIC", companyProfile: "synthetic-sme", actorRole: "hr_operator", subjectType: cap.subjectTypes[0] ?? "employee", mode: "MANUAL_GOVERNED", expectedTerminalState: "AWAITING_EXTERNAL", forbiddenEffects: FORBIDDEN });
    } else if (countryDependent) {
      for (const country of ["FR", "BE", "LU", "CH"] as const) {
        out.push({ id: `cert.cap.${cap.id}.${country}`, domain: cap.domain, capabilityIds: [cap.id], missionPackIds: [], country, companyProfile: "synthetic-sme", actorRole: "hr_operator", subjectType: cap.subjectTypes[0] ?? "employee", mode: "FAIL_CLOSED", expectedTerminalState: "BLOCKED", forbiddenEffects: FORBIDDEN });
      }
    }
  }
  return out;
}

export const CERTIFICATION_SCENARIOS: readonly HrCertificationScenario[] = buildScenarios();
