// B48 — Launch Readiness Core Library Tests
// Tests all pure modules in src/lib/launch-readiness/.
// No Supabase, no Next.js, no async.

import { describe, it, expect } from "vitest";

// Types
import type {
  LaunchReadinessStatus,
  LaunchSurface,
  LaunchSeverity,
  LaunchReadinessCheck,
  ManualVerificationFlags,
} from "@/lib/launch-readiness/types";

// Block registry
import {
  getAllBlocs,
  getBlocById,
  getCompleteBlocs,
  getMissingOrPartialBlocs,
  getBlocRegistrySummary,
  areAllBlocsComplete,
} from "@/lib/launch-readiness/block-registry";

// Env readiness
import {
  getEnvReadinessChecks,
  getEnvReadinessSummary,
  getMissingRequiredEnvVars,
  isEnvProductionReady,
} from "@/lib/launch-readiness/env-readiness";

// Production flags
import {
  getAllProductionFlags,
  getBlockingProductionFlags,
  getNonBlockingProductionFlags,
  getDefaultManualFlags,
  evaluateManualFlags,
} from "@/lib/launch-readiness/production-flags";

// Route readiness
import {
  getAllRoutes,
  getRoutesBySurface,
  getBlockingRoutes,
  getRouteReadinessSummary,
} from "@/lib/launch-readiness/route-readiness";

// UI readiness
import {
  getAllUiPages,
  getMissingBlockingPages,
  getUiReadinessSummary,
  isUiLaunchBlocked,
} from "@/lib/launch-readiness/ui-readiness";

// Security
import {
  getSecurityReadinessChecks,
  getSecurityBlockers,
  isSecurityLaunchBlocked,
} from "@/lib/launch-readiness/security-readiness";

// Billing
import {
  getBillingReadinessChecks,
  getBillingBlockers,
  isBillingLaunchBlocked,
  getBillingReadinessSummary,
} from "@/lib/launch-readiness/billing-readiness";

// Demo
import {
  getDemoReadinessPolicy,
  getDemoReadinessChecks,
  getDemoBlockers,
  isDemoLaunchBlocked,
} from "@/lib/launch-readiness/demo-readiness";

// Pierre readiness
import {
  getPierreReadinessChecks,
  getPierreBlockers,
  isPierreLaunchBlocked,
  getPierreReadinessSummary,
} from "@/lib/launch-readiness/pierre-readiness";

// CloneStore readiness
import {
  getClonestoreReadinessChecks,
  getClonestoreBlockers,
  isClonestoreLaunchBlocked,
} from "@/lib/launch-readiness/clonestore-readiness";

// Readiness checks aggregator
import {
  getAllReadinessChecks,
  buildReadinessReportBySurface,
  buildAllReadinessReports,
  getBlockingChecks,
  getAllSurfaces,
} from "@/lib/launch-readiness/readiness-checks";

// Launch verdict
import {
  buildB48FinalVerdict,
  getB48VerdictSummary,
  isPublicLaunchReady,
  getTechnicalReadinessStatus,
} from "@/lib/launch-readiness/launch-verdict";

// Fixtures
import {
  FIXTURE_FLAGS_ALL_FALSE,
  FIXTURE_FLAGS_ALL_TRUE,
  FIXTURE_FLAGS_BLOCKING_ONLY,
  FIXTURE_CHECK_READY,
  FIXTURE_CHECK_BLOCKED,
  FIXTURE_CHECK_WARNING,
  FIXTURE_SURFACES,
  FIXTURE_BLOCKING_FLAG_KEYS,
} from "@/lib/launch-readiness/launch-fixtures";

// ── Block Registry ─────────────────────────────────────────────────────────────

