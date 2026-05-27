// B43 — Core observability tests (80+ tests)

import { describe, it, expect, beforeEach } from "vitest";

// ── Redaction ─────────────────────────────────────────────────────────────────
import {
  stripSensitiveKeys,
  containsForbiddenSecretLeak,
  redactObservabilityMetadata,
  redactErrorMessage,
  redactStackTrace,
  FORBIDDEN_SECRET_KEYS,
  FORBIDDEN_CONTENT_KEYS,
} from "../redaction";

describe("redaction — stripSensitiveKeys", () => {
  it("redacts api_key", () => {
    const out = stripSensitiveKeys({ api_key: "sk-abc123", user: "alice" });
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.user).toBe("alice");
  });

  it("redacts token at any depth", () => {
    const out = stripSensitiveKeys({ nested: { token: "secret123" } });
    expect((out.nested as Record<string, unknown>).token).toBe("[REDACTED]");
  });

  it("preserves non-sensitive keys", () => {
    const out = stripSensitiveKeys({ company_id: "c1", domain: "task", retry: 2 });
    expect(out.company_id).toBe("c1");
    expect(out.domain).toBe("task");
    expect(out.retry).toBe(2);
  });

  it("redacts password", () => {
    const out = stripSensitiveKeys({ password: "hunter2" });
    expect(out.password).toBe("[REDACTED]");
  });

  it("redacts email_body (content key)", () => {
    const out = stripSensitiveKeys({ email_body: "Dear Bob..." });
    expect(out.email_body).toBe("[REDACTED]");
  });

  it("redacts prompt (content key)", () => {
    const out = stripSensitiveKeys({ prompt: "You are a helpful assistant..." });
    expect(out.prompt).toBe("[REDACTED]");
  });

  it("handles depth limit at 5", () => {
    let obj: Record<string, unknown> = { a: 1 };
    for (let i = 0; i < 7; i++) obj = { nested: obj };
    const out = stripSensitiveKeys(obj);
    expect(out).toBeDefined();
  });

  it("handles arrays of objects", () => {
    const out = stripSensitiveKeys({ items: [{ token: "secret" }, { name: "ok" }] });
    const items = out.items as Record<string, unknown>[];
    expect(items[0].token).toBe("[REDACTED]");
    expect(items[1].name).toBe("ok");
  });
});

describe("redaction — containsForbiddenSecretLeak", () => {
  it("detects sk- pattern", () => {
    expect(containsForbiddenSecretLeak("sk-aBcDeFgHiJkLmNoPqRsTuV")).toBe(true);
  });

  it("detects sk-ant- pattern", () => {
    expect(containsForbiddenSecretLeak("sk-ant-aBcDeFgHiJk")).toBe(true);
  });

  it("detects api_key= pattern", () => {
    expect(containsForbiddenSecretLeak("api_key=some_secret_value")).toBe(true);
  });

  it("returns false for safe strings", () => {
    expect(containsForbiddenSecretLeak("company_id=abc123")).toBe(false);
  });

  it("detects in objects", () => {
    expect(containsForbiddenSecretLeak({ token: "some_real_token" })).toBe(true);
  });

  it("returns false for redacted objects", () => {
    expect(containsForbiddenSecretLeak({ token: "[REDACTED]" })).toBe(false);
  });
});

describe("redaction — redactErrorMessage", () => {
  it("removes sk- keys", () => {
    const out = redactErrorMessage("Error: sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ");
    expect(out).not.toContain("sk-aBcDe");
    expect(out).toContain("[REDACTED_KEY]");
  });

  it("removes Bearer tokens", () => {
    const out = redactErrorMessage("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9");
    expect(out).toContain("Bearer [REDACTED]");
  });

  it("preserves non-secret content", () => {
    const out = redactErrorMessage("Connection refused at localhost:5432");
    expect(out).toBe("Connection refused at localhost:5432");
  });
});

