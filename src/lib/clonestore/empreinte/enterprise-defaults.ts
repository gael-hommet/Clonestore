// B44 — EnterpriseEmpreinte default values
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  EnterpriseEmpreinte,
  CompanyIdentity,
  CommunicationProfile,
  AutonomyPolicy,
  DataGovernance,
  DocumentPreferences,
  EnterpriseMemorySeed,
  EmpreinteCompletion,
} from "./types";

export const EMPREINTE_CURRENT_VERSION = "1.0.0";

export function buildDefaultCompanyIdentity(): CompanyIdentity {
  return {
    legal_name: null,
    trade_name: null,
    brand_mark: null,
    brand_asset_url: null,
    sector: null,
    size_range: null,
    founded_year: null,
    country_code: "FR",
    main_language: "fr",
    website_url: null,
    hr_contact_email: null,
    hr_contact_name: null,
    values: [],
    mission_statement: null,
    tagline: null,
  };
}

export function buildDefaultCommunicationProfile(): CommunicationProfile {
  return {
    default_tone: "formal",
    preferred_length: "standard",
    language_code: "fr",
    formal_closing: null,
    greeting_style: null,
    avoid_words: [],
    preferred_words: [],
    signature_template: null,
  };
}

export function buildDefaultAutonomyPolicy(): AutonomyPolicy {
  return {
    default_level: "supervised",
    allowed_auto_domains: [],
    blocked_auto_domains: [],
    max_auto_tasks_per_mission: 5,
    require_approval_above_risk: "medium",
    sensitive_topics: [],
    never_auto_execute: ["email.send", "send_email"],
  };
}

export function buildDefaultDataGovernance(): DataGovernance {
  return {
    data_retention_days: 365,
    gdpr_dpo_email: null,
    gdpr_dpo_name: null,
    data_processing_region: "eu",
    export_allowed: true,
    purge_requires_confirmation: true,
    audit_log_retention_days: 730,
  };
}

export function buildDefaultDocumentPreferences(): DocumentPreferences {
  return {
    preferred_format: "markdown",
    always_include_signature: false,
    always_include_legal_footer: false,
    legal_footer_text: null,
    require_validation_for_risk_levels: ["high", "critical"],
    preferred_template_ids: [],
    document_language: "fr",
  };
}

export function buildDefaultMemorySeed(): EnterpriseMemorySeed {
  return {
    key_facts: [],
    forbidden_topics: [],
    preferred_workflows: [],
    custom_vocabulary: {},
  };
}

export function buildDefaultEmpreinteCompletion(): EmpreinteCompletion {
  return {
    score: 0,
    status: "not_configured",
    missing_fields: [],
    recommendations: [],
    filled_sections: [],
    empty_sections: [],
    can_activate: false,
  };
}

export function buildDefaultEnterpriseEmpreinte(id: string): EnterpriseEmpreinte {
  const now = new Date().toISOString();
  return {
    id,
    version: EMPREINTE_CURRENT_VERSION,
    status: "not_configured",
    company_identity: buildDefaultCompanyIdentity(),
    locations: [],
    roles: [],
    validation_circuits: [],
    communication: buildDefaultCommunicationProfile(),
    channels: [],
    autonomy: buildDefaultAutonomyPolicy(),
    data_governance: buildDefaultDataGovernance(),
    document_preferences: buildDefaultDocumentPreferences(),
    memory_seed: buildDefaultMemorySeed(),
    completion: buildDefaultEmpreinteCompletion(),
    created_at: now,
    updated_at: now,
  };
}
