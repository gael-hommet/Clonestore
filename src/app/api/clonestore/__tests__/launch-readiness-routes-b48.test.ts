// B48 — Launch Readiness API Routes Tests
// Tests the pure logic behind:
//   GET /api/clonestore/launch-readiness
//   GET /api/pierre/launch-readiness
// Simulates route handlers without Next.js or Supabase.

import { describe, it, expect } from "vitest";

// CloneStore launch readiness route logic
import { buildB48FinalVerdict, getB48VerdictSummary } from "@/lib/launch-readiness/launch-verdict";
import { buildAllReadinessReports, getBlockingChecks } from "@/lib/launch-readiness/readiness-checks";
import { getBlocRegistrySummary } from "@/lib/launch-readiness/block-registry";
import { getEnvReadinessSummary } from "@/lib/launch-readiness/env-readiness";
import { getAllProductionFlags } from "@/lib/launch-readiness/production-flags";

// Pierre launch readiness route logic
import { buildPierreLaunchReport, getPierreLaunchReportSummary } from "@/lib/pierre/launch-readiness/pierre-launch-report";
import { buildPierreFinalLaunchVerdict } from "@/lib/pierre/launch-readiness/pierre-launch-verdict";
import { getAllPierreLaunchScenarios, getPierreLaunchScenariosSummary } from "@/lib/pierre/launch-readiness/pierre-launch-scenarios";
import { getPierreLaunchChecks } from "@/lib/pierre/launch-readiness/pierre-launch-checks";

import type { ManualVerificationFlags } from "@/lib/launch-readiness/types";

// ── Simulate-route helpers ────────────────────────────────────────────────────

function asBool(v: string | null): boolean {
  return v === "true" || v === "1";
}

function buildFlagsFromParams(params: Record<string, string>): Partial<ManualVerificationFlags> {
  const flags: Partial<ManualVerificationFlags> = {};
  const keys: Array<keyof ManualVerificationFlags> = [
    "cgu_cgu_validated",
    "privacy_policy_validated",
    "legal_review_done",
    "rls_production_verified",
    "stripe_production_configured",
    "domain_dns_configured",
    "smtp_production_configured",
    "rgpd_dpa_prepared",
    "security_audit_done",
  ];
  for (const key of keys) {
    const val = params[key] ?? null;
    if (val !== null) {
      flags[key] = asBool(val);
    }
  }
  return flags;
}

function simulateClonestoreLaunchReadiness(params: Record<string, string> = {}) {
  const manualFlags = buildFlagsFromParams(params);
  const verdict = buildB48FinalVerdict(manualFlags);
  const summary = getB48VerdictSummary(manualFlags);
  const reports = buildAllReadinessReports();
  const blockingChecks = getBlockingChecks();
  const blocsSummary = getBlocRegistrySummary();
  const envSummary = getEnvReadinessSummary();
  const productionFlags = getAllProductionFlags();

  return {
    status: 200,
    ok: true,
    verdict,
    summary,
    reports: reports.map((r) => ({
      surface: r.surface,
      status: r.status,
      blocking_count: r.blocking_count,
      warning_count: r.warning_count,
      ready_count: r.ready_count,
    })),
    blocking_checks: blockingChecks.map((c) => ({
      id: c.id,
      surface: c.surface,
      label: c.label,
      severity: c.severity,
      remediation: c.remediation,
    })),
    blocs: blocsSummary,
    env: {
      total: envSummary.total,
      set: envSummary.set,
      missing: envSummary.missing,
      required_missing: envSummary.required_missing,
    },
    production_flags: productionFlags.map((f) => ({
      key: f.key,
      label: f.label,
      blocking_public_launch: f.blocking_public_launch,
      surface: f.surface,
    })),
    meta: {
      bloc: "B48",
      evaluatedAt: verdict.evaluated_at,
      route: "/api/clonestore/launch-readiness",
    },
  };
}

function simulatePierreLaunchReadiness(params: Record<string, string> = {}) {
  const legalReviewDone = asBool(params["legal_review_done"] ?? null);
  const report = buildPierreLaunchReport(legalReviewDone);
  const summary = getPierreLaunchReportSummary();
  const verdict = buildPierreFinalLaunchVerdict(legalReviewDone);
  const scenariosSummary = getPierreLaunchScenariosSummary();
  const scenarios = getAllPierreLaunchScenarios();
  const checks = getPierreLaunchChecks();

  return {
    status: 200,
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
  };
}

// ── GET /api/clonestore/launch-readiness ──────────────────────────────────────