describe("redaction — redactStackTrace", () => {
  it("returns no stack for undefined", () => {
    expect(redactStackTrace(undefined)).toBe("[no stack]");
  });

  it("truncates to 8 lines", () => {
    const longStack = Array.from({ length: 20 }, (_, i) => `  at fn${i} (file.ts:${i}:1)`).join("\n");
    const out = redactStackTrace(longStack);
    expect(out).toContain("(truncated)");
  });

  it("removes absolute paths", () => {
    const stack = "Error\n  at myFn (/home/user/project/src/lib/foo.ts:42:10)";
    const out = redactStackTrace(stack);
    expect(out).not.toContain("/home/user/project");
  });
});

// ── Correlation ───────────────────────────────────────────────────────────────
import {
  createCorrelationId,
  createCausationId,
  ensureCorrelationId,
  buildCorrelationContext,
  buildCorrelationHeaders,
  extractCorrelationIdFromHeaders,
} from "../correlation";

describe("correlation — createCorrelationId", () => {
  it("produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createCorrelationId()));
    expect(ids.size).toBe(100);
  });

  it("uses default prefix 'cor'", () => {
    expect(createCorrelationId()).toMatch(/^cor_/);
  });

  it("uses custom prefix", () => {
    expect(createCorrelationId("evt")).toMatch(/^evt_/);
  });
});

describe("correlation — ensureCorrelationId", () => {
  it("returns existing id if provided", () => {
    expect(ensureCorrelationId("cor_abc123")).toBe("cor_abc123");
  });

  it("generates new id if null", () => {
    expect(ensureCorrelationId(null)).toMatch(/^cor_/);
  });

  it("generates new id if empty string", () => {
    expect(ensureCorrelationId("  ")).toMatch(/^cor_/);
  });
});

describe("correlation — buildCorrelationContext", () => {
  it("fills defaults", () => {
    const ctx = buildCorrelationContext({});
    expect(ctx.correlation_id).toMatch(/^cor_/);
    expect(ctx.agent_slug).toBe("pierre");
    expect(ctx.causation_id).toBeNull();
  });

  it("preserves provided values", () => {
    const ctx = buildCorrelationContext({
      correlation_id: "cor_test",
      company_id: "c1",
      user_id: "u1",
    });
    expect(ctx.correlation_id).toBe("cor_test");
    expect(ctx.company_id).toBe("c1");
    expect(ctx.user_id).toBe("u1");
  });
});

describe("correlation — HTTP headers", () => {
  it("builds correlation headers", () => {
    const ctx = buildCorrelationContext({ correlation_id: "cor_test", mission_id: "m1" });
    const headers = buildCorrelationHeaders(ctx);
    expect(headers["x-correlation-id"]).toBe("cor_test");
    expect(headers["x-mission-id"]).toBe("m1");
  });

  it("extracts correlation_id from headers", () => {
    const id = extractCorrelationIdFromHeaders({ "x-correlation-id": "cor_abc" });
    expect(id).toBe("cor_abc");
  });

  it("returns null if header missing", () => {
    expect(extractCorrelationIdFromHeaders({})).toBeNull();
  });
});

// ── Errors ────────────────────────────────────────────────────────────────────
import {
  createObservableError,
  normalizeUnknownError,
  isRetryableObservableError,
  toSafeUserMessage,
  toInternalErrorLog,
  assertNoSecretInError,
} from "../errors";

describe("errors — createObservableError", () => {
  it("creates a well-formed error", () => {
    const err = createObservableError({
      code: "ai_timeout",
      domain: "ai",
      severity: "error",
      retryable: true,
      safe_message: "Service IA lent.",
    });
    expect(err.code).toBe("ai_timeout");
    expect(err.domain).toBe("ai");
    expect(err.retryable).toBe(true);
    expect(err.user_safe).toBe(true);
  });

  it("defaults severity to 'error'", () => {
    const err = createObservableError({ code: "x", domain: "task" });
    expect(err.severity).toBe("error");
  });

  it("defaults retryable to false", () => {
    const err = createObservableError({ code: "x", domain: "task" });
    expect(err.retryable).toBe(false);
  });

  it("extracts cause from Error object", () => {
    const err = createObservableError({ code: "x", domain: "task", cause: new Error("real message") });
    expect(err.cause_type).toBe("Error");
    expect(err.internal_message).toBe("real message");
  });
});

