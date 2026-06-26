// src/lib/pierre/v1/autonomy.ts
// PHASE 8.1 — Pierre Production Runtime Core — autonomy modes + validation policy.
//
// Four visible modes backed by a real granular policy engine. The mode is NOT a
// cosmetic enum: it actually changes the execution decision. Permanent validation
// ("ask a human for everything") is refused — the engine classifies each action.

export type AutonomyMode = "draft" | "normal" | "high_autonomy" | "enterprise_autonomous";
export const AUTONOMY_MODES: readonly AutonomyMode[] = ["draft", "normal", "high_autonomy", "enterprise_autonomous"];

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Sensitivity = "normal" | "sensitive" | "restricted";

export type ValidationDecision =
  | "AUTO_EXECUTE"
  | "EXECUTE_AND_NOTIFY"
  | "PREPARE_AND_OPTIONALLY_REVIEW"
  | "HUMAN_APPROVAL_REQUIRED"
  | "BLOCK_AND_ESCALATE";

/** Action categories the runtime knows how to classify. */
export type ActionKind =
  // low-risk / operational
  | "request_missing_info" | "reminder" | "deadline_reminder" | "acknowledge_receipt"
  | "classification" | "status_update" | "standard_report" | "low_risk_notification"
  | "create_task" | "operational_summary"
  // approval-required / sensitive
  | "contract" | "amendment" | "compensation" | "sanction" | "termination" | "dismissal"
  | "sensitive_medical" | "discrimination_flagged" | "harassment_flagged"
  | "final_recruitment_decision" | "sensitive_legal_letter";

const AUTO_EXECUTE_ACTIONS: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "request_missing_info", "reminder", "deadline_reminder", "acknowledge_receipt",
  "classification", "status_update", "standard_report", "low_risk_notification",
  "create_task", "operational_summary",
]);

const APPROVAL_REQUIRED_ACTIONS: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "contract", "amendment", "compensation", "sanction", "termination", "dismissal",
  "sensitive_medical", "discrimination_flagged", "harassment_flagged",
  "final_recruitment_decision", "sensitive_legal_letter",
]);

export type AutonomyContext = {
  mode: AutonomyMode;
  action: ActionKind;
  risk: RiskLevel;
  sensitivity: Sensitivity;
  external_side_effect: boolean; // sends email / produces official document / acts outside
};

/**
 * Decide how an action should be handled given the autonomy mode + action class.
 * Sensitive / approval-required actions are NEVER auto-executed, in any mode.
 */
export function decideValidation(ctx: AutonomyContext): ValidationDecision {
  // Hard floor: approval-required + restricted are always gated, regardless of mode.
  if (APPROVAL_REQUIRED_ACTIONS.has(ctx.action) || ctx.sensitivity === "restricted") {
    return "HUMAN_APPROVAL_REQUIRED";
  }
  if (ctx.risk === "critical") return "BLOCK_AND_ESCALATE";

  switch (ctx.mode) {
    case "draft":
      // Discovery / very cautious: nothing external without review.
      return ctx.external_side_effect ? "HUMAN_APPROVAL_REQUIRED" : "PREPARE_AND_OPTIONALLY_REVIEW";

    case "normal":
      if (AUTO_EXECUTE_ACTIONS.has(ctx.action) && ctx.risk === "low") {
        return ctx.external_side_effect ? "EXECUTE_AND_NOTIFY" : "AUTO_EXECUTE";
      }
      if (ctx.risk === "high" || ctx.sensitivity === "sensitive") return "HUMAN_APPROVAL_REQUIRED";
      return "PREPARE_AND_OPTIONALLY_REVIEW";

    case "high_autonomy":
      if (ctx.risk === "high" || ctx.sensitivity === "sensitive") return "HUMAN_APPROVAL_REQUIRED";
      if (AUTO_EXECUTE_ACTIONS.has(ctx.action)) return ctx.external_side_effect ? "EXECUTE_AND_NOTIFY" : "AUTO_EXECUTE";
      return "EXECUTE_AND_NOTIFY";

    case "enterprise_autonomous":
      // Autonomy bounded by enterprise policy; only genuinely sensitive points gate.
      if (ctx.sensitivity === "sensitive" && ctx.risk !== "low") return "HUMAN_APPROVAL_REQUIRED";
      if (ctx.risk === "high") return "HUMAN_APPROVAL_REQUIRED";
      return "EXECUTE_AND_NOTIFY";
  }
}

export function requiresHumanApproval(d: ValidationDecision): boolean {
  return d === "HUMAN_APPROVAL_REQUIRED" || d === "BLOCK_AND_ESCALATE";
}
export function isExecutable(d: ValidationDecision): boolean {
  return d === "AUTO_EXECUTE" || d === "EXECUTE_AND_NOTIFY";
}
