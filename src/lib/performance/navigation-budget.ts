// src/lib/performance/navigation-budget.ts
// B31.6 — Navigation latency classification helpers. Pure, no side-effects.

export type NavigationLatencyClass = "instant" | "acceptable" | "slow" | "critical";

const BUDGET_MS = {
  instant: 100,
  acceptable: 800,
  slow: 1500,
  critical: 3000,
} as const;

export function classifyNavigationLatency(ms: number): NavigationLatencyClass {
  if (ms < BUDGET_MS.instant) return "instant";
  if (ms < BUDGET_MS.acceptable) return "acceptable";
  if (ms < BUDGET_MS.critical) return "slow";
  return "critical";
}

export function assertNavigationBudget(ms: number): boolean {
  return ms < BUDGET_MS.critical;
}

export function assertUiInstant(ms: number): boolean {
  return ms < BUDGET_MS.instant;
}

export function assertCheckoutBudget(ms: number): boolean {
  return ms < BUDGET_MS.acceptable;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export { BUDGET_MS };
