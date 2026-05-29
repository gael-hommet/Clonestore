// P-FINAL 01 — Phase 5 — Tests for Stripe live readiness library.
// All simulate-route: pure functions only, no Stripe API, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  detectStripeEnvironment,
  isLiveKey,
  isTestKey,
  analyzeStripeEnv,
} from "../stripe-env-analyzer";
import {
  buildStripeEnvChecks,
  buildStripeManualChecks,
} from "../stripe-readiness-checks";
import {
  buildStripeReadinessReport,
  isStripeProductionReady,
  getStripeBlockingReasons,
  FIXTURE_STRIPE_PROD_ENV,
  FIXTURE_STRIPE_TEST_ENV,
  FIXTURE_STRIPE_MISMATCH_ENV,
  FIXTURE_STRIPE_EMPTY_ENV,
  FIXTURE_STRIPE_MANUAL_ALL_DONE,
} from "../stripe-readiness-verdict";
import {
  STRIPE_LIVE_CHECKLIST,
  getChecklistByCategory,
  getCriticalStripeChecklistItems,
  areAllCriticalStripeDone,
} from "../stripe-checklist";

// ── Env Analyzer ──────────────────────────────────────────────────────────────

describe("stripe-env-analyzer", () => {
  it("sk_live_ key detected as live", () => {
    expect(detectStripeEnvironment("sk_live_test123")).toBe("live");
  });

  it("sk_test_ key detected as test", () => {
    expect(detectStripeEnvironment("sk_test_test123")).toBe("test");
  });

  it("undefined key → unknown", () => {
    expect(detectStripeEnvironment(undefined)).toBe("unknown");
  });

  it("isLiveKey: sk_live_ is live secret", () => {
    expect(isLiveKey("sk_live_abc", "secret")).toBe(true);
  });

  it("isLiveKey: pk_live_ is live publishable", () => {
    expect(isLiveKey("pk_live_abc", "publishable")).toBe(true);
  });

  it("isLiveKey: sk_test_ is not live", () => {
    expect(isLiveKey("sk_test_abc", "secret")).toBe(false);
  });

  it("isTestKey: sk_test_ is test", () => {
    expect(isTestKey("sk_test_abc", "secret")).toBe(true);
  });

  it("isTestKey: pk_test_ is test publishable", () => {
    expect(isTestKey("pk_test_abc", "publishable")).toBe(true);
  });

  it("analyzeStripeEnv: prod env → all_live_keys: true", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_PROD_ENV);
    expect(analysis.all_live_keys).toBe(true);
    expect(analysis.all_test_keys).toBe(false);
    expect(analysis.key_mismatch).toBe(false);
    expect(analysis.environment).toBe("live");
  });

  it("analyzeStripeEnv: test env → all_test_keys: true", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_TEST_ENV);
    expect(analysis.all_test_keys).toBe(true);
    expect(analysis.all_live_keys).toBe(false);
    expect(analysis.environment).toBe("test");
  });

  it("analyzeStripeEnv: mismatch env → key_mismatch: true", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_MISMATCH_ENV);
    expect(analysis.key_mismatch).toBe(true);
  });

  it("analyzeStripeEnv: empty env → all false", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_EMPTY_ENV);
    expect(analysis.has_secret_key).toBe(false);
    expect(analysis.has_publishable_key).toBe(false);
    expect(analysis.has_webhook_secret).toBe(false);
    expect(analysis.has_price_id).toBe(false);
    expect(analysis.environment).toBe("unknown");
  });

  it("analyzeStripeEnv: prod env has all keys", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_PROD_ENV);
    expect(analysis.has_secret_key).toBe(true);
    expect(analysis.has_publishable_key).toBe(true);
    expect(analysis.has_webhook_secret).toBe(true);
    expect(analysis.has_price_id).toBe(true);
  });
});

// ── Readiness Checks ──────────────────────────────────────────────────────────

describe("stripe-readiness-checks", () => {
  it("prod env checks: all pass", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_PROD_ENV);
    const checks = buildStripeEnvChecks(analysis);
    const failing = checks.filter((c) => !c.passes);
    expect(failing).toHaveLength(0);
  });

  it("test env checks: live keys check fails", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_TEST_ENV);
    const checks = buildStripeEnvChecks(analysis);
    const liveCheck = checks.find((c) => c.id === "stripe_live_keys");
    expect(liveCheck!.passes).toBe(false);
    expect(liveCheck!.status).toBe("blocking");
  });

  it("mismatch env: key mismatch check fails as blocking", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_MISMATCH_ENV);
    const checks = buildStripeEnvChecks(analysis);
    const mismatchCheck = checks.find((c) => c.id === "stripe_no_key_mismatch");
    expect(mismatchCheck!.passes).toBe(false);
    expect(mismatchCheck!.status).toBe("blocking");
  });

  it("empty env: all mandatory checks fail", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_EMPTY_ENV);
    const checks = buildStripeEnvChecks(analysis);
    const failing = checks.filter((c) => !c.passes);
    expect(failing.length).toBeGreaterThan(3);
  });

  it("manual checks: all done → all pass", () => {
    const checks = buildStripeManualChecks(FIXTURE_STRIPE_MANUAL_ALL_DONE);
    const failing = checks.filter((c) => !c.passes);
    expect(failing).toHaveLength(0);
  });

  it("manual checks: none done → all fail", () => {
    const checks = buildStripeManualChecks({});
    const failing = checks.filter((c) => !c.passes);
    expect(failing.length).toBe(checks.length);
  });

  it("all manual checks have is_manual: true", () => {
    const checks = buildStripeManualChecks({});
    for (const c of checks) {
      expect(c.is_manual).toBe(true);
    }
  });

  it("all env checks have is_manual: false", () => {
    const analysis = analyzeStripeEnv(FIXTURE_STRIPE_PROD_ENV);
    const checks = buildStripeEnvChecks(analysis);
    for (const c of checks) {
      expect(c.is_manual).toBe(false);
    }
  });
});

