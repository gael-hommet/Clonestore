// src/lib/pierre/v1/cognitive-runtime/autonomy-policy.ts
// PHASE 8.14 — autonomy classification for cognitive plan steps. REUSES the existing, fail-closed
// decideValidation + evaluateGuard (the LLM can never override them). Maps each step to one of the three
// cognitive modes the owner defined (§12): AUTONOMOUS / CONFIRMATION_REQUIRED / HUMAN_DECISION_REQUIRED.

import { decideValidation, requiresHumanApproval, isExecutable, type ActionKind, type AutonomyMode, type RiskLevel, type Sensitivity } from "../autonomy";
import { evaluateGuard } from "../cloneguard";
import type { PierreCognitiveMode } from "./types";

export type StepAutonomyInput = {
  readonly action: ActionKind;
  readonly risk: RiskLevel;
  readonly sensitivity: Sensitivity;
  readonly externalSideEffect: boolean;
  readonly objective: string;
  readonly mode: AutonomyMode;
};

export type StepAutonomyDecision = {
  readonly mode: PierreCognitiveMode;
  readonly guardLevel: string;
  readonly requiresApproval: boolean;
  readonly executableNow: boolean;
  readonly reason: string;
};

/** Classify one step. Human-only / restricted / guard-black ALWAYS resolve to HUMAN_DECISION_REQUIRED. */
export function classifyStepAutonomy(input: StepAutonomyInput): StepAutonomyDecision {
  const guard = evaluateGuard({ action: input.action, risk: input.risk, sensitivity: input.sensitivity, text: input.objective });
  const decision = decideValidation({ mode: input.mode, action: input.action, risk: input.risk, sensitivity: input.sensitivity, external_side_effect: input.externalSideEffect });

  // Guard black (prohibited) or block-and-escalate → a human must decide; Pierre only prepares.
  if (!guard.allow && guard.level === "black") {
    return { mode: "HUMAN_DECISION_REQUIRED", guardLevel: guard.level, requiresApproval: true, executableNow: false, reason: "guard_black" };
  }
  if (decision === "BLOCK_AND_ESCALATE") {
    return { mode: "HUMAN_DECISION_REQUIRED", guardLevel: guard.level, requiresApproval: true, executableNow: false, reason: "block_and_escalate" };
  }
  if (requiresHumanApproval(decision) || guard.requires_approval) {
    // sensitive/approval-required actions are confirmation/human-decision, never autonomous
    const humanOnly = input.sensitivity === "restricted";
    return {
      mode: humanOnly ? "HUMAN_DECISION_REQUIRED" : "CONFIRMATION_REQUIRED",
      guardLevel: guard.level, requiresApproval: true, executableNow: false,
      reason: humanOnly ? "restricted_human_only" : "approval_required",
    };
  }
  if (isExecutable(decision)) {
    return { mode: "AUTONOMOUS", guardLevel: guard.level, requiresApproval: false, executableNow: true, reason: decision };
  }
  // prepare_and_optionally_review → confirmation before any external effect
  return { mode: "CONFIRMATION_REQUIRED", guardLevel: guard.level, requiresApproval: false, executableNow: false, reason: decision };
}
