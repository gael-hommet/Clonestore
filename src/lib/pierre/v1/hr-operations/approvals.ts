// src/lib/pierre/v1/hr-operations/approvals.ts
// PHASE 8.11 — resolve whether a case step needs a human approval before it may execute, from the
// pack's approval policies + the step's flags. Pure; the actual approval is created/recorded by the
// verified runtime (approval.request action + decideValidationAction).
import type { HrMissionPackDefinition, HrMissionPackStep } from "../hr-mission-packs/types";

export type ApprovalRequirement = { required: boolean; approver: string | null; reason: string | null };

export function approvalFor(pack: HrMissionPackDefinition, step: HrMissionPackStep, ctx: { irreversible?: boolean; legalSensitive?: boolean } = {}): ApprovalRequirement {
  if (step.binding.type === "human_decision") return { required: true, approver: step.binding.role, reason: "legally-reserved human decision" };
  if (step.requiresApproval || step.kind === "signature") {
    const pol = pack.approvals.find((a) => a.when === "always") ?? pack.approvals[0];
    return { required: true, approver: pol?.approver ?? "hr_manager", reason: pol?.reason ?? "governed step requires approval" };
  }
  const pol = pack.approvals.find((a) =>
    a.when === "always" ||
    (a.when === "if_irreversible" && ctx.irreversible) ||
    (a.when === "if_legal_sensitive" && ctx.legalSensitive));
  return pol ? { required: true, approver: pol.approver, reason: pol.reason } : { required: false, approver: null, reason: null };
}

/** Every distinct approver a pack may involve (for governance summary). */
export function approversInvolved(pack: HrMissionPackDefinition): string[] {
  const s = new Set<string>();
  for (const a of pack.approvals) s.add(a.approver);
  for (const st of pack.steps) if (st.binding.type === "human_decision") s.add(st.binding.role);
  return [...s];
}
