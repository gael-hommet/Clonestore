// src/lib/site-health/checks.ts
// B31.6/B31.7 — Static invariant checks. Pure functions, no DB/network calls.

import type { HealthCheckResult } from "./types";
import {
  EXPECTED_PIERRE_PRICE_AMOUNT,
  TRIAL_PERIOD_DAYS,
} from "@/lib/billing/stripe-activation";
import { BUDGET_MS } from "@/lib/performance/navigation-budget";

const EXPECTED_DEFAULT_POST_LOGIN_PATH = "/profile/agents";

const PRIVATE_PATHS = [
  "/agents/pierre/use",
  "/profile",
  "/profile/agents",
  "/profile/messages",
];

export function checkDefaultPostLoginPath(actual: string): HealthCheckResult {
  const ok = actual === EXPECTED_DEFAULT_POST_LOGIN_PATH;
  return {
    name: "default-post-login-path",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Default post-login path is correct: ${actual}`
      : `Expected ${EXPECTED_DEFAULT_POST_LOGIN_PATH}, got: ${actual}`,
  };
}

export function checkPrivatePathsNonEmpty(): HealthCheckResult {
  const ok = PRIVATE_PATHS.length > 0;
  return {
    name: "private-paths-non-empty",
    status: ok ? "pass" : "fail",
    message: ok
      ? `${PRIVATE_PATHS.length} private paths declared`
      : "Private path list is empty",
  };
}

export function checkNoTokenInUrl(url: string): HealthCheckResult {
  const lower = url.toLowerCase();
  const hasToken =
    lower.includes("token=") ||
    lower.includes("access_token=") ||
    lower.includes("refresh_token=");
  return {
    name: "no-token-in-url",
    status: hasToken ? "fail" : "pass",
    message: hasToken
      ? "URL contains a token parameter — this is a security violation"
      : "No token found in URL",
  };
}

export function checkRedirectIsSafe(redirect: string | null | undefined): HealthCheckResult {
  if (!redirect) {
    return { name: "redirect-safe", status: "pass", message: "No redirect param present" };
  }

  const trimmed = redirect.trim();
  const isRelative = /^\/[^/]/.test(trimmed);
  const hasScheme = /[a-z][a-z0-9+\-.]*:/i.test(trimmed);
  const ok = isRelative && !hasScheme;

  return {
    name: "redirect-safe",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Redirect is a safe relative path: ${trimmed}`
      : `Redirect is not a safe relative path: ${trimmed}`,
  };
}

export function checkNoUserIdInCheckoutBody(body: Record<string, unknown>): HealthCheckResult {
  const hasUserId = "user_id" in body;
  return {
    name: "no-user-id-in-checkout-body",
    status: hasUserId ? "fail" : "pass",
    message: hasUserId
      ? "Checkout body contains user_id — must come from server session only"
      : "No user_id in checkout body",
  };
}

export function checkErrorNotExposedRaw(message: string): HealthCheckResult {
  const dangerPatterns = [
    /supabase/i,
    /postgrest/i,
    /at Object\./,
    /stack trace/i,
    /node_modules/i,
    /PGRST\d+/,
  ];
  const exposed = dangerPatterns.some((pattern) => pattern.test(message));
  return {
    name: "error-not-exposed-raw",
    status: exposed ? "fail" : "pass",
    message: exposed
      ? "Error message may expose internal implementation details"
      : "Error message appears safe for client display",
  };
}

// ── B31.7 billing checks ────────────────────────────────────────

export function checkPierreTrialDays(actual: number): HealthCheckResult {
  const ok = actual === TRIAL_PERIOD_DAYS;
  return {
    name: "pierre-trial-days",
    status: ok ? "pass" : "warn",
    message: ok
      ? `Pierre trial period is ${actual} days`
      : `Pierre trial expected ${TRIAL_PERIOD_DAYS} days, got ${actual}`,
  };
}

export function checkPierrePriceAmount(actual: number | null): HealthCheckResult {
  if (actual === null) {
    return {
      name: "pierre-price-amount",
      status: "warn",
      message: "Pierre price amount unknown (not retrieved from Stripe)",
    };
  }
  const ok = actual === EXPECTED_PIERRE_PRICE_AMOUNT;
  return {
    name: "pierre-price-amount",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Pierre price is ${actual} cents (${actual / 100} EUR) — correct`
      : `Pierre price expected ${EXPECTED_PIERRE_PRICE_AMOUNT} cents, got ${actual} cents`,
  };
}

export function checkTrialingGrantsAccess(activeStatuses: string[]): HealthCheckResult {
  const ok = activeStatuses.includes("trialing");
  return {
    name: "trialing-grants-access",
    status: ok ? "pass" : "fail",
    message: ok
      ? "trialing status is included in active access statuses"
      : "trialing status is NOT in active access statuses — trial users blocked",
  };
}

// ── B31.9 performance budget check ─────────────────────────────

export function checkPerformanceBudgetConfig(): HealthCheckResult {
  const ok =
    BUDGET_MS.instant === 100 &&
    BUDGET_MS.acceptable === 800 &&
    BUDGET_MS.critical === 3000;
  return {
    name: "performance-budget-config",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Perf budgets sane: instant=${BUDGET_MS.instant}ms, acceptable=${BUDGET_MS.acceptable}ms, critical=${BUDGET_MS.critical}ms`
      : `Perf budget config unexpected: instant=${BUDGET_MS.instant}, acceptable=${BUDGET_MS.acceptable}, critical=${BUDGET_MS.critical}`,
  };
}

export { PRIVATE_PATHS };
