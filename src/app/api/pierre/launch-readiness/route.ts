// B48 — Pierre Launch Readiness Route
// GET /api/pierre/launch-readiness
// Returns the B48 Pierre-specific launch readiness verdict.
// No Supabase required — pure computation.

import { NextRequest, NextResponse } from "next/server";
import { buildPierreLaunchReport, getPierreLaunchReportSummary } from "../../../../lib/pierre/launch-readiness/pierre-launch-report";
import { buildPierreFinalLaunchVerdict } from "../../../../lib/pierre/launch-readiness/pierre-launch-verdict";
import { getAllPierreLaunchScenarios, getPierreLaunchScenariosSummary } from "../../../../lib/pierre/launch-readiness/pierre-launch-scenarios";
import { getPierreLaunchChecks } from "../../../../lib/pierre/launch-readiness/pierre-launch-checks";

function asBool(v: string | null): boolean {
  return v === "true" || v === "1";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const legalReviewDone = asBool(searchParams.get("legal_review_done"));

  const report = buildPierreLaunchReport(legalReviewDone);
  const summary = getPierreLaunchReportSummary();
  const verdict = buildPierreFinalLaunchVerdict(legalReviewDone);
  const scenariosSummary = getPierreLaunchScenariosSummary();
  const scenarios = getAllPierreLaunchScenarios();
  const checks = getPierreLaunchChecks();

  return NextResponse.json({
    ok: true,
    verdict,
    summary,
    checks: checks.map((c) => ({
      id: c.id,
      label: c.label,
      ok: c.ok,
      blocking: c.blocking,
      notes: c.notes,
    })),
    scenarios_summary: scenariosSummary,
    scenarios: scenarios.map((s) => ({
      id: s.id,
      label: s.label,
      category: s.category,
      expected_outcome: s.expected_outcome,
      expected_ok: s.expected_ok,
    })),
    legal: {
      score: report.legal_verdict_score,
      modules_covered: report.legal_modules_covered,
      hard_limits_count: report.hard_limits_count,
      forbidden_claims_count: report.forbidden_claims_count,
      allowed_claims_count: report.allowed_claims_count,
    },
    meta: {
      bloc: "B48",
      evaluatedAt: report.generated_at,
      route: "/api/pierre/launch-readiness",
      legal_review_done: legalReviewDone,
    },
  });
}
