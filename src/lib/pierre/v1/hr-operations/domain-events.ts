// src/lib/pierre/v1/hr-operations/domain-events.ts
// PHASE 8.11 — typed HR domain events a case emits across its lifecycle. These map to the verified
// runtime's audit/event bus; here they are the canonical, PII-free event shapes for a case.

export type HrDomainEventType =
  | "case.opened" | "subject.resolved" | "info.collected" | "plan.built"
  | "step.executed" | "approval.requested" | "approval.decided"
  | "human.routed" | "human.recorded" | "external.handoff" | "external.reconciled"
  | "artifact.produced" | "communication.sent" | "mutation.applied"
  | "signal.armed" | "case.completed" | "case.blocked" | "case.cancelled";

export type HrDomainEvent = {
  type: HrDomainEventType;
  caseId: string;
  packId: string;
  stepKey?: string;
  at: string;          // ISO instant supplied by the caller (never invented here)
  detail?: string;     // PII-free
};

export function makeEvent(type: HrDomainEventType, caseId: string, packId: string, at: string, extra: { stepKey?: string; detail?: string } = {}): HrDomainEvent {
  return { type, caseId, packId, at, stepKey: extra.stepKey, detail: extra.detail };
}

/** The audit trail a completed case must contain at minimum (for completion evidence). */
export const REQUIRED_CASE_EVENTS: readonly HrDomainEventType[] = ["case.opened", "subject.resolved", "plan.built"];
export function hasRequiredEvents(events: HrDomainEvent[]): boolean {
  const types = new Set(events.map((e) => e.type));
  return REQUIRED_CASE_EVENTS.every((t) => types.has(t));
}
