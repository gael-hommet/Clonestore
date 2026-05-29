// P-FINAL 01 — Phase 3 — Tests for RLS production pack.
// All simulate-route: pure functions only, no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  RLS_POLICY_REGISTRY,
  getCriticalPolicies,
  getPoliciesForTable,
  getAllCoveredTables,
  getRlsPolicyById,
  CRITICAL_TABLES,
} from "../rls-policy-registry";
import {
  verifyRlsPolicyCoverage,
  verifyCriticalTablesHaveRls,
  getRlsCoverageScore,
  getAllExpectedPolicyIds,
} from "../rls-verification";
import {
  RLS_PRODUCTION_CHECKLIST,
  getChecklistReport,
  getItemsByCategory,
  getCriticalChecklistItems,
  areAllCriticalItemsDone,
} from "../rls-production-checklist";
import {
  RLS_ALERT_RULES,
  getCriticalAlerts,
  getAlertsByTrigger,
  getAlertsSummary,
} from "../rls-alerts";
import {
  FIXTURE_ALL_POLICIES_DEPLOYED,
  FIXTURE_NO_POLICIES,
  FIXTURE_MISSING_CRITICAL,
  FIXTURE_WITH_UNEXPECTED_POLICIES,
  FIXTURE_ONLY_COMPANIES,
  FIXTURE_MISSING_EMPLOYEES,
  FIXTURE_CHECKLIST_ALL_CRITICAL_DONE,
  FIXTURE_CHECKLIST_NOTHING_DONE,
} from "../rls-policy-fixtures";

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("rls-policy-registry", () => {
  it("registry has at least 20 policies", () => {
    expect(RLS_POLICY_REGISTRY.length).toBeGreaterThanOrEqual(20);
  });

  it("all registry entries have required fields", () => {
    for (const policy of RLS_POLICY_REGISTRY) {
      expect(policy.id).toBeTruthy();
      expect(policy.table).toBeTruthy();
      expect(policy.policy_name).toBeTruthy();
      expect(policy.action).toBeTruthy();
      expect(policy.role).toBeTruthy();
      expect(policy.using_clause).toBeTruthy();
    }
  });

  it("all policy ids are unique", () => {
    const ids = RLS_POLICY_REGISTRY.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("getCriticalPolicies returns only critical policies", () => {
    const critical = getCriticalPolicies();
    expect(critical.length).toBeGreaterThan(0);
    for (const p of critical) {
      expect(p.critical).toBe(true);
    }
  });

  it("employees table has at least 4 policies (SELECT, INSERT, UPDATE, DELETE)", () => {
    const employees = getPoliciesForTable("employees");
    expect(employees.length).toBeGreaterThanOrEqual(4);
    const actions = employees.map((p) => p.action);
    expect(actions).toContain("SELECT");
    expect(actions).toContain("INSERT");
    expect(actions).toContain("UPDATE");
    expect(actions).toContain("DELETE");
  });

  it("tasks table has SELECT, INSERT, UPDATE policies", () => {
    const tasks = getPoliciesForTable("tasks");
    const actions = tasks.map((p) => p.action);
    expect(actions).toContain("SELECT");
    expect(actions).toContain("INSERT");
    expect(actions).toContain("UPDATE");
  });

  it("audit_logs has no_delete policy", () => {
    const auditPolicies = getPoliciesForTable("audit_logs");
    const noDelete = auditPolicies.find((p) => p.id === "audit_logs_no_delete");
    expect(noDelete).toBeDefined();
    expect(noDelete!.using_clause).toBe("false");
  });

  it("getAllCoveredTables includes all critical tables", () => {
    const covered = getAllCoveredTables();
    for (const table of CRITICAL_TABLES) {
      expect(covered).toContain(table);
    }
  });

  it("getRlsPolicyById returns correct policy", () => {
    const policy = getRlsPolicyById("companies_select_own");
    expect(policy).toBeDefined();
    expect(policy!.table).toBe("companies");
  });

  it("getRlsPolicyById returns undefined for unknown id", () => {
    expect(getRlsPolicyById("nonexistent_policy")).toBeUndefined();
  });

  it("all policies use authenticated role (not anon) for critical tables", () => {
    const criticalTablePolicies = RLS_POLICY_REGISTRY.filter((p) =>
      (CRITICAL_TABLES as readonly string[]).includes(p.table)
    );
    for (const p of criticalTablePolicies) {
      expect(p.role).toBe("authenticated");
    }
  });

  it("all non-profile policies for critical tables have company_id or auth.uid in using_clause", () => {
    const criticalTablePolicies = RLS_POLICY_REGISTRY.filter(
      (p) =>
        (CRITICAL_TABLES as readonly string[]).includes(p.table) &&
        p.using_clause !== "false" &&
        p.using_clause !== "true"
    );
    for (const p of criticalTablePolicies) {
      // Must use either company_id isolation or direct user id isolation
      const hasIsolation =
        p.using_clause.includes("company_id") || p.using_clause.includes("auth.uid()");
      expect(hasIsolation).toBe(true);
    }
  });
});

// ─── Verification ─────────────────────────────────────────────────────────────

describe("rls-verification", () => {
  it("full deployment → is_production_ready: true", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_ALL_POLICIES_DEPLOYED());
    expect(result.is_production_ready).toBe(true);
    expect(result.missing_policies).toHaveLength(0);
    expect(result.critical_missing).toHaveLength(0);
    expect(result.blocking_reason).toBeNull();
  });

  it("no policies → is_production_ready: false", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_NO_POLICIES);
    expect(result.is_production_ready).toBe(false);
    expect(result.missing_policies.length).toBeGreaterThan(0);
    expect(result.critical_missing.length).toBeGreaterThan(0);
  });

  it("no policies → all tables missing", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_NO_POLICIES);
    expect(result.tables_missing.length).toBeGreaterThan(0);
    expect(result.tables_covered).toHaveLength(0);
  });

  it("missing critical → critical_missing not empty, blocking_reason set", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_MISSING_CRITICAL);
    expect(result.is_production_ready).toBe(false);
    expect(result.critical_missing.length).toBeGreaterThan(0);
    expect(result.blocking_reason).toBeTruthy();
  });

  it("with unexpected policies → unexpected_policies not empty", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_WITH_UNEXPECTED_POLICIES());
    expect(result.unexpected_policies).toContain("legacy_policy_from_b33");
    expect(result.unexpected_policies).toContain("old_companies_policy_v1");
  });

  it("only companies policies → tables_partial or tables_missing for others", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_ONLY_COMPANIES);
    expect(result.tables_covered).toContain("companies");
    expect(result.tables_missing.length).toBeGreaterThan(0);
  });

  it("missing employees → tables_missing includes employees", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_MISSING_EMPLOYEES());
    expect(result.tables_missing).toContain("employees");
  });

  it("full deployment → coverage score 100", () => {
    const score = getRlsCoverageScore(FIXTURE_ALL_POLICIES_DEPLOYED());
    expect(score).toBe(100);
  });

  it("no policies → coverage score 0", () => {
    const score = getRlsCoverageScore(FIXTURE_NO_POLICIES);
    expect(score).toBe(0);
  });

  it("partial policies → coverage score between 0 and 100", () => {
    const score = getRlsCoverageScore(FIXTURE_ONLY_COMPANIES);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("verifyCriticalTablesHaveRls: full deployment → all covered", () => {
    const result = verifyCriticalTablesHaveRls(FIXTURE_ALL_POLICIES_DEPLOYED());
    expect(result.all_critical_tables_covered).toBe(true);
    expect(result.uncovered_critical_tables).toHaveLength(0);
  });

  it("verifyCriticalTablesHaveRls: no policies → all critical uncovered", () => {
    const result = verifyCriticalTablesHaveRls(FIXTURE_NO_POLICIES);
    expect(result.all_critical_tables_covered).toBe(false);
    expect(result.uncovered_critical_tables.length).toBeGreaterThan(0);
  });

  it("verifyCriticalTablesHaveRls: missing employees → employees uncovered", () => {
    const result = verifyCriticalTablesHaveRls(FIXTURE_MISSING_EMPLOYEES());
    expect(result.uncovered_critical_tables).toContain("employees");
  });

  it("getAllExpectedPolicyIds returns all registry ids", () => {
    const ids = getAllExpectedPolicyIds();
    expect(ids.length).toBe(RLS_POLICY_REGISTRY.length);
  });

  it("full deployment covered_policies equals total registry count", () => {
    const result = verifyRlsPolicyCoverage(FIXTURE_ALL_POLICIES_DEPLOYED());
    expect(result.covered_policies.length).toBe(RLS_POLICY_REGISTRY.length);
  });
});

