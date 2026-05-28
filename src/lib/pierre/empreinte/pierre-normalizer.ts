// B44 — PierreEmpreinte normalizer
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  PierreEmpreinte,
  PierreEmpreintePatch,
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
} from "./types";
import {
  buildDefaultPierreIdentity,
  buildDefaultHrScope,
  buildDefaultWorkflowRules,
  buildDefaultRecruitmentPreferences,
  buildDefaultOnboardingPreferences,
  buildDefaultAbsencePreferences,
  buildDefaultPrepayrollPreferences,
  buildDefaultEmployeeFilePreferences,
  buildDefaultPierreDocumentRules,
  buildDefaultPierreEmailRules,
  buildDefaultSensitiveCaseRules,
  buildDefaultPierreAutonomyRules,
  buildDefaultPierreDocumentStyle,
  buildDefaultPierreEmpreinte,
  PIERRE_EMPREINTE_CURRENT_VERSION,
} from "./pierre-defaults";
import { computePierreEmpreinteCompletion } from "./pierre-completion";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isString(v: unknown): v is string { return typeof v === "string"; }
function isNumber(v: unknown): v is number { return typeof v === "number" && !isNaN(v); }
function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
function isArray(v: unknown): v is unknown[] { return Array.isArray(v); }
function normalizeStrArr(v: unknown): string[] {
  if (!isArray(v)) return [];
  return v.filter(isString);
}

function normalizeIdentity(raw: unknown): PierreIdentityConfig {
  const d = buildDefaultPierreIdentity();
  if (!isObject(raw)) return d;
  return {
    display_name: isString(raw.display_name) && raw.display_name.length > 0 ? raw.display_name : d.display_name,
    persona_description: isString(raw.persona_description) ? raw.persona_description : d.persona_description,
    greeting_message: isString(raw.greeting_message) ? raw.greeting_message : d.greeting_message,
    help_message: isString(raw.help_message) ? raw.help_message : d.help_message,
    brand_color_hex: isString(raw.brand_color_hex) ? raw.brand_color_hex : d.brand_color_hex,
    visual_identity_asset_url: isString(raw.visual_identity_asset_url) ? raw.visual_identity_asset_url : d.visual_identity_asset_url,
    show_powered_by_clonestore: isBool(raw.show_powered_by_clonestore) ? raw.show_powered_by_clonestore : d.show_powered_by_clonestore,
    custom_slug: isString(raw.custom_slug) ? raw.custom_slug : d.custom_slug,
  };
}

function normalizeHrScope(raw: unknown): HrScopeConfig {
  const d = buildDefaultHrScope();
  if (!isObject(raw)) return d;
  return {
    enabled_domains: normalizeStrArr(raw.enabled_domains).length > 0 ? normalizeStrArr(raw.enabled_domains) : d.enabled_domains,
    disabled_domains: normalizeStrArr(raw.disabled_domains),
    max_employees_managed: isNumber(raw.max_employees_managed) ? raw.max_employees_managed : d.max_employees_managed,
    contract_types_in_scope: normalizeStrArr(raw.contract_types_in_scope).length > 0 ? normalizeStrArr(raw.contract_types_in_scope) : d.contract_types_in_scope,
    excluded_employee_categories: normalizeStrArr(raw.excluded_employee_categories),
  };
}

function normalizeWorkflowRules(raw: unknown): PierreWorkflowRules {
  const d = buildDefaultWorkflowRules();
  if (!isObject(raw)) return d;
  return {
    default_mission_language: isString(raw.default_mission_language) ? raw.default_mission_language : d.default_mission_language,
    require_mission_summary_before_close: isBool(raw.require_mission_summary_before_close) ? raw.require_mission_summary_before_close : d.require_mission_summary_before_close,
    auto_archive_completed_missions_after_days: isNumber(raw.auto_archive_completed_missions_after_days) ? raw.auto_archive_completed_missions_after_days : d.auto_archive_completed_missions_after_days,
    max_tasks_per_mission: isNumber(raw.max_tasks_per_mission) ? raw.max_tasks_per_mission : d.max_tasks_per_mission,
    task_auto_close_after_days: isNumber(raw.task_auto_close_after_days) ? raw.task_auto_close_after_days : d.task_auto_close_after_days,
    require_task_attachment_for_domains: normalizeStrArr(raw.require_task_attachment_for_domains),
  };
}

