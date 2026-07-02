// src/lib/pierre/v1/hr-mission-packs/domains/compensation.ts
// PHASE 8.11 — Compensation & benefits (domain I). Gaps: salary_grid, salary_change_prepare,
// raise_promotion, variable_pay, equity, benefits, vouchers, expenses, salary_review, pay_equity.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, ext, human, cc } from "../schema";

export const COMPENSATION_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "compensation.salary_change", domain: "compensation", title: "Salary change / raise / promotion (prepare → decide → feed contract)",
    description: "Maintain the grid, prepare a salary change (raise/promotion/variable), route the human decision, and feed the contract amendment.",
    capabilityIds: ["compensation.salary_grid", "compensation.salary_change_prepare", "compensation.raise_promotion", "compensation.variable_pay", "compensation.salary_review"],
    subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("prepare_change", "prepare_document", "Prepare the compensation change against the grid", "mission.noop", { dependsOn: ["validate"] }),
      human("comp_decision", "Human compensation decision", "hr_manager", { dependsOn: ["prepare_change"] }),
      rt("feed_amendment", "schedule", "Feed the contract amendment", "follow_up.schedule", { dependsOn: ["comp_decision"], emitsSignal: "contract.amendment_due" }),
      ...closeSkeleton("feed_amendment"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "compensation changes are human decisions" }],
    completionCriteria: [cc("comp.decided", "Compensation decision recorded.", "human_recorded"), cc("comp.closed", "Terminal state.", "state")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
  defineMissionPack({
    id: "compensation.benefits_and_expenses", domain: "compensation", title: "Benefits, vouchers & expense reimbursement",
    description: "Administer benefits (mutuelle/prévoyance), meal vouchers and expense reimbursements via governed workflows + benefits provider handoff.",
    capabilityIds: ["compensation.benefits", "compensation.vouchers", "compensation.expenses"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("prepare", "prepare_document", "Prepare benefit/voucher/expense record", "mission.noop", { dependsOn: ["validate"] }),
      rt("approve", "request_approval", "Approve reimbursement/enrollment", "approval.request", { dependsOn: ["prepare"], autonomy: "execute_with_validation" }),
      ext("provider", "await_external", "Hand off to benefits provider", "benefits_provider", { dependsOn: ["approve"] }),
      rt("reconcile", "reconcile", "Reconcile provider return", "mission.noop", { dependsOn: ["provider"] }),
      ...closeSkeleton("reconcile"),
    ],
    approvals: [{ when: "above_threshold", approver: "hr_manager", reason: "reimbursements above threshold need approval" }],
    integrationRequirements: [{ system: "benefits_provider", status: "not_integrated", notes: "benefits provider integration is P8.12" }],
    completionCriteria: [cc("benefits.reconciled", "Provider reconciled.", "external_reconciled")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
  defineMissionPack({
    id: "compensation.equity_and_equity_review", domain: "compensation", title: "Equity administration & pay-equity review",
    description: "Administer equity grants and run pay-equity analysis/reporting; decisions are human-owned, legal thresholds are country rules.",
    capabilityIds: ["compensation.equity", "compensation.pay_equity"], subjectTypes: ["company", "employee"],
    steps: [
      ...intakeSkeleton(),
      rt("analyze", "validate", "Analyze equity grants / pay-equity gaps", "mission.noop", { dependsOn: ["validate"], autonomy: "observe_only" }),
      human("comp_committee", "Compensation committee decision", "owner", { dependsOn: ["analyze"] }),
      ...closeSkeleton("comp_committee"),
    ],
    approvals: [{ when: "always", approver: "owner", reason: "equity & pay-equity are leadership decisions" }],
    countryRuleRequirements: [{ ruleFamily: "collective_agreements", required: false, notes: "pay-equity thresholds are P8.12" }],
    completionCriteria: [cc("equity.decided", "Committee decision recorded.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
