// src/lib/cloneos/ai/cost-ledger/guards.ts
// B38C — Budget guard helpers. Converts ledger data to AiBudgetSnapshot format
// for use with evaluateAiCostShield() from cost-shield/decision.ts.

import type { AiCostLedger, AiCostLedgerQuery } from "./types";
import type { AiBudgetSnapshot } from "../cost-shield/types";

// ── Build budget snapshots from ledger for cost shield ────────────────────────
// Returns a set of AiBudgetSnapshot objects that can be passed to
// evaluateAiCostShield() via AiCostShieldContext.budget_snapshots.

export async function getLedgerBudgetSnapshots(
  ledger: AiCostLedger,
  query: AiCostLedgerQuery,
): Promise<AiBudgetSnapshot[]> {
  const { daily_remaining_cents, monthly_remaining_cents } =
    await ledger.getRemainingBudget(query);

  const dailyCap = query.daily_cap_cents ?? 300;
  const monthlyCap = query.monthly_cap_cents ?? 1000;

  const snapshots: AiBudgetSnapshot[] = [];

  // Global daily snapshot
  snapshots.push({
    scope: "global_daily",
    key: `global:${new Date().toISOString().slice(0, 10)}`,
    used_cents: dailyCap - daily_remaining_cents,
    max_cents: dailyCap,
    remaining_cents: daily_remaining_cents,
    exceeded: daily_remaining_cents <= 0,
  });

  // Global monthly snapshot
  snapshots.push({
    scope: "global_monthly",
    key: `global:${new Date().toISOString().slice(0, 7)}`,
    used_cents: monthlyCap - monthly_remaining_cents,
    max_cents: monthlyCap,
    remaining_cents: monthly_remaining_cents,
    exceeded: monthly_remaining_cents <= 0,
  });

  // Company-scoped snapshot if company_id provided
  if (query.company_id) {
    const today = new Date().toISOString().slice(0, 10);
    const companyCap = query.daily_cap_cents ?? 100;
    const companyRemaining = daily_remaining_cents;

    snapshots.push({
      scope: "company_daily",
      key: `company:${query.company_id}:${today}`,
      used_cents: companyCap - companyRemaining,
      max_cents: companyCap,
      remaining_cents: companyRemaining,
      exceeded: companyRemaining <= 0,
    });
  }

  return snapshots;
}

// ── Quick check: is any budget exceeded? ──────────────────────────────────────

export async function isBudgetExceeded(
  ledger: AiCostLedger,
  query: AiCostLedgerQuery,
): Promise<boolean> {
  const snapshots = await getLedgerBudgetSnapshots(ledger, query);
  return snapshots.some((s) => s.exceeded);
}