function normalizeRecruitment(raw: unknown): RecruitmentPreferences {
  const d = buildDefaultRecruitmentPreferences();
  if (!isObject(raw)) return d;
  return {
    enabled: isBool(raw.enabled) ? raw.enabled : d.enabled,
    default_contract_type: isString(raw.default_contract_type) ? raw.default_contract_type : d.default_contract_type,
    standard_notice_period_days: isNumber(raw.standard_notice_period_days) ? raw.standard_notice_period_days : d.standard_notice_period_days,
    probation_period_days: isNumber(raw.probation_period_days) ? raw.probation_period_days : d.probation_period_days,
    default_onboarding_checklist_id: isString(raw.default_onboarding_checklist_id) ? raw.default_onboarding_checklist_id : d.default_onboarding_checklist_id,
    require_offer_validation: isBool(raw.require_offer_validation) ? raw.require_offer_validation : d.require_offer_validation,
  };
}

function normalizeOnboarding(raw: unknown): OnboardingPreferences {
  const d = buildDefaultOnboardingPreferences();
  if (!isObject(raw)) return d;
  return {
    enabled: isBool(raw.enabled) ? raw.enabled : d.enabled,
    checklist_template_id: isString(raw.checklist_template_id) ? raw.checklist_template_id : d.checklist_template_id,
    equipment_request_enabled: isBool(raw.equipment_request_enabled) ? raw.equipment_request_enabled : d.equipment_request_enabled,
    buddy_assignment_enabled: isBool(raw.buddy_assignment_enabled) ? raw.buddy_assignment_enabled : d.buddy_assignment_enabled,
    standard_duration_days: isNumber(raw.standard_duration_days) ? raw.standard_duration_days : d.standard_duration_days,
    required_docs: normalizeStrArr(raw.required_docs),
    require_manager_sign_off: isBool(raw.require_manager_sign_off) ? raw.require_manager_sign_off : d.require_manager_sign_off,
  };
}

function normalizeAbsences(raw: unknown): AbsencePreferences {
  const d = buildDefaultAbsencePreferences();
  if (!isObject(raw)) return d;
  return {
    enabled: isBool(raw.enabled) ? raw.enabled : d.enabled,
    leave_types: normalizeStrArr(raw.leave_types).length > 0 ? normalizeStrArr(raw.leave_types) : d.leave_types,
    require_manager_approval_for: normalizeStrArr(raw.require_manager_approval_for),
    require_hr_approval_for: normalizeStrArr(raw.require_hr_approval_for),
    auto_approve_under_days: isNumber(raw.auto_approve_under_days) ? raw.auto_approve_under_days : d.auto_approve_under_days,
    blocking_periods: normalizeStrArr(raw.blocking_periods),
  };
}

function normalizePrepayroll(raw: unknown): PrepayrollPreferences {
  const d = buildDefaultPrepayrollPreferences();
  if (!isObject(raw)) return d;
  return {
    enabled: isBool(raw.enabled) ? raw.enabled : d.enabled,
    payroll_software: isString(raw.payroll_software) ? raw.payroll_software : d.payroll_software,
    payroll_cycle: isString(raw.payroll_cycle) ? (raw.payroll_cycle as PrepayrollPreferences["payroll_cycle"]) : d.payroll_cycle,
    cutoff_day: isNumber(raw.cutoff_day) ? raw.cutoff_day : d.cutoff_day,
    require_hr_sign_off: isBool(raw.require_hr_sign_off) ? raw.require_hr_sign_off : d.require_hr_sign_off,
    auto_export_format: isString(raw.auto_export_format) ? (raw.auto_export_format as PrepayrollPreferences["auto_export_format"]) : d.auto_export_format,
    sensitive_fields: normalizeStrArr(raw.sensitive_fields).length > 0 ? normalizeStrArr(raw.sensitive_fields) : d.sensitive_fields,
  };
}

function normalizeEmployeeFile(raw: unknown): EmployeeFilePreferences {
  const d = buildDefaultEmployeeFilePreferences();
  if (!isObject(raw)) return d;
  return {
    enabled: isBool(raw.enabled) ? raw.enabled : d.enabled,
    required_document_types: normalizeStrArr(raw.required_document_types).length > 0 ? normalizeStrArr(raw.required_document_types) : d.required_document_types,
    optional_document_types: normalizeStrArr(raw.optional_document_types),
    retention_policy_years: isNumber(raw.retention_policy_years) ? raw.retention_policy_years : d.retention_policy_years,
    allow_employee_self_service: isBool(raw.allow_employee_self_service) ? raw.allow_employee_self_service : d.allow_employee_self_service,
    require_signature_for: normalizeStrArr(raw.require_signature_for),
  };
}