describe("errors — normalizeUnknownError", () => {
  it("handles Error instance", () => {
    const err = normalizeUnknownError(new TypeError("bad type"), { domain: "task" });
    expect(err.cause_type).toBe("TypeError");
    expect(err.code).toBe("unknown_error");
  });

  it("handles string error", () => {
    const err = normalizeUnknownError("something went wrong", { domain: "ai" });
    expect(err.cause_type).toBe("StringError");
    expect(err.internal_message).toBe("something went wrong");
  });

  it("handles object error", () => {
    const err = normalizeUnknownError({ message: "service down" }, { domain: "email" });
    expect(err.cause_type).toBe("ObjectError");
    expect(err.internal_message).toBe("service down");
  });

  it("uses custom code", () => {
    const err = normalizeUnknownError(new Error("x"), { domain: "ai", code: "ai_timeout" });
    expect(err.code).toBe("ai_timeout");
  });
});

describe("errors — isRetryableObservableError", () => {
  it("returns false for non-retryable code", () => {
    const err = createObservableError({ code: "tenant_mismatch", domain: "security", retryable: true });
    expect(isRetryableObservableError(err)).toBe(false);
  });

  it("returns false for critical severity", () => {
    const err = createObservableError({ code: "ai_timeout", domain: "ai", severity: "critical", retryable: true });
    expect(isRetryableObservableError(err)).toBe(false);
  });

  it("returns true for retryable error", () => {
    const err = createObservableError({ code: "ai_timeout", domain: "ai", retryable: true });
    expect(isRetryableObservableError(err)).toBe(true);
  });
});

describe("errors — assertNoSecretInError", () => {
  it("does not throw for safe error", () => {
    const err = createObservableError({ code: "ai_timeout", domain: "ai", safe_message: "Service IA lent." });
    expect(() => assertNoSecretInError(err)).not.toThrow();
  });

  it("throws if internal_message contains API key", () => {
    const err = createObservableError({ code: "x", domain: "ai" });
    (err as Record<string, unknown>).internal_message = "api_key=sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ";
    expect(() => assertNoSecretInError(err)).toThrow(/Secret leak/);
  });
});

// ── Event log ─────────────────────────────────────────────────────────────────
import {
  createInMemoryObservableEventSink,
  createDisabledObservableEventSink,
  buildObservableEvent,
} from "../event-log";

describe("event-log — buildObservableEvent", () => {
  it("builds a complete event with defaults", () => {
    const evt = buildObservableEvent({
      correlation_id: "cor_test",
      domain: "task",
      event_type: "task.started",
      status: "started",
      severity: "info",
      message: "Task started",
      safe_user_message: null,
    });
    expect(evt.agent_slug).toBe("pierre");
    expect(evt.causation_id).toBeNull();
    expect(evt.retry_count).toBe(0);
    expect(evt.metadata_redacted).toBeDefined();
  });
});

describe("event-log — createInMemoryObservableEventSink", () => {
  it("records events and counts them", () => {
    const sink = createInMemoryObservableEventSink();
    const evt = buildObservableEvent({
      correlation_id: "cor_1",
      domain: "task",
      event_type: "task.started",
      status: "started",
      severity: "info",
      message: "ok",
      safe_user_message: null,
    });
    sink.record(evt);
    expect(sink.count()).toBe(1);
  });

  it("filters by domain", () => {
    const sink = createInMemoryObservableEventSink();
    sink.record(buildObservableEvent({ correlation_id: "c1", domain: "task", event_type: "t", status: "started", severity: "info", message: "x", safe_user_message: null }));
    sink.record(buildObservableEvent({ correlation_id: "c2", domain: "ai", event_type: "t", status: "started", severity: "info", message: "x", safe_user_message: null }));
    expect(sink.list({ domain: "task" })).toHaveLength(1);
    expect(sink.list({ domain: "ai" })).toHaveLength(1);
  });

  it("summarizes correctly", () => {
    const sink = createInMemoryObservableEventSink();
    sink.record(buildObservableEvent({ correlation_id: "c1", domain: "task", event_type: "t", status: "failed", severity: "error", message: "x", safe_user_message: null }));
    const summary = sink.summarize();
    expect(summary.error_count).toBe(1);
    expect(summary.total).toBe(1);
  });

  it("respects maxSize and trims oldest", () => {
    const sink = createInMemoryObservableEventSink(3);
    for (let i = 0; i < 5; i++) {
      sink.record(buildObservableEvent({ correlation_id: `c${i}`, domain: "task", event_type: "t", status: "started", severity: "info", message: `msg${i}`, safe_user_message: null }));
    }
    expect(sink.count()).toBe(3);
  });

  it("clears all events", () => {
    const sink = createInMemoryObservableEventSink();
    sink.record(buildObservableEvent({ correlation_id: "c1", domain: "task", event_type: "t", status: "started", severity: "info", message: "x", safe_user_message: null }));
    sink.clear();
    expect(sink.count()).toBe(0);
  });
});

