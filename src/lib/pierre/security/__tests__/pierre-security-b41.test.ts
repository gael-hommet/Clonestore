// src/lib/pierre/security/__tests__/pierre-security-b41.test.ts
// B41 — Pierre security module tests. No Supabase, no async IO required.

import { describe, it, expect } from "vitest";
import {
  PIERRE_DATA_MAP,
  getPierreResourceByTable,
  getPierreExportableResources,
  getPierrePurgeableResources,
  getPierreHrSensitiveResources,
  getPierrePersonalDataResources,
} from "../pierre-data-map";
import {
  PIERRE_ROUTE_POLICIES,
  getPierreRoutePolicy,
  getPierreHighSensitivityPolicies,
  getPierreCronPolicies,
} from "../pierre-route-policy";
import {
  buildPierreRgpdExportPlan,
  buildFakeExportAdapters,
  collectPierreRgpdExportData,
  buildPierreRgpdExportBundle,
  redactExportBundle,
  buildFullPierreRgpdExport,
} from "../pierre-rgpd-export";
import {
  buildPierreRgpdPurgePlan,
  validatePurgeConfirmation,
  executePierreRgpdPurge,
  buildFakePurgeAdapters,
  anonymizeRetainedBillingData,
} from "../pierre-rgpd-purge";
import {
  getRetentionPolicyForResource,
  shouldRetainResource,
  shouldAnonymizeResource,
  buildRetentionReport,
  getLegalHoldResources,
  getRetentionPolicySummary,
} from "../pierre-retention";
import {
  buildB41SecurityVerdict,
  auditPierreRoutes,
  auditPierreDataMap,
} from "../pierre-security-audit";
import { buildSecurityTenantScope } from "@/lib/security/tenant-scope";

// ── Data Map (T1–T18) ─────────────────────────────────────────────────────────

describe("Pierre Data Map", () => {
  it("T1 — data map includes pierre_missions", () => {
    expect(PIERRE_DATA_MAP.some((r) => r.table === "pierre_missions")).toBe(true);
  });

  it("T2 — data map includes pierre_tasks", () => {
    expect(PIERRE_DATA_MAP.some((r) => r.table === "pierre_tasks")).toBe(true);
  });

  it("T3 — data map includes pierre_company_memory", () => {
    expect(PIERRE_DATA_MAP.some((r) => r.table === "pierre_company_memory")).toBe(true);
  });

  it("T4 — pierre_company_memory is hr_sensitive", () => {
    const mem = getPierreResourceByTable("pierre_company_memory");
    expect(mem?.sensitivity).toBe("hr_sensitive");
  });

  it("T5 — pierre_outbound_emails is exportable", () => {
    const emails = getPierreResourceByTable("pierre_outbound_emails");
    expect(emails?.exportable).toBe(true);
  });

  it("T6 — orders is NOT fully purgeable", () => {
    const orders = getPierreResourceByTable("orders");
    expect(orders?.purgeable).toBe(false);
  });

  it("T7 — orders uses anonymize_instead_of_purge", () => {
    const orders = getPierreResourceByTable("orders");
    expect(orders?.anonymize_instead_of_purge).toBe(true);
  });

  it("T8 — getPierreExportableResources returns non-empty list", () => {
    expect(getPierreExportableResources().length).toBeGreaterThan(5);
  });

  it("T9 — getPierrePurgeableResources excludes orders", () => {
    const purgeable = getPierrePurgeableResources();
    expect(purgeable.some((r) => r.table === "orders")).toBe(false);
  });

  it("T10 — getPierreHrSensitiveResources includes missions and memory", () => {
    const hr = getPierreHrSensitiveResources();
    expect(hr.some((r) => r.table === "pierre_missions")).toBe(true);
    expect(hr.some((r) => r.table === "pierre_company_memory")).toBe(true);
  });

  it("T11 — getPierrePersonalDataResources includes emails", () => {
    const personal = getPierrePersonalDataResources();
    expect(personal.some((r) => r.table === "pierre_outbound_emails")).toBe(true);
  });

  it("T12 — data map total >= 10 resources", () => {
    expect(PIERRE_DATA_MAP.length).toBeGreaterThanOrEqual(10);
  });

  it("T13 — pierre_task_logs has 90d retention", () => {
    const logs = getPierreResourceByTable("pierre_task_logs");
    expect(logs?.retention_policy).toContain("90");
  });

  it("T14 — all resources have tenant_columns defined", () => {
    for (const r of PIERRE_DATA_MAP) {
      expect(r.tenant_columns.length).toBeGreaterThan(0);
    }
  });
});

