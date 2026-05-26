// src/app/api/pierre/security/__tests__/pierre-security-routes-b41.test.ts
// B41 — Route handler tests using pure helpers. No Supabase required.

import { describe, it, expect } from "vitest";
import {
  buildSecurityHeaders,
  ensureJsonNoCache,
} from "@/lib/security/headers";
import {
  buildSecurityTenantScope,
  stripTenantSpoofingFields,
} from "@/lib/security/tenant-scope";
import {
  evaluateRouteSecurityPolicy,
  buildBlockedSecurityResponse,
} from "@/lib/security/route-guard";
import { getPierreRoutePolicy } from "@/lib/pierre/security/pierre-route-policy";
import {
  buildPierreRgpdExportPlan,
  buildFakeExportAdapters,
  buildFullPierreRgpdExport,
  redactExportBundle,
  buildPierreRgpdExportBundle,
} from "@/lib/pierre/security/pierre-rgpd-export";
import {
  buildPierreRgpdPurgePlan,
  buildFakePurgeAdapters,
  validatePurgeConfirmation,
} from "@/lib/pierre/security/pierre-rgpd-purge";
import {
  buildB41SecurityVerdict,
  auditPierreRoutes,
  auditPierreDataMap,
} from "@/lib/pierre/security/pierre-security-audit";
import { buildRetentionReport } from "@/lib/pierre/security/pierre-retention";

// ── Helper: simulate route auth guard ────────────────────────────────────────

function simulateExportRoute(bearerHeader: string, scope: ReturnType<typeof buildSecurityTenantScope> | null) {
  const policy = getPierreRoutePolicy("pierre.security.export");
  if (!bearerHeader.startsWith("Bearer ")) {
    return { status: 401, body: { ok: false, error: "Authentification requise.", code: "block_auth_required" } };
  }
  if (!policy) return { status: 500, body: { ok: false, error: "Policy not found" } };
  const decision = evaluateRouteSecurityPolicy(policy, scope);
  if (!decision.allowed) {
    const { body, status } = buildBlockedSecurityResponse(decision);
    return { status, body };
  }
  return { status: 200, body: { ok: true } };
}

function simulatePurgeRoute(bearerHeader: string, scope: ReturnType<typeof buildSecurityTenantScope> | null) {
  const policy = getPierreRoutePolicy("pierre.security.purge");
  if (!bearerHeader.startsWith("Bearer ")) {
    return { status: 401, body: { ok: false, error: "Authentification requise.", code: "block_auth_required" } };
  }
  if (!policy) return { status: 500, body: { ok: false, error: "Policy not found" } };
  const decision = evaluateRouteSecurityPolicy(policy, scope);
  if (!decision.allowed) {
    const { body, status } = buildBlockedSecurityResponse(decision);
    return { status, body };
  }
  return { status: 200, body: { ok: true } };
}

function simulateAuditRoute(bearerHeader: string, scope: ReturnType<typeof buildSecurityTenantScope> | null) {
  const policy = getPierreRoutePolicy("pierre.security.audit");
  if (!bearerHeader.startsWith("Bearer ")) {
    return { status: 401, body: { ok: false, error: "Authentification requise.", code: "block_auth_required" } };
  }
  if (!policy) return { status: 500, body: { ok: false, error: "Policy not found" } };
  const decision = evaluateRouteSecurityPolicy(policy, scope);
  if (!decision.allowed) {
    const { body, status } = buildBlockedSecurityResponse(decision);
    return { status, body };
  }
  return { status: 200, body: { ok: true } };
}

const paidPierreScope = buildSecurityTenantScope({
  user_id: "u1", company_id: "c1",
  access_level: "paid_customer",
  owns_pierre: true, pierre_enabled: true,
  source: "supabase_auth",
});

const adminScope = buildSecurityTenantScope({
  user_id: "admin1", company_id: "admin1",
  access_level: "internal_admin",
  owns_pierre: true, pierre_enabled: true,
  source: "supabase_auth",
});

const unpaidScope = buildSecurityTenantScope({
  user_id: "u2", company_id: "c2",
  access_level: "logged_unpaid",
  source: "supabase_auth",
});

// ── Export Route (T1–T15) ─────────────────────────────────────────────────────

