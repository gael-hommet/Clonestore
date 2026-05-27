// B43 — Observable error creation and normalization

import type { ObservableError, ObservableEventDomain, ObservabilitySeverity } from "./types";
import { redactErrorMessage, redactObservabilityMetadata, redactStackTrace } from "./redaction";

// ── Safe user messages (no technical detail) ──────────────────────────────────

const DEFAULT_SAFE_MESSAGE = "Une erreur s'est produite. Veuillez réessayer ou contacter le support.";

// ── Error creation ────────────────────────────────────────────────────────────

export type ObservableErrorInput = {
  code: string;
  domain: ObservableEventDomain;
  severity?: ObservabilitySeverity;
  retryable?: boolean;
  safe_message?: string;
  internal_message?: string;
  cause?: unknown;
  metadata?: Record<string, unknown>;
};

export function createObservableError(input: ObservableErrorInput): ObservableError {
  const cause = input.cause;
  const causeType = cause instanceof Error
    ? cause.constructor.name
    : typeof cause === "string"
    ? "StringError"
    : cause === null || cause === undefined
    ? "NoError"
    : "UnknownError";

  const internalMessage = input.internal_message ??
    (cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "Unknown error");

  return {
    code: input.code,
    domain: input.domain,
    severity: input.severity ?? "error",
    retryable: input.retryable ?? false,
    user_safe: true,
    safe_message: input.safe_message ?? DEFAULT_SAFE_MESSAGE,
    internal_message: redactErrorMessage(internalMessage),
    cause_type: causeType,
    metadata_redacted: redactObservabilityMetadata(input.metadata ?? {}),
  };
}

// ── Unknown error normalization ───────────────────────────────────────────────

export type NormalizeErrorContext = {
  domain: ObservableEventDomain;
  code?: string;
  metadata?: Record<string, unknown>;
};

export function normalizeUnknownError(
  error: unknown,
  context: NormalizeErrorContext,
): ObservableError {
  let internalMessage: string;
  let causeType: string;
  let severity: ObservabilitySeverity = "error";

  if (error instanceof Error) {
    internalMessage = error.message;
    causeType = error.constructor.name || "Error";
    if (error.constructor.name === "TypeError") severity = "error";
    if (error.constructor.name === "RangeError") severity = "error";
  } else if (typeof error === "string") {
    internalMessage = error;
    causeType = "StringError";
  } else if (error !== null && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    internalMessage = typeof obj.message === "string"
      ? obj.message
      : JSON.stringify(obj).slice(0, 200);
    causeType = "ObjectError";
  } else {
    internalMessage = String(error);
    causeType = "PrimitiveError";
  }

  return {
    code: context.code ?? "unknown_error",
    domain: context.domain,
    severity,
    retryable: false,
    user_safe: true,
    safe_message: DEFAULT_SAFE_MESSAGE,
    internal_message: redactErrorMessage(internalMessage),
    cause_type: causeType,
    metadata_redacted: redactObservabilityMetadata(context.metadata ?? {}),
  };
}

// ── Retry check ───────────────────────────────────────────────────────────────

const NON_RETRYABLE_CODES = new Set([
  "tenant_mismatch",
  "security_violation",
  "budget_exceeded",
  "validation_missing",
  "sensitive_blocked",
  "email_blocked_by_policy",
  "rgpd_purge_blocked",
  "workflow_hard_fail",
  "unauthorized",
  "forbidden",
]);

export function isRetryableObservableError(error: ObservableError): boolean {
  if (NON_RETRYABLE_CODES.has(error.code)) return false;
  if (error.severity === "critical") return false;
  return error.retryable;
}

// ── Safe user message ─────────────────────────────────────────────────────────

export function toSafeUserMessage(error: ObservableError): string {
  return error.safe_message || DEFAULT_SAFE_MESSAGE;
}

// ── Internal error log ────────────────────────────────────────────────────────

export function toInternalErrorLog(error: ObservableError): Record<string, unknown> {
  return {
    code: error.code,
    domain: error.domain,
    severity: error.severity,
    retryable: error.retryable,
    internal_message: error.internal_message,
    cause_type: error.cause_type,
    metadata_redacted: error.metadata_redacted,
  };
}

// ── Secret leak assertion ─────────────────────────────────────────────────────

import { containsForbiddenSecretLeak } from "./redaction";

export function assertNoSecretInError(error: ObservableError): void {
  const check = [
    error.safe_message,
    error.internal_message,
    JSON.stringify(error.metadata_redacted),
  ].join(" ");

  if (containsForbiddenSecretLeak(check)) {
    throw new Error(
      `[B43] Secret leak detected in ObservableError (code=${error.code}). ` +
      "Redact all API keys and tokens before logging.",
    );
  }
}
