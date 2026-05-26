// src/lib/pierre/security/pierre-retention.ts
// B41 — Data retention policies. Pure, no side effects.

import type { PierreResourceDefinition } from "./pierre-data-map";
import { getPierreResourceByTable } from "./pierre-data-map";

export type RetentionPolicy = {
  resource_type: string;
  table: string;
  policy_id: string;
  max_age_days: number | null;
  legal_hold: boolean;
  anonymize_at_expiry: boolean;
  delete_at_expiry: boolean;
  notes: string;
};

export type RetentionDecision = {
  should_retain: boolean;
  should_anonymize: boolean;
  should_delete: boolean;
  reason: string;
  policy_id: string;
};

export type RetentionReport = {
  generated_at: string;
  user_id: string;
  resources: Array<{
    table: string;
    policy_id: string;
    action: "retain" | "anonymize" | "delete" | "legal_hold";
    notes: string;
  }>;
};

// ── Policy definitions ────────────────────────────────────────────────────────

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    resource_type: "mission",
    table: "pierre_missions",
    policy_id: "ret_mission_until_deletion",
    max_age_days: null,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Missions retained until account deletion. Deleted on RGPD purge request.",
  },
  {
    resource_type: "task",
    table: "pierre_tasks",
    policy_id: "ret_task_until_deletion",
    max_age_days: null,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Tasks retained until account deletion.",
  },
  {
    resource_type: "task_log",
    table: "pierre_task_logs",
    policy_id: "ret_task_log_90d",
    max_age_days: 90,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Operational logs purged after 90 days by default.",
  },
  {
    resource_type: "artifact",
    table: "pierre_task_artifacts",
    policy_id: "ret_artifact_until_deletion",
    max_age_days: null,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Artifact metadata retained until deletion.",
  },
  {
    resource_type: "document",
    table: "pierre_documents",
    policy_id: "ret_document_until_deletion",
    max_age_days: null,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Documents retained until deletion.",
  },
  {
    resource_type: "outbound_email",
    table: "pierre_outbound_emails",
    policy_id: "ret_email_until_deletion",
    max_age_days: null,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Email metadata retained until deletion.",
  },
  {
    resource_type: "company_memory",
    table: "pierre_company_memory",
    policy_id: "ret_memory_until_deletion",
    max_age_days: null,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "CloneADN retained until explicit deletion.",
  },
  {
    resource_type: "ai_cost_event",
    table: "cloneos_ai_cost_events",
    policy_id: "ret_ai_cost_90d",
    max_age_days: 90,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "AI cost events purged after 90 days.",
  },
  {
    resource_type: "email_send_event",
    table: "cloneos_email_send_events",
    policy_id: "ret_email_audit_90d",
    max_age_days: 90,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Email send audit events purged after 90 days.",
  },
  {
    resource_type: "security_audit_event",
    table: "security_audit_events",
    policy_id: "ret_security_audit_1y",
    max_age_days: 365,
    legal_hold: false,
    anonymize_at_expiry: false,
    delete_at_expiry: true,
    notes: "Security events retained 1 year.",
  },
  {
    resource_type: "billing_order",
    table: "orders",
    policy_id: "ret_billing_legal_7y",
    max_age_days: 365 * 7,
    legal_hold: true,
    anonymize_at_expiry: true,
    delete_at_expiry: false,
    notes: "Orders retained 7 years for legal/fiscal compliance. Anonymized at expiry, never deleted.",
  },
];

// ── Lookup ────────────────────────────────────────────────────────────────────

export function getRetentionPolicyForResource(
  tableOrType: string,
): RetentionPolicy | null {
  return (
    RETENTION_POLICIES.find(
      (p) => p.table === tableOrType || p.resource_type === tableOrType,
    ) ?? null
  );
}

export function shouldRetainResource(
  tableOrType: string,
  ageInDays: number,
): boolean {
  const policy = getRetentionPolicyForResource(tableOrType);
  if (!policy) return true;
  if (policy.legal_hold) return true;
  if (policy.max_age_days === null) return true;
  return ageInDays < policy.max_age_days;
}

export function shouldAnonymizeResource(
  tableOrType: string,
  ageInDays: number,
): boolean {
  const policy = getRetentionPolicyForResource(tableOrType);
  if (!policy) return false;
  if (!policy.anonymize_at_expiry) return false;
  if (policy.max_age_days === null) return false;
  return ageInDays >= policy.max_age_days;
}

export function buildRetentionReport(userId: string): RetentionReport {
  const resources = RETENTION_POLICIES.map((policy) => {
    let action: "retain" | "anonymize" | "delete" | "legal_hold";
    if (policy.legal_hold) {
      action = "legal_hold";
    } else if (policy.anonymize_at_expiry && policy.max_age_days !== null) {
      action = "anonymize";
    } else if (policy.delete_at_expiry) {
      action = "delete";
    } else {
      action = "retain";
    }

    return {
      table: policy.table,
      policy_id: policy.policy_id,
      action,
      notes: policy.notes,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    user_id: userId,
    resources,
  };
}

export function getRetentionPolicySummary(): RetentionPolicy[] {
  return [...RETENTION_POLICIES];
}

export function getLegalHoldResources(): RetentionPolicy[] {
  return RETENTION_POLICIES.filter((p) => p.legal_hold);
}

// ── Resource definition bridge ────────────────────────────────────────────────

export function getResourceDefinitionWithRetention(
  table: string,
): { resource: PierreResourceDefinition | null; retention: RetentionPolicy | null } {
  return {
    resource: getPierreResourceByTable(table),
    retention: getRetentionPolicyForResource(table),
  };
}