describe("block-registry", () => {
  it("getAllBlocs returns non-empty array", () => {
    const blocs = getAllBlocs();
    expect(blocs.length).toBeGreaterThan(0);
  });

  it("covers B33 through B47", () => {
    const ids = getAllBlocs().map((b) => b.id);
    for (const id of ["B33", "B38", "B40", "B43", "B44", "B45", "B46", "B47"]) {
      expect(ids).toContain(id);
    }
  });

  it("getBlocById returns correct bloc", () => {
    const b47 = getBlocById("B47");
    expect(b47).not.toBeNull();
    expect(b47?.id).toBe("B47");
    expect(b47?.status).toBe("complete");
  });

  it("getBlocById returns null for unknown", () => {
    expect(getBlocById("B99")).toBeNull();
  });

  it("getCompleteBlocs returns all complete", () => {
    const complete = getCompleteBlocs();
    expect(complete.length).toBeGreaterThan(0);
    complete.forEach((b) => expect(b.status).toBe("complete"));
  });

  it("getMissingOrPartialBlocs returns empty when all complete", () => {
    const missing = getMissingOrPartialBlocs();
    // In B48 all blocs B33-B47 are complete
    expect(missing.length).toBe(0);
  });

  it("getBlocRegistrySummary has correct shape", () => {
    const summary = getBlocRegistrySummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("complete");
    expect(summary).toHaveProperty("missing");
    expect(summary).toHaveProperty("total_tests");
    expect(summary.total_tests).toBeGreaterThan(0);
    expect(summary.complete).toBeGreaterThan(0);
  });

  it("areAllBlocsComplete returns true", () => {
    expect(areAllBlocsComplete()).toBe(true);
  });

  it("each bloc has test_count > 0", () => {
    getAllBlocs().forEach((b) => {
      expect(b.test_count).toBeGreaterThan(0);
    });
  });

  it("B47 has has_routes=true and has_docs=true", () => {
    const b47 = getBlocById("B47");
    expect(b47?.has_routes).toBe(true);
    expect(b47?.has_docs).toBe(true);
  });
});

// ── Env Readiness ──────────────────────────────────────────────────────────────

