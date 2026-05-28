// B48 — Pierre Launch Readiness Tests
// Tests all pure modules in src/lib/pierre/launch-readiness/.
// No Supabase, no Next.js, no async.

import { describe, it, expect } from "vitest";

// Pierre launch checks
import {
  getPierreLaunchChecks,
  getPierreLaunchChecksSummary,
  getPierreReadinessAsLaunchChecks,
} from "@/lib/pierre/launch-readiness/pierre-launch-checks";

// Pierre launch scenarios
import {
  getAllPierreLaunchScenarios,
  getScenariosByCategory,
  getBlockedScenarios,
  getHumanRequiredScenarios,
  getPierreLaunchScenariosSummary,
} from "@/lib/pierre/launch-readiness/pierre-launch-scenarios";

// Pierre launch verdict
import {
  buildPierreFinalLaunchVerdict,
  isPierreSafeForDemo,
  isPierreSafeForPaidCustomers,
} from "@/lib/pierre/launch-readiness/pierre-launch-verdict";

// Pierre launch report
import {
  buildPierreLaunchReport,
  getPierreLaunchReportSummary,
} from "@/lib/pierre/launch-readiness/pierre-launch-report";

// ── Pierre Launch Checks ───────────────────────────────────────────────────────

describe("pierre-launch-checks", () => {
  it("getPierreLaunchChecks returns checks", () => {
    const checks = getPierreLaunchChecks();
    expect(checks.length).toBeGreaterThan(0);
  });

  it("PIERRE_LEGAL_VERDICT_SAFE check is ok", () => {
    const check = getPierreLaunchChecks().find((c) => c.id === "PIERRE_LEGAL_VERDICT_SAFE");
    expect(check).toBeDefined();
    expect(check?.ok).toBe(true);
  });

  it("PIERRE_HARD_LIMITS check is ok", () => {
    const check = getPierreLaunchChecks().find((c) => c.id === "PIERRE_HARD_LIMITS");
    expect(check?.ok).toBe(true);
  });

  it("PIERRE_SAFE_CLAIMS_COUNT check is ok", () => {
    const check = getPierreLaunchChecks().find((c) => c.id === "PIERRE_SAFE_CLAIMS_COUNT");
    expect(check?.ok).toBe(true);
  });

  it("PIERRE_DISCLAIMER_INJECTION check is ok", () => {
    const check = getPierreLaunchChecks().find((c) => c.id === "PIERRE_DISCLAIMER_INJECTION");
    expect(check?.ok).toBe(true);
  });

  it("PIERRE_NO_LAWYER_CLAIM_CODE check is ok", () => {
    const check = getPierreLaunchChecks().find((c) => c.id === "PIERRE_NO_LAWYER_CLAIM_CODE");
    expect(check?.ok).toBe(true);
  });

  it("PIERRE_PAYROLL_BLOCKED_TASKS check is ok", () => {
    const check = getPierreLaunchChecks().find((c) => c.id === "PIERRE_PAYROLL_BLOCKED_TASKS");
    expect(check?.ok).toBe(true);
  });

  it("getPierreLaunchChecksSummary has correct shape", () => {
    const summary = getPierreLaunchChecksSummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("ok");
    expect(summary).toHaveProperty("failing");
    expect(summary).toHaveProperty("blocking_failing");
    expect(summary.total).toBeGreaterThan(0);
  });

  it("getPierreLaunchChecksSummary blocking_failing is 0", () => {
    const summary = getPierreLaunchChecksSummary();
    expect(summary.blocking_failing).toBe(0);
  });

  it("getPierreReadinessAsLaunchChecks returns array", () => {
    const checks = getPierreReadinessAsLaunchChecks();
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
  });

  it("each check has id, label, ok, blocking, notes", () => {
    getPierreLaunchChecks().forEach((c) => {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("ok");
      expect(c).toHaveProperty("blocking");
      expect(c).toHaveProperty("notes");
    });
  });
});

// ── Pierre Launch Scenarios ────────────────────────────────────────────────────

