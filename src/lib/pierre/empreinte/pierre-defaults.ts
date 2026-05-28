// B44 — PierreEmpreinte default values
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  PierreEmpreinte,
  PierreIdentityConfig,
  HrScopeConfig,
  PierreWorkflowRules,
  RecruitmentPreferences,
  OnboardingPreferences,
  AbsencePreferences,
  PrepayrollPreferences,
  EmployeeFilePreferences,
  PierreDocumentRules,
  PierreEmailRules,
  SensitiveCaseRules,
  PierreAutonomyRules,
  PierreDocumentStylePrep,
  PierreEmpreinteCompletion,
} from "./types";

export const PIERRE_EMPREINTE_CURRENT_VERSION = "1.0.0";

export function buildDefaultPierreIdentity(): PierreIdentityConfig {
  return {
    display_name: "Pierre",
    persona_description: null,
    greeting_message: null,
    help_message: null,
    brand_color_hex: null,
    visual_identity_asset_url: null,
    show_powered_by_clonestore: true,
    custom_slug: null,
  };
}

export function buildDefaultHrScope(): HrScopeConfig {
  return {
    enabled_domains: ["task", "document", "mission", "employee", "absence", "onboarding", "prepayroll"],
    disabled_domains: [],
    max_employees_managed: null,
    contract_types_in_scope: ["CDI", "CDD"],
    excluded_employee_categories: [],
  };
}

export function buildDefaultWorkflowRules(): PierreWorkflowRules {
  return {
    default_mission_language: "fr",
    require_mission_summary_before_close: false,
    auto_archive_completed_missions_after_days: null,
    max_tasks_per_mission: 20,
    task_auto_close_after_days: null,
    require_task_attachment_for_domains: [],
  };
}

export function buildDefaultRecruitmentPreferences(): RecruitmentPreferences {
  return {
    enabled: true,
    default_contract_type: "CDI",
    standard_notice_period_days: null,
    probation_period_days: null,
    default_onboarding_checklist_id: null,
    require_offer_validation: true,
  };
}

export function buildDefaultOnboardingPreferences(): OnboardingPreferences {
  return {
    enabled: true,
    checklist_template_id: null,
    equipment_request_enabled: false,
    buddy_assignment_enabled: false,
    standard_duration_days: 30,
    required_docs: [],
    require_manager_sign_off: true,
  };
}

export function buildDefaultAbsencePreferences(): AbsencePreferences {
  return {
    enabled: true,
    leave_types: ["cp", "rtt", "sick", "exceptional"],
    require_manager_approval_for: ["cp", "rtt"],
    require_hr_approval_for: ["exceptional"],
    auto_approve_under_days: null,
    blocking_periods: [],
  };
}

export function buildDefaultPrepayrollPreferences(): PrepayrollPreferences {
  return {
    enabled: false,
    payroll_software: null,
    payroll_cycle: "monthly",
    cutoff_day: null,
    require_hr_sign_off: true,
    auto_export_format: null,
    sensitive_fields: ["salary", "bonus", "bank_account"],
  };
}

export function buildDefaultEmployeeFilePreferences(): EmployeeFilePreferences {
  return {
    enabled: true,
    required_document_types: ["contract", "id_proof"],
    optional_document_types: ["diploma", "references"],
    retention_policy_years: 5,
    allow_employee_self_service: false,
    require_signature_for: ["contract", "amendment"],
  };
}

export function buildDefaultPierreDocumentRules(): PierreDocumentRules {
  return {
    default_tone: "formal",
    always_require_human_for_types: ["hr_contract_draft", "hr_amendment_draft", "sensitive_case_note"],
    auto_generate_allowed_types: ["work_certificate", "leave_confirmation"],
    document_language: "fr",
    include_company_header: false,
    include_legal_disclaimer: false,
    legal_disclaimer_text: null,
    preferred_template_ids: [],
  };
}

export function buildDefaultPierreEmailRules(): PierreEmailRules {
  return {
    send_mode: "draft_only",
    require_approval_for_domains: ["offboarding", "sensitive", "legal"],
    never_auto_send_domains: ["offboarding", "legal", "payroll"],
    default_from_name: null,
    default_reply_to: null,
    max_recipients_per_email: 5,
    include_confidentiality_footer: false,
  };
}

export function buildDefaultSensitiveCaseRules(): SensitiveCaseRules {
  return {
    always_require_human: true,
    escalation_email: null,
    legal_review_required_for: ["disciplinary", "termination", "harassment"],
    documentation_required: true,
    confidentiality_level: "confidential",
    hr_manager_must_validate: true,
  };
}

export function buildDefaultPierreAutonomyRules(): PierreAutonomyRules {
  return {
    ai_mode: "assist",
    trust_level: "supervised",
    require_human_review_before_send: true,
    max_auto_actions_per_session: 10,
    blocked_task_types: ["email.send", "send_email"],
    allowed_auto_task_types: ["document.generate", "email.draft"],
  };
}

export function buildDefaultPierreDocumentStyle(): PierreDocumentStylePrep {
  return {
    font_family: null,
    primary_color_hex: null,
    secondary_color_hex: null,
    header_template_id: null,
    footer_template_id: null,
    watermark_text: null,
    page_margin_mm: 20,
    use_company_brand_mark: false,
  };
}

export function buildDefaultPierreEmpreinteCompletion(): PierreEmpreinteCompletion {
  return {
    score: 0,
    status: "not_configured",
    missing_fields: [],
    recommendations: [],
    filled_sections: [],
    empty_sections: [],
    can_activate: false,
    identity_ready: false,
    hr_scope_ready: false,
    workflow_ready: false,
    document_ready: false,
  };
}

export function buildDefaultPierreEmpreinte(
  id: string,
  enterpriseEmpreinteId: string,
): PierreEmpreinte {
  const now = new Date().toISOString();
  return {
    id,
    enterprise_empreinte_id: enterpriseEmpreinteId,
    version: PIERRE_EMPREINTE_CURRENT_VERSION,
    status: "not_configured",
    identity: buildDefaultPierreIdentity(),
    hr_scope: buildDefaultHrScope(),
    workflow_rules: buildDefaultWorkflowRules(),
    recruitment: buildDefaultRecruitmentPreferences(),
    onboarding: buildDefaultOnboardingPreferences(),
    absences: buildDefaultAbsencePreferences(),
    prepayroll: buildDefaultPrepayrollPreferences(),
    employee_file: buildDefaultEmployeeFilePreferences(),
    document_rules: buildDefaultPierreDocumentRules(),
    email_rules: buildDefaultPierreEmailRules(),
    sensitive_cases: buildDefaultSensitiveCaseRules(),
    autonomy: buildDefaultPierreAutonomyRules(),
    document_style: buildDefaultPierreDocumentStyle(),
    completion: buildDefaultPierreEmpreinteCompletion(),
    created_at: now,
    updated_at: now,
  };
}
