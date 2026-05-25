// src/lib/cloneos/ai/cost-shield/budget-ledger.ts
// B38A — In-memory budget ledger. Pure, no async, no DB.
// Used in tests and as reference implementation for B38B (Supabase persistence).
// For production, replace with DB-backed implementation in B38B.

import type { AiBudgetLedgerEntry, AiBudgetScopeKind, AiCostShieldProvider } from "./types";

// ── Ledger interface ──────────────────────────────────────────────────────────

export type AiBudgetLedger = {
  recordEstimatedUsage(entry: Omit<AiBudgetLedgerEntry, "id" | "created_at">): AiBudgetLedgerEntry;
  recordActualUsage(id: string, actualCents: number, actualInputTokens: number, actualOutputTokens: number): void;
  sumUsageForScope(scope: AiBudgetScopeKind, key: string, sinceIso?: string): number;
  getRemainingBudget(scope: AiBudgetScopeKind, key: string, maxCents: number, sinceIso?: string): number;
  getEntries(): AiBudgetLedgerEntry[];
  clear(): void;
};

// ── Key builders for each scope ───────────────────────────────────────────────

function scopeKey(scope: AiBudgetScopeKind, entry: AiBudgetLedgerEntry): string {
  const today = entry.created_at.slice(0, 10); // YYYY-MM-DD
  const month = entry.created_at.slice(0, 7);  // YYYY-MM
  switch (scope) {
    case "global_daily":       return `global:${today}`;
    case "global_monthly":     return `global:${month}`;
    case "company_daily":      return `company:${entry.company_id ?? "_"}:${today}`;
    case "company_monthly":    return `company:${entry.company_id ?? "_"}:${month}`;
    case "user_daily":         return `user:${entry.user_id ?? "_"}:${today}`;
    case "user_monthly":       return `user:${entry.user_id ?? "_"}:${month}`;
    case "mission":            return `mission:${entry.metadata?.mission_id as string | undefined ?? "_"}`;
    case "task":               return `task:${entry.metadata?.task_id as string | undefined ?? "_"}`;
    case "model_daily":        return `model:${entry.model}:${today}`;
    case "premium_model_daily": return `premium_model:${entry.model}:${today}`;
  }
}

// ── In-memory implementation ──────────────────────────────────────────────────

let _idCounter = 0;

function generateId(): string {
  return `ledger_${Date.now()}_${++_idCounter}`;
}

export function createInMemoryAiBudgetLedger(): AiBudgetLedger {
  const entries: AiBudgetLedgerEntry[] = [];

  return {
    recordEstimatedUsage(data) {
      const entry: AiBudgetLedgerEntry = {
        ...data,
        id: generateId(),
        created_at: data.metadata?.created_at_override as string | undefined ?? new Date().toISOString(),
      };
      entries.push(entry);
      return entry;
    },

    recordActualUsage(id, actualCents, actualInputTokens, actualOutputTokens) {
      const entry = entries.find((e) => e.id === id);
      if (entry) {
        entry.actual_cost_cents = Math.max(0, actualCents);
        entry.input_tokens = actualInputTokens;
        entry.output_tokens = actualOutputTokens;
        entry.status = "actual";
      }
    },

    sumUsageForScope(scope, key, sinceIso) {
      return entries
        .filter((e) => {
          if (e.status === "blocked" || e.status === "mock") return false;
          if (sinceIso && e.created_at < sinceIso) return false;
          return scopeKey(scope, e) === key;
        })
        .reduce((sum, e) => {
          // Use actual_cost_cents if available, otherwise estimated
          const cost = e.status === "actual" ? e.actual_cost_cents : e.estimated_cost_cents;
          return sum + Math.max(0, cost);
        }, 0);
    },

    getRemainingBudget(scope, key, maxCents, sinceIso) {
      const used = this.sumUsageForScope(scope, key, sinceIso);
      return Math.max(0, maxCents - used);
    },

    getEntries() {
      return [...entries];
    },

    clear() {
      entries.length = 0;
    },
  };
}

// ── Scope key builder for external use ───────────────────────────────────────

export function buildScopeKey(
  scope: AiBudgetScopeKind,
  options: {
    company_id?: string | null;
    user_id?: string | null;
    mission_id?: string | null;
    task_id?: string | null;
    model?: string;
    date?: string; // YYYY-MM-DD, defaults to today
    month?: string; // YYYY-MM, defaults to current month
  },
): string {
  const today = options.date ?? new Date().toISOString().slice(0, 10);
  const month = options.month ?? new Date().toISOString().slice(0, 7);

  switch (scope) {
    case "global_daily":       return `global:${today}`;
    case "global_monthly":     return `global:${month}`;
    case "company_daily":      return `company:${options.company_id ?? "_"}:${today}`;
    case "company_monthly":    return `company:${options.company_id ?? "_"}:${month}`;
    case "user_daily":         return `user:${options.user_id ?? "_"}:${today}`;
    case "user_monthly":       return `user:${options.user_id ?? "_"}:${month}`;
    case "mission":            return `mission:${options.mission_id ?? "_"}`;
    case "task":               return `task:${options.task_id ?? "_"}`;
    case "model_daily":        return `model:${options.model ?? "_"}:${today}`;
    case "premium_model_daily": return `premium_model:${options.model ?? "_"}:${today}`;
  }
}

// ── Utility: build an entry for a provider usage ──────────────────────────────

export function buildLedgerEntryInput(params: {
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  provider: AiCostShieldProvider;
  model: string;
  use_case: string;
  estimated_cost_cents: number;
  decision_status: AiBudgetLedgerEntry["decision_status"];
  metadata?: Record<string, unknown>;
}): Omit<AiBudgetLedgerEntry, "id" | "created_at"> {
  return {
    company_id: params.company_id,
    user_id: params.user_id,
    agent_slug: params.agent_slug,
    provider: params.provider,
    model: params.model,
    use_case: params.use_case,
    estimated_cost_cents: Math.max(0, params.estimated_cost_cents),
    actual_cost_cents: 0,
    input_tokens: 0,
    output_tokens: 0,
    status: params.decision_status === "allow" ? "estimated" : "blocked",
    decision_status: params.decision_status,
    metadata: params.metadata ?? {},
  };
}
