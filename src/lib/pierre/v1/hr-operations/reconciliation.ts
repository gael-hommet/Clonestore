// src/lib/pierre/v1/hr-operations/reconciliation.ts
// PHASE 8.11 — reconcile an external/human return into the case. Governed + idempotent: the same
// return applied twice yields one effect. Pure — the runtime persists; this decides the outcome.

export type ReturnOutcome = "success" | "failure" | "ambiguous" | "rejected";
export type ReconcileInput = { stepKey: string; correlationId: string; outcome: ReturnOutcome; alreadyReconciled: boolean };
export type ReconcileResult = { apply: boolean; nextEvent: "reconciled" | "external_returned" | "human_recorded" | "blocked"; note: string };

export function reconcile(input: ReconcileInput): ReconcileResult {
  if (input.alreadyReconciled) return { apply: false, nextEvent: "reconciled", note: "idempotent: already reconciled" };
  switch (input.outcome) {
    case "success": return { apply: true, nextEvent: "reconciled", note: "external/human success applied" };
    case "rejected": return { apply: true, nextEvent: "blocked", note: "return rejected → case blocked for review" };
    case "failure": return { apply: true, nextEvent: "blocked", note: "return failed → retry/dead-letter governed by runtime" };
    case "ambiguous": return { apply: false, nextEvent: "blocked", note: "ambiguous return → manual reconciliation (never blind success)" };
  }
}
