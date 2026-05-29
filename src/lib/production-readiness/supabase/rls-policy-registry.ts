// P-FINAL 01 — Phase 3 — RLS Policy Registry.
// Defines all expected RLS policies for CloneStore production.
// Pure: no Supabase, no Next, no async, no throw.
// CRITICAL: Do not apply migrations directly. This is a review-ready registry only.

export type RlsPolicyAction = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
export type RlsPolicyRole = "authenticated" | "anon" | "service_role";
export type RlsPolicyCoverage = "full" | "partial" | "none";

export interface RlsPolicy {
  id: string;
  table: string;
  policy_name: string;
  action: RlsPolicyAction;
  role: RlsPolicyRole;
  description: string;
  critical: boolean;
  using_clause: string;
  with_check_clause?: string;
}

export interface RlsTableCoverage {
  table: string;
  expected_policy_count: number;
  coverage: RlsCoverage;
  is_critical: boolean;
}

export type RlsCoverage = "full" | "partial" | "none" | "unknown";

// All expected RLS policies for CloneStore production.
// Tables: users (profiles), companies, employees, tasks, documents, emails,
//         pierre_task_artifacts, cloneos_ai_cost_events, absences, audit_logs
export const RLS_POLICY_REGISTRY: RlsPolicy[] = [
  // ── companies ────────────────────────────────────────────────────────────
  {
    id: "companies_select_own",
    table: "companies",
    policy_name: "companies_select_own",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only select their own company",
    critical: true,
    using_clause: "id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "companies_update_own",
    table: "companies",
    policy_name: "companies_update_own",
    action: "UPDATE",
    role: "authenticated",
    description: "Admins can only update their own company",
    critical: true,
    using_clause: "id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
    with_check_clause: "id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── profiles (users) ─────────────────────────────────────────────────────
  {
    id: "profiles_select_own_company",
    table: "profiles",
    policy_name: "profiles_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can see profiles within their own company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "profiles_update_own",
    table: "profiles",
    policy_name: "profiles_update_own",
    action: "UPDATE",
    role: "authenticated",
    description: "Users can only update their own profile",
    critical: true,
    using_clause: "id = auth.uid()",
    with_check_clause: "id = auth.uid()",
  },

  // ── employees ────────────────────────────────────────────────────────────
  {
    id: "employees_select_own_company",
    table: "employees",
    policy_name: "employees_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view employees from their own company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "employees_insert_own_company",
    table: "employees",
    policy_name: "employees_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Users can only insert employees for their own company",
    critical: true,
    using_clause: "true",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "employees_update_own_company",
    table: "employees",
    policy_name: "employees_update_own_company",
    action: "UPDATE",
    role: "authenticated",
    description: "Users can only update employees from their own company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "employees_delete_own_company",
    table: "employees",
    policy_name: "employees_delete_own_company",
    action: "DELETE",
    role: "authenticated",
    description: "Users can only delete employees from their own company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── tasks ────────────────────────────────────────────────────────────────
  {
    id: "tasks_select_own_company",
    table: "tasks",
    policy_name: "tasks_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view tasks from their company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "tasks_insert_own_company",
    table: "tasks",
    policy_name: "tasks_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Users can only create tasks for their company",
    critical: true,
    using_clause: "true",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "tasks_update_own_company",
    table: "tasks",
    policy_name: "tasks_update_own_company",
    action: "UPDATE",
    role: "authenticated",
    description: "Users can only update tasks from their company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── documents ────────────────────────────────────────────────────────────
  {
    id: "documents_select_own_company",
    table: "documents",
    policy_name: "documents_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view documents from their company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "documents_insert_own_company",
    table: "documents",
    policy_name: "documents_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Users can only create documents for their company",
    critical: true,
    using_clause: "true",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── emails ───────────────────────────────────────────────────────────────
  {
    id: "emails_select_own_company",
    table: "emails",
    policy_name: "emails_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view emails from their company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "emails_insert_own_company",
    table: "emails",
    policy_name: "emails_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Users can only create email drafts for their company",
    critical: true,
    using_clause: "true",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── pierre_task_artifacts ─────────────────────────────────────────────────
  {
    id: "pierre_task_artifacts_select_own_company",
    table: "pierre_task_artifacts",
    policy_name: "pierre_task_artifacts_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view Pierre artifacts from their company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "pierre_task_artifacts_insert_own_company",
    table: "pierre_task_artifacts",
    policy_name: "pierre_task_artifacts_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Users can only create Pierre artifacts for their company",
    critical: true,
    using_clause: "true",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── cloneos_ai_cost_events ────────────────────────────────────────────────
  {
    id: "ai_cost_events_select_own_company",
    table: "cloneos_ai_cost_events",
    policy_name: "ai_cost_events_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view AI cost events from their company",
    critical: false,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "ai_cost_events_insert_own_company",
    table: "cloneos_ai_cost_events",
    policy_name: "ai_cost_events_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Service role inserts cost events — authenticated users cannot",
    critical: false,
    using_clause: "false",
  },

  // ── absences ──────────────────────────────────────────────────────────────
  {
    id: "absences_select_own_company",
    table: "absences",
    policy_name: "absences_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only view absences from their company",
    critical: true,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "absences_insert_own_company",
    table: "absences",
    policy_name: "absences_insert_own_company",
    action: "INSERT",
    role: "authenticated",
    description: "Users can only create absences for their company",
    critical: true,
    using_clause: "true",
    with_check_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },

  // ── audit_logs ────────────────────────────────────────────────────────────
  {
    id: "audit_logs_select_own_company",
    table: "audit_logs",
    policy_name: "audit_logs_select_own_company",
    action: "SELECT",
    role: "authenticated",
    description: "Users can only read audit logs from their company",
    critical: false,
    using_clause: "company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())",
  },
  {
    id: "audit_logs_no_delete",
    table: "audit_logs",
    policy_name: "audit_logs_no_delete",
    action: "DELETE",
    role: "authenticated",
    description: "Audit logs cannot be deleted by authenticated users",
    critical: false,
    using_clause: "false",
  },
];

export function getCriticalPolicies(): RlsPolicy[] {
  return RLS_POLICY_REGISTRY.filter((p) => p.critical);
}

export function getPoliciesForTable(table: string): RlsPolicy[] {
  return RLS_POLICY_REGISTRY.filter((p) => p.table === table);
}

export function getAllCoveredTables(): string[] {
  return [...new Set(RLS_POLICY_REGISTRY.map((p) => p.table))];
}

export function getRlsPolicyById(id: string): RlsPolicy | undefined {
  return RLS_POLICY_REGISTRY.find((p) => p.id === id);
}

export const CRITICAL_TABLES = [
  "companies",
  "profiles",
  "employees",
  "tasks",
  "documents",
  "emails",
  "pierre_task_artifacts",
  "absences",
] as const;

export type CriticalTable = (typeof CRITICAL_TABLES)[number];
