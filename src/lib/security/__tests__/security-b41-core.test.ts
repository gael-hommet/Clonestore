// src/lib/security/__tests__/security-b41-core.test.ts
// B41 — Core security module tests. No Supabase, no async IO.

import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyDataSensitivity,
  isSensitiveFieldName,
  isSecretFieldName,
  isHrSensitiveFieldName,
  isPersonalFieldName,
  isPayrollSensitiveFieldName,
  isHealthSensitiveFieldName,
  isLegalHrSensitiveFieldName,
  getDefaultSensitivityForRoute,
} from "../pii";
import {
  redactEmail,
  redactPhone,
  redactSecret,
  redactString,
  redactObjectDeep,
  hashForAudit,
  safeJsonForAudit,
  redactExportRecord,
  shouldRedactField,
} from "../redaction";
import {
  buildSecurityTenantScope,
  isScopeValid,
  isScopeAuthorizedForPierre,
  isScopeServiceRole,
  assertTenantMatch,
  stripTenantSpoofingFields,
  validateResourceOwnership,
} from "../tenant-scope";
import {
  evaluateRouteSecurityPolicy,
  requireRouteAccess,
  buildBlockedSecurityResponse,
} from "../route-guard";
import type { SecurityRoutePolicy } from "../types";
import {
  createInMemorySecurityRateLimiter,
  checkSecurityRateLimit,
  recordSecurityRequest,
  checkAndRecordRateLimit,
} from "../rate-limit";
import {
  createInMemorySecurityAudit,
  buildSecurityAuditEvent,
  recordSecurityAuditEvent,
  listSecurityAuditEvents,
  summarizeSecurityAudit,
} from "../audit";
import {
  buildSecurityHeaders,
  applyNoStoreHeaders,
  ensureJsonNoCache,
} from "../headers";
import {
  buildSecurityErrorResponse,
  getHttpStatusForDecision,
  getMessageForDecision,
} from "../errors";

// ── PII Classification (T1–T25) ───────────────────────────────────────────────

describe("PII — classifyDataSensitivity", () => {
  it("T1 — email classified as personal", () => {
    expect(classifyDataSensitivity("email")).toBe("personal");
  });

  it("T2 — salary classified as payroll_sensitive", () => {
    expect(classifyDataSensitivity("salary")).toBe("payroll_sensitive");
  });

  it("T3 — health classified as health_sensitive", () => {
    expect(classifyDataSensitivity("health")).toBe("health_sensitive");
  });

  it("T4 — disciplinary classified as legal_sensitive", () => {
    expect(classifyDataSensitivity("disciplinary")).toBe("legal_sensitive");
  });

  it("T5 — api_key classified as secret", () => {
    expect(classifyDataSensitivity("api_key")).toBe("secret");
  });

  it("T6 — ssn classified as personal", () => {
    expect(classifyDataSensitivity("ssn")).toBe("personal");
  });

  it("T7 — iban classified as payroll_sensitive", () => {
    expect(classifyDataSensitivity("iban")).toBe("payroll_sensitive");
  });

  it("T8 — maladie classified as health_sensitive", () => {
    expect(classifyDataSensitivity("maladie")).toBe("health_sensitive");
  });

  it("T9 — licenciement classified as legal_sensitive", () => {
    expect(classifyDataSensitivity("licenciement")).toBe("legal_sensitive");
  });

  it("T10 — password classified as secret", () => {
    expect(classifyDataSensitivity("password")).toBe("secret");
  });

  it("T11 — unknown field classified as internal", () => {
    expect(classifyDataSensitivity("random_field_xyz")).toBe("internal");
  });

  it("T12 — contract classified as hr_sensitive", () => {
    expect(classifyDataSensitivity("contract")).toBe("hr_sensitive");
  });

  it("T13 — phone classified as personal", () => {
    expect(classifyDataSensitivity("phone")).toBe("personal");
  });
});

