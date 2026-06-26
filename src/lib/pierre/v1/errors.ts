// src/lib/pierre/v1/errors.ts
// PHASE 8.1 — Pierre Production Runtime Core — typed errors.
//
// No silent failures. Every runtime failure is a typed, classified error that
// carries a stable code, an HTTP-ish status, and a redacted-safe message. Never
// throw raw strings; never swallow.

export type RuntimeErrorCode =
  | "unauthenticated"
  | "tenant_access_denied"
  | "tenant_not_migrated"
  | "membership_suspended"
  | "company_suspended"
  | "forbidden"
  | "validation_failed"
  | "not_found"
  | "conflict"
  | "version_conflict"
  | "illegal_transition"
  | "idempotency_replay"
  | "guard_blocked"
  | "unsupported"
  | "rate_limited"
  | "internal";

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  constructor(code: RuntimeErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  unauthenticated: (m = "Authentication required") => new RuntimeError("unauthenticated", m, 401),
  tenantAccessDenied: (m = "Cross-tenant access denied") => new RuntimeError("tenant_access_denied", m, 403),
  tenantNotMigrated: (m = "Account not migrated to v1 runtime") => new RuntimeError("tenant_not_migrated", m, 409),
  membershipSuspended: (m = "Membership suspended") => new RuntimeError("membership_suspended", m, 403),
  companySuspended: (m = "Company suspended") => new RuntimeError("company_suspended", m, 403),
  forbidden: (m = "Permission denied") => new RuntimeError("forbidden", m, 403),
  validation: (m: string, details?: Record<string, unknown>) => new RuntimeError("validation_failed", m, 422, details),
  notFound: (m = "Not found") => new RuntimeError("not_found", m, 404),
  conflict: (m = "Conflict") => new RuntimeError("conflict", m, 409),
  versionConflict: (m = "Optimistic concurrency conflict") => new RuntimeError("version_conflict", m, 409),
  illegalTransition: (from: string, to: string) =>
    new RuntimeError("illegal_transition", `Illegal transition ${from} -> ${to}`, 409, { from, to }),
  guardBlocked: (m: string, details?: Record<string, unknown>) => new RuntimeError("guard_blocked", m, 403, details),
  unsupported: (m = "Unsupported") => new RuntimeError("unsupported", m, 501),
  rateLimited: (m = "Rate limit exceeded") => new RuntimeError("rate_limited", m, 429),
  internal: (m = "Internal runtime error") => new RuntimeError("internal", m, 500),
};

/** Redact an arbitrary thrown value into a safe, typed runtime error. */
export function toRuntimeError(err: unknown): RuntimeError {
  if (err instanceof RuntimeError) return err;
  // Never leak stack traces / raw SQL to callers.
  return Errors.internal();
}

/** Stable client-facing error body (no stack, no internal details unless safe). */
export function errorBody(err: RuntimeError): { error: { code: RuntimeErrorCode; message: string; details?: Record<string, unknown> } } {
  const safeDetails =
    err.code === "validation_failed" || err.code === "illegal_transition" || err.code === "guard_blocked"
      ? err.details
      : undefined;
  return { error: { code: err.code, message: err.message, details: safeDetails } };
}