// ── Route Policies (T15–T30) ──────────────────────────────────────────────────

describe("Pierre Route Policies", () => {
  it("T15 — policy list is non-empty", () => {
    expect(PIERRE_ROUTE_POLICIES.length).toBeGreaterThan(10);
  });

  it("T16 — snapshot policy exists", () => {
    expect(getPierreRoutePolicy("pierre.cockpit.snapshot")).not.toBeNull();
  });

  it("T17 — submit policy exists", () => {
    expect(getPierreRoutePolicy("pierre.use.submit")).not.toBeNull();
  });

  it("T18 — task policy exists", () => {
    expect(getPierreRoutePolicy("pierre.use.task")).not.toBeNull();
  });

  it("T19 — security export policy exists", () => {
    expect(getPierreRoutePolicy("pierre.security.export")).not.toBeNull();
  });

  it("T20 — cron policy is service_role only", () => {
    const cronPolicies = getPierreCronPolicies();
    expect(cronPolicies.length).toBeGreaterThan(0);
    for (const p of cronPolicies) {
      expect(p.allows_service_role).toBe(true);
      expect(p.requires_pierre_access).toBe(false);
    }
  });

  it("T21 — snapshot requires pierre access and paid_customer", () => {
    const p = getPierreRoutePolicy("pierre.cockpit.snapshot");
    expect(p?.requires_pierre_access).toBe(true);
    expect(p?.required_access_level).toBe("paid_customer");
  });

  it("T22 — purge policy requires internal_admin", () => {
    const p = getPierreRoutePolicy("pierre.security.purge");
    expect(p?.required_access_level).toBe("internal_admin");
  });

  it("T23 — export policy has audit_required=true", () => {
    const p = getPierreRoutePolicy("pierre.security.export");
    expect(p?.audit_required).toBe(true);
  });

  it("T24 — all sensitive routes have no_store_required=true", () => {
    const hrPolicies = getPierreHighSensitivityPolicies();
    for (const p of hrPolicies) {
      expect(p.no_store_required).toBe(true);
    }
  });

  it("T25 — submit policy has rate_limit_key set", () => {
    const p = getPierreRoutePolicy("pierre.use.submit");
    expect(p?.rate_limit_key).toBeTruthy();
  });
});

// ── RGPD Export (T31–T50) ─────────────────────────────────────────────────────

