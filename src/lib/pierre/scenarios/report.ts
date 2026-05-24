// src/lib/pierre/scenarios/report.ts
// Pierre Golden Scenarios — Executive Report Builder
// Bloc 29: transforms suite results into sellable-proof report.
// Pure module: no async, no Supabase, no Next, no side effects.

import type {
  PierreGoldenScenarioSuiteResult,
  PierreGoldenScenarioReport,
  PierreGoldenScenarioReportLevel,
} from "./types";

// ══════════════════════════════════════════════════════════════
// 1. SCORE COMPUTATION
// ══════════════════════════════════════════════════════════════

function computeSuiteScore(suite: PierreGoldenScenarioSuiteResult): number {
  if (suite.scenarios_total === 0) return 0;
  const baseScore = (suite.scenarios_passed / suite.scenarios_total) * 100;
  const checkBonus =
    suite.checks_total > 0
      ? (suite.checks_passed / suite.checks_total) * 10
      : 0;
  return Math.min(100, Math.round(baseScore * 0.9 + checkBonus));
}

// ══════════════════════════════════════════════════════════════
// 2. LEVEL DETERMINATION
// ══════════════════════════════════════════════════════════════

function computeReportLevel(
  suite: PierreGoldenScenarioSuiteResult,
  score: number,
): PierreGoldenScenarioReportLevel {
  // Critical failures → blocked
  if (suite.critical_failures.length > 0) return "blocked";

  // All fail → blocked
  if (suite.suite_status === "all_fail") return "blocked";

  // Perfect run → sellable
  if (suite.scenarios_failed === 0 && suite.scenarios_warned === 0 && score >= 90) {
    return "sellable";
  }

  // No failures but some warnings → demo_ready
  if (suite.scenarios_failed === 0 && score >= 75) return "demo_ready";

  // Some failures but not critical → internal_only
  if (score >= 50) return "internal_only";

  return "blocked";
}

const LEVEL_LABELS: Record<PierreGoldenScenarioReportLevel, string> = {
  sellable: "Sellable — Prêt pour démo et vente",
  demo_ready: "Demo Ready — Prêt pour démo client",
  internal_only: "Internal Only — Validation interne requise",
  blocked: "Blocked — Non démontrable en l'état",
};

// ══════════════════════════════════════════════════════════════
// 3. HIGHLIGHTS & FINDINGS
// ══════════════════════════════════════════════════════════════

function extractPositiveHighlights(suite: PierreGoldenScenarioSuiteResult): string[] {
  const highlights: string[] = [];
  for (const result of suite.results) {
    if (result.status === "pass" && result.category === "positive") {
      highlights.push(
        `${result.label} — ${result.checks_passed}/${result.checks_total} checks OK`,
      );
    }
  }
  return highlights;
}

function extractNegativeFindings(suite: PierreGoldenScenarioSuiteResult): string[] {
  const findings: string[] = [];
  for (const result of suite.results) {
    if (result.status !== "pass") {
      const failedChecks = result.check_results
        .filter((c) => !c.passed)
        .map((c) => c.label)
        .slice(0, 2);
      findings.push(
        `${result.label} — ${result.checks_failed} check(s) échoué(s): ${failedChecks.join(", ")}`,
      );
    }
  }
  return findings;
}

// ══════════════════════════════════════════════════════════════
// 4. RECOMMENDATION
// ══════════════════════════════════════════════════════════════

function buildRecommendation(
  level: PierreGoldenScenarioReportLevel,
  suite: PierreGoldenScenarioSuiteResult,
  score: number,
): string {
  switch (level) {
    case "sellable":
      return `Pierre HR Engine validé à ${score}/100. Tous les scénarios critiques passent. Démo et vente client autorisées.`;
    case "demo_ready":
      return `Pierre HR Engine prêt pour démonstration (score ${score}/100). ${suite.scenarios_warned} scénario(s) avec avertissement. Démo interne et prospect autorisées.`;
    case "internal_only":
      return `Score ${score}/100. ${suite.scenarios_failed} scénario(s) échoué(s). Démonstration interne uniquement — corriger avant contact client.`;
    case "blocked":
      return `Score ${score}/100. ${suite.critical_failures.length} failure(s) critique(s). Pierre HR Engine non démontrable. Correction immédiate requise.`;
    default:
      return `Score ${score}/100. Vérification manuelle recommandée.`;
  }
}