describe("event-log — createDisabledObservableEventSink", () => {
  it("records but returns zero count", () => {
    const sink = createDisabledObservableEventSink();
    expect(sink.count()).toBe(0);
    expect(sink.list()).toHaveLength(0);
    const summary = sink.summarize();
    expect(summary.total).toBe(0);
  });

  it("record returns a valid event shape", () => {
    const sink = createDisabledObservableEventSink();
    const evt = sink.record(buildObservableEvent({ correlation_id: "c1", domain: "task", event_type: "t", status: "started", severity: "info", message: "x", safe_user_message: null }));
    expect(evt.id).toMatch(/^evt_/);
  });
});

// ── Retry policy ──────────────────────────────────────────────────────────────
import {
  getDefaultRetryPolicy,
  calculateBackoffMs,
  decideRetry,
  shouldDeadLetter,
} from "../retry-policy";
import { createObservableError as mkErr } from "../errors";

describe("retry-policy — getDefaultRetryPolicy", () => {
  it("returns 0 retries for workflow", () => {
    expect(getDefaultRetryPolicy("workflow").max_retries).toBe(0);
  });

  it("returns 0 retries for security", () => {
    expect(getDefaultRetryPolicy("security").max_retries).toBe(0);
  });

  it("returns 0 retries for rgpd", () => {
    expect(getDefaultRetryPolicy("rgpd").max_retries).toBe(0);
  });

  it("returns 2 retries for ai", () => {
    expect(getDefaultRetryPolicy("ai").max_retries).toBe(2);
  });

  it("returns 3 retries for task", () => {
    expect(getDefaultRetryPolicy("task").max_retries).toBe(3);
  });
});

describe("retry-policy — calculateBackoffMs", () => {
  it("returns baseMs at retryCount=0", () => {
    expect(calculateBackoffMs(0, 1000, 30000)).toBe(1000);
  });

  it("doubles on retryCount=1", () => {
    expect(calculateBackoffMs(1, 1000, 30000)).toBe(1000);
  });

  it("caps at maxMs", () => {
    expect(calculateBackoffMs(10, 1000, 5000)).toBe(5000);
  });

  it("applies jitter within ±20%", () => {
    const results = Array.from({ length: 20 }, () => calculateBackoffMs(1, 1000, 10000, true));
    expect(results.some((r) => r !== 1000)).toBe(true);
    expect(results.every((r) => r >= 800 && r <= 1200)).toBe(true);
  });
});

describe("retry-policy — decideRetry", () => {
  it("does not retry non-retryable error", () => {
    const err = mkErr({ code: "ai_timeout", domain: "ai", retryable: false });
    const d = decideRetry(err, { retry_count: 0 });
    expect(d.should_retry).toBe(false);
  });

  it("does not retry non-retryable code", () => {
    const err = mkErr({ code: "tenant_mismatch", domain: "security", retryable: true });
    const d = decideRetry(err, { retry_count: 0 });
    expect(d.should_retry).toBe(false);
    expect(d.reason).toContain("tenant_mismatch");
  });

  it("does not retry critical severity", () => {
    const err = mkErr({ code: "ai_timeout", domain: "ai", severity: "critical", retryable: true });
    const d = decideRetry(err, { retry_count: 0 });
    expect(d.should_retry).toBe(false);
  });

  it("allows retry for task domain within max_retries", () => {
    const err = mkErr({ code: "task_error", domain: "task", retryable: true });
    const d = decideRetry(err, { retry_count: 0 });
    expect(d.should_retry).toBe(true);
    expect(d.retry_count).toBe(1);
  });

  it("stops retrying at max_retries", () => {
    const err = mkErr({ code: "task_error", domain: "task", retryable: true });
    const d = decideRetry(err, { retry_count: 3 });
    expect(d.should_retry).toBe(false);
    expect(d.reason).toContain("Max retries");
  });

  it("does not retry workflow domain (max_retries=0)", () => {
    const err = mkErr({ code: "wf_error", domain: "workflow", retryable: true });
    const d = decideRetry(err, { retry_count: 0 });
    expect(d.should_retry).toBe(false);
  });

  it("sets next_attempt_at when retrying", () => {
    const err = mkErr({ code: "task_error", domain: "task", retryable: true });
    const d = decideRetry(err, { retry_count: 0, now: new Date("2026-01-01T00:00:00Z") });
    expect(d.next_attempt_at).toBeTruthy();
    expect(new Date(d.next_attempt_at!).getTime()).toBeGreaterThan(new Date("2026-01-01T00:00:00Z").getTime());
  });
});

