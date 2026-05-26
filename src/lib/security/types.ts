// src/lib/security/types.ts
// B41 — Core security types. Pure, no side effects.

export type SecurityAccessLevel =
  | "anonymous"
  | "logged_unpaid"
  | "trial"
  | "paid_customer"
  | "internal_admin"
  | "service_role";

export type SecurityDataSensitivity =
  | "public"
  | "internal"
  | "personal"
  | "hr_sensitive"
  | "legal_sensitive"
  | "health_sensitive"
  | "payroll_sensitive"
  | "secret";

export type SecurityDecisionStatus =
  | "allow"
  | "block_auth_required"
  | "block_not_paid"
  | "block_no_company"
  | "block_no_agent_access"
  | "block_tenant_mismatch"
  | "block_sensitive_scope"
  | "block_rate_limited"
  | "block_service_role_required"
  | "block_invalid_payload"
  | "block_emergency_shutdown";

export type SecurityTenantScope = {
  organization_id: string | null;
  company_id: string | null;
  user_id: string | null;
  agent_slug: string | null;
  access_level: SecurityAccessLevel;
  owns_pierre: boolean;
  pierre_enabled: boolean;
  source: "supabase_auth" | "mock_test" | "service_role" | "unknown";
};

export type SecurityRoutePolicy = {
  route_id: string;
  path_pattern: string;
  method: string | string[];
  required_access_level: SecurityAccessLevel;
  requires_pierre_access: boolean;
  requires_company_scope: boolean;
  allows_service_role: boolean;
  data_sensitivity: SecurityDataSensitivity;
  rate_limit_key: string | null;
  audit_required: boolean;
  no_store_required: boolean;
};

export type SecurityAuditEvent = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  company_id: string | null;
  organization_id: string | null;
  agent_slug: string | null;
  route_id: string | null;
  decision_status: SecurityDecisionStatus;
  data_sensitivity: SecurityDataSensitivity;
  resource_type: string | null;
  resource_id: string | null;
  ip_hash: string | null;
  user_agent_hash: string | null;
  metadata_redacted: Record<string, unknown>;
  created_at: string;
};

export type SecurityDecision = {
  status: SecurityDecisionStatus;
  allowed: boolean;
  reason: string | null;
  policy_id: string | null;
};

export type RgpdExportBundle = {
  generated_at: string;
  tenant: {
    user_id: string;
    company_id: string;
    access_level: SecurityAccessLevel;
  };
  missions: unknown[];
  tasks: unknown[];
  documents: unknown[];
  emails: unknown[];
  memory: unknown[];
  audit_events: unknown[];
  cost_events: unknown[];
  metadata: Record<string, unknown>;
};

export type RgpdPurgePlan = {
  tenant: {
    user_id: string;
    company_id: string;
  };
  dry_run: boolean;
  tables: Array<{
    table: string;
    rows_estimated: number;
    purgeable: boolean;
    action: "delete" | "anonymize" | "retain";
    retain_reason?: string;
  }>;
  rows_estimated_total: number;
  blocked_reasons: string[];
  requires_confirmation: boolean;
  confirmation_phrase: string;
  irreversible_after_execution: boolean;
};