describe("env-readiness", () => {
  it("getEnvReadinessChecks returns non-empty array", () => {
    const checks = getEnvReadinessChecks();
    expect(checks.length).toBeGreaterThan(0);
  });

  it("includes Supabase and Stripe keys", () => {
    const keys = getEnvReadinessChecks().map((c) => c.key);
    expect(keys).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(keys).toContain("STRIPE_SECRET_KEY");
    expect(keys).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("getEnvReadinessSummary has correct shape", () => {
    const summary = getEnvReadinessSummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("set");
    expect(summary).toHaveProperty("missing");
    expect(summary).toHaveProperty("required_missing");
    expect(summary.total).toBeGreaterThan(0);
  });

  it("getMissingRequiredEnvVars returns array (test env has missing keys)", () => {
    const missing = getMissingRequiredEnvVars();
    expect(Array.isArray(missing)).toBe(true);
    // In test environment, production keys are not set
    missing.forEach((c) => {
      expect(c.required_for_production).toBe(true);
      expect(c.status).not.toBe("set");
    });
  });

  it("isEnvProductionReady returns boolean", () => {
    expect(typeof isEnvProductionReady()).toBe("boolean");
  });

  it("each check has required fields", () => {
    getEnvReadinessChecks().forEach((c) => {
      expect(c).toHaveProperty("key");
      expect(c).toHaveProperty("status");
      expect(c).toHaveProperty("required_for_production");
      expect(c).toHaveProperty("surface");
    });
  });
});

// ── Production Flags ───────────────────────────────────────────────────────────

describe("production-flags", () => {
  it("getAllProductionFlags returns non-empty array", () => {
    expect(getAllProductionFlags().length).toBeGreaterThan(0);
  });

  it("getBlockingProductionFlags returns subset of all flags", () => {
    const all = getAllProductionFlags();
    const blocking = getBlockingProductionFlags();
    expect(blocking.length).toBeLessThanOrEqual(all.length);
    blocking.forEach((f) => expect(f.blocking_public_launch).toBe(true));
  });

  it("getNonBlockingProductionFlags returns non-blocking", () => {
    getNonBlockingProductionFlags().forEach((f) => {
      expect(f.blocking_public_launch).toBe(false);
    });
  });

  it("getDefaultManualFlags returns all false", () => {
    const flags = getDefaultManualFlags();
    Object.values(flags).forEach((v) => expect(v).toBe(false));
  });

  it("evaluateManualFlags with all false — blocking_unverified not empty", () => {
    const result = evaluateManualFlags(FIXTURE_FLAGS_ALL_FALSE);
    expect(result.blocking_unverified.length).toBeGreaterThan(0);
    expect(result.all_blocking_done).toBe(false);
    expect(result.all_done).toBe(false);
  });

  it("evaluateManualFlags with all true — all done", () => {
    const result = evaluateManualFlags(FIXTURE_FLAGS_ALL_TRUE);
    expect(result.blocking_unverified.length).toBe(0);
    expect(result.all_blocking_done).toBe(true);
    expect(result.all_done).toBe(true);
  });

  it("evaluateManualFlags with only blocking flags — non_blocking has items", () => {
    const result = evaluateManualFlags(FIXTURE_FLAGS_BLOCKING_ONLY);
    expect(result.all_blocking_done).toBe(true);
    expect(result.non_blocking_unverified.length).toBeGreaterThan(0);
    expect(result.all_done).toBe(false);
  });

  it("FIXTURE_BLOCKING_FLAG_KEYS match actual blocking flags", () => {
    const blockingKeys = getBlockingProductionFlags().map((f) => f.key);
    FIXTURE_BLOCKING_FLAG_KEYS.forEach((k) => {
      expect(blockingKeys).toContain(k);
    });
  });

  it("each blocking flag has remediation", () => {
    getBlockingProductionFlags().forEach((f) => {
      expect(f.remediation).toBeTruthy();
    });
  });
});

// ── Route Readiness ────────────────────────────────────────────────────────────

describe("route-readiness", () => {
  it("getAllRoutes returns non-empty array", () => {
    expect(getAllRoutes().length).toBeGreaterThan(0);
  });

  it("getRoutesBySurface returns subset", () => {
    const billing = getRoutesBySurface("billing");
    billing.forEach((r) => expect(r.surface).toBe("billing"));
  });

  it("getBlockingRoutes returns blocking routes", () => {
    const blocking = getBlockingRoutes();
    blocking.forEach((r) => expect(r.blocking_if_missing).toBe(true));
  });

  it("getRouteReadinessSummary has correct shape", () => {
    const summary = getRouteReadinessSummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("active");
    expect(summary).toHaveProperty("blocking_active");
  });

  it("B48 routes are registered", () => {
    const paths = getAllRoutes().map((r) => r.path);
    expect(paths).toContain("/api/clonestore/launch-readiness");
    expect(paths).toContain("/api/pierre/launch-readiness");
  });

  it("Pierre submit route exists", () => {
    const paths = getAllRoutes().map((r) => r.path);
    expect(paths).toContain("/api/pierre/submit");
  });
});

// ── UI Readiness ───────────────────────────────────────────────────────────────

describe("ui-readiness", () => {
  it("getAllUiPages returns non-empty array", () => {
    expect(getAllUiPages().length).toBeGreaterThan(0);
  });

  it("getMissingBlockingPages includes CGU and CGV", () => {
    const missing = getMissingBlockingPages();
    const paths = missing.map((p) => p.path);
    expect(paths).toContain("/legal/cgu");
    expect(paths).toContain("/legal/cgv");
  });

  it("isUiLaunchBlocked is true because CGU/CGV missing", () => {
    expect(isUiLaunchBlocked()).toBe(true);
  });

  it("getUiReadinessSummary has blocking_missing > 0", () => {
    const summary = getUiReadinessSummary();
    expect(summary.blocking_missing).toBeGreaterThan(0);
    expect(summary.missing).toBeGreaterThanOrEqual(summary.blocking_missing);
  });

  it("launch-readiness page is registered as active", () => {
    const pages = getAllUiPages();
    const page = pages.find((p) => p.path === "/profile/launch-readiness");
    expect(page).toBeDefined();
    expect(page?.status).toBe("active");
  });

  it("/legal/confidentialite exists", () => {
    const pages = getAllUiPages();
    const privacyPage = pages.find((p) => p.path === "/legal/confidentialite");
    expect(privacyPage).toBeDefined();
    expect(privacyPage?.status).toBe("active");
  });
});

// ── Security Readiness ─────────────────────────────────────────────────────────

describe("security-readiness", () => {
  it("getSecurityReadinessChecks returns checks", () => {
    expect(getSecurityReadinessChecks().length).toBeGreaterThan(0);
  });

  it("RLS check is blocking and not ready", () => {
    const rlsCheck = getSecurityReadinessChecks().find((c) => c.id === "SEC_RLS_PRODUCTION");
    expect(rlsCheck).toBeDefined();
    expect(rlsCheck?.blocking_public_launch).toBe(true);
    expect(rlsCheck?.status).toBe("blocked");
  });

  it("isSecurityLaunchBlocked is true (RLS not verified)", () => {
    expect(isSecurityLaunchBlocked()).toBe(true);
  });

  it("getSecurityBlockers returns at least RLS", () => {
    const blockers = getSecurityBlockers();
    expect(blockers.length).toBeGreaterThan(0);
    const ids = blockers.map((c) => c.id);
    expect(ids).toContain("SEC_RLS_PRODUCTION");
  });

  it("service_role_key check is ready", () => {
    const check = getSecurityReadinessChecks().find((c) => c.id === "SEC_SERVICE_ROLE_KEY_SERVER_ONLY");
    expect(check?.status).toBe("ready");
  });

  it("no_command_injection check is ready", () => {
    const check = getSecurityReadinessChecks().find((c) => c.id === "SEC_NO_COMMAND_INJECTION");
    expect(check?.status).toBe("ready");
  });
});

// ── Billing Readiness ──────────────────────────────────────────────────────────

describe("billing-readiness", () => {
  it("getBillingReadinessChecks returns checks", () => {
    expect(getBillingReadinessChecks().length).toBeGreaterThan(0);
  });

  it("isBillingLaunchBlocked is true (Stripe live not configured)", () => {
    expect(isBillingLaunchBlocked()).toBe(true);
  });

  it("Stripe live keys check is blocked", () => {
    const check = getBillingReadinessChecks().find((c) => c.id === "BILL_STRIPE_LIVE_KEYS");
    expect(check?.status).toBe("blocked");
    expect(check?.blocking_public_launch).toBe(true);
  });

  it("getBillingBlockers returns Stripe-related blockers", () => {
    const blockers = getBillingBlockers();
    expect(blockers.length).toBeGreaterThan(0);
    const ids = blockers.map((c) => c.id);
    expect(ids).toContain("BILL_STRIPE_LIVE_KEYS");
  });

  it("activate_route check is ready", () => {
    const check = getBillingReadinessChecks().find((c) => c.id === "BILL_ACTIVATE_ROUTE");
    expect(check?.status).toBe("ready");
  });

  it("no_free_trial check is ready", () => {
    const check = getBillingReadinessChecks().find((c) => c.id === "BILL_NO_FREE_TRIAL");
    expect(check?.status).toBe("ready");
  });

  it("getBillingReadinessSummary has correct shape", () => {
    const summary = getBillingReadinessSummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("ready");
    expect(summary).toHaveProperty("blocked");
    expect(summary).toHaveProperty("blocking_unresolved");
    expect(summary.blocking_unresolved).toBeGreaterThan(0);
  });
});

// ── Demo Readiness ─────────────────────────────────────────────────────────────

describe("demo-readiness", () => {
  it("getDemoReadinessPolicy has all required fields", () => {
    const policy = getDemoReadinessPolicy();
    expect(policy.real_email_send_allowed).toBe(false);
    expect(policy.official_document_export_in_demo).toBe(false);
    expect(policy.real_ai_generation_in_demo).toBe(false);
    expect(policy.demo_data_isolated).toBe(true);
    expect(policy.demo_disclaimer_shown).toBe(true);
  });

  it("getDemoReadinessChecks returns checks", () => {
    expect(getDemoReadinessChecks().length).toBeGreaterThan(0);
  });

  it("no_real_email check is ready", () => {
    const check = getDemoReadinessChecks().find((c) => c.id === "DEMO_NO_REAL_EMAIL");
    expect(check?.status).toBe("ready");
  });

  it("no_official_docs check is ready", () => {
    const check = getDemoReadinessChecks().find((c) => c.id === "DEMO_NO_OFFICIAL_DOCS");
    expect(check?.status).toBe("ready");
  });

  it("data_isolated check is ready", () => {
    const check = getDemoReadinessChecks().find((c) => c.id === "DEMO_DATA_ISOLATED");
    expect(check?.status).toBe("ready");
  });

  it("isDemoLaunchBlocked is false (demo controls in place)", () => {
    expect(isDemoLaunchBlocked()).toBe(false);
  });

  it("getDemoBlockers returns empty array", () => {
    expect(getDemoBlockers().length).toBe(0);
  });
});

// ── Pierre Readiness ───────────────────────────────────────────────────────────

describe("pierre-readiness", () => {
  it("getPierreReadinessChecks returns checks", () => {
    expect(getPierreReadinessChecks().length).toBeGreaterThan(0);
  });

  it("no_lawyer_claims check is ready", () => {
    const check = getPierreReadinessChecks().find((c) => c.id === "PIERRE_NO_LAWYER_CLAIMS");
    expect(check?.status).toBe("ready");
  });

  it("no_payslip_generation check is ready", () => {
    const check = getPierreReadinessChecks().find((c) => c.id === "PIERRE_NO_PAYSLIP_GENERATION");
    expect(check?.status).toBe("ready");
  });

  it("no_live_email check is ready", () => {
    const check = getPierreReadinessChecks().find((c) => c.id === "PIERRE_NO_LIVE_EMAIL");
    expect(check?.status).toBe("ready");
  });

  it("brain_mock_fallback check is ready", () => {
    const check = getPierreReadinessChecks().find((c) => c.id === "PIERRE_BRAIN_MOCK_FALLBACK");
    expect(check?.status).toBe("ready");
  });

  it("isPierreLaunchBlocked is false (core controls in place)", () => {
    expect(isPierreLaunchBlocked()).toBe(false);
  });

  it("getPierreReadinessSummary has correct shape", () => {
    const summary = getPierreReadinessSummary();
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("ready");
    expect(summary).toHaveProperty("ready_with_warnings");
    expect(summary).toHaveProperty("blocked");
    expect(summary.ready).toBeGreaterThan(0);
  });
});

// ── CloneStore Readiness ───────────────────────────────────────────────────────

describe("clonestore-readiness", () => {
  it("getClonestoreReadinessChecks returns checks", () => {
    expect(getClonestoreReadinessChecks().length).toBeGreaterThan(0);
  });

  it("cloneguard check is ready", () => {
    const check = getClonestoreReadinessChecks().find((c) => c.id === "CS_CLONEGUARD_ACTIVE");
    expect(check?.status).toBe("ready");
  });

  it("clonetrace check is ready", () => {
    const check = getClonestoreReadinessChecks().find((c) => c.id === "CS_CLONETRACE_ACTIVE");
    expect(check?.status).toBe("ready");
  });

  it("tenant_spoofing_strip check is ready", () => {
    const check = getClonestoreReadinessChecks().find((c) => c.id === "CS_TENANT_SPOOFING_STRIP");
    expect(check?.status).toBe("ready");
  });

  it("billing_flow check is ready_with_warnings (Stripe live not done)", () => {
    const check = getClonestoreReadinessChecks().find((c) => c.id === "CS_BILLING_FLOW");
    expect(check?.status).toBe("ready_with_warnings");
    expect(check?.blocking_public_launch).toBe(true);
  });
});

// ── Readiness Checks Aggregator ────────────────────────────────────────────────

describe("readiness-checks", () => {
  it("getAllReadinessChecks returns large set of checks", () => {
    const checks = getAllReadinessChecks();
    expect(checks.length).toBeGreaterThan(20);
  });

  it("CGU check is in all checks", () => {
    const checks = getAllReadinessChecks();
    const cgu = checks.find((c) => c.id === "LEGAL_CGU_MISSING");
    expect(cgu).toBeDefined();
    expect(cgu?.blocking_public_launch).toBe(true);
    expect(cgu?.status).toBe("blocked");
  });

  it("getAllSurfaces returns all 15 surfaces", () => {
    const surfaces = getAllSurfaces();
    expect(surfaces.length).toBe(15);
    expect(surfaces).toContain("legal");
    expect(surfaces).toContain("pierre");
    expect(surfaces).toContain("security");
  });

  it("FIXTURE_SURFACES matches getAllSurfaces", () => {
    const surfaces = getAllSurfaces();
    FIXTURE_SURFACES.forEach((s) => {
      expect(surfaces).toContain(s);
    });
  });

  it("buildReadinessReportBySurface for legal returns blocked", () => {
    const report = buildReadinessReportBySurface("legal");
    expect(report.surface).toBe("legal");
    expect(report.status).toBe("blocked");
    expect(report.blocking_count).toBeGreaterThan(0);
  });

  it("buildReadinessReportBySurface for demo returns non-blocked", () => {
    const report = buildReadinessReportBySurface("demo");
    expect(["ready", "ready_with_warnings"]).toContain(report.status);
  });

  it("buildAllReadinessReports returns reports for all surfaces", () => {
    const reports = buildAllReadinessReports();
    expect(reports.length).toBe(15);
    const surfaces = reports.map((r) => r.surface);
    expect(surfaces).toContain("legal");
    expect(surfaces).toContain("billing");
    expect(surfaces).toContain("pierre");
  });

  it("getBlockingChecks returns at least CGU/CGV blockers", () => {
    const blocking = getBlockingChecks();
    expect(blocking.length).toBeGreaterThan(0);
    const ids = blocking.map((c) => c.id);
    expect(ids).toContain("LEGAL_CGU_MISSING");
    expect(ids).toContain("LEGAL_CGV_MISSING");
  });

  it("each check in aggregator has required fields", () => {
    getAllReadinessChecks().forEach((c) => {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("surface");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("status");
      expect(c).toHaveProperty("severity");
      expect(c).toHaveProperty("blocking_public_launch");
    });
  });
});

// ── Launch Verdict ─────────────────────────────────────────────────────────────

describe("launch-verdict", () => {
  it("buildB48FinalVerdict with no flags returns technical_ready_public_blocked", () => {
    const verdict = buildB48FinalVerdict({});
    expect(verdict.status).toBe("technical_ready_public_blocked");
  });

  it("buildB48FinalVerdict with all_false flags — blocking_items not empty", () => {
    const verdict = buildB48FinalVerdict(FIXTURE_FLAGS_ALL_FALSE);
    expect(verdict.blocking_items.length).toBeGreaterThan(0);
    expect(verdict.is_publicly_launchable).toBe(false);
  });

  it("buildB48FinalVerdict is_technically_complete when all blocs done", () => {
    const verdict = buildB48FinalVerdict({});
    expect(verdict.is_technically_complete).toBe(true);
  });

  it("buildB48FinalVerdict is_publicly_launchable is false without manual flags", () => {
    const verdict = buildB48FinalVerdict({});
    expect(verdict.is_publicly_launchable).toBe(false);
  });

  it("buildB48FinalVerdict score is between 0 and 100", () => {
    const verdict = buildB48FinalVerdict({});
    expect(verdict.score_0_to_100).toBeGreaterThanOrEqual(0);
    expect(verdict.score_0_to_100).toBeLessThanOrEqual(100);
  });

  it("buildB48FinalVerdict.surfaces_blocked includes legal", () => {
    const verdict = buildB48FinalVerdict({});
    expect(verdict.surfaces_blocked).toContain("legal");
  });

  it("buildB48FinalVerdict.evaluated_at is ISO date string", () => {
    const verdict = buildB48FinalVerdict({});
    expect(() => new Date(verdict.evaluated_at).toISOString()).not.toThrow();
  });

  it("buildB48FinalVerdict.warnings are non-empty", () => {
    const verdict = buildB48FinalVerdict({});
    expect(verdict.warnings.length).toBeGreaterThan(0);
  });

  it("getB48VerdictSummary has required fields", () => {
    const summary = getB48VerdictSummary({});
    expect(summary).toHaveProperty("status");
    expect(summary).toHaveProperty("score");
    expect(summary).toHaveProperty("blocking_count");
    expect(summary).toHaveProperty("is_technically_complete");
    expect(summary).toHaveProperty("is_publicly_launchable");
  });

  it("isPublicLaunchReady returns false without manual flags", () => {
    expect(isPublicLaunchReady({})).toBe(false);
  });

  it("getTechnicalReadinessStatus returns 'complete'", () => {
    expect(getTechnicalReadinessStatus()).toBe("complete");
  });

  it("verdict never claims public_launch_ready without all manual flags", () => {
    const partialFlags = { cgu_cgu_validated: true };
    const verdict = buildB48FinalVerdict(partialFlags);
    expect(verdict.status).not.toBe("public_launch_ready");
    expect(verdict.is_publicly_launchable).toBe(false);
  });

  it("verdict status with all_true flags and no code blockers would be public_launch_ready", () => {
    // Only possible if all manual flags AND no code-level blocking checks
    // Since there are code-level blockers (RLS, Stripe live are manual-only),
    // with all true flags we expect public_launch_ready
    const verdict = buildB48FinalVerdict(FIXTURE_FLAGS_ALL_TRUE);
    // When all manual flags are resolved, the status should be public_launch_ready
    // (blocking checks from code all resolve when manual_verified = true)
    expect(verdict.status).toBe("public_launch_ready");
    expect(verdict.is_publicly_launchable).toBe(true);
  });
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

describe("launch-fixtures", () => {
  it("FIXTURE_FLAGS_ALL_FALSE has all values false", () => {
    Object.values(FIXTURE_FLAGS_ALL_FALSE).forEach((v) => expect(v).toBe(false));
  });

  it("FIXTURE_FLAGS_ALL_TRUE has all values true", () => {
    Object.values(FIXTURE_FLAGS_ALL_TRUE).forEach((v) => expect(v).toBe(true));
  });

  it("FIXTURE_CHECK_READY has status ready", () => {
    expect(FIXTURE_CHECK_READY.status).toBe("ready");
    expect(FIXTURE_CHECK_READY.blocking_public_launch).toBe(false);
  });

  it("FIXTURE_CHECK_BLOCKED has status blocked and blocking_public_launch", () => {
    expect(FIXTURE_CHECK_BLOCKED.status).toBe("blocked");
    expect(FIXTURE_CHECK_BLOCKED.blocking_public_launch).toBe(true);
  });

  it("FIXTURE_CHECK_WARNING has status ready_with_warnings", () => {
    expect(FIXTURE_CHECK_WARNING.status).toBe("ready_with_warnings");
  });

  it("FIXTURE_SURFACES has 15 entries", () => {
    expect(FIXTURE_SURFACES.length).toBe(15);
  });

  it("FIXTURE_BLOCKING_FLAG_KEYS has at least 5 entries", () => {
    expect(FIXTURE_BLOCKING_FLAG_KEYS.length).toBeGreaterThanOrEqual(5);
  });
});
