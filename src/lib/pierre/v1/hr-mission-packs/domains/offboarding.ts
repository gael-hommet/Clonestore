// src/lib/pierre/v1/hr-mission-packs/domains/offboarding.ts
// PHASE 8.11 — Offboarding (domain R). Gaps: orchestrate, exit_interview. (dismissal is HUMAN_ONLY;
// resignation/mutual-termination/final-pay are country-dependent P8.12.)
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, ext, cc, sig } from "../schema";

export const OFFBOARDING_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "offboarding.orchestrate", domain: "offboarding", title: "Orchestrate offboarding (handover, access, equipment, exit interview, archival)",
    description: "Once a departure is decided (elsewhere), orchestrate handover, access revocation, equipment return, exit interview, and file closure/archival with retention.",
    capabilityIds: ["offboarding.orchestrate", "offboarding.exit_interview"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("handover", "prepare_document", "Plan handover & equipment return", "mission.noop", { dependsOn: ["validate"] }),
      ext("revoke_access", "await_external", "Revoke accounts/access", "identity_provider", { dependsOn: ["handover"], autonomy: "execute_with_validation" }),
      rt("exit_interview", "collect", "Conduct/record exit interview", "mission.noop", { dependsOn: ["handover"] }),
      svc("archive_file", "archive", "Close & archive the employee file (retention)", "employee360.archive", { dependsOn: ["exit_interview"] }),
      rt("notify", "communicate", "Notify stakeholders", "communication.create_intent", { dependsOn: ["archive_file"], emitsSignal: "offboarding.access_to_close" }),
      ...closeSkeleton("notify"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "offboarding archives the employee file (irreversible)" }],
    integrationRequirements: [{ system: "identity_provider", status: "not_integrated", notes: "access revocation via IdP is P8.12" }],
    countryRuleRequirements: [{ ruleFamily: "document_retention", required: true, notes: "retention periods are P8.12" }],
    expectedEmployeeMutations: [{ target: "employee", operation: "status_change", field: "status=left", reversible: false }],
    proactiveSignals: [sig("offboarding.access_to_close", "Access still open after departure")],
    completionCriteria: [cc("offboarding.archived", "File archived.", "mutation"), cc("offboarding.closed", "Terminal state.", "state")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
];