// ── Readiness Verdict ─────────────────────────────────────────────────────────

describe("stripe-readiness-verdict", () => {
  it("prod env + all manual done → is_production_ready: true", () => {
    const report = buildStripeReadinessReport(FIXTURE_STRIPE_PROD_ENV, FIXTURE_STRIPE_MANUAL_ALL_DONE);
    expect(report.is_production_ready).toBe(true);
    expect(report.blocking_count).toBe(0);
    expect(report.blocking_reason).toBeNull();
  });

  it("prod env + no manual → is_production_ready: false (manual blocking)", () => {
    const report = buildStripeReadinessReport(FIXTURE_STRIPE_PROD_ENV);
    expect(report.is_production_ready).toBe(false);
    expect(report.blocking_count).toBeGreaterThan(0);
  });

  it("test env + all manual → is_production_ready: false (test keys)", () => {
    const report = buildStripeReadinessReport(FIXTURE_STRIPE_TEST_ENV, FIXTURE_STRIPE_MANUAL_ALL_DONE);
    expect(report.is_production_ready).toBe(false);
  });

  it("empty env → blocking_count > 0", () => {
    const report = buildStripeReadinessReport(FIXTURE_STRIPE_EMPTY_ENV);
    expect(report.blocking_count).toBeGreaterThan(3);
  });

  it("mismatch env → blocking_reason set", () => {
    const report = buildStripeReadinessReport(FIXTURE_STRIPE_MISMATCH_ENV);
    expect(report.blocking_reason).toBeTruthy();
  });

  it("isStripeProductionReady: true with full prod setup", () => {
    expect(isStripeProductionReady(FIXTURE_STRIPE_PROD_ENV, FIXTURE_STRIPE_MANUAL_ALL_DONE)).toBe(true);
  });

  it("isStripeProductionReady: false with no manual", () => {
    expect(isStripeProductionReady(FIXTURE_STRIPE_PROD_ENV)).toBe(false);
  });

  it("getStripeBlockingReasons: empty with full prod setup", () => {
    const reasons = getStripeBlockingReasons(FIXTURE_STRIPE_PROD_ENV, FIXTURE_STRIPE_MANUAL_ALL_DONE);
    expect(reasons).toHaveLength(0);
  });

  it("getStripeBlockingReasons: has reasons with empty env", () => {
    const reasons = getStripeBlockingReasons(FIXTURE_STRIPE_EMPTY_ENV);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it("report has env_analysis and checks", () => {
    const report = buildStripeReadinessReport(FIXTURE_STRIPE_PROD_ENV);
    expect(report.env_analysis).toBeDefined();
    expect(report.checks.length).toBeGreaterThan(0);
  });
});

// ── Checklist ─────────────────────────────────────────────────────────────────

describe("stripe-checklist", () => {
  it("checklist has at least 10 items", () => {
    expect(STRIPE_LIVE_CHECKLIST.length).toBeGreaterThanOrEqual(10);
  });

  it("all items have id, title, description, category, critical field", () => {
    for (const item of STRIPE_LIVE_CHECKLIST) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(typeof item.critical).toBe("boolean");
    }
  });

  it("checklist ids are unique", () => {
    const ids = STRIPE_LIVE_CHECKLIST.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("webhook category has at least 2 items", () => {
    const webhook = getChecklistByCategory("webhook");
    expect(webhook.length).toBeGreaterThanOrEqual(2);
  });

  it("getCriticalStripeChecklistItems returns only critical", () => {
    const critical = getCriticalStripeChecklistItems();
    for (const i of critical) {
      expect(i.critical).toBe(true);
    }
  });

  it("areAllCriticalStripeDone: false with empty done list", () => {
    expect(areAllCriticalStripeDone([])).toBe(false);
  });

  it("areAllCriticalStripeDone: true when all critical done", () => {
    const criticalIds = getCriticalStripeChecklistItems().map((i) => i.id);
    expect(areAllCriticalStripeDone(criticalIds)).toBe(true);
  });

  it("replace_test_keys_with_live item is critical", () => {
    const item = STRIPE_LIVE_CHECKLIST.find((i) => i.id === "replace_test_keys_with_live");
    expect(item).toBeDefined();
    expect(item!.critical).toBe(true);
  });

  it("create_live_webhook_endpoint item is critical", () => {
    const item = STRIPE_LIVE_CHECKLIST.find((i) => i.id === "create_live_webhook_endpoint");
    expect(item).toBeDefined();
    expect(item!.critical).toBe(true);
  });

  it("flow category has checkout flow test item", () => {
    const flow = getChecklistByCategory("flow");
    const checkoutItem = flow.find((i) => i.id === "test_full_checkout_flow");
    expect(checkoutItem).toBeDefined();
    expect(checkoutItem!.critical).toBe(true);
  });
});