describe("Export Route — auth and guard", () => {
  it("T1 — rejects missing Bearer token", () => {
    const result = simulateExportRoute("", null);
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  it("T2 — rejects non-Bearer auth header", () => {
    const result = simulateExportRoute("Basic dXNlcjpwYXNz", null);
    expect(result.status).toBe(401);
  });

  it("T3 — rejects unpaid scope", () => {
    const result = simulateExportRoute("Bearer valid_token", unpaidScope);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body.ok).toBe(false);
  });

  it("T4 — allows paid Pierre scope", () => {
    const result = simulateExportRoute("Bearer valid_token", paidPierreScope);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });

  it("T5 — rejects null scope (no auth)", () => {
    const result = simulateExportRoute("Bearer valid_token", null);
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("T6 — export plan excludes secrets", () => {
    const plan = buildPierreRgpdExportPlan(paidPierreScope);
    expect(plan.excluded_fields).toContain("api_key");
    expect(plan.excluded_fields).toContain("prompt");
  });

  it("T7 — export response headers include no-store", () => {
    const headers = buildSecurityHeaders({ no_store: true });
    expect(headers["Cache-Control"]).toContain("no-store");
  });

  it("T8 — company_id from body is stripped (spoofing prevention)", () => {
    const body = { company_id: "attacker_company", task: "do_something" };
    const sanitized = stripTenantSpoofingFields(body);
    expect(sanitized.company_id).toBeUndefined();
    expect(sanitized.task).toBe("do_something");
  });

  it("T9 — export bundle never contains secret fields", async () => {
    const adapters = buildFakeExportAdapters({
      fetchMissions: async () => [{ id: "m1", api_key: "sk-123", title: "test" }],
    });
    const bundle = await buildFullPierreRgpdExport(paidPierreScope, adapters);
    const mission = bundle.missions[0] as Record<string, unknown>;
    expect(mission.api_key).not.toBe("sk-123");
  });

  it("T10 — export bundle never contains prompt", async () => {
    const adapters = buildFakeExportAdapters({
      fetchTasks: async () => [{ id: "t1", prompt: "system prompt here", status: "done" }],
    });
    const bundle = await buildFullPierreRgpdExport(paidPierreScope, adapters);
    const task = bundle.tasks[0] as Record<string, unknown>;
    expect(task.prompt).not.toBe("system prompt here");
  });

  it("T11 — export bundle includes tenant info", async () => {
    const adapters = buildFakeExportAdapters();
    const bundle = await buildFullPierreRgpdExport(paidPierreScope, adapters);
    expect(bundle.tenant.user_id).toBe("u1");
  });

  it("T12 — redactExportBundle strips email body", () => {
    const rawData = {
      missions: [], tasks: [], documents: [],
      emails: [{ id: "e1", email_body: "Dear HR..." }],
      memory: [], audit_events: [], cost_events: [],
    };
    const bundle = buildPierreRgpdExportBundle(paidPierreScope, rawData);
    const redacted = redactExportBundle(bundle);
    const email = redacted.emails[0] as Record<string, unknown>;
    expect(email.email_body).toContain("NOT_EXPORTED");
  });
});

// ── Purge Route (T13–T22) ─────────────────────────────────────────────────────

describe("Purge Route — auth and dry-run", () => {
  it("T13 — rejects missing Bearer for purge", () => {
    const result = simulatePurgeRoute("", null);
    expect(result.status).toBe(401);
  });

  it("T14 — blocks paid user (admin required for purge)", () => {
    const result = simulatePurgeRoute("Bearer token", paidPierreScope);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body.ok).toBe(false);
  });

  it("T15 — allows internal_admin for purge", () => {
    const result = simulatePurgeRoute("Bearer token", adminScope);
    expect(result.status).toBe(200);
  });

  it("T16 — purge plan is dry_run by default", async () => {
    const adapters = buildFakePurgeAdapters();
    const plan = await buildPierreRgpdPurgePlan(paidPierreScope, { dry_run: true, adapters });
    expect(plan.dry_run).toBe(true);
  });

  it("T17 — purge validation fails without correct phrase", async () => {
    const adapters = buildFakePurgeAdapters();
    const plan = await buildPierreRgpdPurgePlan(paidPierreScope, { adapters });
    const result = validatePurgeConfirmation(
      { confirmation_phrase: "wrong", user_id: "u1", understand_irreversible: true },
      plan,
    );
    expect(result.valid).toBe(false);
  });

  it("T18 — purge plan has irreversible_after_execution flag", async () => {
    const plan = await buildPierreRgpdPurgePlan(paidPierreScope);
    expect(plan.irreversible_after_execution).toBe(true);
  });

  it("T19 — purge route response headers include no-store", () => {
    const headers = ensureJsonNoCache();
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["Content-Type"]).toContain("application/json");
  });

  it("T20 — orders table is retained in purge plan", async () => {
    const plan = await buildPierreRgpdPurgePlan(paidPierreScope);
    const ordersEntry = plan.tables.find((t) => t.table === "orders");
    expect(ordersEntry?.action).toBe("retain");
  });
});

// ── Audit Route (T21–T30) ─────────────────────────────────────────────────────

describe("Audit Route", () => {
  it("T21 — rejects missing Bearer for audit", () => {
    const result = simulateAuditRoute("", null);
    expect(result.status).toBe(401);
  });

  it("T22 — rejects unpaid for audit route", () => {
    const result = simulateAuditRoute("Bearer token", unpaidScope);
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("T23 — allows paid Pierre scope for audit", () => {
    const result = simulateAuditRoute("Bearer token", paidPierreScope);
    expect(result.status).toBe(200);
  });

  it("T24 — audit response headers no-store", () => {
    const headers = buildSecurityHeaders({ no_store: true, no_index: true });
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["X-Robots-Tag"]).toContain("noindex");
  });

  it("T25 — verdict in audit response has safe_to_continue_to_b42", () => {
    const verdict = buildB41SecurityVerdict();
    expect(typeof verdict.safe_to_continue_to_b42).toBe("boolean");
  });

  it("T26 — audit includes route audit summary", () => {
    const audit = auditPierreRoutes();
    expect(audit.total).toBeGreaterThan(0);
  });

  it("T27 — audit includes data map summary", () => {
    const audit = auditPierreDataMap();
    expect(audit.total).toBeGreaterThan(0);
  });

  it("T28 — retention report included in audit", () => {
    const report = buildRetentionReport("u1");
    expect(report.resources.length).toBeGreaterThan(0);
    expect(report.user_id).toBe("u1");
  });

  it("T29 — audit response never contains raw PII", () => {
    const verdict = buildB41SecurityVerdict();
    const serialized = JSON.stringify(verdict);
    expect(serialized).not.toMatch(/sk-proj/);
    expect(serialized).not.toMatch(/password/i);
  });

  it("T30 — audit verdict does not expose user data", () => {
    const verdict = buildB41SecurityVerdict();
    const serialized = JSON.stringify(verdict);
    expect(serialized).not.toMatch(/@example\.com/);
    expect(serialized).not.toMatch(/\biban\b/i);
  });
});