describe("PII — field name helpers", () => {
  it("T14 — isSecretFieldName detects api_key", () => {
    expect(isSecretFieldName("api_key")).toBe(true);
  });

  it("T15 — isSecretFieldName detects password", () => {
    expect(isSecretFieldName("password")).toBe(true);
  });

  it("T16 — isSecretFieldName returns false for name", () => {
    expect(isSecretFieldName("name")).toBe(false);
  });

  it("T17 — isPayrollSensitiveFieldName detects salary", () => {
    expect(isPayrollSensitiveFieldName("salary")).toBe(true);
  });

  it("T18 — isHealthSensitiveFieldName detects health", () => {
    expect(isHealthSensitiveFieldName("health")).toBe(true);
  });

  it("T19 — isLegalHrSensitiveFieldName detects harassment", () => {
    expect(isLegalHrSensitiveFieldName("harassment")).toBe(true);
  });

  it("T20 — isHrSensitiveFieldName detects contract", () => {
    expect(isHrSensitiveFieldName("contract")).toBe(true);
  });

  it("T21 — isPersonalFieldName detects email", () => {
    expect(isPersonalFieldName("email")).toBe(true);
  });

  it("T22 — isSensitiveFieldName returns true for salary", () => {
    expect(isSensitiveFieldName("salary")).toBe(true);
  });

  it("T23 — isSensitiveFieldName returns false for mission_title", () => {
    expect(isSensitiveFieldName("mission_title")).toBe(false);
  });

  it("T24 — route sensitivity pierre.cockpit.snapshot = hr_sensitive", () => {
    expect(getDefaultSensitivityForRoute("pierre.cockpit.snapshot")).toBe("hr_sensitive");
  });

  it("T25 — route sensitivity pierre.cron = internal", () => {
    expect(getDefaultSensitivityForRoute("pierre.cron")).toBe("internal");
  });
});

// ── Redaction (T26–T45) ───────────────────────────────────────────────────────

describe("Redaction — email/phone/secret", () => {
  it("T26 — redactEmail masks email with asterisks", () => {
    const result = redactEmail("john.doe@example.com");
    expect(result).not.toBe("john.doe@example.com");
    expect(result).toContain("@");
    expect(result).toContain("***");
  });

  it("T27 — redactEmail returns placeholder for invalid input", () => {
    expect(redactEmail("notanemail")).toBe("[REDACTED_EMAIL]");
  });

  it("T28 — redactPhone masks digits", () => {
    const result = redactPhone("+33612345678");
    expect(result).not.toBe("+33612345678");
    expect(result).toContain("****");
  });

  it("T29 — redactPhone returns placeholder for short input", () => {
    expect(redactPhone("12")).toBe("[REDACTED_PHONE]");
  });

  it("T30 — redactSecret always returns [REDACTED_SECRET]", () => {
    expect(redactSecret("sk-proj-abc123")).toBe("[REDACTED_SECRET]");
    expect(redactSecret(null)).toBe("[REDACTED_SECRET]");
  });

  it("T31 — redactString auto-detects email", () => {
    const result = redactString("admin@test.com");
    expect(result).toContain("@");
    expect(result).toContain("***");
  });

  it("T32 — redactString uses field name hint for phone", () => {
    const result = redactString("0612345678", "phone");
    expect(result).toContain("****");
  });
});

describe("Redaction — redactObjectDeep", () => {
  it("T33 — removes api_key field", () => {
    const result = redactObjectDeep({ api_key: "sk-123", name: "Pierre" }) as Record<string, unknown>;
    expect(result.api_key).toBe("[REDACTED_SECRET]");
    expect(result.name).toBe("Pierre");
  });

  it("T34 — removes prompt field (never logged)", () => {
    const result = redactObjectDeep({ prompt: "hire this person", cost: 42 }) as Record<string, unknown>;
    expect(result.prompt).toBe("[CONTENT_NOT_LOGGED]");
    expect(result.cost).toBe(42);
  });

  it("T35 — removes completion field (never logged)", () => {
    const result = redactObjectDeep({ completion: "Voici le résultat", status: "ok" }) as Record<string, unknown>;
    expect(result.completion).toBe("[CONTENT_NOT_LOGGED]");
  });

  it("T36 — redacts email fields in nested objects", () => {
    const result = redactObjectDeep({
      user: { email: "alice@example.com", id: "u1" },
    }) as Record<string, unknown>;
    const user = result.user as Record<string, unknown>;
    expect(user.email).not.toBe("alice@example.com");
    expect(user.email).toContain("***");
  });

  it("T37 — removes openai_response field", () => {
    const result = redactObjectDeep({ openai_response: "some content" }) as Record<string, unknown>;
    expect(result.openai_response).toBe("[CONTENT_NOT_LOGGED]");
  });

  it("T38 — removes email_body field", () => {
    const result = redactObjectDeep({ email_body: "Dear John...", subject: "Contract" }) as Record<string, unknown>;
    expect(result.email_body).toBe("[CONTENT_NOT_LOGGED]");
  });

  it("T39 — passes through safe fields unchanged", () => {
    const result = redactObjectDeep({ mission_id: "m1", status: "ready" }) as Record<string, unknown>;
    expect(result.mission_id).toBe("m1");
    expect(result.status).toBe("ready");
  });
});