describe("Pierre RGPD Export", () => {
  const validScope = buildSecurityTenantScope({
    user_id: "u1",
    company_id: "c1",
    access_level: "paid_customer",
    owns_pierre: true,
    pierre_enabled: true,
    source: "supabase_auth",
  });

  it("T31 — buildPierreRgpdExportPlan includes resources", () => {
    const plan = buildPierreRgpdExportPlan(validScope);
    expect(plan.resources.length).toBeGreaterThan(5);
  });

  it("T32 — plan tenant matches scope", () => {
    const plan = buildPierreRgpdExportPlan(validScope);
    expect(plan.tenant.user_id).toBe("u1");
  });

  it("T33 — plan excludes secrets fields", () => {
    const plan = buildPierreRgpdExportPlan(validScope);
    expect(plan.excluded_fields).toContain("api_key");
  });

  it("T34 — plan excludes prompts/completions", () => {
    const plan = buildPierreRgpdExportPlan(validScope);
    expect(plan.excluded_fields).toContain("prompt");
    expect(plan.excluded_fields).toContain("completion");
  });

  it("T35 — plan format is json", () => {
    const plan = buildPierreRgpdExportPlan(validScope);
    expect(plan.format).toBe("json");
  });

  it("T36 — collectPierreRgpdExportData returns correct shape", async () => {
    const adapters = buildFakeExportAdapters({
      fetchMissions: async () => [{ id: "m1" }],
    });
    const data = await collectPierreRgpdExportData("u1", adapters);
    expect(data.missions).toHaveLength(1);
    expect(data.tasks).toHaveLength(0);
  });

  it("T37 — buildPierreRgpdExportBundle includes tenant", () => {
    const data = {
      missions: [], tasks: [], documents: [], emails: [],
      memory: [], audit_events: [], cost_events: [],
    };
    const bundle = buildPierreRgpdExportBundle(validScope, data);
    expect(bundle.tenant.user_id).toBe("u1");
  });

  it("T38 — bundle includes export version metadata", () => {
    const data = {
      missions: [], tasks: [], documents: [], emails: [],
      memory: [], audit_events: [], cost_events: [],
    };
    const bundle = buildPierreRgpdExportBundle(validScope, data);
    expect((bundle.metadata as Record<string, unknown>).export_version).toBe("B41");
  });

  it("T39 — redactExportBundle redacts email_body in emails", () => {
    const data = {
      missions: [], tasks: [], documents: [],
      emails: [{ id: "e1", email_body: "Dear John", subject: "Contract" }],
      memory: [], audit_events: [], cost_events: [],
    };
    const bundle = buildPierreRgpdExportBundle(validScope, data);
    const redacted = redactExportBundle(bundle);
    const email = redacted.emails[0] as Record<string, unknown>;
    expect(email.email_body).not.toBe("Dear John");
    expect(email.email_body).toContain("NOT_EXPORTED");
  });

  it("T40 — redactExportBundle redacts api_key in missions", () => {
    const data = {
      missions: [{ id: "m1", api_key: "sk-123" }],
      tasks: [], documents: [], emails: [], memory: [], audit_events: [], cost_events: [],
    };
    const bundle = buildPierreRgpdExportBundle(validScope, data);
    const redacted = redactExportBundle(bundle);
    const mission = redacted.missions[0] as Record<string, unknown>;
    expect(mission.api_key).toBe("[REDACTED_SECRET]");
  });

  it("T41 — buildFullPierreRgpdExport returns redacted bundle", async () => {
    const adapters = buildFakeExportAdapters();
    const bundle = await buildFullPierreRgpdExport(validScope, adapters);
    expect(bundle.tenant.user_id).toBe("u1");
    expect(bundle.generated_at).toBeTruthy();
  });

  it("T42 — buildFullPierreRgpdExport throws for missing user_id", async () => {
    const invalidScope = buildSecurityTenantScope({ user_id: null, company_id: "c1" });
    const adapters = buildFakeExportAdapters();
    await expect(buildFullPierreRgpdExport(invalidScope, adapters)).rejects.toThrow();
  });
});

// ── RGPD Purge (T43–T65) ─────────────────────────────────────────────────────

