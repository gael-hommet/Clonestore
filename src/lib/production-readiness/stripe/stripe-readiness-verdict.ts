// P-FINAL 01 — Phase 5 — Stripe readiness verdict aggregator.
// Pure: no Stripe SDK, no Next, no async, no throw.

import type { StripeReadinessReport, StripeManualVerification } from "./stripe-readiness-types";
import { analyzeStripeEnv } from "./stripe-env-analyzer";
import { buildStripeEnvChecks, buildStripeManualChecks } from "./stripe-readiness-checks";

export function buildStripeReadinessReport(
  envVars: Record<string, string | undefined>,
  manual?: Partial<StripeManualVerification>
): StripeReadinessReport {
  const env_analysis = analyzeStripeEnv(envVars);
  const envChecks = buildStripeEnvChecks(env_analysis);
  const manualChecks = buildStripeManualChecks(manual ?? {});
  const checks = [...envChecks, ...manualChecks];

  const blocking_count = checks.filter((c) => c.status === "blocking" && !c.passes).length;
  const warning_count = checks.filter((c) => c.status === "warning" && !c.passes).length;
  const is_production_ready = blocking_count === 0;

  const firstBlocking = checks.find((c) => c.status === "blocking" && !c.passes);
  const blocking_reason = firstBlocking ? firstBlocking.label : null;

  return {
    env_analysis,
    checks,
    blocking_count,
    warning_count,
    is_production_ready,
    blocking_reason,
  };
}

export function isStripeProductionReady(
  envVars: Record<string, string | undefined>,
  manual?: Partial<StripeManualVerification>
): boolean {
  return buildStripeReadinessReport(envVars, manual).is_production_ready;
}

export function getStripeBlockingReasons(
  envVars: Record<string, string | undefined>,
  manual?: Partial<StripeManualVerification>
): string[] {
  const report = buildStripeReadinessReport(envVars, manual);
  return report.checks
    .filter((c) => c.status === "blocking" && !c.passes)
    .map((c) => c.label);
}

// Default env snapshot for full production — all live keys present
export const FIXTURE_STRIPE_PROD_ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_live_example_key_123",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_example_key_456",
  STRIPE_WEBHOOK_SECRET: "whsec_example_webhook_secret",
  NEXT_PUBLIC_STRIPE_PRICE_ID: "price_pierre_449_live",
};

// Test env — test keys
export const FIXTURE_STRIPE_TEST_ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_test_example_key_123",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example_key_456",
  STRIPE_WEBHOOK_SECRET: "whsec_test_webhook_secret",
  NEXT_PUBLIC_STRIPE_PRICE_ID: "price_pierre_449_test",
};

// Mismatched keys (one live, one test)
export const FIXTURE_STRIPE_MISMATCH_ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_live_example_key_123",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_example_key_456",
  STRIPE_WEBHOOK_SECRET: "whsec_webhook_secret",
  NEXT_PUBLIC_STRIPE_PRICE_ID: "price_pierre_449_test",
};

// Empty env — nothing configured
export const FIXTURE_STRIPE_EMPTY_ENV: Record<string, string> = {};

// All manual verifications done
export const FIXTURE_STRIPE_MANUAL_ALL_DONE: StripeManualVerification = {
  webhook_endpoint_created: true,
  live_payment_tested: true,
  subscription_flow_verified: true,
  stripe_dashboard_reviewed: true,
};