describe("GET /api/clonestore/launch-readiness", () => {
  it("returns ok: true", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns verdict with status", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.verdict).toHaveProperty("status");
    expect(typeof res.verdict.status).toBe("string");
  });

  it("verdict status is technical_ready_public_blocked by default", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.verdict.status).toBe("technical_ready_public_blocked");
  });

  it("returns reports array with 15 surfaces", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.reports.length).toBe(15);
  });

  it("each report has surface and status", () => {
    const res = simulateClonestoreLaunchReadiness();
    res.reports.forEach((r) => {
      expect(r).toHaveProperty("surface");
      expect(r).toHaveProperty("status");
      expect(r).toHaveProperty("blocking_count");
    });
  });

  it("returns blocking_checks array", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(Array.isArray(res.blocking_checks)).toBe(true);
    expect(res.blocking_checks.length).toBeGreaterThan(0);
  });

  it("each blocking check has id, surface, label", () => {
    const res = simulateClonestoreLaunchReadiness();
    res.blocking_checks.forEach((c) => {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("surface");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("severity");
    });
  });

  it("returns blocs summary", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.blocs).toHaveProperty("total");
    expect(res.blocs).toHaveProperty("complete");
    expect(res.blocs.complete).toBeGreaterThan(0);
  });

  it("returns env summary", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.env).toHaveProperty("total");
    expect(res.env).toHaveProperty("required_missing");
  });

  it("returns production_flags array", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(Array.isArray(res.production_flags)).toBe(true);
    expect(res.production_flags.length).toBeGreaterThan(0);
  });

  it("returns meta with bloc B48", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.meta.bloc).toBe("B48");
    expect(res.meta.route).toBe("/api/clonestore/launch-readiness");
  });

  it("meta.evaluatedAt is valid ISO string", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(() => new Date(res.meta.evaluatedAt).toISOString()).not.toThrow();
  });

  it("with all flags true — verdict is public_launch_ready", () => {
    const allTrue: Record<string, string> = {
      cgu_cgu_validated: "true",
      privacy_policy_validated: "true",
      legal_review_done: "true",
      rls_production_verified: "true",
      stripe_production_configured: "true",
      domain_dns_configured: "true",
      smtp_production_configured: "true",
      rgpd_dpa_prepared: "true",
      security_audit_done: "true",
    };
    const res = simulateClonestoreLaunchReadiness(allTrue);
    expect(res.verdict.status).toBe("public_launch_ready");
    expect(res.verdict.is_publicly_launchable).toBe(true);
  });

  it("score decreases with blocking items", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.verdict.score_0_to_100).toBeGreaterThanOrEqual(0);
    expect(res.verdict.score_0_to_100).toBeLessThan(100);
  });

  it("blocking CGU check appears in blocking_checks", () => {
    const res = simulateClonestoreLaunchReadiness();
    const ids = res.blocking_checks.map((c) => c.id);
    expect(ids).toContain("LEGAL_CGU_MISSING");
    expect(ids).toContain("LEGAL_CGV_MISSING");
  });

  it("summary.is_technically_complete is true", () => {
    const res = simulateClonestoreLaunchReadiness();
    expect(res.summary.is_technically_complete).toBe(true);
  });
});

// ── GET /api/pierre/launch-readiness ──────────────────────────────────────────

describe("GET /api/pierre/launch-readiness", () => {
  it("returns ok: true", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns verdict with status", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.verdict).toHaveProperty("status");
  });

  it("verdict status without legal review is pierre_internal_only or pierre_blocked", () => {
    const res = simulatePierreLaunchReadiness();
    expect(["pierre_internal_only", "pierre_blocked"]).toContain(res.verdict.status);
  });

  it("verdict is_safe_for_demo is true", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.verdict.is_safe_for_demo).toBe(true);
  });

  it("with legal_review_done=true — pierre_launch_ready", () => {
    const res = simulatePierreLaunchReadiness({ legal_review_done: "true" });
    expect(res.verdict.status).toBe("pierre_launch_ready");
    expect(res.verdict.is_safe_for_paid_customers).toBe(true);
  });

  it("returns checks array", () => {
    const res = simulatePierreLaunchReadiness();
    expect(Array.isArray(res.checks)).toBe(true);
    expect(res.checks.length).toBeGreaterThan(0);
  });

  it("each check has id, label, ok, blocking", () => {
    const res = simulatePierreLaunchReadiness();
    res.checks.forEach((c) => {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("ok");
      expect(c).toHaveProperty("blocking");
    });
  });

  it("returns scenarios_summary with total > 0", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.scenarios_summary.total).toBeGreaterThan(0);
  });

  it("returns scenarios array", () => {
    const res = simulatePierreLaunchReadiness();
    expect(Array.isArray(res.scenarios)).toBe(true);
    expect(res.scenarios.length).toBeGreaterThan(0);
  });

  it("each scenario has id, category, expected_outcome", () => {
    const res = simulatePierreLaunchReadiness();
    res.scenarios.forEach((s) => {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("category");
      expect(s).toHaveProperty("expected_outcome");
    });
  });

  it("returns legal section", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.legal).toHaveProperty("score");
    expect(res.legal).toHaveProperty("modules_covered");
    expect(res.legal).toHaveProperty("hard_limits_count");
    expect(res.legal).toHaveProperty("forbidden_claims_count");
    expect(res.legal).toHaveProperty("allowed_claims_count");
  });

  it("legal.score is positive", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.legal.score).toBeGreaterThan(0);
  });

  it("legal.hard_limits_count > 0", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.legal.hard_limits_count).toBeGreaterThan(0);
  });

  it("returns meta with bloc B48", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.meta.bloc).toBe("B48");
    expect(res.meta.route).toBe("/api/pierre/launch-readiness");
  });

  it("meta.legal_review_done is false by default", () => {
    const res = simulatePierreLaunchReadiness();
    expect(res.meta.legal_review_done).toBe(false);
  });

  it("meta.legal_review_done is true when passed", () => {
    const res = simulatePierreLaunchReadiness({ legal_review_done: "true" });
    expect(res.meta.legal_review_done).toBe(true);
  });
});