describe("pierre-launch-scenarios", () => {
  it("getAllPierreLaunchScenarios returns non-empty array", () => {
    expect(getAllPierreLaunchScenarios().length).toBeGreaterThan(0);
  });

  it("email scenarios exist", () => {
    const emailScenarios = getScenariosByCategory("email");
    expect(emailScenarios.length).toBeGreaterThan(0);
  });

  it("SCENARIO_EMAIL_DRAFT expected_outcome is draft_only", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_EMAIL_DRAFT");
    expect(scenario).toBeDefined();
    expect(scenario?.expected_outcome).toBe("draft_only");
    expect(scenario?.expected_ok).toBe(true);
  });

  it("SCENARIO_EMAIL_SEND_BLOCKED expected_outcome is blocked", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_EMAIL_SEND_BLOCKED");
    expect(scenario?.expected_outcome).toBe("blocked");
    expect(scenario?.expected_ok).toBe(false);
  });

  it("SCENARIO_PAYSLIP_BLOCKED expected_outcome is blocked", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_PAYSLIP_BLOCKED");
    expect(scenario?.expected_outcome).toBe("blocked");
    expect(scenario?.expected_ok).toBe(false);
  });

  it("SCENARIO_PREPAYROLL_ALLOWED is allowed_with_disclaimer", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_PREPAYROLL_ALLOWED");
    expect(scenario?.expected_outcome).toBe("allowed_with_disclaimer");
    expect(scenario?.expected_ok).toBe(true);
  });

  it("SCENARIO_DISMISSAL_HUMAN_REQUIRED is human_required", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_DISMISSAL_HUMAN_REQUIRED");
    expect(scenario?.expected_outcome).toBe("human_required");
    expect(scenario?.expected_ok).toBe(true);
  });

  it("SCENARIO_HARASSMENT_ESCALATED is human_required", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_HARASSMENT_ESCALATED");
    expect(scenario?.expected_outcome).toBe("human_required");
    expect(scenario?.category).toBe("hr_sensitive");
  });

  it("SCENARIO_LAWYER_CLAIM_FORBIDDEN is blocked", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_LAWYER_CLAIM_FORBIDDEN");
    expect(scenario?.expected_outcome).toBe("blocked");
    expect(scenario?.category).toBe("legal");
  });

  it("SCENARIO_AI_MOCK_FALLBACK is allowed", () => {
    const scenario = getAllPierreLaunchScenarios().find((s) => s.id === "SCENARIO_AI_MOCK_FALLBACK");
    expect(scenario?.expected_outcome).toBe("allowed");
    expect(scenario?.expected_ok).toBe(true);
  });

  it("getBlockedScenarios returns only blocked", () => {
    getBlockedScenarios().forEach((s) => {
      expect(s.expected_outcome).toBe("blocked");
    });
  });

  it("getHumanRequiredScenarios returns only human_required", () => {
    getHumanRequiredScenarios().forEach((s) => {
      expect(s.expected_outcome).toBe("human_required");
    });
  });

  it("getPierreLaunchScenariosSummary has correct shape", () => {
    const summary = getPierreLaunchScenariosSummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("blocked");
    expect(summary).toHaveProperty("human_required");
    expect(summary).toHaveProperty("allowed_with_disclaimer");
    expect(summary).toHaveProperty("allowed");
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.blocked + summary.human_required + summary.allowed_with_disclaimer + summary.allowed + summary.draft_only).toBe(summary.total);
  });

  it("each scenario has required fields", () => {
    getAllPierreLaunchScenarios().forEach((s) => {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("label");
      expect(s).toHaveProperty("category");
      expect(s).toHaveProperty("expected_outcome");
      expect(s).toHaveProperty("expected_ok");
    });
  });

  it("getScenariosByCategory('payroll') returns payroll scenarios", () => {
    const payroll = getScenariosByCategory("payroll");
    payroll.forEach((s) => expect(s.category).toBe("payroll"));
    expect(payroll.length).toBeGreaterThan(0);
  });

  it("at least one blocked scenario", () => {
    expect(getBlockedScenarios().length).toBeGreaterThan(0);
  });

  it("at least one human_required scenario", () => {
    expect(getHumanRequiredScenarios().length).toBeGreaterThan(0);
  });
});

// ── Pierre Launch Verdict ──────────────────────────────────────────────────────