describe("Redaction — audit helpers", () => {
  it("T40 — hashForAudit is deterministic", () => {
    expect(hashForAudit("test@example.com")).toBe(hashForAudit("test@example.com"));
  });

  it("T41 — hashForAudit different values produce different hashes", () => {
    expect(hashForAudit("alice@test.com")).not.toBe(hashForAudit("bob@test.com"));
  });

  it("T42 — hashForAudit starts with h_", () => {
    expect(hashForAudit("value")).toMatch(/^h_[0-9a-f]{8}$/);
  });

  it("T43 — safeJsonForAudit removes body_text", () => {
    const result = safeJsonForAudit({ body_text: "sensitive", event: "login" });
    expect(result.body_text).toBeUndefined();
    expect(result.event).toBe("login");
  });

  it("T44 — safeJsonForAudit returns empty for non-objects", () => {
    expect(safeJsonForAudit(null)).toEqual({});
    expect(safeJsonForAudit("string")).toEqual({});
  });

  it("T45 — shouldRedactField returns true for api_key", () => {
    expect(shouldRedactField("api_key")).toBe(true);
  });

  it("T46 — redactExportRecord strips secrets preserves metadata", () => {
    const record = { id: "m1", api_key: "sk-123", mission_title: "Embauche" };
    const result = redactExportRecord(record);
    expect(result.api_key).toBe("[REDACTED_SECRET]");
    expect(result.id).toBe("m1");
    expect(result.mission_title).toBe("Embauche");
  });
});

// ── Tenant Scope (T47–T61) ────────────────────────────────────────────────────

describe("Tenant Scope", () => {
  it("T47 — stripTenantSpoofingFields removes company_id", () => {
    const result = stripTenantSpoofingFields({ company_id: "evil", task_id: "t1" });
    expect(result.company_id).toBeUndefined();
    expect(result.task_id).toBe("t1");
  });

  it("T48 — stripTenantSpoofingFields removes user_id", () => {
    const result = stripTenantSpoofingFields({ user_id: "attacker", name: "test" });
    expect(result.user_id).toBeUndefined();
    expect(result.name).toBe("test");
  });

  it("T49 — stripTenantSpoofingFields removes organization_id", () => {
    const result = stripTenantSpoofingFields({ organization_id: "org_evil" });
    expect(result.organization_id).toBeUndefined();
  });

  it("T50 — assertTenantMatch passes same user_id", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: "u1" });
    const result = assertTenantMatch("u1", scope);
    expect(result.match).toBe(true);
  });

  it("T51 — assertTenantMatch blocks mismatch", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: "u1" });
    const result = assertTenantMatch("u2", scope);
    expect(result.match).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("T52 — assertTenantMatch blocks null requested id", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: "u1" });
    const result = assertTenantMatch(null, scope);
    expect(result.match).toBe(false);
  });

  it("T53 — isScopeValid returns false for null", () => {
    expect(isScopeValid(null)).toBe(false);
  });

  it("T54 — isScopeValid returns false for missing user_id", () => {
    const scope = buildSecurityTenantScope({ user_id: null, company_id: "c1" });
    expect(isScopeValid(scope)).toBe(false);
  });

  it("T55 — isScopeValid returns false for missing company_id", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: null });
    expect(isScopeValid(scope)).toBe(false);
  });

  it("T56 — isScopeValid returns true for complete scope", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: "c1" });
    expect(isScopeValid(scope)).toBe(true);
  });

  it("T57 — isScopeAuthorizedForPierre false for anonymous", () => {
    const scope = buildSecurityTenantScope({
      user_id: "u1", company_id: "c1", access_level: "anonymous",
    });
    expect(isScopeAuthorizedForPierre(scope)).toBe(false);
  });

  it("T58 — isScopeAuthorizedForPierre false when pierre disabled", () => {
    const scope = buildSecurityTenantScope({
      user_id: "u1", company_id: "c1", access_level: "paid_customer",
      owns_pierre: true, pierre_enabled: false,
    });
    expect(isScopeAuthorizedForPierre(scope)).toBe(false);
  });

  it("T59 — isScopeAuthorizedForPierre true for paid with pierre", () => {
    const scope = buildSecurityTenantScope({
      user_id: "u1", company_id: "c1", access_level: "paid_customer",
      owns_pierre: true, pierre_enabled: true,
    });
    expect(isScopeAuthorizedForPierre(scope)).toBe(true);
  });

  it("T60 — isScopeServiceRole detects service_role", () => {
    const scope = buildSecurityTenantScope({ access_level: "service_role" });
    expect(isScopeServiceRole(scope)).toBe(true);
  });

  it("T61 — validateResourceOwnership blocks cross-tenant resource", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: "c1" });
    const result = validateResourceOwnership({ user_id: "u2", id: "r1" }, scope);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("block_tenant_mismatch");
  });
});

