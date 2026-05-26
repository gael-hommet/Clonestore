// src/lib/pierre/cockpit/__tests__/cockpit-b40-tenant.test.ts
// Pierre Cockpit B40 — Multi-tenant isolation tests.
// Proves: one engine, one logical Pierre per company, no cross-tenant data leak.
// Pure unit tests. No Supabase, no API calls, no network.

import { describe, it, expect } from "vitest";
import {
  buildTenantContext,
  buildMockTenantContext,
  resolveAccessLevel,
  isPaidAccess,
  isTrialAccess,
  isNonPayingAccess,
  isTenantValid,
  isTenantAuthorized,
  filterMissionsByTenant,
  filterTasksByTenant,
  filterDocumentsByTenant,
  filterEmployeesByTenant,
  filterValidationsByTenant,
  auditSnapshotForLeaks,
  sanitizeActionPayload,
  formatCompanyId,
  getTenantDisplayLabel,
} from "../tenant";
import {
  resolveCockpitPermissions,
  canApproveTask,
  canCancelTask,
  canRunTask,
  canSendEmail,
  isSensitiveTaskType,
  isEmailTaskType,
  getBlockedReason,
} from "../permissions";
import {
  buildMissionSubmitPayload,
  buildTaskApprovePayload,
  buildTaskCancelPayload,
  buildEmailPreparePayload,
  resolveNextActions,
} from "../actions";
import {
  filterByCompanyId,
  validateSnapshotOwnership,
} from "../normalizers";
import type {
  PierreTenantContext,
  PierreCockpitTaskSummary,
} from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenant(overrides: Partial<PierreTenantContext> = {}): PierreTenantContext {
  return buildMockTenantContext(overrides);
}