// ══════════════════════════════════════════════════════════════
// 5. MAIN BUILD FUNCTION
// ══════════════════════════════════════════════════════════════

export function buildGoldenScenarioReport(
  suite: PierreGoldenScenarioSuiteResult,
): PierreGoldenScenarioReport {
  const score = computeSuiteScore(suite);
  const level = computeReportLevel(suite, score);
  const positive_highlights = extractPositiveHighlights(suite);
  const negative_findings = extractNegativeFindings(suite);
  const recommendation = buildRecommendation(level, suite, score);

  return {
    generated_at: suite.generated_at,
    level,
    level_label: LEVEL_LABELS[level],
    suite_status: suite.suite_status,
    score,
    scenarios_total: suite.scenarios_total,
    scenarios_passed: suite.scenarios_passed,
    scenarios_failed: suite.scenarios_failed,
    critical_failures: suite.critical_failures,
    modules_validated: suite.modules_validated,
    executive_summary: suite.executive_summary,
    positive_highlights,
    negative_findings,
    recommendation,
    sellable: level === "sellable",
  };
}

// ══════════════════════════════════════════════════════════════
// 6. QUICK REPORT (from partial results)
// ══════════════════════════════════════════════════════════════

export function buildQuickReport(params: {
  scenarios_passed: number;
  scenarios_failed: number;
  scenarios_total: number;
  critical_failures: string[];
  modules_validated: string[];
}): Pick<PierreGoldenScenarioReport, "level" | "level_label" | "score" | "sellable" | "recommendation"> {
  const { scenarios_passed, scenarios_failed, scenarios_total, critical_failures } = params;

  const score =
    scenarios_total > 0
      ? Math.round((scenarios_passed / scenarios_total) * 100)
      : 0;

  let level: PierreGoldenScenarioReportLevel = "blocked";
  if (critical_failures.length === 0 && scenarios_failed === 0 && score >= 90) {
    level = "sellable";
  } else if (critical_failures.length === 0 && scenarios_failed === 0) {
    level = "demo_ready";
  } else if (critical_failures.length === 0 && score >= 50) {
    level = "internal_only";
  }

  return {
    level,
    level_label: LEVEL_LABELS[level],
    score,
    sellable: level === "sellable",
    recommendation: buildRecommendation(level, {
      critical_failures,
      scenarios_failed,
      scenarios_warned: 0,
    } as PierreGoldenScenarioSuiteResult, score),
  };
}

// ══════════════════════════════════════════════════════════════
// 7. MODULE COVERAGE REPORT
// ══════════════════════════════════════════════════════════════

export type PierreModuleCoverageReport = {
  module: string;
  scenarios_using: number;
  scenarios_passed: number;
  coverage_pct: number;
};

export function buildModuleCoverageReport(
  suite: PierreGoldenScenarioSuiteResult,
): PierreModuleCoverageReport[] {
  const moduleCounts: Record<string, { total: number; passed: number }> = {};

  for (const result of suite.results) {
    for (const artifact of result.artifacts) {
      if (!moduleCounts[artifact.type]) {
        moduleCounts[artifact.type] = { total: 0, passed: 0 };
      }
      moduleCounts[artifact.type].total++;
      if (result.status === "pass") {
        moduleCounts[artifact.type].passed++;
      }
    }
  }

  return Object.entries(moduleCounts).map(([module, counts]) => ({
    module,
    scenarios_using: counts.total,
    scenarios_passed: counts.passed,
    coverage_pct:
      counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0,
  }));
}
