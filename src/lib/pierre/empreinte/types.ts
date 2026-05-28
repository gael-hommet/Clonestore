// B44 — Pierre Empreinte types
// Pierre-specific configuration per enterprise.
// One shared Pierre engine + per-company PierreEmpreinte = personalised Pierre per client.
// Pure types: no Next.js, no Supabase, no async, no side effects.

import type { EnterpriseEmpreinte, EmpreinteCompletion } from "../../clonestore/empreinte/types";

// Re-export for convenience
export type { EmpreinteCompletion };

// ── Scalar types ──────────────────────────────────────────────────────────────

export type PierreEmpreinteStatus =
  | "not_configured"
  | "minimal"
  | "partial"
  | "configured"
  | "complete"
  | "locked";

export type PierreAiMode =
  | "off"
  | "assist"
  | "primary";

export type PierreTrustLevel =
  | "minimal"
  | "supervised"
  | "trusted"
  | "autonomous";

export type PierreEmailSendMode =
  | "mock"
  | "draft_only"
  | "live_with_approval"
  | "live_auto";

export type PierrePayrollCycle =
  | "monthly"
  | "bimonthly"
  | "weekly";

export type PierreConfidentialityLevel =
  | "internal"
  | "restricted"
  | "confidential"
  | "secret";

// ── PierreIdentityConfig ──────────────────────────────────────────────────────

export interface PierreIdentityConfig {
  display_name: string;                 // default "Pierre"
  persona_description: string | null;
  greeting_message: string | null;
  help_message: string | null;
  brand_color_hex: string | null;       // visual identity asset color
  visual_identity_asset_url: string | null; // company_mark URL, NOT "logo"
  show_powered_by_clonestore: boolean;
  custom_slug: string | null;
}

// ── HrScopeConfig ─────────────────────────────────────────────────────────────

export interface HrScopeConfig {
  enabled_domains: string[];            // e.g. ["task", "document", "employee"]
  disabled_domains: string[];
  max_employees_managed: number | null;
  contract_types_in_scope: string[];    // CDI, CDD, interim, etc.
  excluded_employee_categories: string[];
}

// ── PierreWorkflowRules ───────────────────────────────────────────────────────

export interface PierreWorkflowRules {
  default_mission_language: string;     // ISO 639-1
  require_mission_summary_before_close: boolean;
  auto_archive_completed_missions_after_days: number | null;
  max_tasks_per_mission: number;
  task_auto_close_after_days: number | null;
  require_task_attachment_for_domains: string[];
}

// ── RecruitmentPreferences ────────────────────────────────────────────────────

export interface RecruitmentPreferences {
  enabled: boolean;
  default_contract_type: string | null;
  standard_notice_period_days: number | null;
  probation_period_days: number | null;
  default_onboarding_checklist_id: string | null;
  require_offer_validation: boolean;
}

// ── OnboardingPreferences ─────────────────────────────────────────────────────

export interface OnboardingPreferences {
  enabled: boolean;
  checklist_template_id: string | null;
  equipment_request_enabled: boolean;
  buddy_assignment_enabled: boolean;
  standard_duration_days: number;
  required_docs: string[];              // document template IDs
  require_manager_sign_off: boolean;
}

// ── AbsencePreferences ────────────────────────────────────────────────────────

export interface AbsencePreferences {
  enabled: boolean;
  leave_types: string[];                // "cp", "rtt", "sick", "exceptional"
  require_manager_approval_for: string[];
  require_hr_approval_for: string[];
  auto_approve_under_days: number | null;
  blocking_periods: string[];
}

// ── PrepayrollPreferences ─────────────────────────────────────────────────────

export interface PrepayrollPreferences {
  enabled: boolean;
  payroll_software: string | null;      // "silae", "payfit", "adp", "sage"
  payroll_cycle: PierrePayrollCycle | null;
  cutoff_day: number | null;
  require_hr_sign_off: boolean;
  auto_export_format: "csv" | "excel" | "xml" | "json" | null;
  sensitive_fields: string[];
}

// ── EmployeeFilePreferences ───────────────────────────────────────────────────

export interface EmployeeFilePreferences {
  enabled: boolean;
  required_document_types: string[];
  optional_document_types: string[];
  retention_policy_years: number;
  allow_employee_self_service: boolean;
  require_signature_for: string[];
}

// ── PierreDocumentRules ───────────────────────────────────────────────────────

export interface PierreDocumentRules {
  default_tone: string;                 // matches EmpTone / CloneADNTone
  always_require_human_for_types: string[];
  auto_generate_allowed_types: string[];
  document_language: string;
  include_company_header: boolean;
  include_legal_disclaimer: boolean;
  legal_disclaimer_text: string | null;
  preferred_template_ids: string[];
}

// ── PierreEmailRules ──────────────────────────────────────────────────────────

