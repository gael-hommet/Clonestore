// B44 — PierreEmpreinte workflow configuration builder
// Derives runtime workflow config from PierreEmpreinte for Pierre's HR engine.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { PierreEmpreinte } from "./types";

export interface PierreWorkflowRuntimeConfig {
  language: string;
  max_tasks_per_mission: number;
  require_summary_before_close: boolean;
  auto_archive_after_days: number | null;
  enabled_domains: string[];
  blocked_task_types: string[];
  allowed_auto_task_types: string[];
  require_human_review_before_send: boolean;
  ai_mode: string;
  trust_level: string;
  sensitive_case_always_human: boolean;
  email_send_mode: string;
  never_auto_send_domains: string[];
  require_approval_for_email_domains: string[];
  human_required_document_types: string[];
  max_auto_actions_per_session: number;
}

export function buildPierreWorkflowRuntimeConfig(
  empreinte: PierreEmpreinte | null,
): PierreWorkflowRuntimeConfig {
  if (!empreinte) {
    return buildDefaultWorkflowRuntimeConfig();
  }

  return {
    language: empreinte.workflow_rules.default_mission_language,
    max_tasks_per_mission: empreinte.workflow_rules.max_tasks_per_mission,
    require_summary_before_close: empreinte.workflow_rules.require_mission_summary_before_close,
    auto_archive_after_days: empreinte.workflow_rules.auto_archive_completed_missions_after_days,
    enabled_domains: empreinte.hr_scope.enabled_domains,
    blocked_task_types: empreinte.autonomy.blocked_task_types,
    allowed_auto_task_types: empreinte.autonomy.allowed_auto_task_types,
    require_human_review_before_send: empreinte.autonomy.require_human_review_before_send,
    ai_mode: empreinte.autonomy.ai_mode,
    trust_level: empreinte.autonomy.trust_level,
    sensitive_case_always_human: empreinte.sensitive_cases.always_require_human,
    email_send_mode: empreinte.email_rules.send_mode,
    never_auto_send_domains: empreinte.email_rules.never_auto_send_domains,
    require_approval_for_email_domains: empreinte.email_rules.require_approval_for_domains,
    human_required_document_types: empreinte.document_rules.always_require_human_for_types,
    max_auto_actions_per_session: empreinte.autonomy.max_auto_actions_per_session,
  };
}

function buildDefaultWorkflowRuntimeConfig(): PierreWorkflowRuntimeConfig {
  return {
    language: "fr",
    max_tasks_per_mission: 20,
    require_summary_before_close: false,
    auto_archive_after_days: null,
    enabled_domains: ["task", "document", "mission", "employee"],
    blocked_task_types: ["email.send", "send_email"],
    allowed_auto_task_types: ["document.generate", "email.draft"],
    require_human_review_before_send: true,
    ai_mode: "assist",
    trust_level: "supervised",
    sensitive_case_always_human: true,
    email_send_mode: "draft_only",
    never_auto_send_domains: ["offboarding", "legal", "payroll"],
    require_approval_for_email_domains: ["offboarding", "sensitive"],
    human_required_document_types: ["hr_contract_draft", "hr_amendment_draft", "sensitive_case_note"],
    max_auto_actions_per_session: 10,
  };
}

export function isDomainEnabledInEmpreinte(
  domain: string,
  empreinte: PierreEmpreinte | null,
): boolean {
  if (!empreinte) return true;
  if (empreinte.hr_scope.disabled_domains.includes(domain)) return false;
  if (empreinte.hr_scope.enabled_domains.length === 0) return true;
  return empreinte.hr_scope.enabled_domains.includes(domain);
}

export function isTaskTypeBlockedInEmpreinte(
  taskType: string,
  empreinte: PierreEmpreinte | null,
): boolean {
  if (!empreinte) {
    return taskType === "email.send" || taskType === "send_email";
  }
  return empreinte.autonomy.blocked_task_types.includes(taskType);
}

export function requiresHumanForDocumentType(
  documentType: string,
  empreinte: PierreEmpreinte | null,
): boolean {
  if (!empreinte) {
    return ["hr_contract_draft", "hr_amendment_draft", "sensitive_case_note"].includes(documentType);
  }
  return empreinte.document_rules.always_require_human_for_types.includes(documentType);
}
