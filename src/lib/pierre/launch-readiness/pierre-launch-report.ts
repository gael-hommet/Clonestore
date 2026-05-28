// B48 — Pierre Launch Report
// Full report combining verdict, checks, scenarios, and legal status.
// Pure: no Supabase, no Next, no async. No throw.

import { buildPierreFinalLaunchVerdict } from "./pierre-launch-verdict";
import { getPierreLaunchChecks, getPierreLaunchChecksSummary } from "./pierre-launch-checks";
import { getAllPierreLaunchScenarios, getPierreLaunchScenariosSummary } from "./pierre-launch-scenarios";
import { buildPierreLegalVerdict } from "../legal/pierre-legal-verdict";

export type PierreLaunchReport = {
  verdict: ReturnType<typeof buildPierreFinalLaunchVerdict>;
  checks_summary: ReturnType<typeof getPierreLaunchChecksSummary>;
  scenarios_summary: ReturnType<typeof getPierreLaunchScenariosSummary>;
  legal_verdict_score: number;
  legal_modules_covered: number;
  hard_limits_count: number;
  forbidden_claims_count: number;
  allowed_claims_count: number;
  generated_at: string;
};

export function buildPierreLaunchReport(
  legalReviewManuallyDone = false
): PierreLaunchReport {
  const verdict = buildPierreFinalLaunchVerdict(legalReviewManuallyDone);
  const checksSummary = getPierreLaunchChecksSummary();
  const scenariosSummary = getPierreLaunchScenariosSummary();
  const legalVerdict = buildPierreLegalVerdict();

  return {
    verdict,
    checks_summary: checksSummary,
    scenarios_summary: scenariosSummary,
    legal_verdict_score: legalVerdict.score_0_to_100,
    legal_modules_covered: legalVerdict.covered_modules.length,
    hard_limits_count: legalVerdict.hard_limits.length,
    forbidden_claims_count: legalVerdict.capabilities_summary.forbidden_commercial_claims,
    allowed_claims_count: legalVerdict.capabilities_summary.safe_commercial_claims,
    generated_at: new Date().toISOString(),
  };
}

export function getPierreLaunchReportSummary(): {
  status: string;
  is_safe_for_demo: boolean;
  is_safe_for_paid_customers: boolean;
  legal_score: number;
  blocking_count: number;
  scenarios_total: number;
} {
  const report = buildPierreLaunchReport(false);
  return {
    status: report.verdict.status,
    is_safe_for_demo: report.verdict.is_safe_for_demo,
    is_safe_for_paid_customers: report.verdict.is_safe_for_paid_customers,
    legal_score: report.legal_verdict_score,
    blocking_count: report.verdict.blocking_items.length,
    scenarios_total: report.scenarios_summary.total,
  };
}

export { getAllPierreLaunchScenarios } from "./pierre-launch-scenarios";
export { getPierreLaunchChecks } from "./pierre-launch-checks";
