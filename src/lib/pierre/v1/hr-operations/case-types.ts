// src/lib/pierre/v1/hr-operations/case-types.ts
// PHASE 8.11 — an HR "case" is a running instance of a mission pack. These types describe a case's
// governed lifecycle. A case never executes anything itself — it is the durable state that the
// verified runtime (missions/tasks/queue/approvals) advances; this layer is the pure orchestration.

export type CaseState =
  | "intake" | "resolving_subject" | "collecting" | "planning" | "executing"
  | "awaiting_approval" | "awaiting_human" | "awaiting_external" | "reconciling"
  | "completed" | "blocked" | "cancelled";

export type CaseTransition = { from: CaseState; to: CaseState; reason: string };

export type HrCase = {
  caseId: string;
  packId: string;
  companyId: string;
  subjectRef: string | null;   // resolved subject (opaque ref; never raw PII here)
  state: CaseState;
  completedStepKeys: string[];
  blockedReason: string | null;
  correlationId: string;
};

export const TERMINAL_STATES: readonly CaseState[] = ["completed", "cancelled"];
export function isTerminal(s: CaseState): boolean { return TERMINAL_STATES.includes(s); }