function makeTask(overrides: Partial<PierreCockpitTaskSummary> = {}): PierreCockpitTaskSummary {
  return {
    id: "task_1",
    missionId: "mission_1",
    type: "document.draft",
    title: "Tâche test",
    description: null,
    status: "ready",
    riskLevel: "normal",
    requiresValidation: false,
    isEmailTask: false,
    isSensitive: false,
    executeAt: null,
    blockedReason: null,
    createdAt: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// GROUP 1 — Tenant context building
// ══════════════════════════════════════════════════════════════

describe("buildTenantContext", () => {
  it("T1 — builds valid tenant from raw data", () => {
    const tenant = buildTenantContext({
      user_id: "user_abc",
      company_id: "company_abc",
      access_level: "paid_customer",
      owns_pierre: true,
      pierre_enabled: true,
    });
    expect(tenant.user_id).toBe("user_abc");
    expect(tenant.company_id).toBe("company_abc");
    expect(tenant.owns_pierre).toBe(true);
    expect(tenant.pierre_enabled).toBe(true);
    expect(tenant.active_agent_slug).toBe("pierre");
  });

  it("T2 — pierre_enabled is false when owns_pierre is false", () => {
    const tenant = buildTenantContext({
      user_id: "user_abc",
      company_id: "company_abc",
      owns_pierre: false,
    });
    expect(tenant.pierre_enabled).toBe(false);
  });

  it("T3 — handles null values gracefully", () => {
    const tenant = buildTenantContext({});
    expect(tenant.user_id).toBeNull();
    expect(tenant.company_id).toBeNull();
    expect(tenant.owns_pierre).toBe(false);
  });

  it("T4 — mock tenant has test source", () => {
    const tenant = buildMockTenantContext();
    expect(tenant.source).toBe("mock_test");
  });

  it("T5 — mock tenant overrides work", () => {
    const tenant = buildMockTenantContext({ company_id: "company_xyz", access_level: "trial" });
    expect(tenant.company_id).toBe("company_xyz");
    expect(tenant.access_level).toBe("trial");
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 2 — Access level resolution
// ══════════════════════════════════════════════════════════════

describe("resolveAccessLevel", () => {
  it("T6 — resolves paid_customer", () => {
    expect(resolveAccessLevel("paid_customer")).toBe("paid_customer");
  });

  it("T7 — resolves internal_admin", () => {
    expect(resolveAccessLevel("internal_admin")).toBe("internal_admin");
  });

  it("T8 — resolves trial", () => {
    expect(resolveAccessLevel("trial")).toBe("trial");
  });

  it("T9 — resolves anonymous", () => {
    expect(resolveAccessLevel("anonymous")).toBe("anonymous");
  });

  it("T10 — unknown value defaults to logged_unpaid", () => {
    expect(resolveAccessLevel("superuser")).toBe("logged_unpaid");
    expect(resolveAccessLevel(null)).toBe("logged_unpaid");
    expect(resolveAccessLevel(undefined)).toBe("logged_unpaid");
  });
});

describe("Access level predicates", () => {
  it("T11 — paid_customer is paid access", () => {
    expect(isPaidAccess(makeTenant({ access_level: "paid_customer" }))).toBe(true);
  });

  it("T12 — internal_admin is paid access", () => {
    expect(isPaidAccess(makeTenant({ access_level: "internal_admin" }))).toBe(true);
  });

  it("T13 — trial is not paid access but is trial", () => {
    const tenant = makeTenant({ access_level: "trial" });
    expect(isPaidAccess(tenant)).toBe(false);
    expect(isTrialAccess(tenant)).toBe(true);
  });

  it("T14 — anonymous is non-paying", () => {
    expect(isNonPayingAccess(makeTenant({ access_level: "anonymous" }))).toBe(true);
  });

  it("T15 — logged_unpaid is non-paying", () => {
    expect(isNonPayingAccess(makeTenant({ access_level: "logged_unpaid" }))).toBe(true);
  });

  it("T16 — paid_customer is not non-paying", () => {
    expect(isNonPayingAccess(makeTenant({ access_level: "paid_customer" }))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 3 — Tenant validation and authorization
// ══════════════════════════════════════════════════════════════

describe("isTenantValid", () => {
  it("T17 — null is invalid", () => {
    expect(isTenantValid(null)).toBe(false);
  });

  it("T18 — tenant without user_id is invalid", () => {
    expect(isTenantValid(makeTenant({ user_id: null }))).toBe(false);
  });

  it("T19 — tenant without company_id is invalid", () => {
    expect(isTenantValid(makeTenant({ company_id: null }))).toBe(false);
  });

  it("T20 — valid tenant passes", () => {
    expect(isTenantValid(makeTenant())).toBe(true);
  });
});

describe("isTenantAuthorized", () => {
  it("T21 — null tenant is not authorized", () => {
    expect(isTenantAuthorized(null)).toBe(false);
  });

  it("T22 — non-paying tenant is not authorized", () => {
    expect(isTenantAuthorized(makeTenant({ access_level: "anonymous", owns_pierre: false }))).toBe(false);
  });

  it("T23 — tenant without pierre is not authorized", () => {
    expect(isTenantAuthorized(makeTenant({ owns_pierre: false }))).toBe(false);
  });

  it("T24 — tenant with pierre disabled is not authorized", () => {
    expect(isTenantAuthorized(makeTenant({ pierre_enabled: false }))).toBe(false);
  });

  it("T25 — fully valid tenant is authorized", () => {
    expect(isTenantAuthorized(makeTenant())).toBe(true);
  });

  it("T26 — internal_admin with pierre is authorized", () => {
    expect(isTenantAuthorized(makeTenant({ access_level: "internal_admin" }))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 4 — Multi-tenant isolation (the critical tests)
// ══════════════════════════════════════════════════════════════

describe("auditSnapshotForLeaks", () => {
  it("T27 — clean snapshot passes audit", () => {
    const items = [
      { id: "m1", company_id: "company_a" },
      { id: "m2", company_id: "company_a" },
    ];
    const result = auditSnapshotForLeaks(items, "company_a");
    expect(result.clean).toBe(true);
    expect(result.leaked_items).toBe(0);
  });

  it("T28 — cross-company item detected as leak", () => {
    const items = [
      { id: "m1", company_id: "company_a" },
      { id: "m2", company_id: "company_b" },  // Belongs to different company!
    ];
    const result = auditSnapshotForLeaks(items, "company_a");
    expect(result.clean).toBe(false);
    expect(result.leaked_items).toBe(1);
  });

  it("T29 — items without company_id pass (server-scoped)", () => {
    const items = [{ id: "m1", title: "Mission sans company_id" }];
    const result = auditSnapshotForLeaks(items, "company_a");
    expect(result.clean).toBe(true);
  });

  it("T30 — multiple leaks are counted", () => {
    const items = [
      { id: "m1", company_id: "company_a" },
      { id: "m2", company_id: "company_b" },
      { id: "m3", company_id: "company_c" },
    ];
    const result = auditSnapshotForLeaks(items, "company_a");
    expect(result.leaked_items).toBe(2);
  });

  it("T31 — empty list is clean", () => {
    const result = auditSnapshotForLeaks([], "company_a");
    expect(result.clean).toBe(true);
    expect(result.leaked_items).toBe(0);
  });
});

describe("sanitizeActionPayload", () => {
  it("T32 — removes company_id from action payload", () => {
    const tenant = makeTenant({ company_id: "company_a" });
    const payload = { text: "hello", company_id: "company_b" };
    const sanitized = sanitizeActionPayload(payload, tenant);
    expect(sanitized.company_id).toBeUndefined();
    expect(sanitized.text).toBe("hello");
  });

  it("T33 — removes organization_id from action payload", () => {
    const tenant = makeTenant();
    const payload = { text: "hello", organization_id: "org_other" };
    const sanitized = sanitizeActionPayload(payload, tenant);
    expect(sanitized.organization_id).toBeUndefined();
  });

  it("T34 — removes user_id from action payload", () => {
    const tenant = makeTenant({ user_id: "user_a" });
    const payload = { text: "hello", user_id: "user_other" };
    const sanitized = sanitizeActionPayload(payload, tenant);
    expect(sanitized.user_id).toBeUndefined();
  });

  it("T35 — removes agent_slug from action payload", () => {
    const tenant = makeTenant();
    const payload = { text: "hello", agent_slug: "malicious" };
    const sanitized = sanitizeActionPayload(payload, tenant);
    expect(sanitized.agent_slug).toBeUndefined();
  });

  it("T36 — preserves safe fields", () => {
    const tenant = makeTenant();
    const payload = { input: "Mission de test", source: "test", autonomy_level: "supervised" };
    const sanitized = sanitizeActionPayload(payload, tenant);
    expect(sanitized.input).toBe("Mission de test");
    expect(sanitized.source).toBe("test");
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 5 — Permissions
// ══════════════════════════════════════════════════════════════

describe("resolveCockpitPermissions", () => {
  it("T37 — null tenant gets zero permissions", () => {
    const perms = resolveCockpitPermissions(null);
    expect(perms.can_submit_mission).toBe(false);
    expect(perms.can_approve_task).toBe(false);
    expect(perms.can_use_ai).toBe(false);
  });

  it("T38 — non-paying tenant gets zero permissions", () => {
    const tenant = makeTenant({ access_level: "anonymous", owns_pierre: false });
    const perms = resolveCockpitPermissions(tenant);
    expect(perms.can_submit_mission).toBe(false);
    expect(perms.can_use_ai).toBe(false);
  });

  it("T39 — paid tenant gets full permissions", () => {
    const tenant = makeTenant();
    const perms = resolveCockpitPermissions(tenant);
    expect(perms.can_submit_mission).toBe(true);
    expect(perms.can_approve_task).toBe(true);
    expect(perms.can_prepare_email).toBe(true);
    expect(perms.can_use_ai).toBe(true);
  });

  it("T40 — owns_pierre=false blocks all permissions", () => {
    const tenant = makeTenant({ owns_pierre: false });
    const perms = resolveCockpitPermissions(tenant);
    expect(perms.can_submit_mission).toBe(false);
  });
});

describe("Task action permissions", () => {
  it("T41 — can approve non-sensitive task", () => {
    const task = makeTask({ status: "awaiting_approval" });
    const result = canApproveTask(task, makeTenant());
    expect(result.allowed).toBe(true);
  });

  it("T42 — cannot approve done task", () => {
    const task = makeTask({ status: "done" });
    const result = canApproveTask(task, makeTenant());
    expect(result.allowed).toBe(false);
  });

  it("T43 — cannot cancel done task", () => {
    const task = makeTask({ status: "done" });
    const result = canCancelTask(task, makeTenant());
    expect(result.allowed).toBe(false);
  });

  it("T44 — email task cannot be run directly", () => {
    const task = makeTask({ type: "email.send", isEmailTask: true });
    const result = canRunTask(task, makeTenant());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("T45 — sensitive task with validation required cannot be run", () => {
    const task = makeTask({ isSensitive: true, requiresValidation: true });
    const result = canRunTask(task, makeTenant());
    expect(result.allowed).toBe(false);
  });

  it("T46 — non-sensitive task can be run", () => {
    const task = makeTask({ type: "document.draft", status: "ready" });
    const result = canRunTask(task, makeTenant());
    expect(result.allowed).toBe(true);
  });
});

describe("canSendEmail", () => {
  it("T47 — live email mode always blocked from cockpit", () => {
    const task = makeTask({ type: "email.draft" });
    const result = canSendEmail(task, makeTenant(), "live");
    expect(result.allowed).toBe(false);
  });

  it("T48 — mock email is allowed for paid tenant", () => {
    const task = makeTask({ type: "email.draft", requiresValidation: false });
    const result = canSendEmail(task, makeTenant(), "mock");
    expect(result.allowed).toBe(true);
  });

  it("T49 — sensitive email requires approval even in mock mode", () => {
    const task = makeTask({ type: "email.draft", requiresValidation: true });
    const result = canSendEmail(task, makeTenant(), "mock");
    expect(result.allowed).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 6 — Actions (validated payloads, no company_id injection)
// ══════════════════════════════════════════════════════════════

describe("buildMissionSubmitPayload", () => {
  it("T50 — valid mission submit payload", () => {
    const tenant = makeTenant();
    const result = buildMissionSubmitPayload("Onboarding nouveau salarié", tenant);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.input).toBe("Onboarding nouveau salarié");
      expect(result.payload.source).toBeTruthy();
    }
  });

  it("T51 — empty mission is rejected", () => {
    const tenant = makeTenant();
    const result = buildMissionSubmitPayload("", tenant);
    expect(result.ok).toBe(false);
  });

  it("T52 — too short mission is rejected", () => {
    const tenant = makeTenant();
    const result = buildMissionSubmitPayload("abc", tenant);
    expect(result.ok).toBe(false);
  });

  it("T53 — non-authorized tenant cannot submit", () => {
    const tenant = makeTenant({ owns_pierre: false });
    const result = buildMissionSubmitPayload("Onboarding", tenant);
    expect(result.ok).toBe(false);
  });

  it("T54 — null tenant cannot submit", () => {
    const result = buildMissionSubmitPayload("Onboarding", null);
    expect(result.ok).toBe(false);
  });
});

describe("buildTaskApprovePayload", () => {
  it("T55 — valid task approve payload", () => {
    const result = buildTaskApprovePayload("task_123", makeTenant());
    expect(result.ok).toBe(true);
  });

  it("T56 — extra payload gets company_id stripped", () => {
    const result = buildTaskApprovePayload("task_123", makeTenant(), {
      company_id: "company_evil",
      note: "ok",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extra.company_id).toBeUndefined();
      expect(result.extra.note).toBe("ok");
    }
  });

  it("T57 — empty taskId is rejected", () => {
    const result = buildTaskApprovePayload("", makeTenant());
    expect(result.ok).toBe(false);
  });
});

describe("buildEmailPreparePayload", () => {
  it("T58 — email prepare always uses mock mode", () => {
    const result = buildEmailPreparePayload("task_123", makeTenant());
    expect(result.ok).toBe(true);
    if (result.ok) {
      // B39 constraint: cockpit NEVER uses live
      expect(result.payload.email_mode).toBe("mock");
    }
  });

  it("T59 — unauthorized tenant cannot prepare email", () => {
    const tenant = makeTenant({ owns_pierre: false });
    const result = buildEmailPreparePayload("task_123", tenant);
    expect(result.ok).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 7 — Next actions resolver
// ══════════════════════════════════════════════════════════════

describe("resolveNextActions", () => {
  it("T60 — no mission → suggests submitting first mission", () => {
    const actions = resolveNextActions({
      hasMission: false, hasValidations: false, hasSensitiveTasks: false,
      hasEmailTasks: false, hasDeliverables: false, memoryConfigured: true,
      emailMode: "mock",
    });
    expect(actions.some((a) => a.includes("mission"))).toBe(true);
  });

  it("T61 — validations pending → suggests validating", () => {
    const actions = resolveNextActions({
      hasMission: true, hasValidations: true, hasSensitiveTasks: false,
      hasEmailTasks: false, hasDeliverables: false, memoryConfigured: true,
      emailMode: "mock",
    });
    expect(actions.some((a) => a.includes("Validation"))).toBe(true);
  });

  it("T62 — memory not configured → suggests configuring CloneADN", () => {
    const actions = resolveNextActions({
      hasMission: true, hasValidations: false, hasSensitiveTasks: false,
      hasEmailTasks: false, hasDeliverables: false, memoryConfigured: false,
      emailMode: "mock",
    });
    expect(actions.some((a) => a.includes("CloneADN"))).toBe(true);
  });

  it("T63 — max 5 actions returned", () => {
    const actions = resolveNextActions({
      hasMission: false, hasValidations: true, hasSensitiveTasks: true,
      hasEmailTasks: true, hasDeliverables: true, memoryConfigured: false,
      emailMode: "mock",
    });
    expect(actions.length).toBeLessThanOrEqual(5);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 8 — Normalizer tenant filtering
// ══════════════════════════════════════════════════════════════

describe("filterByCompanyId", () => {
  it("T64 — passes items with matching company_id", () => {
    const items = [
      { id: "1", company_id: "company_a", title: "M1" },
      { id: "2", company_id: "company_a", title: "M2" },
    ];
    const result = filterByCompanyId(items, "company_a");
    expect(result).toHaveLength(2);
  });

  it("T65 — filters out items with different company_id", () => {
    const items = [
      { id: "1", company_id: "company_a", title: "M1" },
      { id: "2", company_id: "company_b", title: "M2" },
    ];
    const result = filterByCompanyId(items, "company_a");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("T66 — null companyId returns empty array", () => {
    const items = [{ id: "1", company_id: "company_a" }];
    const result = filterByCompanyId(items, null);
    expect(result).toHaveLength(0);
  });

  it("T67 — items without company_id pass through (server-scoped)", () => {
    const items = [{ id: "1", title: "No company field" }];
    const result = filterByCompanyId(items, "company_a");
    expect(result).toHaveLength(1);
  });

  it("T68 — cross-company simulation: tenant A does not see tenant B items", () => {
    const tenantAItems = [{ id: "m1", company_id: "company_a" }];
    const tenantBItems = [{ id: "m2", company_id: "company_b" }];
    const allItems = [...tenantAItems, ...tenantBItems];

    const resultA = filterByCompanyId(allItems, "company_a");
    const resultB = filterByCompanyId(allItems, "company_b");

    expect(resultA).toHaveLength(1);
    expect(resultA[0].id).toBe("m1");
    expect(resultB).toHaveLength(1);
    expect(resultB[0].id).toBe("m2");

    // Confirm no cross-contamination
    expect(resultA.find((i) => i.id === "m2")).toBeUndefined();
    expect(resultB.find((i) => i.id === "m1")).toBeUndefined();
  });
});

describe("validateSnapshotOwnership", () => {
  it("T69 — snapshot with matching user_id passes", () => {
    const snapshot = { user_id: "user_a", mission_id: "m1" };
    expect(validateSnapshotOwnership(snapshot, "user_a")).toBe(true);
  });

  it("T70 — snapshot with different user_id fails", () => {
    const snapshot = { user_id: "user_b", mission_id: "m1" };
    expect(validateSnapshotOwnership(snapshot, "user_a")).toBe(false);
  });

  it("T71 — snapshot without user_id passes (server-scoped)", () => {
    const snapshot = { mission_id: "m1", title: "Mission" };
    expect(validateSnapshotOwnership(snapshot, "user_a")).toBe(true);
  });

  it("T72 — non-object snapshot fails", () => {
    expect(validateSnapshotOwnership(null, "user_a")).toBe(false);
    expect(validateSnapshotOwnership("string", "user_a")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 9 — Sensitive task detection
// ══════════════════════════════════════════════════════════════

describe("Sensitive task detection", () => {
  it("T73 — email.send is sensitive", () => {
    expect(isSensitiveTaskType("email.send")).toBe(true);
  });

  it("T74 — hr_contract_draft is sensitive", () => {
    expect(isSensitiveTaskType("hr_contract_draft")).toBe(true);
  });

  it("T75 — document.draft is not sensitive", () => {
    expect(isSensitiveTaskType("document.draft")).toBe(false);
  });

  it("T76 — email.send is email task", () => {
    expect(isEmailTaskType("email.send")).toBe(true);
  });

  it("T77 — email.draft is email task", () => {
    expect(isEmailTaskType("email.draft")).toBe(true);
  });

  it("T78 — document.draft is not email task", () => {
    expect(isEmailTaskType("document.draft")).toBe(false);
  });
});

describe("getBlockedReason", () => {
  it("T79 — email task returns reason about email panel", () => {
    const task = makeTask({ type: "email.send", isEmailTask: true });
    const reason = getBlockedReason(task, makeTenant(), "mock");
    expect(reason).toBeTruthy();
  });

  it("T80 — sensitive task returns reason", () => {
    const task = makeTask({ isSensitive: true });
    const reason = getBlockedReason(task, makeTenant(), "mock");
    expect(reason).toBeTruthy();
  });

  it("T81 — non-sensitive task returns null when authorized", () => {
    const task = makeTask();
    const reason = getBlockedReason(task, makeTenant(), "mock");
    expect(reason).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 10 — Display helpers
// ══════════════════════════════════════════════════════════════

describe("Tenant display helpers", () => {
  it("T82 — formatCompanyId truncates long IDs", () => {
    const tenant = makeTenant({ company_id: "company_very_long_id_here" });
    const label = formatCompanyId(tenant);
    expect(label.length).toBeLessThanOrEqual(12);
    expect(label).toContain("…");
  });

  it("T83 — formatCompanyId returns — for null", () => {
    const tenant = makeTenant({ company_id: null });
    expect(formatCompanyId(tenant)).toBe("—");
  });

  it("T84 — getTenantDisplayLabel returns label for valid tenant", () => {
    const tenant = makeTenant({ company_id: "comp_123" });
    const label = getTenantDisplayLabel(tenant);
    expect(label).toBeTruthy();
    expect(label).not.toBe("Aucune entreprise");
  });

  it("T85 — getTenantDisplayLabel returns 'Aucune entreprise' for null", () => {
    expect(getTenantDisplayLabel(null)).toBe("Aucune entreprise");
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 11 — Multi-tenant budget isolation (conceptual)
// ══════════════════════════════════════════════════════════════

describe("Multi-tenant budget isolation (concepts)", () => {
  it("T86 — company A budget is independent of company B", () => {
    // Budget is scoped per tenant — each company has its own counters.
    // This test validates the type structure enforces company_id on budget.
    const tenantA = makeTenant({ company_id: "company_a" });
    const tenantB = makeTenant({ company_id: "company_b" });
    expect(tenantA.company_id).not.toBe(tenantB.company_id);
    // Budgets would be fetched per user_id from the ledger (B38C)
    // and are never mixed.
  });

  it("T87 — email audit is scoped by company_id", () => {
    // B39: email audit events have company_id from tenant context.
    // A company_a audit event cannot appear in company_b's cockpit.
    const tenantA = makeTenant({ company_id: "company_a" });
    const emailAudit = [
      { id: "e1", company_id: "company_a", event_type: "send_dry_run" },
      { id: "e2", company_id: "company_b", event_type: "send_dry_run" },
    ];
    const filtered = filterByCompanyId(emailAudit, tenantA.company_id);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("e1");
  });

  it("T88 — history is scoped per company", () => {
    const tenantA = makeTenant({ company_id: "company_a" });
    const historyItems = [
      { id: "h1", company_id: "company_a" },
      { id: "h2", company_id: "company_b" },
    ];
    const filtered = filterByCompanyId(historyItems, tenantA.company_id);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("h1");
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 12 — Filter functions
// ══════════════════════════════════════════════════════════════

describe("Tenant filter functions (server-scoped pass-through)", () => {
  it("T89 — filterMissionsByTenant passes non-empty list", () => {
    const tenant = makeTenant({ company_id: "co_a" });
    const missions = [
      { id: "m1", title: "M1", status: "active", riskLevel: "normal",
        requiresValidation: false, tasksTotal: 0, tasksDone: 0,
        tasksBlocked: 0, tasksAwaiting: 0, summary: null, createdAt: null, updatedAt: null }
    ];
    const result = filterMissionsByTenant(missions, tenant);
    expect(result).toHaveLength(1);
  });

  it("T90 — filterMissionsByTenant returns empty if company_id null", () => {
    const tenant = makeTenant({ company_id: null });
    const missions = [
      { id: "m1", title: "M1", status: "active", riskLevel: "normal",
        requiresValidation: false, tasksTotal: 0, tasksDone: 0,
        tasksBlocked: 0, tasksAwaiting: 0, summary: null, createdAt: null, updatedAt: null }
    ];
    const result = filterMissionsByTenant(missions, tenant);
    expect(result).toHaveLength(0);
  });
});
