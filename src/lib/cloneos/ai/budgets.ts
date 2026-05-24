// src/lib/cloneos/ai/budgets.ts
// B32 — Budget enforcement. Pure, no DB, no async.
// Callers pass used_cents (read from DB/cache); this module decides allow/block.
// To enforce cumulative budgets, connect to ai_usage_logs table (see docs/sql/ai_usage_logs.sql).

import type { AiBudgetScope, AiBudgetDecision } from "./types";

// ── Default budget config (env-driven) ───────────────────────────────────────

type BudgetConfig = {
  daily_cents: number;
  monthly_cents: number;
  single_call_max_cents: number;
};

function getEnvCents(key: string, fallback: number): number {
  try {
    const raw = process.env[key];
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function getBudgetConfig(): BudgetConfig {
  return {
    daily_cents: getEnvCents("AI_DEFAULT_DAILY_BUDGET_CENTS", 500),    // $5/day default
    monthly_cents: getEnvCents("AI_DEFAULT_MONTHLY_BUDGET_CENTS", 10000), // $100/month default
    single_call_max_cents: getEnvCents("AI_SINGLE_CALL_MAX_CENTS", 100),  // $1/call hard cap
  };
}

// ── Core budget check ─────────────────────────────────────────────────────────

export function checkBudget(
  scope: AiBudgetScope,
  estimatedCents: number,
): AiBudgetDecision {
  const safeCost = typeof estimatedCents === "number" && estimatedCents >= 0
    ? estimatedCents
    : 0;

  if (!scope || typeof scope.max_cents !== "number" || scope.max_cents <= 0) {
    return {
      allowed: true,
      reason: "No budget limit configured — allowed.",
      remaining_cents: Infinity,
      estimated_cost_cents: safeCost,
    };
  }

  const used = typeof scope.used_cents === "number" && scope.used_cents >= 0
    ? scope.used_cents
    : 0;

  const remaining = Math.max(0, scope.max_cents - used);

  if (safeCost > remaining) {
    return {
      allowed: false,
      reason: `Budget ${scope.period} dépassé pour "${scope.agent_slug}". Utilisé: ${used.toFixed(2)}¢ / ${scope.max_cents.toFixed(2)}¢. Requis: ${safeCost.toFixed(4)}¢.`,
      remaining_cents: remaining,
      estimated_cost_cents: safeCost,
    };
  }

  return {
    allowed: true,
    reason: `Budget ${scope.period} OK. Restant: ${(remaining - safeCost).toFixed(2)}¢.`,
    remaining_cents: remaining - safeCost,
    estimated_cost_cents: safeCost,
  };
}

export function checkSingleCallBudget(estimatedCents: number): AiBudgetDecision {
  const config = getBudgetConfig();
  const scope: AiBudgetScope = {
    agent_slug: "global",
    period: "daily",
    max_cents: config.single_call_max_cents,
    used_cents: 0,
  };
  return checkBudget(scope, estimatedCents);
}

export function buildDefaultScope(
  agentSlug: string,
  period: "daily" | "monthly",
  usedCents: number,
): AiBudgetScope {
  const config = getBudgetConfig();
  const max = period === "daily" ? config.daily_cents : config.monthly_cents;
  return {
    agent_slug: agentSlug,
    period,
    max_cents: max,
    used_cents: typeof usedCents === "number" && usedCents >= 0 ? usedCents : 0,
  };
}
