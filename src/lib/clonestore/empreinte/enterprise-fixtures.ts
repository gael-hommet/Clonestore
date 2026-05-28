// B44 — EnterpriseEmpreinte test fixtures
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { EnterpriseEmpreinte } from "./types";
import { normalizeEnterpriseEmpreinte } from "./enterprise-normalizer";
import { computeEnterpriseEmpreinteCompletion } from "./enterprise-completion";

export function buildMinimalEnterpriseEmpreinte(overrides: Partial<Record<string, unknown>> = {}): EnterpriseEmpreinte {
  const base = normalizeEnterpriseEmpreinte({
    id: "test_user",
    company_identity: {
      legal_name: "Acme SAS",
      sector: "Technologie",
      size_range: "11-50",
      country_code: "FR",
      main_language: "fr",
      hr_contact_email: "rh@acme.fr",
    },
    communication: {
      default_tone: "formal",
      preferred_length: "standard",
      language_code: "fr",
    },
    autonomy: {
      default_level: "supervised",
      require_approval_above_risk: "medium",
      never_auto_execute: ["email.send", "send_email"],
    },
    ...overrides,
  }, "test_user");
  return base;
}

export function buildCompleteEnterpriseEmpreinte(): EnterpriseEmpreinte {
  const raw: Record<string, unknown> = {
    company_identity: {
      legal_name: "Meridian Technologies SAS",
      trade_name: "Meridian",
      brand_mark: "Meridian",
      sector: "Logiciels RH",
      size_range: "51-200",
      founded_year: 2015,
      country_code: "FR",
      main_language: "fr",
      website_url: "https://meridian.fr",
      hr_contact_email: "rh@meridian.fr",
      hr_contact_name: "Sophie Martin",
      values: ["innovation", "transparence", "bienveillance"],
      mission_statement: "Simplifier la gestion RH pour les entreprises en croissance.",
      tagline: "Le RH, simplifié.",
    },
    locations: [
      {
        id: "loc_paris",
        label: "Siège Paris",
        city: "Paris",
        postal_code: "75008",
        country_code: "FR",
        timezone: "Europe/Paris",
        is_headquarters: true,
        active: true,
      },
    ],
    roles: [
      { id: "role_drh", title: "Directeur RH", department: "RH", level: "director", is_hr_role: true, can_approve_hr_actions: true, active: true },
      { id: "role_rrh", title: "Responsable RH", department: "RH", level: "manager", is_hr_role: true, can_approve_hr_actions: true, active: true },
    ],
    validation_circuits: [
      { id: "vc_sensitive", label: "Circuit cas sensibles", scope: "sensitive", required_approvers: 2, approver_roles: ["role_drh", "role_rrh"], max_delay_hours: 48, active: true },
    ],
    communication: {
      default_tone: "warm",
      preferred_length: "standard",
      language_code: "fr",
      formal_closing: "Bien cordialement,",
      greeting_style: "Bonjour {prénom},",
      avoid_words: ["urgentissime", "ASAP"],
      preferred_words: ["collaboration", "accompagnement"],
    },
    channels: [
      { channel: "email", enabled: true, from_name: "Meridian RH", from_address: "rh@meridian.fr", reply_to: null, footer_text: null, brand_color_hex: "#1A5276" },
    ],
    autonomy: {
      default_level: "supervised",
      allowed_auto_domains: ["document"],
      blocked_auto_domains: ["offboarding"],
      max_auto_tasks_per_mission: 5,
      require_approval_above_risk: "medium",
      sensitive_topics: ["licenciement", "harcèlement"],
      never_auto_execute: ["email.send", "send_email", "hr_contract_sign"],
    },
    data_governance: {
      data_retention_days: 365,
      gdpr_dpo_email: "dpo@meridian.fr",
      gdpr_dpo_name: "Thomas Dupont",
      data_processing_region: "eu",
      export_allowed: true,
      purge_requires_confirmation: true,
      audit_log_retention_days: 730,
    },
    document_preferences: {
      preferred_format: "markdown",
      always_include_signature: true,
      always_include_legal_footer: true,
      legal_footer_text: "Document confidentiel — Meridian Technologies SAS",
      require_validation_for_risk_levels: ["high", "critical"],
      preferred_template_ids: [],
      document_language: "fr",
    },
    memory_seed: {
      key_facts: ["Convention collective SYNTEC", "Télétravail 3j/semaine maximum"],
      forbidden_topics: ["salaires individuels", "situations médicales"],
      preferred_workflows: ["document", "absence", "onboarding"],
      custom_vocabulary: { "collaborateur": "employé", "CSST": "Comité Social" },
    },
  };

  const empreinte = normalizeEnterpriseEmpreinte(raw, "fixture_complete");
  return empreinte;
}

export function buildPartialEnterpriseEmpreinte(): EnterpriseEmpreinte {
  return buildMinimalEnterpriseEmpreinte({
    communication: {
      default_tone: "formal",
      preferred_length: "standard",
      language_code: "fr",
    },
  });
}

export function buildEmptyEnterpriseEmpreinte(): EnterpriseEmpreinte {
  return normalizeEnterpriseEmpreinte(null, "empty_user");
}
