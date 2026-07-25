// src/lib/pierre/v1/hr-mission-packs/domains/offers.ts
// PHASE 8.11 — Offer & pre-hire (domain C). Gaps: negotiation, signature_collection, candidate_to_employee.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, ext, cc } from "../schema";

export const OFFER_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "offer.negotiation_and_signature", domain: "offer", title: "Offer negotiation & signature collection",
    description: "Prepare the offer, run the negotiation loop, request approval, then collect signatures via the (blocked) e-signature provider.",
    capabilityIds: ["offer.negotiation", "offer.signature_collection"], subjectTypes: ["candidate", "document"],
    steps: [
      ...intakeSkeleton(),
      svc("prepare_offer", "prepare_document", "Prepare/adjust the offer document", "offer.render_offer_premium", { dependsOn: ["validate"] }),
      rt("approve_offer", "request_approval", "Approve the offer terms", "approval.request", { dependsOn: ["prepare_offer"], autonomy: "execute_with_validation" }),
      ext("collect_signature", "signature", "Collect signature via e-signature provider", "signature_provider", { dependsOn: ["approve_offer"], requiresApproval: true }),
      rt("reconcile_sig", "reconcile", "Reconcile signature return", "hr.reconcile.apply", { dependsOn: ["collect_signature"] }),
      ...closeSkeleton("reconcile_sig"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "an offer is a binding pre-contractual commitment" }],
    integrationRequirements: [{ system: "signature_provider", status: "blocked", notes: "Yousign external blocker P8.7.4" }],
    countryRuleRequirements: [{ ruleFamily: "contract_types", required: true }],
    expectedArtifacts: [{ kind: "letter", format: "pdf", label: "Job offer", retention: "legal_audit" }],
    completionCriteria: [cc("offer.prepared", "Offer prepared.", "artifact"), cc("offer.reconciled", "Signature reconciled.", "external_reconciled")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
  defineMissionPack({
    id: "offer.candidate_conversion", domain: "offer", title: "Convert candidate to employee",
    description: "On signed offer, convert the candidate to an employee and hand off to onboarding.",
    capabilityIds: ["offer.candidate_to_employee"], subjectTypes: ["candidate", "employee"],
    steps: [...intakeSkeleton(), svc("create_employee", "mutate_record", "Create the employee record", "employee360.create", { dependsOn: ["validate"] }), rt("handoff_onboarding", "schedule", "Hand off to onboarding", "follow_up.schedule", { dependsOn: ["create_employee"], emitsSignal: "onboarding.kickoff_due" }), ...closeSkeleton("handoff_onboarding")],
    expectedEmployeeMutations: [{ target: "employee", operation: "create", reversible: false }],
    approvals: [{ when: "if_irreversible", approver: "hr_operator", reason: "creating an employee is a durable record" }],
    completionCriteria: [cc("candidate.converted", "Employee record created.", "mutation"), cc("conversion.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
