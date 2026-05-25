// src/lib/cloneos/ai/live-validation/cost-report.ts
// B38B — Cost tracking. Pure, no async.

import type { LiveValidationResult } from "./types";

export type CostTracker = {
  total_estimated_cents: number;
  per_scenario: Map<string, number>;
  add(scenarioId: string, costCents: number): void;
  exceedsCap(capCents: number): boolean;
  remainingCents(capCents: number): number;
};

export function createCostTracker(): CostTracker {
  return {
    total_estimated_cents: 0,
    per_scenario: new Map(),

    add(scenarioId: string, costCents: number): void {
      this.total_estimated_cents += costCents;
      this.per_scenario.set(scenarioId, (this.per_scenario.get(scenarioId) ?? 0) + costCents);
    },

    exceedsCap(capCents: number): boolean {
      return this.total_estimated_cents > capCents;
    },

    remainingCents(capCents: number): number {
      return Math.max(0, capCents - this.total_estimated_cents);
    },
  };
}

export function formatCostCents(cents: number): string {
  if (!Number.isFinite(cents)) return "0.0000¢";
  if (cents < 0.01) return `${cents.toFixed(4)}¢`;
  if (cents < 1) return `${cents.toFixed(3)}¢`;
  return `${cents.toFixed(2)}¢`;
}

export function formatCostEuros(cents: number): string {
  const euros = (cents / 100) * 0.92;
  if (euros < 0.0001) return "<0.0001€";
  return `${euros.toFixed(4)}€`;
}

export function summarizeCosts(results: LiveValidationResult[]): {
  total_estimated: number;
  total_actual: number;
  per_scenario: Array<{ id: string; name: string; estimated: number; actual: number }>;
} {
  return {
    total_estimated: results.reduce((s, r) => s + r.estimated_cost_cents, 0),
    total_actual: results.reduce((s, r) => s + r.actual_cost_cents, 0),
    per_scenario: results.map((r) => ({
      id: r.scenario_id,
      name: r.scenario_name,
      estimated: r.estimated_cost_cents,
      actual: r.actual_cost_cents,
    })),
  };
}