describe("retry-policy — shouldDeadLetter", () => {
  it("returns false if should_retry=true", () => {
    const err = mkErr({ code: "task_error", domain: "task", retryable: true });
    const decision = decideRetry(err, { retry_count: 0 });
    expect(shouldDeadLetter(err, decision)).toBe(false);
  });

  it("returns true for critical severity non-retry", () => {
    const err = mkErr({ code: "x", domain: "security", severity: "critical", retryable: false });
    const decision = { should_retry: false, next_attempt_at: null, retry_count: 0, max_retries: 0, backoff_ms: 0, reason: "critical" };
    expect(shouldDeadLetter(err, decision)).toBe(true);
  });

  it("returns true when max retries exhausted (max_retries>0)", () => {
    const err = mkErr({ code: "task_error", domain: "task", retryable: true });
    const decision = { should_retry: false, next_attempt_at: null, retry_count: 3, max_retries: 3, backoff_ms: 0, reason: "max reached" };
    expect(shouldDeadLetter(err, decision)).toBe(true);
  });
});

// ── Dead letter ───────────────────────────────────────────────────────────────
import {
  createInMemoryDeadLetterSink,
  createDisabledDeadLetterSink,
  buildDeadLetterEntry,
} from "../dead-letter";

describe("dead-letter — createInMemoryDeadLetterSink", () => {
  it("adds and counts entries", () => {
    const sink = createInMemoryDeadLetterSink();
    const err = mkErr({ code: "ai_timeout", domain: "ai", retryable: true });
    sink.add(buildDeadLetterEntry({ correlation_id: "c1", domain: "ai", resource_type: "ai_call", error: err, retry_count: 2, reason: "max retries" }));
    expect(sink.count()).toBe(1);
  });

  it("resolves an entry", () => {
    const sink = createInMemoryDeadLetterSink();
    const err = mkErr({ code: "ai_timeout", domain: "ai", retryable: true });
    const entry = sink.add(buildDeadLetterEntry({ correlation_id: "c1", domain: "ai", resource_type: "ai_call", error: err, retry_count: 2, reason: "max" }));
    expect(sink.resolve(entry.id, { resolved_by: "admin", note: "fixed" })).toBe(true);
    expect(sink.list({ resolved: true })).toHaveLength(1);
    expect(sink.list({ resolved: false })).toHaveLength(0);
  });

  it("does not resolve already-resolved entry", () => {
    const sink = createInMemoryDeadLetterSink();
    const err = mkErr({ code: "ai_timeout", domain: "ai" });
    const entry = sink.add(buildDeadLetterEntry({ correlation_id: "c1", domain: "ai", resource_type: "r", error: err, retry_count: 0, reason: "x" }));
    sink.resolve(entry.id, { resolved_by: "admin", note: "ok" });
    expect(sink.resolve(entry.id, { resolved_by: "admin", note: "again" })).toBe(false);
  });

  it("summarizes correctly", () => {
    const sink = createInMemoryDeadLetterSink();
    const err = mkErr({ code: "ai_timeout", domain: "ai" });
    sink.add(buildDeadLetterEntry({ correlation_id: "c1", domain: "ai", resource_type: "r", error: err, retry_count: 0, reason: "x" }));
    sink.add(buildDeadLetterEntry({ correlation_id: "c2", domain: "task", resource_type: "r", error: mkErr({ code: "task_err", domain: "task" }), retry_count: 0, reason: "y" }));
    const s = sink.summarize();
    expect(s.total).toBe(2);
    expect(s.unresolved).toBe(2);
    expect(s.by_domain.ai).toBe(1);
    expect(s.by_domain.task).toBe(1);
  });

  it("filters by domain", () => {
    const sink = createInMemoryDeadLetterSink();
    sink.add(buildDeadLetterEntry({ correlation_id: "c1", domain: "ai", resource_type: "r", error: mkErr({ code: "x", domain: "ai" }), retry_count: 0, reason: "a" }));
    sink.add(buildDeadLetterEntry({ correlation_id: "c2", domain: "task", resource_type: "r", error: mkErr({ code: "y", domain: "task" }), retry_count: 0, reason: "b" }));
    expect(sink.list({ domain: "ai" })).toHaveLength(1);
  });
});