function normalizeDocumentRules(raw: unknown): PierreDocumentRules {
  const d = buildDefaultPierreDocumentRules();
  if (!isObject(raw)) return d;
  return {
    default_tone: isString(raw.default_tone) ? raw.default_tone : d.default_tone,
    always_require_human_for_types: normalizeStrArr(raw.always_require_human_for_types).length > 0 ? normalizeStrArr(raw.always_require_human_for_types) : d.always_require_human_for_types,
    auto_generate_allowed_types: normalizeStrArr(raw.auto_generate_allowed_types),
    document_language: isString(raw.document_language) ? raw.document_language : d.document_language,
    include_company_header: isBool(raw.include_company_header) ? raw.include_company_header : d.include_company_header,
    include_legal_disclaimer: isBool(raw.include_legal_disclaimer) ? raw.include_legal_disclaimer : d.include_legal_disclaimer,
    legal_disclaimer_text: isString(raw.legal_disclaimer_text) ? raw.legal_disclaimer_text : d.legal_disclaimer_text,
    preferred_template_ids: normalizeStrArr(raw.preferred_template_ids),
  };
}

function normalizeEmailRules(raw: unknown): PierreEmailRules {
  const d = buildDefaultPierreEmailRules();
  if (!isObject(raw)) return d;
  return {
    send_mode: isString(raw.send_mode) ? (raw.send_mode as PierreEmailRules["send_mode"]) : d.send_mode,
    require_approval_for_domains: normalizeStrArr(raw.require_approval_for_domains),
    never_auto_send_domains: normalizeStrArr(raw.never_auto_send_domains).length > 0 ? normalizeStrArr(raw.never_auto_send_domains) : d.never_auto_send_domains,
    default_from_name: isString(raw.default_from_name) ? raw.default_from_name : d.default_from_name,
    default_reply_to: isString(raw.default_reply_to) ? raw.default_reply_to : d.default_reply_to,
    max_recipients_per_email: isNumber(raw.max_recipients_per_email) ? raw.max_recipients_per_email : d.max_recipients_per_email,
    include_confidentiality_footer: isBool(raw.include_confidentiality_footer) ? raw.include_confidentiality_footer : d.include_confidentiality_footer,
  };
}

function normalizeSensitiveCases(raw: unknown): SensitiveCaseRules {
  const d = buildDefaultSensitiveCaseRules();
  if (!isObject(raw)) return d;
  return {
    always_require_human: isBool(raw.always_require_human) ? raw.always_require_human : d.always_require_human,
    escalation_email: isString(raw.escalation_email) ? raw.escalation_email : d.escalation_email,
    legal_review_required_for: normalizeStrArr(raw.legal_review_required_for).length > 0 ? normalizeStrArr(raw.legal_review_required_for) : d.legal_review_required_for,
    documentation_required: isBool(raw.documentation_required) ? raw.documentation_required : d.documentation_required,
    confidentiality_level: isString(raw.confidentiality_level) ? (raw.confidentiality_level as SensitiveCaseRules["confidentiality_level"]) : d.confidentiality_level,
    hr_manager_must_validate: isBool(raw.hr_manager_must_validate) ? raw.hr_manager_must_validate : d.hr_manager_must_validate,
  };
}

function normalizeAutonomy(raw: unknown): PierreAutonomyRules {
  const d = buildDefaultPierreAutonomyRules();
  if (!isObject(raw)) return d;
  return {
    ai_mode: isString(raw.ai_mode) ? (raw.ai_mode as PierreAutonomyRules["ai_mode"]) : d.ai_mode,
    trust_level: isString(raw.trust_level) ? (raw.trust_level as PierreAutonomyRules["trust_level"]) : d.trust_level,
    require_human_review_before_send: isBool(raw.require_human_review_before_send) ? raw.require_human_review_before_send : d.require_human_review_before_send,
    max_auto_actions_per_session: isNumber(raw.max_auto_actions_per_session) ? raw.max_auto_actions_per_session : d.max_auto_actions_per_session,
    blocked_task_types: normalizeStrArr(raw.blocked_task_types).length > 0 ? normalizeStrArr(raw.blocked_task_types) : d.blocked_task_types,
    allowed_auto_task_types: normalizeStrArr(raw.allowed_auto_task_types),
  };
}

