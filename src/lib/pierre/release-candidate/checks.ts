// src/lib/pierre/release-candidate/checks.ts
// Pierre Release Candidate — Check builders and scoring logic.
// Pure module: no Supabase, no Next, no async, no side effects. Never throws.

import type {
  PierreReleaseCandidateArea,
  PierreReleaseCandidateCheck,
  PierreReleaseCandidateModuleSummary,
  PierreReleaseCandidateReport,
  PierreReleaseCandidateSeverity,
  PierreReleaseCandidateStatus,
} from "./types";

// ══════════════════════════════════════════════════════════════
// 1. CHECK BUILDERS
// ══════════════════════════════════════════════════════════════

export function buildRCCheck(params: {
  id: string;
  area: PierreReleaseCandidateArea;
  label: string;
  pass: boolean;
  expected: string;
  actual: string;
  severity?: PierreReleaseCandidateSeverity;
  recommendation?: string | null;
}): PierreReleaseCandidateCheck {
  return {
    id: params.id,
    area: params.area,
    label: params.label,
    status: params.pass ? "pass" : "fail",
    severity: params.severity ?? "error",
    expected: params.expected,
    actual: params.actual,
    recommendation: params.recommendation ?? null,
  };
}

export function buildRCWarning(params: {
  id: string;
  area: PierreReleaseCandidateArea;
  label: string;
  expected: string;
  actual: string;
  severity?: PierreReleaseCandidateSeverity;
  recommendation?: string | null;
}): PierreReleaseCandidateCheck {
  return {
    id: params.id,
    area: params.area,
    label: params.label,
    status: "warning",
    severity: params.severity ?? "warning",
    expected: params.expected,
    actual: params.actual,
    recommendation: params.recommendation ?? null,
  };
}

export function buildRCFail(params: {
  id: string;
  area: PierreReleaseCandidateArea;
  label: string;
  expected: string;
  actual: string;
  severity?: PierreReleaseCandidateSeverity;
  recommendation?: string | null;
}): PierreReleaseCandidateCheck {
  return {
    id: params.id,
    area: params.area,
    label: params.label,
    status: "fail",
    severity: params.severity ?? "error",
    expected: params.expected,
    actual: params.actual,
    recommendation: params.recommendation ?? null,
  };
}

// ══════════════════════════════════════════════════════════════
// 2. SCORING
// ══════════════════════════════════════════════════════════════

export function scoreRCChecks(checks: PierreReleaseCandidateCheck[]): number {
  if (checks.length === 0) return 0;
  const passing = checks.filter((c) => c.status === "pass").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const base = (passing / checks.length) * 100;
  const warningPenalty = (warnings / checks.length) * 5;
  return Math.min(100, Math.max(0, Math.round(base - warningPenalty)));
}

// ══════════════════════════════════════════════════════════════
// 3. MODULE SUMMARY
// ══════════════════════════════════════════════════════════════

export function summarizeRCModules(
  checks: PierreReleaseCandidateCheck[],
): PierreReleaseCandidateModuleSummary[] {
  const byArea = new Map<PierreReleaseCandidateArea, PierreReleaseCandidateCheck[]>();
  for (const check of checks) {
    const existing = byArea.get(check.area) ?? [];
    existing.push(check);
    byArea.set(check.area, existing);
  }

  const summaries: PierreReleaseCandidateModuleSummary[] = [];
  for (const [area, areaChecks] of byArea.entries()) {
    const passed = areaChecks.filter((c) => c.status === "pass").length;
    const warnings = areaChecks.filter((c) => c.status === "warning").length;
    const failed = areaChecks.filter((c) => c.status === "fail").length;
    const critical = areaChecks.filter(
      (c) => c.status === "fail" && c.severity === "critical",
    ).length;
    const score = areaChecks.length > 0 ? Math.round((passed / areaChecks.length) * 100) : 0;
    let status: PierreReleaseCandidateStatus = "ready";
    if (critical > 0) {
      status = "blocked";
    } else if (failed > 0) {
      status = "blocked";
    } else if (warnings > 0) {
      status = "almost_ready";
    }
    summaries.push({ area, score, status, passed, warnings, failed, critical });
  }
  return summaries;
}

// ══════════════════════════════════════════════════════════════
// 4. STATUS CLASSIFICATION
// ══════════════════════════════════════════════════════════════

export function classifyRCStatus(params: {
  score: number;
  checks: PierreReleaseCandidateCheck[];
}): PierreReleaseCandidateStatus {
  const { score, checks } = params;
  const hasCriticalFail = checks.some(
    (c) => c.status === "fail" && c.severity === "critical",
  );
  if (hasCriticalFail) return "blocked";
  if (checks.some((c) => c.status === "fail" && c.severity === "error")) return "blocked";
  if (score >= 90 && !checks.some((c) => c.status === "fail")) return "ready";
  if (score >= 75) return "almost_ready";
  return "blocked";
}

// ══════════════════════════════════════════════════════════════
// 5. FULL REPORT BUILDER
// ══════════════════════════════════════════════════════════════

export function buildPierreReleaseCandidateReport(params: {
  checks: PierreReleaseCandidateCheck[];
  version?: string;
  strongest_proofs?: string[];
  generatedAt?: string;
}): PierreReleaseCandidateReport {
  try {
    const { checks, version, strongest_proofs, generatedAt } = params;
    const safeChecks: PierreReleaseCandidateCheck[] = Array.isArray(checks) ? checks : [];
    const score = scoreRCChecks(safeChecks);
    const status = classifyRCStatus({ score, checks: safeChecks });
    const modules = summarizeRCModules(safeChecks);
    const blocking_issues = safeChecks.filter((c) => c.status === "fail");
    const warnings = safeChecks.filter((c) => c.status === "warning");
    const hasCriticalFail = blocking_issues.some((c) => c.severity === "critical");
    const hasErrorFail = blocking_issues.some((c) => c.severity === "error");

    const can_release_backend = status === "ready";
    const can_start_cockpit = !hasCriticalFail && score >= 75;
    const requires_hotfix = hasCriticalFail || hasErrorFail;

    let recommendation = "";
    if (status === "ready") {
      recommendation =
        `Backend Pierre V1 validé (score ${score}/100). Tous les checks critiques passent. Prêt pour Bloc 31 — Cockpit Pierre Final UI.`;
    } else if (status === "almost_ready") {
      recommendation =
        `Backend Pierre V1 presque prêt (score ${score}/100). Corriger les avertissements avant démo client. Cockpit peut démarrer.`;
    } else {
      recommendation =
        `Backend Pierre V1 bloqué (score ${score}/100). ${blocking_issues.length} issue(s) critique(s) à corriger. Cockpit en attente.`;
    }

    return {
      generated_at: generatedAt ?? new Date().toISOString(),
      version: version ?? "1.0.0",
      status,
      score,
      modules,
      checks: safeChecks,
      blocking_issues,
      warnings,
      strongest_proofs: Array.isArray(strongest_proofs) ? strongest_proofs : [],
      release_decision: {
        can_release_backend,
        can_start_cockpit,
        requires_hotfix,
        recommendation,
      },
    };
  } catch {
    const now = new Date().toISOString();
    return {
      generated_at: now,
      version: params.version ?? "1.0.0",
      status: "failed",
      score: 0,
      modules: [],
      checks: [],
      blocking_issues: [],
      warnings: [],
      strongest_proofs: [],
      release_decision: {
        can_release_backend: false,
        can_start_cockpit: false,
        requires_hotfix: true,
        recommendation: "Report generation failed — check logs.",
      },
    };
  }
}