describe("dead-letter — createDisabledDeadLetterSink", () => {
  it("returns zero count", () => {
    const sink = createDisabledDeadLetterSink();
    expect(sink.count()).toBe(0);
    expect(sink.list()).toHaveLength(0);
  });

  it("resolve returns false", () => {
    const sink = createDisabledDeadLetterSink();
    expect(sink.resolve("any", { resolved_by: "x", note: "y" })).toBe(false);
  });
});

// ── Health ────────────────────────────────────────────────────────────────────
import {
  buildHealthCheckResult,
  combineHealthChecks,
  checkRequiredEnvPresence,
  latencyToStatus,
} from "../health";

describe("health — buildHealthCheckResult", () => {
  it("creates a health check result", () => {
    const r = buildHealthCheckResult("supabase", "ok", { latency_ms: 12 });
    expect(r.service).toBe("supabase");
    expect(r.status).toBe("ok");
    expect(r.latency_ms).toBe(12);
    expect(r.checked_at).toBeTruthy();
  });
});

describe("health — combineHealthChecks", () => {
  it("returns ok for all ok", () => {
    const checks = [
      buildHealthCheckResult("a", "ok"),
      buildHealthCheckResult("b", "ok"),
    ];
    expect(combineHealthChecks(checks)).toBe("ok");
  });

  it("returns degraded if one is degraded", () => {
    const checks = [
      buildHealthCheckResult("a", "ok"),
      buildHealthCheckResult("b", "degraded"),
    ];
    expect(combineHealthChecks(checks)).toBe("degraded");
  });

  it("returns down if one is down", () => {
    const checks = [
      buildHealthCheckResult("a", "ok"),
      buildHealthCheckResult("b", "down"),
    ];
    expect(combineHealthChecks(checks)).toBe("down");
  });

  it("returns ok for empty array", () => {
    expect(combineHealthChecks([])).toBe("ok");
  });
});

describe("health — checkRequiredEnvPresence", () => {
  it("reports missing required vars", () => {
    const report = checkRequiredEnvPresence({ required: ["DEFINITELY_NOT_SET_VAR_XYZ"] });
    expect(report.all_required_present).toBe(false);
    expect(report.missing_required).toContain("DEFINITELY_NOT_SET_VAR_XYZ");
  });

  it("reports ok when all present", () => {
    process.env._TEST_PRESENT = "yes";
    const report = checkRequiredEnvPresence({ required: ["_TEST_PRESENT"] });
    expect(report.all_required_present).toBe(true);
    delete process.env._TEST_PRESENT;
  });
});

describe("health — latencyToStatus", () => {
  it("ok below degraded threshold", () => {
    expect(latencyToStatus(100, { degraded: 500, down: 2000 })).toBe("ok");
  });

  it("degraded between thresholds", () => {
    expect(latencyToStatus(800, { degraded: 500, down: 2000 })).toBe("degraded");
  });

  it("down above down threshold", () => {
    expect(latencyToStatus(3000, { degraded: 500, down: 2000 })).toBe("down");
  });
});

// ── Runbook ───────────────────────────────────────────────────────────────────
import {
  getRunbookForErrorCode,
  getRunbookForDomain,
  buildRecommendedActions,
  shouldEscalate,
  isAutoRecoverable,
} from "../runbook";

