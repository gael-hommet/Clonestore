// src/lib/pierre/v1/hr-mission-packs/domains/policies.ts
// PHASE 8.11 — Policies & internal compliance (domain Q). Gaps: define, version_publish,
// acceptance, impact_diffusion, enforcement_audit.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, cc, sig } from "../schema";

export const POLICY_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "policy.lifecycle", domain: "policy", title: "Policy lifecycle (define → version → publish → acceptance → diffusion)",
    description: "Define/version an internal policy, approve & publish it, diffuse it and collect acceptance proof (NDA, code of conduct).",
    capabilityIds: ["policy.define", "policy.version_publish", "policy.acceptance", "policy.impact_diffusion"], subjectTypes: ["policy", "company"],
    steps: [
      ...intakeSkeleton(),
      rt("draft", "prepare_document", "Draft/version the policy", "document.generate", { dependsOn: ["validate"] }),
      rt("approve", "request_approval", "Approve & publish", "approval.request", { dependsOn: ["draft"], autonomy: "execute_with_validation" }),
      rt("diffuse", "communicate", "Diffuse to employees", "communication.create_intent", { dependsOn: ["approve"] }),
      rt("collect_acceptance", "collect", "Collect acceptance proof", "hr.data.collect", { dependsOn: ["diffuse"], emitsSignal: "policy.acceptance_pending" }),
      ...closeSkeleton("collect_acceptance"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "policy publication is governed" }],
    expectedArtifacts: [{ kind: "policy_doc", format: "pdf", label: "Policy", retention: "legal_audit" }],
    proactiveSignals: [sig("policy.acceptance_pending", "Policy acceptance still pending")],
    completionCriteria: [cc("policy.published", "Policy published.", "artifact"), cc("policy.diffused", "Diffused to employees.", "communication")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "policy.enforcement_audit", domain: "policy", title: "Policy enforcement & exception audit",
    description: "Audit policy application, surface exceptions, and report.",
    capabilityIds: ["policy.enforcement_audit"], subjectTypes: ["company"],
    steps: [...intakeSkeleton(), rt("audit", "collect", "Audit application & exceptions (compute completeness/gaps)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "completeness_deadlines" } }), ...closeSkeleton("audit")],
    completionCriteria: [cc("policy.audited", "Enforcement audited.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