export interface PierreEmailRules {
  send_mode: PierreEmailSendMode;
  require_approval_for_domains: string[];
  never_auto_send_domains: string[];
  default_from_name: string | null;
  default_reply_to: string | null;
  max_recipients_per_email: number;
  include_confidentiality_footer: boolean;
}

// ── SensitiveCaseRules ────────────────────────────────────────────────────────

export interface SensitiveCaseRules {
  always_require_human: boolean;
  escalation_email: string | null;
  legal_review_required_for: string[];  // task types
  documentation_required: boolean;
  confidentiality_level: PierreConfidentialityLevel;
  hr_manager_must_validate: boolean;
}

// ── PierreAutonomyRules ───────────────────────────────────────────────────────

export interface PierreAutonomyRules {
  ai_mode: PierreAiMode;
  trust_level: PierreTrustLevel;
  require_human_review_before_send: boolean;
  max_auto_actions_per_session: number;
  blocked_task_types: string[];
  allowed_auto_task_types: string[];
}

// ── PierreDocumentStylePrep ───────────────────────────────────────────────────

export interface PierreDocumentStylePrep {
  font_family: string | null;
  primary_color_hex: string | null;    // visual identity primary color
  secondary_color_hex: string | null;
  header_template_id: string | null;
  footer_template_id: string | null;
  watermark_text: string | null;
  page_margin_mm: number;
  use_company_brand_mark: boolean;     // use visual_identity_asset, NOT "logo"
}

// ── PierreEmpreinteCompletion ─────────────────────────────────────────────────

export interface PierreEmpreinteCompletion {
  score: number;                        // 0-100
  status: PierreEmpreinteStatus;
  missing_fields: string[];
  recommendations: string[];
  filled_sections: string[];
  empty_sections: string[];
  can_activate: boolean;
  identity_ready: boolean;
  hr_scope_ready: boolean;
  workflow_ready: boolean;
  document_ready: boolean;
}

// ── Main PierreEmpreinte ──────────────────────────────────────────────────────

export interface PierreEmpreinte {
  id: string;
  enterprise_empreinte_id: string;     // link to EnterpriseEmpreinte
  version: string;
  status: PierreEmpreinteStatus;
  identity: PierreIdentityConfig;
  hr_scope: HrScopeConfig;
  workflow_rules: PierreWorkflowRules;
  recruitment: RecruitmentPreferences;
  onboarding: OnboardingPreferences;
  absences: AbsencePreferences;
  prepayroll: PrepayrollPreferences;
  employee_file: EmployeeFilePreferences;
  document_rules: PierreDocumentRules;
  email_rules: PierreEmailRules;
  sensitive_cases: SensitiveCaseRules;
  autonomy: PierreAutonomyRules;
  document_style: PierreDocumentStylePrep;
  completion: PierreEmpreinteCompletion;
  created_at: string;
  updated_at: string;
}

// ── Patch ─────────────────────────────────────────────────────────────────────

export type PierreEmpreintePatch = {
  identity?: Partial<PierreIdentityConfig>;
  hr_scope?: Partial<HrScopeConfig>;
  workflow_rules?: Partial<PierreWorkflowRules>;
  recruitment?: Partial<RecruitmentPreferences>;
  onboarding?: Partial<OnboardingPreferences>;
  absences?: Partial<AbsencePreferences>;
  prepayroll?: Partial<PrepayrollPreferences>;
  employee_file?: Partial<EmployeeFilePreferences>;
  document_rules?: Partial<PierreDocumentRules>;
  email_rules?: Partial<PierreEmailRules>;
  sensitive_cases?: Partial<SensitiveCaseRules>;
  autonomy?: Partial<PierreAutonomyRules>;
  document_style?: Partial<PierreDocumentStylePrep>;
  version?: string;
};

// ── Combined snapshot ─────────────────────────────────────────────────────────

export interface PierreEmpreinteSnapshot {
  enterprise: EnterpriseEmpreinte;
  pierre: PierreEmpreinte;
  generated_at: string;
  user_id: string;
  company_id: string | null;
  overall_completion: number;
  ready_to_activate: boolean;
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export type PierreEmpreinteVerdictLevel =
  | "not_ready"
  | "minimal_viable"
  | "production_ready"
  | "fully_configured"
  | "locked";

export interface PierreEmpreinteVerdictArea {
  area: string;
  ready: boolean;
  score: number;
  blocking_issues: string[];
  notes: string[];
}

export interface PierreEmpreinteVerdict {
  level: PierreEmpreinteVerdictLevel;
  overall_score: number;
  safe_to_activate: boolean;
  areas: PierreEmpreinteVerdictArea[];
  blocking_issues: string[];
  recommendations: string[];
  enterprise_completion: number;
  pierre_completion: number;
  generated_at: string;
}