describe("pierre-launch-verdict", () => {
  it("buildPierreFinalLaunchVerdict without legal review — status pierre_internal_only", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(["pierre_internal_only", "pierre_blocked"]).toContain(verdict.status);
    expect(verdict.legal_review_complete).toBe(false);
  });

  it("buildPierreFinalLaunchVerdict legal_review_required is true", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict.legal_review_required).toBe(true);
  });

  it("buildPierreFinalLaunchVerdict hard_limits_ok is true", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict.hard_limits_ok).toBe(true);
  });

  it("buildPierreFinalLaunchVerdict is_safe_for_demo is true", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict.is_safe_for_demo).toBe(true);
  });

  it("buildPierreFinalLaunchVerdict with legal_review — status pierre_launch_ready", () => {
    const verdict = buildPierreFinalLaunchVerdict(true);
    expect(verdict.status).toBe("pierre_launch_ready");
    expect(verdict.legal_review_complete).toBe(true);
    expect(verdict.is_safe_for_paid_customers).toBe(true);
  });

  it("buildPierreFinalLaunchVerdict warnings are non-empty", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict.warnings.length).toBeGreaterThan(0);
  });

  it("warnings include 'Pierre ne garantit pas la conformité'", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    const hasGuaranteeWarning = verdict.warnings.some((w) =>
      w.toLowerCase().includes("garantit") || w.toLowerCase().includes("conformité")
    );
    expect(hasGuaranteeWarning).toBe(true);
  });

  it("notes contain legal score", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict.notes).toContain("Score légal B47");
  });

  it("isPierreSafeForDemo returns true", () => {
    expect(isPierreSafeForDemo()).toBe(true);
  });

  it("isPierreSafeForPaidCustomers false without legal review", () => {
    expect(isPierreSafeForPaidCustomers(false)).toBe(false);
  });

  it("isPierreSafeForPaidCustomers true with legal review", () => {
    expect(isPierreSafeForPaidCustomers(true)).toBe(true);
  });

  it("verdict has all required fields", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict).toHaveProperty("status");
    expect(verdict).toHaveProperty("is_safe_for_paid_customers");
    expect(verdict).toHaveProperty("is_safe_for_demo");
    expect(verdict).toHaveProperty("legal_review_complete");
    expect(verdict).toHaveProperty("legal_review_required");
    expect(verdict).toHaveProperty("hard_limits_ok");
    expect(verdict).toHaveProperty("blocking_items");
    expect(verdict).toHaveProperty("warnings");
    expect(verdict).toHaveProperty("notes");
  });

  it("blocking_items not empty without legal review", () => {
    const verdict = buildPierreFinalLaunchVerdict(false);
    expect(verdict.blocking_items.length).toBeGreaterThan(0);
  });

  it("blocking_items empty with legal review", () => {
    const verdict = buildPierreFinalLaunchVerdict(true);
    expect(verdict.blocking_items.length).toBe(0);
  });
});

// ── Pierre Launch Report ───────────────────────────────────────────────────────

describe("pierre-launch-report", () => {
  it("buildPierreLaunchReport returns full report", () => {
    const report = buildPierreLaunchReport(false);
    expect(report).toHaveProperty("verdict");
    expect(report).toHaveProperty("checks_summary");
    expect(report).toHaveProperty("scenarios_summary");
    expect(report).toHaveProperty("legal_verdict_score");
    expect(report).toHaveProperty("legal_modules_covered");
    expect(report).toHaveProperty("hard_limits_count");
    expect(report).toHaveProperty("generated_at");
  });

  it("report.legal_verdict_score is positive number", () => {
    const report = buildPierreLaunchReport(false);
    expect(report.legal_verdict_score).toBeGreaterThan(0);
    expect(report.legal_verdict_score).toBeLessThanOrEqual(100);
  });

  it("report.hard_limits_count > 0", () => {
    const report = buildPierreLaunchReport(false);
    expect(report.hard_limits_count).toBeGreaterThan(0);
  });

  it("report.legal_modules_covered > 0", () => {
    const report = buildPierreLaunchReport(false);
    expect(report.legal_modules_covered).toBeGreaterThan(0);
  });

  it("report.forbidden_claims_count > 0", () => {
    const report = buildPierreLaunchReport(false);
    expect(report.forbidden_claims_count).toBeGreaterThan(0);
  });

  it("report.allowed_claims_count > 0", () => {
    const report = buildPierreLaunchReport(false);
    expect(report.allowed_claims_count).toBeGreaterThan(0);
  });

  it("report.generated_at is ISO date string", () => {
    const report = buildPierreLaunchReport(false);
    expect(() => new Date(report.generated_at).toISOString()).not.toThrow();
  });

  it("getPierreLaunchReportSummary has correct shape", () => {
    const summary = getPierreLaunchReportSummary();
    expect(summary).toHaveProperty("status");
    expect(summary).toHaveProperty("is_safe_for_demo");
    expect(summary).toHaveProperty("is_safe_for_paid_customers");
    expect(summary).toHaveProperty("legal_score");
    expect(summary).toHaveProperty("blocking_count");
    expect(summary).toHaveProperty("scenarios_total");
  });

  it("getPierreLaunchReportSummary is_safe_for_demo is true", () => {
    const summary = getPierreLaunchReportSummary();
    expect(summary.is_safe_for_demo).toBe(true);
  });

  it("getPierreLaunchReportSummary scenarios_total > 0", () => {
    const summary = getPierreLaunchReportSummary();
    expect(summary.scenarios_total).toBeGreaterThan(0);
  });

  it("buildPierreLaunchReport checks_summary.blocking_failing is 0", () => {
    const report = buildPierreLaunchReport(false);
    expect(report.checks_summary.blocking_failing).toBe(0);
  });
});
