// src/lib/pierre/v1/hr-canon/country-packs/source-freshness.ts
// PHASE 8.12 — freshness policy for sourced legal content. Legal texts change; a VERIFIED rule whose
// source snapshot is older than its family's max age becomes STALE and must be re-sourced/re-reviewed
// before it can authorize a sensitive act. Pure — `now` is supplied, never invented.

export type FreshnessPolicy = { ruleFamily: string; maxAgeDays: number };

// Conservative defaults: contribution/wage figures change yearly; procedures less often. These are
// REVIEW cadences, not legal values.
export const DEFAULT_MAX_AGE_DAYS: Record<string, number> = {
  payroll_contributions: 180, minimum_wage: 180, paid_leave: 365, public_holidays: 365,
  sick_leave: 365, parental_leave: 365, notice_periods: 365, dismissal_procedure: 365,
  severance: 365, working_time: 365, contract_types: 730, fixed_term_rules: 730,
  probation_periods: 730, data_protection: 365, document_retention: 730, disciplinary_procedure: 730,
  occupational_health: 365, mandatory_trainings: 365, collective_agreements: 365,
  right_to_work: 365, employee_representation: 730, payslip_requirements: 365, non_compete: 730,
};
export function maxAgeDaysFor(ruleFamily: string): number { return DEFAULT_MAX_AGE_DAYS[ruleFamily] ?? 365; }

export type FreshnessResult = { fresh: boolean; ageDays: number; maxAgeDays: number; reason: string };

/** Evaluate freshness of a retrieved-at time against a rule family's policy. */
export function evaluateFreshness(ruleFamily: string, retrievedAt: string | null, nowIso: string): FreshnessResult {
  const maxAgeDays = maxAgeDaysFor(ruleFamily);
  if (!retrievedAt) return { fresh: false, ageDays: Infinity, maxAgeDays, reason: "never retrieved" };
  const ms = Date.parse(nowIso) - Date.parse(retrievedAt);
  const ageDays = Math.floor(ms / 86400000);
  return { fresh: ageDays <= maxAgeDays, ageDays, maxAgeDays, reason: ageDays <= maxAgeDays ? "fresh" : `stale (${ageDays}d > ${maxAgeDays}d)` };
}
