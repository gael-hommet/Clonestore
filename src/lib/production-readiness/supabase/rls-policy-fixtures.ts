// P-FINAL 01 — Phase 3 — Test fixtures for RLS verification tests.
// Pure: no Supabase, no Next, no async, no throw.

import { getAllExpectedPolicyIds } from "./rls-verification";

// All expected policies deployed — represents a fully configured production DB
export function FIXTURE_ALL_POLICIES_DEPLOYED(): string[] {
  return getAllExpectedPolicyIds();
}

// No policies deployed — represents a fresh DB with no RLS
export const FIXTURE_NO_POLICIES: string[] = [];

// Only critical policies missing (non-critical present)
export const FIXTURE_MISSING_CRITICAL: string[] = [
  "ai_cost_events_select_own_company",
  "ai_cost_events_insert_own_company",
  "audit_logs_select_own_company",
  "audit_logs_no_delete",
];

// All deployed + some unexpected extras
export function FIXTURE_WITH_UNEXPECTED_POLICIES(): string[] {
  return [
    ...getAllExpectedPolicyIds(),
    "legacy_policy_from_b33",
    "old_companies_policy_v1",
  ];
}

// Only companies table policies deployed
export const FIXTURE_ONLY_COMPANIES: string[] = [
  "companies_select_own",
  "companies_update_own",
];

// Everything except employees (most common partial scenario)
export function FIXTURE_MISSING_EMPLOYEES(): string[] {
  return getAllExpectedPolicyIds().filter((id) => !id.startsWith("employees_"));
}

// Checklist done items — all critical items completed
export const FIXTURE_CHECKLIST_ALL_CRITICAL_DONE: string[] = [
  "backup_before_rls",
  "review_sql_file",
  "check_rls_enabled",
  "staging_test_first",
  "check_service_role_exempt",
  "anon_access_blocked",
  "apply_in_transaction",
  "check_no_syntax_errors",
  "verify_policies_created",
  "test_authenticated_isolation",
  "test_pierre_routes_post_rls",
];

// Checklist with nothing done
export const FIXTURE_CHECKLIST_NOTHING_DONE: string[] = [];