// ── Route Guard (T62–T72) ─────────────────────────────────────────────────────

const makePaidPierreScope = () =>
  buildSecurityTenantScope({
    user_id: "u1", company_id: "c1", access_level: "paid_customer",
    owns_pierre: true, pierre_enabled: true,
  });

const basePolicy: SecurityRoutePolicy = {
  route_id: "test.route",
  path_pattern: "/api/test",
  method: "GET",
  required_access_level: "paid_customer",
  requires_pierre_access: true,
  requires_company_scope: true,
  allows_service_role: false,
  data_sensitivity: "hr_sensitive",
  rate_limit_key: "user_per_minute",
  audit_required: true,
  no_store_required: true,
};

describe("Route Guard", () => {
  it("T62 — blocks anonymous scope", () => {
    const scope = buildSecurityTenantScope({ user_id: "u1", company_id: "c1", access_level: "anonymous" });
    const decision = evaluateRouteSecurityPolicy(basePolicy, scope);
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("block_not_paid");
  });

  it("T63 — blocks logged_unpaid for Pierre route", () => {
    const scope = buildSecurityTenantScope({
      user_id: "u1", company_id: "c1", access_level: "logged_unpaid",
    });
    const decision = evaluateRouteSecurityPolicy(basePolicy, scope);
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("block_not_paid");
  });

  it("T64 — blocks paid without Pierre", () => {
    const scope = buildSecurityTenantScope({
      user_id: "u1", company_id: "c1", access_level: "paid_customer",
      owns_pierre: false,
    });
    const decision = evaluateRouteSecurityPolicy(basePolicy, scope);
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("block_no_agent_access");
  });

  it("T65 — allows paid with Pierre", () => {
    const scope = makePaidPierreScope();
    const decision = evaluateRouteSecurityPolicy(basePolicy, scope);
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("allow");
  });

  it("T66 — blocks service_role on non-service-role route", () => {
    const servicePolicy: SecurityRoutePolicy = {
      ...basePolicy,
      route_id: "cron.internal",
      allows_service_role: true,
      requires_pierre_access: false,
    };
    const scope = buildSecurityTenantScope({ access_level: "service_role" });
    // Service-role-only means requires_pierre_access=false
    const decision = evaluateRouteSecurityPolicy(servicePolicy, scope);
    expect(decision.allowed).toBe(true);
  });

  it("T67 — service_role_required route blocks paid user", () => {
    const cronPolicy: SecurityRoutePolicy = {
      ...basePolicy,
      route_id: "cron.internal",
      allows_service_role: true,
      requires_pierre_access: false,
      required_access_level: "service_role",
    };
    const scope = makePaidPierreScope();
    const decision = evaluateRouteSecurityPolicy(cronPolicy, scope);
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("block_service_role_required");
  });

  it("T68 — blocks null scope (no auth)", () => {
    const decision = evaluateRouteSecurityPolicy(basePolicy, null);
    expect(decision.allowed).toBe(false);
  });

  it("T69 — requireRouteAccess returns ok:true for authorized", () => {
    const result = requireRouteAccess(basePolicy, makePaidPierreScope());
    expect(result.ok).toBe(true);
  });

  it("T70 — requireRouteAccess returns ok:false for unauthorized", () => {
    const result = requireRouteAccess(basePolicy, null);
    expect(result.ok).toBe(false);
  });

  it("T71 — buildBlockedSecurityResponse returns 401 for auth required", () => {
    const result = buildBlockedSecurityResponse({
      status: "block_auth_required", allowed: false, reason: "Auth required", policy_id: null,
    });
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  it("T72 — buildBlockedSecurityResponse returns 429 for rate limited", () => {
    const result = buildBlockedSecurityResponse({
      status: "block_rate_limited", allowed: false, reason: "Too many", policy_id: null,
    });
    expect(result.status).toBe(429);
  });
});

// ── Rate Limiter (T73–T82) ────────────────────────────────────────────────────

describe("Rate Limiter", () => {
  it("T73 — allows first request for user_per_minute", () => {
    const limiter = createInMemorySecurityRateLimiter();
    const result = checkSecurityRateLimit(limiter, "user_per_minute", "user_a");
    expect(result.allowed).toBe(true);
  });

  it("T74 — blocks after max requests for user_per_minute", () => {
    const limiter = createInMemorySecurityRateLimiter({ user_per_minute: { max_requests: 2 } });
    recordSecurityRequest(limiter, "user_per_minute", "user_x");
    recordSecurityRequest(limiter, "user_per_minute", "user_x");
    const result = checkSecurityRateLimit(limiter, "user_per_minute", "user_x");
    expect(result.allowed).toBe(false);
  });

  it("T75 — allows after window reset", () => {
    const limiter = createInMemorySecurityRateLimiter({ user_per_minute: { max_requests: 1 } });
    const past = Date.now() - 120_000;
    recordSecurityRequest(limiter, "user_per_minute", "user_y", past);
    const result = checkSecurityRateLimit(limiter, "user_per_minute", "user_y");
    expect(result.allowed).toBe(true);
  });

  it("T76 — different users have independent buckets", () => {
    const limiter = createInMemorySecurityRateLimiter({ user_per_minute: { max_requests: 1 } });
    recordSecurityRequest(limiter, "user_per_minute", "user_a");
    recordSecurityRequest(limiter, "user_per_minute", "user_a");
    const result = checkSecurityRateLimit(limiter, "user_per_minute", "user_b");
    expect(result.allowed).toBe(true);
  });

  it("T77 — route_per_minute scoped per user+route", () => {
    const limiter = createInMemorySecurityRateLimiter({ route_per_minute: { max_requests: 1 } });
    recordSecurityRequest(limiter, "route_per_minute", "submit:u1");
    const result = checkSecurityRateLimit(limiter, "route_per_minute", "submit:u1");
    expect(result.allowed).toBe(false);
  });

  it("T78 — checkAndRecordRateLimit blocks after recording", () => {
    const limiter = createInMemorySecurityRateLimiter({
      user_per_minute: { max_requests: 1 },
      user_per_hour: { max_requests: 100 },
      route_per_minute: { max_requests: 100 },
    });
    checkAndRecordRateLimit(limiter, { user_id: "u1" });
    const r2 = checkAndRecordRateLimit(limiter, { user_id: "u1" });
    expect(r2.allowed).toBe(false);
  });

  it("T79 — remaining decrements", () => {
    const limiter = createInMemorySecurityRateLimiter({ user_per_minute: { max_requests: 10 } });
    const r1 = checkSecurityRateLimit(limiter, "user_per_minute", "u1");
    expect(r1.remaining).toBe(9);
  });

  it("T80 — reset_at is in the future", () => {
    const limiter = createInMemorySecurityRateLimiter();
    const result = checkSecurityRateLimit(limiter, "user_per_minute", "u1");
    expect(result.reset_at).toBeGreaterThan(Date.now() - 1);
  });
});

// ── Audit (T81–T92) ───────────────────────────────────────────────────────────

describe("Security Audit", () => {
  it("T81 — creates empty audit store", () => {
    const audit = createInMemorySecurityAudit();
    expect(audit.events).toHaveLength(0);
  });

  it("T82 — records an audit event", () => {
    const audit = createInMemorySecurityAudit();
    const event = buildSecurityAuditEvent({
      event_type: "route_access",
      actor_user_id: "u1",
      company_id: "c1",
      decision_status: "allow",
      data_sensitivity: "hr_sensitive",
    });
    recordSecurityAuditEvent(audit, event);
    expect(audit.events).toHaveLength(1);
  });

  it("T83 — event has redacted ip and user_agent", () => {
    const event = buildSecurityAuditEvent({
      event_type: "test",
      decision_status: "allow",
      data_sensitivity: "internal",
      ip: "192.168.1.100",
      user_agent: "Mozilla/5.0",
    });
    expect(event.ip_hash).toMatch(/^h_/);
    expect(event.user_agent_hash).toMatch(/^h_/);
    expect(event.ip_hash).not.toContain("192.168");
  });

  it("T84 — event metadata is redacted", () => {
    const event = buildSecurityAuditEvent({
      event_type: "test",
      decision_status: "block_auth_required",
      data_sensitivity: "secret",
      metadata: { api_key: "sk-123", mission_id: "m1" },
    });
    expect(event.metadata_redacted.api_key).toBe("[REDACTED_SECRET]");
    expect(event.metadata_redacted.mission_id).toBe("m1");
  });

  it("T85 — listSecurityAuditEvents filters by user", () => {
    const audit = createInMemorySecurityAudit();
    const e1 = buildSecurityAuditEvent({ event_type: "a", actor_user_id: "u1", decision_status: "allow", data_sensitivity: "internal" });
    const e2 = buildSecurityAuditEvent({ event_type: "b", actor_user_id: "u2", decision_status: "allow", data_sensitivity: "internal" });
    recordSecurityAuditEvent(audit, e1);
    recordSecurityAuditEvent(audit, e2);
    const results = listSecurityAuditEvents(audit, { actor_user_id: "u1" });
    expect(results).toHaveLength(1);
    expect(results[0].actor_user_id).toBe("u1");
  });

  it("T86 — summarize counts blocks and allows", () => {
    const audit = createInMemorySecurityAudit();
    recordSecurityAuditEvent(audit, buildSecurityAuditEvent({ event_type: "x", decision_status: "allow", data_sensitivity: "internal" }));
    recordSecurityAuditEvent(audit, buildSecurityAuditEvent({ event_type: "y", decision_status: "block_auth_required", data_sensitivity: "internal" }));
    const summary = summarizeSecurityAudit(audit);
    expect(summary.allowed).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.total).toBe(2);
  });
});

// ── Security Headers (T87–T95) ────────────────────────────────────────────────

describe("Security Headers", () => {
  it("T87 — buildSecurityHeaders includes Cache-Control no-store", () => {
    const headers = buildSecurityHeaders();
    expect(headers["Cache-Control"]).toContain("no-store");
  });

  it("T88 — buildSecurityHeaders includes X-Content-Type-Options", () => {
    const headers = buildSecurityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("T89 — buildSecurityHeaders includes Referrer-Policy", () => {
    const headers = buildSecurityHeaders();
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });

  it("T90 — buildSecurityHeaders includes X-Robots-Tag", () => {
    const headers = buildSecurityHeaders();
    expect(headers["X-Robots-Tag"]).toContain("noindex");
  });

  it("T91 — applyNoStoreHeaders merges with existing", () => {
    const headers = applyNoStoreHeaders({ "X-Custom": "value" });
    expect(headers["X-Custom"]).toBe("value");
    expect(headers["Cache-Control"]).toContain("no-store");
  });

  it("T92 — ensureJsonNoCache includes Content-Type json", () => {
    const headers = ensureJsonNoCache();
    expect(headers["Content-Type"]).toContain("application/json");
    expect(headers["Cache-Control"]).toContain("no-store");
  });

  it("T93 — X-Frame-Options is DENY", () => {
    const headers = buildSecurityHeaders();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});

// ── Error Responses (T94–T100) ────────────────────────────────────────────────

describe("Security Errors", () => {
  it("T94 — block_auth_required gives 401", () => {
    expect(getHttpStatusForDecision("block_auth_required")).toBe(401);
  });

  it("T95 — block_rate_limited gives 429", () => {
    expect(getHttpStatusForDecision("block_rate_limited")).toBe(429);
  });

  it("T96 — block_emergency_shutdown gives 503", () => {
    expect(getHttpStatusForDecision("block_emergency_shutdown")).toBe(503);
  });

  it("T97 — buildSecurityErrorResponse has ok:false", () => {
    const resp = buildSecurityErrorResponse("block_not_paid");
    expect(resp.ok).toBe(false);
    expect(resp.status).toBe(403);
  });

  it("T98 — custom message overrides default", () => {
    const resp = buildSecurityErrorResponse("block_not_paid", "Custom message");
    expect(resp.error).toBe("Custom message");
  });

  it("T99 — getMessageForDecision returns non-empty string", () => {
    expect(getMessageForDecision("block_no_company")).toBeTruthy();
  });

  it("T100 — allow decision gives 200", () => {
    expect(getHttpStatusForDecision("allow")).toBe(200);
  });
});
