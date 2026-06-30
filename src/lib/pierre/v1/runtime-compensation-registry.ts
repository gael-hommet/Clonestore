// src/lib/pierre/v1/runtime-compensation-registry.ts
// PHASE 8.5-R4 §R4.13 — the canonical, CLOSED compensation registry. Each externally-effecting action
// declares HONESTLY what can and can NOT be undone: a communication that is only queued can be cancelled
// via P8.4, but a submitted/delivered one is irreversible and is never pretended-undone; a prepared (not
// submitted) signature can be cancelled via P8.3, a completed one never. A compensation never deletes a
// signed document or a decided validation's history. There is no generic "rollback everything".

export type EffectKind = "none" | "local" | "external_idempotent" | "external_irreversible";

export type CompensationRule = {
  actionKey: string;
  effectKind: EffectKind;
  /** states from which a governed compensation is possible (e.g. cancel the queued delivery). */
  compensatableStates: string[];
  /** states that are IRREVERSIBLE — the effect already left the system; never claim it was undone. */
  irreversibleStates: string[];
  requiresApproval: boolean;
  safeSummary: string;
};

const REGISTRY: Record<string, CompensationRule> = {
  "communication.create_intent": {
    actionKey: "communication.create_intent", effectKind: "external_idempotent",
    compensatableStates: ["queued", "scheduled", "retry_scheduled"],
    irreversibleStates: ["submitted", "delivered", "bounced", "complained"],
    requiresApproval: false,
    safeSummary: "A queued/scheduled communication can be cancelled via the P8.4 governed cancel; once submitted or delivered it is irreversible.",
  },
  "follow_up.schedule": {
    actionKey: "follow_up.schedule", effectKind: "local",
    compensatableStates: ["active", "paused"], irreversibleStates: [], requiresApproval: false,
    safeSummary: "An active follow-up schedule is cancelled via the governed schedule cancel; it has no external effect.",
  },
  "signature.prepare": {
    actionKey: "signature.prepare", effectKind: "external_irreversible",
    compensatableStates: ["ready_for_signature", "prepared_not_submitted", "submitted"],
    irreversibleStates: ["completed"], requiresApproval: true,
    safeSummary: "A prepared (not submitted) signature is cancelled via P8.3; a submitted one only if the P8.3 policy allows; a completed signature is irreversible.",
  },
  "document.generate": {
    actionKey: "document.generate", effectKind: "local",
    compensatableStates: ["draft"], irreversibleStates: ["final", "signed"], requiresApproval: false,
    safeSummary: "A draft document is archived/cancelled per policy; a finalized/signed document or its evidence is NEVER deleted.",
  },
  "approval.request": {
    actionKey: "approval.request", effectKind: "local",
    compensatableStates: ["pending"], irreversibleStates: ["approved", "rejected", "changes_requested"], requiresApproval: false,
    safeSummary: "A pending validation is cancelled; a decided validation's history is preserved (immutable).",
  },
};

export function getCompensationRule(actionKey: string): CompensationRule | null {
  return REGISTRY[actionKey] ?? null;
}
export function isCompensatable(actionKey: string, state: string): boolean {
  const r = REGISTRY[actionKey];
  return !!r && r.compensatableStates.includes(state) && !r.irreversibleStates.includes(state);
}
export function isIrreversible(actionKey: string, state: string): boolean {
  const r = REGISTRY[actionKey];
  return !!r && r.irreversibleStates.includes(state);
}
export function allCompensationRules(): CompensationRule[] {
  return Object.values(REGISTRY);
}