// ─── Checklist ────────────────────────────────────────────────────────────────

describe("rls-production-checklist", () => {
  it("checklist has at least 12 items", () => {
    expect(RLS_PRODUCTION_CHECKLIST.length).toBeGreaterThanOrEqual(12);
  });

  it("all checklist items have id, title, description, category", () => {
    for (const item of RLS_PRODUCTION_CHECKLIST) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.category).toBeTruthy();
    }
  });

  it("checklist has items in pre_migration category", () => {
    const preMigration = getItemsByCategory("pre_migration");
    expect(preMigration.length).toBeGreaterThan(0);
  });

  it("checklist has items in post_migration_verification category", () => {
    const postMigration = getItemsByCategory("post_migration_verification");
    expect(postMigration.length).toBeGreaterThan(0);
  });

  it("getCriticalChecklistItems returns only critical items", () => {
    const critical = getCriticalChecklistItems();
    for (const item of critical) {
      expect(item.critical).toBe(true);
    }
  });

  it("getCriticalChecklistItems returns at least 5 critical items", () => {
    expect(getCriticalChecklistItems().length).toBeGreaterThanOrEqual(5);
  });

  it("getChecklistReport totals match array length", () => {
    const report = getChecklistReport();
    expect(report.total).toBe(RLS_PRODUCTION_CHECKLIST.length);
    expect(report.critical_count).toBe(getCriticalChecklistItems().length);
  });

  it("areAllCriticalItemsDone: all done → true", () => {
    expect(areAllCriticalItemsDone(FIXTURE_CHECKLIST_ALL_CRITICAL_DONE)).toBe(true);
  });

  it("areAllCriticalItemsDone: nothing done → false", () => {
    expect(areAllCriticalItemsDone(FIXTURE_CHECKLIST_NOTHING_DONE)).toBe(false);
  });

  it("checklist item ids are unique", () => {
    const ids = RLS_PRODUCTION_CHECKLIST.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("backup_before_rls is critical", () => {
    const item = RLS_PRODUCTION_CHECKLIST.find((i) => i.id === "backup_before_rls");
    expect(item).toBeDefined();
    expect(item!.critical).toBe(true);
  });

  it("staging_test_first is critical", () => {
    const item = RLS_PRODUCTION_CHECKLIST.find((i) => i.id === "staging_test_first");
    expect(item).toBeDefined();
    expect(item!.critical).toBe(true);
  });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

describe("rls-alerts", () => {
  it("alert rules list is not empty", () => {
    expect(RLS_ALERT_RULES.length).toBeGreaterThan(0);
  });

  it("all alert rules have id, name, description, severity", () => {
    for (const rule of RLS_ALERT_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.severity).toMatch(/^(critical|warning|info)$/);
    }
  });

  it("getCriticalAlerts returns only critical severity", () => {
    const criticals = getCriticalAlerts();
    for (const a of criticals) {
      expect(a.severity).toBe("critical");
    }
  });

  it("getCriticalAlerts has at least 2 alerts", () => {
    expect(getCriticalAlerts().length).toBeGreaterThanOrEqual(2);
  });

  it("getAlertsByTrigger error_rate returns relevant alerts", () => {
    const errRate = getAlertsByTrigger("error_rate");
    expect(errRate.length).toBeGreaterThan(0);
    for (const a of errRate) {
      expect(a.trigger).toBe("error_rate");
    }
  });

  it("getAlertsSummary totals match array length", () => {
    const summary = getAlertsSummary();
    expect(summary.total).toBe(RLS_ALERT_RULES.length);
    expect(summary.critical_count + summary.warning_count).toBeLessThanOrEqual(summary.total);
  });

  it("rls_403_spike is critical", () => {
    const alert = RLS_ALERT_RULES.find((a) => a.id === "rls_403_spike");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
  });

  it("all alerts have recommended_action", () => {
    for (const rule of RLS_ALERT_RULES) {
      expect(rule.recommended_action).toBeTruthy();
    }
  });
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

describe("rls-policy-fixtures", () => {
  it("FIXTURE_ALL_POLICIES_DEPLOYED returns all registry ids", () => {
    const all = FIXTURE_ALL_POLICIES_DEPLOYED();
    expect(all.length).toBe(RLS_POLICY_REGISTRY.length);
  });

  it("FIXTURE_NO_POLICIES is empty", () => {
    expect(FIXTURE_NO_POLICIES).toHaveLength(0);
  });

  it("FIXTURE_MISSING_CRITICAL only contains non-critical policy ids", () => {
    // FIXTURE_MISSING_CRITICAL contains only non-critical policies (critical ones are absent)
    const criticalIds = new Set(getCriticalPolicies().map((p) => p.id));
    for (const id of FIXTURE_MISSING_CRITICAL) {
      expect(criticalIds.has(id)).toBe(false);
    }
  });

  it("FIXTURE_WITH_UNEXPECTED_POLICIES has more ids than the registry", () => {
    const withExtra = FIXTURE_WITH_UNEXPECTED_POLICIES();
    expect(withExtra.length).toBeGreaterThan(RLS_POLICY_REGISTRY.length);
  });

  it("FIXTURE_MISSING_EMPLOYEES has no employee policy ids", () => {
    const missing = FIXTURE_MISSING_EMPLOYEES();
    const hasEmployee = missing.some((id) => id.startsWith("employees_"));
    expect(hasEmployee).toBe(false);
  });

  it("FIXTURE_ONLY_COMPANIES has exactly 2 entries", () => {
    expect(FIXTURE_ONLY_COMPANIES).toHaveLength(2);
    expect(FIXTURE_ONLY_COMPANIES).toContain("companies_select_own");
    expect(FIXTURE_ONLY_COMPANIES).toContain("companies_update_own");
  });

  it("FIXTURE_CHECKLIST_ALL_CRITICAL_DONE covers all critical checklist items", () => {
    const critical = getCriticalChecklistItems();
    const doneSet = new Set(FIXTURE_CHECKLIST_ALL_CRITICAL_DONE);
    for (const item of critical) {
      expect(doneSet.has(item.id)).toBe(true);
    }
  });

  it("FIXTURE_CHECKLIST_NOTHING_DONE is empty", () => {
    expect(FIXTURE_CHECKLIST_NOTHING_DONE).toHaveLength(0);
  });
});

// ─── Cross-cutting invariants ─────────────────────────────────────────────────

describe("cross-cutting RLS invariants", () => {
  it("no policy allows anon SELECT on critical tables", () => {
    const anonSelectOnCritical = RLS_POLICY_REGISTRY.filter(
      (p) =>
        p.role === "anon" &&
        p.action === "SELECT" &&
        (CRITICAL_TABLES as readonly string[]).includes(p.table)
    );
    expect(anonSelectOnCritical).toHaveLength(0);
  });

  it("employees table has DELETE policy with false-isolation (not open DELETE)", () => {
    const deletePolicy = getPoliciesForTable("employees").find((p) => p.action === "DELETE");
    expect(deletePolicy).toBeDefined();
    expect(deletePolicy!.using_clause).toMatch(/company_id/);
  });

  it("audit_logs DELETE policy uses USING(false)", () => {
    const policy = getRlsPolicyById("audit_logs_no_delete");
    expect(policy).toBeDefined();
    expect(policy!.using_clause).toBe("false");
  });

  it("ai_cost_events INSERT uses false — service_role only", () => {
    const policy = getRlsPolicyById("ai_cost_events_insert_own_company");
    expect(policy).toBeDefined();
    expect(policy!.using_clause).toBe("false");
  });

  it("all INSERT policies on critical tables have WITH CHECK clause", () => {
    const criticalInserts = RLS_POLICY_REGISTRY.filter(
      (p) =>
        p.action === "INSERT" &&
        (CRITICAL_TABLES as readonly string[]).includes(p.table) &&
        p.id !== "ai_cost_events_insert_own_company"
    );
    for (const p of criticalInserts) {
      expect(p.with_check_clause).toBeTruthy();
      expect(p.with_check_clause).toMatch(/company_id/);
    }
  });
});
