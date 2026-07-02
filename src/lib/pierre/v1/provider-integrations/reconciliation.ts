// src/lib/pierre/v1/provider-integrations/reconciliation.ts
// PHASE 8.12 — reconcile a provider (or manual) return into the mission. Idempotent; an ambiguous
// return is never treated as success (mirrors the P8.11 hr-operations reconciliation contract).
export type ProviderReturn = "success" | "failure" | "ambiguous" | "rejected";
export type ProviderReconcileResult = { apply: boolean; terminal: boolean; status: "reconciled" | "blocked" | "retry"; note: string };

export function reconcileProvider(input: { outcome: ProviderReturn; alreadyReconciled: boolean }): ProviderReconcileResult {
  if (input.alreadyReconciled) return { apply: false, terminal: true, status: "reconciled", note: "idempotent: already reconciled" };
  switch (input.outcome) {
    case "success": return { apply: true, terminal: true, status: "reconciled", note: "provider/manual success applied" };
    case "rejected": return { apply: true, terminal: true, status: "blocked", note: "return rejected → blocked for review" };
    case "failure": return { apply: false, terminal: false, status: "retry", note: "failure → retry/backoff/dead-letter (runtime)" };
    case "ambiguous": return { apply: false, terminal: false, status: "blocked", note: "ambiguous → manual reconciliation (never blind success)" };
  }
}