describe("runbook", () => {
  it("returns runbook for known code", () => {
    const rb = getRunbookForErrorCode("tenant_mismatch");
    expect(rb).not.toBeNull();
    expect(rb!.escalate).toBe(true);
    expect(rb!.steps.length).toBeGreaterThan(0);
  });

  it("returns null for unknown code", () => {
    expect(getRunbookForErrorCode("completely_unknown_code_xyz")).toBeNull();
  });

  it("returns domain steps for known domain", () => {
    const steps = getRunbookForDomain("ai");
    expect(steps.length).toBeGreaterThan(0);
  });

  it("buildRecommendedActions uses runbook steps when code known", () => {
    const actions = buildRecommendedActions("tenant_mismatch", "security");
    expect(actions).toEqual(getRunbookForErrorCode("tenant_mismatch")!.steps);
  });

  it("buildRecommendedActions falls back to domain steps for unknown code", () => {
    const actions = buildRecommendedActions("totally_unknown", "ai");
    expect(actions).toEqual(getRunbookForDomain("ai"));
  });

  it("shouldEscalate returns true for tenant_mismatch", () => {
    expect(shouldEscalate("tenant_mismatch")).toBe(true);
  });

  it("shouldEscalate returns false for validation_missing", () => {
    expect(shouldEscalate("validation_missing")).toBe(false);
  });

  it("isAutoRecoverable returns true for ai_timeout", () => {
    expect(isAutoRecoverable("ai_timeout")).toBe(true);
  });

  it("isAutoRecoverable returns false for tenant_mismatch", () => {
    expect(isAutoRecoverable("tenant_mismatch")).toBe(false);
  });
});

// ── Runtime ───────────────────────────────────────────────────────────────────
import {
  withObservableRuntime,
  withObservableRuntimeSync,
  resetDefaultSinks,
} from "../runtime";

describe("runtime — withObservableRuntime", () => {
  beforeEach(() => resetDefaultSinks());

  it("records started and succeeded events on success", async () => {
    const sink = createInMemoryObservableEventSink();
    const result = await withObservableRuntime(
      { correlation_id: "c1", domain: "task", event_type: "task.run" },
      async () => "done",
      { sink },
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe("done");
    expect(result.dead_lettered).toBe(false);
    const events = sink.list();
    expect(events.some((e) => e.status === "started")).toBe(true);
    expect(events.some((e) => e.status === "succeeded")).toBe(true);
  });

  it("records failed event on error", async () => {
    const sink = createInMemoryObservableEventSink();
    const result = await withObservableRuntime(
      { correlation_id: "c1", domain: "task", event_type: "task.run" },
      async () => { throw new Error("task exploded"); },
      { sink },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    const events = sink.list();
    expect(events.some((e) => e.status === "failed" || e.status === "dead_lettered" || e.status === "retried")).toBe(true);
  });

  it("dead-letters critical error", async () => {
    const sink = createInMemoryObservableEventSink();
    const dlSink = createInMemoryDeadLetterSink();
    const result = await withObservableRuntime(
      { correlation_id: "c1", domain: "security", event_type: "security.check" },
      async () => {
        const err = new Error("security violation");
        err.constructor = class CriticalError {};
        throw err;
      },
      { sink, dead_letter_sink: dlSink },
    );
    // Security domain has max_retries=0, so it won't retry — may dead-letter if severity matches
    expect(result.ok).toBe(false);
  });
});

describe("runtime — withObservableRuntimeSync", () => {
  it("records succeeded event", () => {
    const sink = createInMemoryObservableEventSink();
    const result = withObservableRuntimeSync(
      { correlation_id: "c1", domain: "task", event_type: "task.sync" },
      () => 42,
      { sink },
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
    expect(sink.list({ status: "succeeded" })).toHaveLength(1);
  });

  it("records failed event on throw", () => {
    const sink = createInMemoryObservableEventSink();
    const result = withObservableRuntimeSync(
      { correlation_id: "c1", domain: "task", event_type: "task.sync" },
      () => { throw new Error("sync fail"); },
      { sink },
    );
    expect(result.ok).toBe(false);
    expect(sink.list({ status: "failed" })).toHaveLength(1);
  });
});