function normalizeDocumentStyle(raw: unknown): PierreDocumentStylePrep {
  const d = buildDefaultPierreDocumentStyle();
  if (!isObject(raw)) return d;
  return {
    font_family: isString(raw.font_family) ? raw.font_family : d.font_family,
    primary_color_hex: isString(raw.primary_color_hex) ? raw.primary_color_hex : d.primary_color_hex,
    secondary_color_hex: isString(raw.secondary_color_hex) ? raw.secondary_color_hex : d.secondary_color_hex,
    header_template_id: isString(raw.header_template_id) ? raw.header_template_id : d.header_template_id,
    footer_template_id: isString(raw.footer_template_id) ? raw.footer_template_id : d.footer_template_id,
    watermark_text: isString(raw.watermark_text) ? raw.watermark_text : d.watermark_text,
    page_margin_mm: isNumber(raw.page_margin_mm) ? raw.page_margin_mm : d.page_margin_mm,
    use_company_brand_mark: isBool(raw.use_company_brand_mark) ? raw.use_company_brand_mark : d.use_company_brand_mark,
  };
}

// ── Main normalizer ───────────────────────────────────────────────────────────

export function normalizePierreEmpreinte(
  raw: unknown,
  id: string,
  enterpriseEmpreinteId: string,
): PierreEmpreinte {
  const now = new Date().toISOString();

  if (!isObject(raw)) {
    const base = buildDefaultPierreEmpreinte(id, enterpriseEmpreinteId);
    base.completion = computePierreEmpreinteCompletion(base);
    return base;
  }

  const empreinte: PierreEmpreinte = {
    id,
    enterprise_empreinte_id: enterpriseEmpreinteId,
    version: isString(raw.version) ? raw.version : PIERRE_EMPREINTE_CURRENT_VERSION,
    status: isString(raw.status) ? (raw.status as PierreEmpreinte["status"]) : "not_configured",
    identity: normalizeIdentity(raw.identity),
    hr_scope: normalizeHrScope(raw.hr_scope),
    workflow_rules: normalizeWorkflowRules(raw.workflow_rules),
    recruitment: normalizeRecruitment(raw.recruitment),
    onboarding: normalizeOnboarding(raw.onboarding),
    absences: normalizeAbsences(raw.absences),
    prepayroll: normalizePrepayroll(raw.prepayroll),
    employee_file: normalizeEmployeeFile(raw.employee_file),
    document_rules: normalizeDocumentRules(raw.document_rules),
    email_rules: normalizeEmailRules(raw.email_rules),
    sensitive_cases: normalizeSensitiveCases(raw.sensitive_cases),
    autonomy: normalizeAutonomy(raw.autonomy),
    document_style: normalizeDocumentStyle(raw.document_style),
    completion: {
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
    },
    created_at: isString(raw.created_at) ? raw.created_at : now,
    updated_at: now,
  };

  empreinte.completion = computePierreEmpreinteCompletion(empreinte);
  empreinte.status = empreinte.completion.status;

  return empreinte;
}

export function applyPierreEmpreintePatch(
  base: PierreEmpreinte,
  patch: PierreEmpreintePatch,
): PierreEmpreinte {
  const now = new Date().toISOString();
  const updated: PierreEmpreinte = { ...base, updated_at: now };

  if (patch.identity) updated.identity = { ...base.identity, ...patch.identity };
  if (patch.hr_scope) updated.hr_scope = { ...base.hr_scope, ...patch.hr_scope };
  if (patch.workflow_rules) updated.workflow_rules = { ...base.workflow_rules, ...patch.workflow_rules };
  if (patch.recruitment) updated.recruitment = { ...base.recruitment, ...patch.recruitment };
  if (patch.onboarding) updated.onboarding = { ...base.onboarding, ...patch.onboarding };
  if (patch.absences) updated.absences = { ...base.absences, ...patch.absences };
  if (patch.prepayroll) updated.prepayroll = { ...base.prepayroll, ...patch.prepayroll };
  if (patch.employee_file) updated.employee_file = { ...base.employee_file, ...patch.employee_file };
  if (patch.document_rules) updated.document_rules = { ...base.document_rules, ...patch.document_rules };
  if (patch.email_rules) updated.email_rules = { ...base.email_rules, ...patch.email_rules };
  if (patch.sensitive_cases) updated.sensitive_cases = { ...base.sensitive_cases, ...patch.sensitive_cases };
  if (patch.autonomy) updated.autonomy = { ...base.autonomy, ...patch.autonomy };
  if (patch.document_style) updated.document_style = { ...base.document_style, ...patch.document_style };
  if (patch.version) updated.version = patch.version;

  updated.completion = computePierreEmpreinteCompletion(updated);
  updated.status = updated.completion.status;

  return updated;
}
