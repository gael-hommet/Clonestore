// src/lib/pierre/security/pierre-data-map.ts
// B41 — Pierre data resource classification for RGPD export/purge/retention.
// Pure map — no async, no side effects.

import type { SecurityDataSensitivity } from "@/lib/security/types";

export type PierreResourceDefinition = {
  table: string;
  resource_type: string;
  sensitivity: SecurityDataSensitivity;
  tenant_columns: string[];
  exportable: boolean;
  purgeable: boolean;
  anonymize_instead_of_purge: boolean;
  retention_policy: string;
  contains_personal_data: boolean;
  contains_hr_sensitive_data: boolean;
  notes: string;
};

export const PIERRE_DATA_MAP: PierreResourceDefinition[] = [
  {
    table: "pierre_missions",
    resource_type: "mission",
    sensitivity: "hr_sensitive",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "until_account_deletion",
    contains_personal_data: true,
    contains_hr_sensitive_data: true,
    notes: "Mission briefs may contain employee names, titles, HR context.",
  },
  {
    table: "pierre_tasks",
    resource_type: "task",
    sensitivity: "hr_sensitive",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "until_account_deletion",
    contains_personal_data: true,
    contains_hr_sensitive_data: true,
    notes: "Tasks may reference employees, HR actions, disciplinary events.",
  },
  {
    table: "pierre_task_logs",
    resource_type: "task_log",
    sensitivity: "internal",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "90_days_default",
    contains_personal_data: false,
    contains_hr_sensitive_data: false,
    notes: "Operational logs — meta_json must be redacted before export.",
  },
  {
    table: "pierre_task_artifacts",
    resource_type: "artifact",
    sensitivity: "hr_sensitive",
    tenant_columns: ["user_id", "mission_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "until_account_deletion",
    contains_personal_data: true,
    contains_hr_sensitive_data: true,
    notes: "Artifact metadata only — no binary content exported.",
  },
  {
    table: "pierre_documents",
    resource_type: "document",
    sensitivity: "hr_sensitive",
    tenant_columns: ["user_id", "mission_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "until_account_deletion",
    contains_personal_data: true,
    contains_hr_sensitive_data: true,
    notes: "Document metadata exported. HTML content not included in export.",
  },
  {
    table: "pierre_outbound_emails",
    resource_type: "outbound_email",
    sensitivity: "personal",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "until_account_deletion",
    contains_personal_data: true,
    contains_hr_sensitive_data: false,
    notes: "Email metadata only. Body text (email_body) never exported. Recipient email redacted.",
  },
  {
    table: "pierre_company_memory",
    resource_type: "company_memory",
    sensitivity: "hr_sensitive",
    tenant_columns: ["user_id", "agent_slug"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "until_account_deletion",
    contains_personal_data: true,
    contains_hr_sensitive_data: true,
    notes: "CloneADN — company profile, employee list, HR rules. Core sensitive resource.",
  },
  {
    table: "cloneos_ai_cost_events",
    resource_type: "ai_cost_event",
    sensitivity: "internal",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "90_days_default",
    contains_personal_data: false,
    contains_hr_sensitive_data: false,
    notes: "AI cost ledger. No prompts/completions stored (B38C policy).",
  },
  {
    table: "cloneos_email_send_events",
    resource_type: "email_send_event",
    sensitivity: "personal",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "90_days_default",
    contains_personal_data: true,
    contains_hr_sensitive_data: false,
    notes: "Email audit trail. Recipient metadata. Body never stored.",
  },
  {
    table: "security_audit_events",
    resource_type: "security_audit_event",
    sensitivity: "internal",
    tenant_columns: ["actor_user_id", "company_id"],
    exportable: true,
    purgeable: true,
    anonymize_instead_of_purge: false,
    retention_policy: "1_year_security",
    contains_personal_data: false,
    contains_hr_sensitive_data: false,
    notes: "Security audit log. ip_hash/user_agent_hash — PII hashed, not raw.",
  },
  {
    table: "orders",
    resource_type: "billing_order",
    sensitivity: "personal",
    tenant_columns: ["user_id"],
    exportable: true,
    purgeable: false,
    anonymize_instead_of_purge: true,
    retention_policy: "legal_minimum_7_years",
    contains_personal_data: true,
    contains_hr_sensitive_data: false,
    notes: "Billing records. Cannot be fully purged (legal retention). Anonymize on account deletion.",
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getPierreResourceByTable(
  table: string,
): PierreResourceDefinition | null {
  return PIERRE_DATA_MAP.find((r) => r.table === table) ?? null;
}

export function getPierreExportableResources(): PierreResourceDefinition[] {
  return PIERRE_DATA_MAP.filter((r) => r.exportable);
}

export function getPierrePurgeableResources(): PierreResourceDefinition[] {
  return PIERRE_DATA_MAP.filter((r) => r.purgeable);
}

export function getPierreHrSensitiveResources(): PierreResourceDefinition[] {
  return PIERRE_DATA_MAP.filter((r) => r.contains_hr_sensitive_data);
}

export function getPierrePersonalDataResources(): PierreResourceDefinition[] {
  return PIERRE_DATA_MAP.filter((r) => r.contains_personal_data);
}
