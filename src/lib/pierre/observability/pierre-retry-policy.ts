// B43 — Pierre retry policy: domain-aware retry decisions

import type { ObservableError } from "../../observability/types";
import type { RetryContext, RetryDecision } from "../../observability/retry-policy";
import { decideRetry } from "../../observability/retry-policy";
import { PIERRE_NON_RETRYABLE_CODES, isPierreErrorCode, getPierreErrorMeta } from "./pierre-error-taxonomy";

// ── Pierre-specific non-retryable codes ───────────────────────────────────────

const PIERRE_USER_ACTION_REQUIRED_CODES = new Set([
  "PIERRE_TASK_APPROVAL_REQUIRED",
  "PIERRE_TASK_BLOCKED_SENSITIVE",
  "PIERRE_EMAIL_BLOCKED_BY_POLICY",
  "PIERRE_RGPD_PURGE_BLOCKED",
  "PIERRE_AI_BUDGET_EXCEEDED",
  "PIERRE_EMAIL_RECIPIENT_INVALID",
  "PIERRE_MISSION_NOT_FOUND",
  "PIERRE_TASK_NOT_FOUND",
  "PIERRE_MISSION_ALREADY_CLOSED",
]);

const PIERRE_CRITICAL_CODES = new Set([
  "PIERRE_SECURITY_VIOLATION",
  "PIERRE_MISSION_COMPANY_MISMATCH",
  "PIERRE_WORKFLOW_HARD_FAIL",
  "PIERRE_RGPD_PURGE_BLOCKED",
]);

// ── Checks ────────────────────────────────────────────────────────────────────

export function isPierreUserActionRequired(code: string): boolean {
  return PIERRE_USER_ACTION_REQUIRED_CODES.has(code);
}

export function isPierreCriticalNonRetryable(code: string): boolean {
  return PIERRE_CRITICAL_CODES.has(code);
}

export function isPierreAutoRetryable(code: string): boolean {
  if (isPierreErrorCode(code)) {
    const meta = getPierreErrorMeta(code);
    return meta.retryable && !PIERRE_NON_RETRYABLE_CODES.has(code);
  }
  return false;
}

// ── Pierre-aware retry decision ───────────────────────────────────────────────

export function decidePierreRetry(
  error: ObservableError,
  context: RetryContext,
): RetryDecision {
  // Pierre-specific overrides take precedence
  if (PIERRE_CRITICAL_CODES.has(error.code)) {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: context.retry_count,
      max_retries: 0,
      backoff_ms: 0,
      reason: `Pierre critical code ${error.code} — no retry.`,
    };
  }

  if (PIERRE_USER_ACTION_REQUIRED_CODES.has(error.code)) {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: context.retry_count,
      max_retries: 0,
      backoff_ms: 0,
      reason: `Pierre code ${error.code} requires user action — no auto-retry.`,
    };
  }

  if (PIERRE_NON_RETRYABLE_CODES.has(error.code)) {
    return {
      should_retry: false,
      next_attempt_at: null,
      retry_count: context.retry_count,
      max_retries: 0,
      backoff_ms: 0,
      reason: `Pierre code ${error.code} is non-retryable.`,
    };
  }

  // Delegate to generic retry policy
  return decideRetry(error, context);
}

// ── Dead-letter decision for Pierre ──────────────────────────────────────────

export function shouldPierreDeadLetter(
  error: ObservableError,
  decision: RetryDecision,
): boolean {
  if (decision.should_retry) return false;
  // Critical codes always go to dead-letter
  if (PIERRE_CRITICAL_CODES.has(error.code)) return true;
  // Security violations always dead-letter
  if (error.code === "PIERRE_SECURITY_VIOLATION") return true;
  // User-action-required codes do not dead-letter (they surface to cockpit)
  if (PIERRE_USER_ACTION_REQUIRED_CODES.has(error.code)) return false;
  // Retry-exhausted errors dead-letter
  if (decision.retry_count >= decision.max_retries && decision.max_retries > 0) return true;
  return false;
}
