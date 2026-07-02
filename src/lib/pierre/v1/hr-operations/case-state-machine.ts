// src/lib/pierre/v1/hr-operations/case-state-machine.ts
// PHASE 8.11 — the governed case state machine. Pure + deterministic: given a state and an event,
// it returns the next legal state (or refuses). It encodes the anti-improvisation lifecycle every
// mission pack runs through and forbids illegal jumps (e.g. cannot complete while awaiting approval).

import type { CaseState } from "./case-types";
import { isTerminal } from "./case-types";

export type CaseEvent =
  | "subject_resolved" | "info_collected" | "plan_built" | "step_executed"
  | "approval_requested" | "approval_granted" | "approval_rejected"
  | "human_requested" | "human_recorded"
  | "external_requested" | "external_returned" | "reconciled"
  | "completed" | "blocked" | "cancelled";

// Allowed transitions. Anything not listed is refused (fail-closed).
const TRANSITIONS: Record<CaseState, Partial<Record<CaseEvent, CaseState>>> = {
  intake: { subject_resolved: "resolving_subject", cancelled: "cancelled", blocked: "blocked" },
  resolving_subject: { info_collected: "collecting", blocked: "blocked", cancelled: "cancelled" },
  collecting: { plan_built: "planning", blocked: "blocked", cancelled: "cancelled" },
  planning: { step_executed: "executing", approval_requested: "awaiting_approval", human_requested: "awaiting_human", external_requested: "awaiting_external", blocked: "blocked", cancelled: "cancelled" },
  executing: { approval_requested: "awaiting_approval", human_requested: "awaiting_human", external_requested: "awaiting_external", step_executed: "executing", completed: "completed", blocked: "blocked", cancelled: "cancelled" },
  awaiting_approval: { approval_granted: "executing", approval_rejected: "blocked", cancelled: "cancelled" },
  awaiting_human: { human_recorded: "executing", cancelled: "cancelled", blocked: "blocked" },
  awaiting_external: { external_returned: "reconciling", blocked: "blocked", cancelled: "cancelled" },
  reconciling: { reconciled: "executing", step_executed: "executing", completed: "completed", blocked: "blocked", cancelled: "cancelled" },
  completed: {},
  blocked: { info_collected: "collecting", approval_granted: "executing", human_recorded: "executing", external_returned: "reconciling", cancelled: "cancelled" },
  cancelled: {},
};

export type TransitionResult = { ok: boolean; next: CaseState; error?: string };

export function transition(state: CaseState, event: CaseEvent): TransitionResult {
  if (isTerminal(state)) return { ok: false, next: state, error: `case is terminal (${state})` };
  const next = TRANSITIONS[state]?.[event];
  if (!next) return { ok: false, next: state, error: `illegal transition ${state} --${event}--> ?` };
  return { ok: true, next };
}

export function legalEvents(state: CaseState): CaseEvent[] {
  return Object.keys(TRANSITIONS[state] ?? {}) as CaseEvent[];
}
