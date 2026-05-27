// B43 — Generic retry policy

import type { ObservableError, ObservableEventDomain, RetryDecision } from "./types";

export type { RetryDecision };

// ── Default retry config by domain ───────────────────────────────────────────

type RetryConfig = {
  max_retries: number;
  base_backoff_ms: number;
  max_backoff_ms: number;
  jitter: boolean;
};

const DOMAIN_RETRY_CONFIG: Record<ObservableEventDomain, RetryConfig> = {
  ai:       { max_retries: 2, base_backoff_ms: 2000,  max_backoff_ms: 30000,  jitter: true },
  email:    { max_retries: 1, base_backoff_ms: 5000,  max_backoff_ms: 60000,  jitter: false },
  workflow: { max_retries: 0, base_backoff_ms: 0,     max_backoff_ms: 0,      jitter: false },
  task:     { max_retries: 3, base_backoff_ms: 1000,  max_backoff_ms: 60000,  jitter: true },
  mission:  { max_retries: 1, base_backoff_ms: 1000,  max_backoff_ms: 10000,  jitter: false },
  cockpit:  { max_retries: 1, base_backoff_ms: 500,   max_backoff_ms: 5000,   jitter: false },
  security: { max_retries: 0, base_backoff_ms: 0,     max_backoff_ms: 0,      jitter: false },
  rgpd:     { max_retries: 0, base_backoff_ms: 0,     max_backoff_ms: 0,      jitter: false },
  billing:  { max_retries: 1, base_backoff_ms: 3000,  max_backoff_ms: 30000,  jitter: false },
  document: { max_retries: 2, base_backoff_ms: 1000,  max_backoff_ms: 15000,  jitter: true },
  pdf:      { max_retries: 1, base_backoff_ms: 2000,  max_backoff_ms: 15000,  jitter: false },
  memory:   { max_retries: 2, base_backoff_ms: 500,   max_backoff_ms: 10000,  jitter: true },
  channel:  { max_retries: 1, base_backoff_ms: 5000,  max_backoff_ms: 60000,  jitter: false },
  system:   { max_retries: 1, base_backoff_ms: 1000,  max_backoff_ms: 10000,  jitter: false },
};

export function getDefaultRetryPolicy(domain: ObservableEventDomain): RetryConfig {
  return DOMAIN_RETRY_CONFIG[domain] ?? { max_retries: 1, base_backoff_ms: 1000, max_backoff_ms: 10000, jitter: false };
}

// ── Backoff calculation ───────────────────────────────────────────────────────

export function calculateBackoffMs(
  retryCount: number,
  baseMs: number,
  maxMs: number,
  jitter = false,
): number {
  if (retryCount <= 0) return baseMs;
  const exponential = baseMs * Math.pow(2, retryCount - 1);
  const capped = Math.min(exponential, maxMs);
  if (jitter) {
    // ±20% jitter
    const jitterRange = capped * 0.2;
    return Math.floor(capped + (Math.random() - 0.5) * 2 * jitterRange);
  }
  return capped;
}

// ── Non-retryable error codes ─────────────────────────────────────────────────

const NON_RETRYABLE_CODES = new Set([
  "tenant_mismatch",
  "security_violation",
  "budget_exceeded",
  "ai_budget_exceeded",
  "validation_missing",
  "sensitive_blocked",
  "email_blocked_by_policy",
  "rgpd_purge_blocked",
  "workflow_hard_fail",
  "unauthorized",
  "forbidden",
  "approval_required",
  "user_action_required",
]);

// ── Retry decision ────────────────────────────────────────────────────────────

export type RetryContext = {
  retry_count: number;
  now?: Date;
};

export function decideRetry(
  error: ObservableError,
  context: RetryContext,
): RetryDecision {
  const config = getDefaultRetryPolicy(error.domain);
  const retryCount = context.retry_count;
  const now = context.now ?? new Date();

  // Hard non-retryable conditions
  if (!error.retryable) {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: retryCount,
      max_retries: config.max_retries,
      backoff_ms: 0,
      reason: "Error is marked non-retryable.",
    };
  }

  if (NON_RETRYABLE_CODES.has(error.code)) {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: retryCount,
      max_retries: config.max_retries,
      backoff_ms: 0,
      reason: `Error code ${error.code} is never retried.`,
    };
  }

  if (error.severity === "critical") {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: retryCount,
      max_retries: config.max_retries,
      backoff_ms: 0,
      reason: "Critical severity — no automatic retry.",
    };
  }

  if (retryCount >= config.max_retries) {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: retryCount,
      max_retries: config.max_retries,
      backoff_ms: 0,
      reason: `Max retries (${config.max_retries}) reached.`,
    };
  }

  const backoff_ms = calculateBackoffMs(retryCount + 1, config.base_backoff_ms, config.max_backoff_ms, config.jitter);
  const next_attempt_at = new Date(now.getTime() + backoff_ms).toISOString();

  return {
    should_retry: true,
    next_attempt_at,
    retry_count: retryCount + 1,
    max_retries: config.max_retries,
    backoff_ms,
    reason: `Retry ${retryCount + 1}/${config.max_retries} scheduled in ${backoff_ms}ms.`,
  };
}

// ── Dead letter check ─────────────────────────────────────────────────────────

export function shouldDeadLetter(error: ObservableError, decision: RetryDecision): boolean {
  if (decision.should_retry) return false;
  // Dead letter if: max retries reached, or non-retryable critical/error
  if (error.severity === "critical") return true;
  if (error.severity === "error" && !error.retryable) return true;
  if (decision.retry_count >= decision.max_retries && decision.max_retries > 0) return true;
  return false;
}
