// src/lib/pierre/v1/hr-mission-packs/domains/contract-changes.ts
// PHASE 8.11 — Contractual changes (domain D). Gaps: role_change, salary_change, suspension,
// expiration, submit_signature. (create/approve/finalize/amendment are VERIFIED_EXISTING.)
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, ext, cc, sig } from "../schema";

export const CONTRACT_CHANGE_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "contract.change_via_amendment", domain: "contract", title: "Contractual change via amendment (role/salary/hours/site)",
    description: "Prepare an amendment for a role/salary/hours/site change, approve it, apply the effects to the employee record on activation.",
    capabilityIds: ["contract.role_change", "contract.salary_change"], subjectTypes: ["employee", "contract"],
    steps: [
      ...intakeSkeleton(),
      svc("create_amendment", "prepare_document", "Prepare the amendment (avenant)", "contract.create_amendment", { dependsOn: ["validate"] }),
      rt("approve", "request_approval", "Approve the amendment", "approval.request", { dependsOn: ["create_amendment"], autonomy: "execute_with_validation" }),
      svc("apply_effects", "mutate_record", "Apply amendment effects to the employee record", "contract.apply_amendment_effects", { dependsOn: ["approve"] }),
      rt("notify", "communicate", "Notify the employee", "communication.create_intent", { dependsOn: ["apply_effects"] }),
      ...closeSkeleton("notify"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "a contractual change is legally sensitive" }],
    countryRuleRequirements: [{ ruleFamily: "working_time", required: false, notes: "hours-change limits are P8.12" }],
    expectedArtifacts: [{ kind: "contract", format: "pdf", label: "Amendment", retention: "legal_audit" }],
    expectedEmployeeMutations: [{ target: "contract", operation: "update", reversible: false }],
    completionCriteria: [cc("amendment.prepared", "Amendment prepared.", "artifact"), cc("amendment.applied", "Effects applied.", "mutation"), cc("amendment.notified", "Employee notified.", "communication")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "contract.suspension_and_expiration", domain: "contract", title: "Contract suspension & expiration handling",
    description: "Handle suspension and end-of-term/expiration: prepare, approve, apply status change, notify, arm proactive expiry monitoring.",
    capabilityIds: ["contract.suspension", "contract.expiration"], subjectTypes: ["employee", "contract"],
    steps: [
      ...intakeSkeleton(),
      rt("prepare_change", "prepare_document", "Prepare suspension/expiration paperwork", "document.generate", { dependsOn: ["validate"] }),
      rt("approve", "request_approval", "Approve the change", "approval.request", { dependsOn: ["prepare_change"], autonomy: "execute_with_validation" }),
      svc("apply_status", "mutate_record", "Apply the contract status change", "contract.archive", { dependsOn: ["approve"] }),
      rt("notify", "communicate", "Notify the employee", "communication.create_intent", { dependsOn: ["apply_status"], emitsSignal: "contract.expiry_watch" }),
      ...closeSkeleton("notify"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "suspension/expiration is legally sensitive" }],
    countryRuleRequirements: [{ ruleFamily: "fixed_term_rules", required: true, notes: "term/renewal rules are P8.12" }],
    proactiveSignals: [sig("contract.expiry_watch", "Contract nearing expiry")],
    completionCriteria: [cc("contract.status_changed", "Status change applied.", "mutation"), cc("contract.change_closed", "Terminal state.", "state")],
    runtimeStatus: "COUNTRY_RULES_REQUIRED",
  }),
  defineMissionPack({
    id: "contract.submit_signature", domain: "contract", title: "Submit contract to e-signature (external)",
    description: "Prepare the signature (verified), then submit to the e-signature provider (blocked) and reconcile the webhook.",
    capabilityIds: ["contract.submit_signature"], subjectTypes: ["contract", "document"],
    steps: [
      ...intakeSkeleton(),
      rt("approve", "request_approval", "Approve signature submission", "approval.request", { dependsOn: ["validate"], autonomy: "execute_with_validation" }),
      rt("prepare_signature", "signature", "Prepare the signature request (governed)", "signature.prepare", { dependsOn: ["approve"], requiresApproval: true }),
      ext("submit", "await_external", "Submit to e-signature provider", "signature_provider", { dependsOn: ["prepare_signature"] }),
      rt("reconcile", "reconcile", "Reconcile signature webhook", "hr.record.append", { dependsOn: ["submit"] }),
      ...closeSkeleton("reconcile"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "signature submission is sensitive" }],
    integrationRequirements: [{ system: "signature_provider", status: "blocked", notes: "Yousign external blocker P8.7.4" }],
    completionCriteria: [cc("sig.submitted", "Signature submitted + reconciled.", "external_reconciled")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
];
