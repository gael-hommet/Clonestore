// B44 — PierreEmpreinte test fixtures
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { PierreEmpreinte } from "./types";
import { normalizePierreEmpreinte } from "./pierre-normalizer";

export function buildMinimalPierreEmpreinte(overrides: Partial<Record<string, unknown>> = {}): PierreEmpreinte {
  return normalizePierreEmpreinte({
    identity: { display_name: "Pierre", show_powered_by_clonestore: true },
    hr_scope: { enabled_domains: ["task", "document", "employee"], contract_types_in_scope: ["CDI"] },
    autonomy: { ai_mode: "assist", trust_level: "supervised", blocked_task_types: ["email.send", "send_email"], require_human_review_before_send: true },
    email_rules: { send_mode: "draft_only", never_auto_send_domains: ["offboarding", "legal"] },
    sensitive_cases: { always_require_human: true, confidentiality_level: "confidential", hr_manager_must_validate: true },
    document_rules: { default_tone: "formal", always_require_human_for_types: ["hr_contract_draft", "sensitive_case_note"], document_language: "fr" },
    ...overrides,
  }, "test_user", "test_enterprise");
}

export function buildCompletePierreEmpreinte(): PierreEmpreinte {
  return normalizePierreEmpreinte({
    identity: {
      display_name: "Pierre Meridian",
      persona_description: "Votre assistant RH personnalisé pour Meridian.",
      greeting_message: "Bonjour ! Je suis Pierre, prêt à vous aider dans vos démarches RH.",
      help_message: "Décrivez votre besoin RH en français et je m'en occupe.",
      brand_color_hex: "#1A5276",
      visual_identity_asset_url: null,
      show_powered_by_clonestore: true,
      custom_slug: "pierre-meridian",
    },
    hr_scope: {
      enabled_domains: ["task", "document", "mission", "employee", "absence", "onboarding", "prepayroll", "recruitment"],
      disabled_domains: [],
      max_employees_managed: 200,
      contract_types_in_scope: ["CDI", "CDD", "interim", "apprentissage"],
      excluded_employee_categories: ["stagiaires"],
    },
    workflow_rules: {
      default_mission_language: "fr",
      require_mission_summary_before_close: true,
      auto_archive_completed_missions_after_days: 90,
      max_tasks_per_mission: 20,
      task_auto_close_after_days: 30,
      require_task_attachment_for_domains: ["prepayroll"],
    },
    recruitment: {
      enabled: true,
      default_contract_type: "CDI",
      standard_notice_period_days: 90,
      probation_period_days: 90,
      default_onboarding_checklist_id: null,
      require_offer_validation: true,
    },
    onboarding: {
      enabled: true,
      checklist_template_id: null,
      equipment_request_enabled: true,
      buddy_assignment_enabled: true,
      standard_duration_days: 30,
      required_docs: ["contract", "id_proof"],
      require_manager_sign_off: true,
    },
    absences: {
      enabled: true,
      leave_types: ["cp", "rtt", "sick", "exceptional", "paternity"],
      require_manager_approval_for: ["cp", "rtt"],
      require_hr_approval_for: ["exceptional", "paternity"],
      auto_approve_under_days: null,
      blocking_periods: ["fin_annee"],
    },
    prepayroll: {
      enabled: true,
      payroll_software: "silae",
      payroll_cycle: "monthly",
      cutoff_day: 25,
      require_hr_sign_off: true,
      auto_export_format: "excel",
      sensitive_fields: ["salary", "bonus", "bank_account"],
    },
    employee_file: {
      enabled: true,
      required_document_types: ["contract", "id_proof", "rib"],
      optional_document_types: ["diploma", "references", "medical_certificate"],
      retention_policy_years: 5,
      allow_employee_self_service: false,
      require_signature_for: ["contract", "amendment"],
    },
    document_rules: {
      default_tone: "warm",
      always_require_human_for_types: ["hr_contract_draft", "hr_amendment_draft", "sensitive_case_note", "offboarding_checklist"],
      auto_generate_allowed_types: ["work_certificate", "leave_confirmation", "employment_letter"],
      document_language: "fr",
      include_company_header: true,
      include_legal_disclaimer: true,
      legal_disclaimer_text: "Document confidentiel — Meridian Technologies SAS. Ne pas diffuser.",
      preferred_template_ids: [],
    },
    email_rules: {
      send_mode: "live_with_approval",
      require_approval_for_domains: ["offboarding", "sensitive", "legal", "disciplinary"],
      never_auto_send_domains: ["offboarding", "legal", "payroll", "disciplinary"],
      default_from_name: "Pierre — RH Meridian",
      default_reply_to: "rh@meridian.fr",
      max_recipients_per_email: 5,
      include_confidentiality_footer: true,
    },
    sensitive_cases: {
      always_require_human: true,
      escalation_email: "drh@meridian.fr",
      legal_review_required_for: ["disciplinary", "termination", "harassment", "legal_dispute"],
      documentation_required: true,
      confidentiality_level: "confidential",
      hr_manager_must_validate: true,
    },
    autonomy: {
      ai_mode: "assist",
      trust_level: "supervised",
      require_human_review_before_send: true,
      max_auto_actions_per_session: 5,
      blocked_task_types: ["email.send", "send_email", "hr_contract_sign"],
      allowed_auto_task_types: ["document.generate", "email.draft", "leave_confirmation"],
    },
    document_style: {
      font_family: "Arial",
      primary_color_hex: "#1A5276",
      secondary_color_hex: "#AED6F1",
      header_template_id: null,
      footer_template_id: null,
      watermark_text: null,
      page_margin_mm: 20,
      use_company_brand_mark: false,
    },
  }, "fixture_complete", "fixture_enterprise");
}

export function buildEmptyPierreEmpreinte(): PierreEmpreinte {
  return normalizePierreEmpreinte(null, "empty_user", "empty_enterprise");
}