describe("Pierre RGPD Purge", () => {
  const validScope = buildSecurityTenantScope({
    user_id: "u1", company_id: "c1",
    access_level: "internal_admin",
    owns_pierre: true, pierre_enabled: true,
    source: "supabase_auth",
  });

  it("T43 — purge plan is dry_run by default", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    expect(plan.dry_run).toBe(true);
  });

  it("T44 — purge plan contains tables", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    expect(plan.tables.length).toBeGreaterThan(5);
  });

  it("T45 — purge plan has requires_confirmation=true", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    expect(plan.requires_confirmation).toBe(true);
  });

  it("T46 — purge plan marks orders as retain (not purgeable)", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    const orders = plan.tables.find((t) => t.table === "orders");
    expect(orders?.action).not.toBe("delete");
  });

  it("T47 — purge plan irreversible_after_execution=true", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    expect(plan.irreversible_after_execution).toBe(true);
  });

  it("T48 — validatePurgeConfirmation fails with wrong phrase", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    const result = validatePurgeConfirmation(
      { confirmation_phrase: "WRONG", user_id: "u1", understand_irreversible: true },
      plan,
    );
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("T49 — validatePurgeConfirmation fails with wrong user_id", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    const result = validatePurgeConfirmation(
      {
        confirmation_phrase: "CONFIRME SUPPRESSION DONNÉES PIERRE",
        user_id: "wrong_user",
        understand_irreversible: true,
      },
      plan,
    );
    expect(result.valid).toBe(false);
  });

  it("T50 — validatePurgeConfirmation fails without irreversible acknowledgement", async () => {
    const plan = await buildPierreRgpdPurgePlan(validScope);
    const result = validatePurgeConfirmation(
      {
        confirmation_phrase: "CONFIRME SUPPRESSION DONNÉES PIERRE",
        user_id: "u1",
        understand_irreversible: false,
      },
      plan,
    );
    expect(result.valid).toBe(false);
  });

  it("T51 — executePierreRgpdPurge in dry_run does not execute", async () => {
    const adapters = buildFakePurgeAdapters();
    const plan = await buildPierreRgpdPurgePlan(validScope, { dry_run: true, adapters });
    const result = await executePierreRgpdPurge(
      plan,
      { confirmation_phrase: "CONFIRME SUPPRESSION DONNÉES PIERRE", user_id: "u1", understand_irreversible: true },
      adapters,
    );
    expect(result.executed).toBe(false);
    expect(result.dry_run).toBe(true);
  });

  it("T52 — executePierreRgpdPurge blocks without confirmation", async () => {
    const adapters = buildFakePurgeAdapters();
    const plan = await buildPierreRgpdPurgePlan(validScope, { dry_run: false, adapters });
    const result = await executePierreRgpdPurge(
      plan,
      { confirmation_phrase: "WRONG", user_id: "u1", understand_irreversible: true },
      adapters,
    );
    expect(result.executed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("T53 — anonymizeRetainedBillingData replaces user_id", () => {
    const order = { id: "o1", user_id: "u1", email: "user@test.com", amount: 99 };
    const anon = anonymizeRetainedBillingData(order);
    expect(anon.user_id).toBe("[ANONYMIZED]");
    expect(anon.email).toBe("[ANONYMIZED_EMAIL]");
    expect(anon.id).toBe("o1");
  });

  it("T54 — purge plan blocked when user_id is missing", async () => {
    const noUserScope = buildSecurityTenantScope({ user_id: null, company_id: "c1" });
    const plan = await buildPierreRgpdPurgePlan(noUserScope);
    expect(plan.blocked_reasons.length).toBeGreaterThan(0);
  });
});

// ── Retention Policy (T55–T72) ────────────────────────────────────────────────

describe("Pierre Retention Policy", () => {
  it("T55 — retention policy exists for pierre_missions", () => {
    expect(getRetentionPolicyForResource("pierre_missions")).not.toBeNull();
  });

  it("T56 — retention policy exists for pierre_task_logs", () => {
    expect(getRetentionPolicyForResource("pierre_task_logs")).not.toBeNull();
  });

  it("T57 — pierre_company_memory retained until deletion (no expiry)", () => {
    const p = getRetentionPolicyForResource("pierre_company_memory");
    expect(p?.max_age_days).toBeNull();
  });

  it("T58 — pierre_task_logs has 90-day retention", () => {
    const p = getRetentionPolicyForResource("pierre_task_logs");
    expect(p?.max_age_days).toBe(90);
  });

  it("T59 — orders has legal_hold=true", () => {
    const p = getRetentionPolicyForResource("orders");
    expect(p?.legal_hold).toBe(true);
  });

  it("T60 — orders retained after 365 days", () => {
    expect(shouldRetainResource("orders", 365)).toBe(true);
  });

  it("T61 — pierre_task_logs not retained after 100 days", () => {
    expect(shouldRetainResource("pierre_task_logs", 100)).toBe(false);
  });

  it("T62 — pierre_task_logs retained before 90 days", () => {
    expect(shouldRetainResource("pierre_task_logs", 50)).toBe(true);
  });

  it("T63 — shouldAnonymizeResource returns true for orders at expiry", () => {
    const policy = getRetentionPolicyForResource("orders")!;
    expect(shouldAnonymizeResource("orders", policy.max_age_days! + 1)).toBe(true);
  });

  it("T64 — shouldAnonymizeResource returns false for missions (delete, not anonymize)", () => {
    expect(shouldAnonymizeResource("pierre_missions", 1000)).toBe(false);
  });

  it("T65 — buildRetentionReport includes user_id", () => {
    const report = buildRetentionReport("u1");
    expect(report.user_id).toBe("u1");
  });

  it("T66 — retention report includes all resources", () => {
    const report = buildRetentionReport("u1");
    expect(report.resources.length).toBeGreaterThan(5);
  });

  it("T67 — getLegalHoldResources returns at least orders", () => {
    const resources = getLegalHoldResources();
    expect(resources.some((r) => r.table === "orders")).toBe(true);
  });

  it("T68 — getRetentionPolicySummary is non-empty", () => {
    expect(getRetentionPolicySummary().length).toBeGreaterThan(5);
  });
});

// ── Security Audit Verdict (T69–T80) ─────────────────────────────────────────

describe("Pierre Security Audit Verdict", () => {
  it("T69 — verdict is B41", () => {
    const v = buildB41SecurityVerdict();
    expect(v.bloc).toBe("B41");
  });

  it("T70 — safe_to_continue_to_b42 is true (no critical open)", () => {
    const v = buildB41SecurityVerdict();
    expect(v.safe_to_continue_to_b42).toBe(true);
  });

  it("T71 — score >= 90", () => {
    const v = buildB41SecurityVerdict();
    expect(v.score).toBeGreaterThanOrEqual(90);
  });

  it("T72 — verdict has findings list", () => {
    const v = buildB41SecurityVerdict();
    expect(v.findings.length).toBeGreaterThan(5);
  });

  it("T73 — billing/activate finding is addressed_in_b41", () => {
    const v = buildB41SecurityVerdict();
    const f = v.findings.find((f) => f.id === "B41-F01");
    expect(f?.status).toBe("addressed_in_b41");
  });

  it("T74 — verdict has guarantees list", () => {
    const v = buildB41SecurityVerdict();
    expect(v.guarantees.length).toBeGreaterThan(5);
  });

  it("T75 — verdict has followups list", () => {
    const v = buildB41SecurityVerdict();
    expect(v.followups.length).toBeGreaterThan(3);
  });

  it("T76 — auditPierreRoutes total > 10", () => {
    const audit = auditPierreRoutes();
    expect(audit.total).toBeGreaterThan(10);
  });

  it("T77 — auditPierreRoutes has service_role_only routes", () => {
    const audit = auditPierreRoutes();
    expect(audit.service_role_only).toBeGreaterThan(0);
  });

  it("T78 — auditPierreDataMap total >= 10", () => {
    const audit = auditPierreDataMap();
    expect(audit.total).toBeGreaterThanOrEqual(10);
  });

  it("T79 — auditPierreDataMap hr_sensitive > 0", () => {
    const audit = auditPierreDataMap();
    expect(audit.hr_sensitive).toBeGreaterThan(0);
  });

  it("T80 — verdict status is validated_with_followups", () => {
    const v = buildB41SecurityVerdict();
    expect(v.status).toBe("validated_with_followups");
  });
});
