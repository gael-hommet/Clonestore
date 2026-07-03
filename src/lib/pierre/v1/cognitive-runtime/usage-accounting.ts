// src/lib/pierre/v1/cognitive-runtime/usage-accounting.ts
// PHASE 8.14 — cost governance for cognitive work. REUSES the atomic cloneos budget gate (checkBudget /
// checkSingleCallBudget) — no new budgeting engine — and adds a per-mission usage record so token/cost is
// attributable to the mission/task that spent it (the audit found accounting existed but was not wired to
// the Pierre runtime). Persisting the record is the caller's job (via the existing durable stores).

import { checkSingleCallBudget, getBudgetConfig } from "../../../cloneos/ai/budgets";

export type CognitiveUsageRecord = {
  readonly companyId: string;
  readonly missionId: string | null;
  readonly taskId: string | null;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCents: number;
  readonly atIso: string;
};

export function buildCognitiveUsageRecord(p: {
  companyId: string; missionId?: string | null; taskId?: string | null; model: string;
  inputTokens: number; outputTokens: number; estimatedCents: number; atIso: string;
}): CognitiveUsageRecord {
  return {
    companyId: p.companyId, missionId: p.missionId ?? null, taskId: p.taskId ?? null, model: p.model,
    inputTokens: Math.max(0, p.inputTokens), outputTokens: Math.max(0, p.outputTokens),
    estimatedCents: Math.max(0, p.estimatedCents), atIso: p.atIso,
  };
}

/** Atomic pre-call gate — reuse the real single-call budget check. */
export function allowCognitiveCall(estimatedCents: number): { allowed: boolean; reason: string } {
  const d = checkSingleCallBudget(estimatedCents);
  return { allowed: d.allowed, reason: d.reason ?? (d.allowed ? "within_budget" : "budget_exceeded") };
}

export { getBudgetConfig };
