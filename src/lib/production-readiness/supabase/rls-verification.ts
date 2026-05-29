// P-FINAL 01 — Phase 3 — RLS Policy Verification.
// Verify that a set of known/deployed policies matches the expected registry.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: Do not call Supabase directly from this module.

import {
  RLS_POLICY_REGISTRY,
  getCriticalPolicies,
  getAllCoveredTables,
  CRITICAL_TABLES,
  type RlsPolicy,
} from "./rls-policy-registry";

export interface RlsVerificationResult {
  covered_policies: string[];      // policy ids found in both registry and knownPolicies
  missing_policies: string[];      // policy ids in registry but not in knownPolicies
  unexpected_policies: string[];   // policy ids in knownPolicies but not in registry
  critical_missing: string[];      // critical policies not found
  tables_covered: string[];        // tables that have all expected policies
  tables_partial: string[];        // tables with some but not all policies
  tables_missing: string[];        // tables with no policies at all
  is_production_ready: boolean;
  blocking_reason: string | null;
}

export function verifyRlsPolicyCoverage(knownPolicyIds: string[]): RlsVerificationResult {
  const knownSet = new Set(knownPolicyIds);
  const registryIds = RLS_POLICY_REGISTRY.map((p) => p.id);

  const covered_policies = registryIds.filter((id) => knownSet.has(id));
  const missing_policies = registryIds.filter((id) => !knownSet.has(id));
  const unexpected_policies = knownPolicyIds.filter((id) => !registryIds.includes(id));

  const critical_missing = getCriticalPolicies()
    .filter((p) => !knownSet.has(p.id))
    .map((p) => p.id);

  const allTables = getAllCoveredTables();
  const tables_covered: string[] = [];
  const tables_partial: string[] = [];
  const tables_missing: string[] = [];

  for (const table of allTables) {
    const expectedForTable = RLS_POLICY_REGISTRY.filter((p) => p.table === table).map((p) => p.id);
    const foundForTable = expectedForTable.filter((id) => knownSet.has(id));

    if (foundForTable.length === 0) {
      tables_missing.push(table);
    } else if (foundForTable.length < expectedForTable.length) {
      tables_partial.push(table);
    } else {
      tables_covered.push(table);
    }
  }

  const is_production_ready =
    critical_missing.length === 0 && missing_policies.length === 0;

  let blocking_reason: string | null = null;
  if (critical_missing.length > 0) {
    blocking_reason = `${critical_missing.length} critical RLS policies missing: ${critical_missing.slice(0, 3).join(", ")}${critical_missing.length > 3 ? "…" : ""}`;
  } else if (missing_policies.length > 0) {
    blocking_reason = `${missing_policies.length} RLS policies not deployed`;
  }

  return {
    covered_policies,
    missing_policies,
    unexpected_policies,
    critical_missing,
    tables_covered,
    tables_partial,
    tables_missing,
    is_production_ready,
    blocking_reason,
  };
}

export function verifyCriticalTablesHaveRls(knownPolicyIds: string[]): {
  all_critical_tables_covered: boolean;
  uncovered_critical_tables: string[];
} {
  const knownSet = new Set(knownPolicyIds);
  const uncovered_critical_tables: string[] = [];

  for (const table of CRITICAL_TABLES) {
    const policiesForTable = RLS_POLICY_REGISTRY.filter(
      (p) => p.table === table && p.critical
    );
    const allCovered = policiesForTable.every((p) => knownSet.has(p.id));
    if (!allCovered) {
      uncovered_critical_tables.push(table);
    }
  }

  return {
    all_critical_tables_covered: uncovered_critical_tables.length === 0,
    uncovered_critical_tables,
  };
}

export function getRlsCoverageScore(knownPolicyIds: string[]): number {
  if (RLS_POLICY_REGISTRY.length === 0) return 100;
  const result = verifyRlsPolicyCoverage(knownPolicyIds);
  return Math.round((result.covered_policies.length / RLS_POLICY_REGISTRY.length) * 100);
}

// Returns all policy ids from the registry — useful for "full coverage" fixture
export function getAllExpectedPolicyIds(): string[] {
  return RLS_POLICY_REGISTRY.map((p) => p.id);
}
