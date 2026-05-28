// B44 — EnterpriseEmpreinte normalizer
// Merges defaults with user data, sanitizes untrusted input.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  EnterpriseEmpreinte,
  EnterpriseEmpreintePatch,
  CompanyIdentity,
  CommunicationProfile,
  AutonomyPolicy,
  DataGovernance,
  DocumentPreferences,
  EnterpriseMemorySeed,
  CompanyLocation,
  OrganizationRole,
  ValidationCircuit,
  ChannelIdentityConfig,
} from "./types";
import {
  buildDefaultCompanyIdentity,
  buildDefaultCommunicationProfile,
  buildDefaultAutonomyPolicy,
  buildDefaultDataGovernance,
  buildDefaultDocumentPreferences,
  buildDefaultMemorySeed,
  buildDefaultEnterpriseEmpreinte,
  EMPREINTE_CURRENT_VERSION,
} from "./enterprise-defaults";
import { computeEnterpriseEmpreinteCompletion } from "./enterprise-completion";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function normalizeStringArray(v: unknown): string[] {
  if (!isArray(v)) return [];
  return v.filter(isString);
}

// ── Section normalizers ───────────────────────────────────────────────────────

function normalizeCompanyIdentity(raw: unknown): CompanyIdentity {
  const defaults = buildDefaultCompanyIdentity();
  if (!isObject(raw)) return defaults;

  return {
    legal_name: isString(raw.legal_name) ? raw.legal_name : defaults.legal_name,
    trade_name: isString(raw.trade_name) ? raw.trade_name : defaults.trade_name,
    brand_mark: isString(raw.brand_mark) ? raw.brand_mark : defaults.brand_mark,
    brand_asset_url: isString(raw.brand_asset_url) ? raw.brand_asset_url : defaults.brand_asset_url,
    sector: isString(raw.sector) ? raw.sector : defaults.sector,
    size_range: isString(raw.size_range) ? (raw.size_range as CompanyIdentity["size_range"]) : defaults.size_range,
    founded_year: isNumber(raw.founded_year) ? raw.founded_year : defaults.founded_year,
    country_code: isString(raw.country_code) ? raw.country_code : defaults.country_code,
    main_language: isString(raw.main_language) && raw.main_language.length === 2 ? raw.main_language : defaults.main_language,
    website_url: isString(raw.website_url) ? raw.website_url : defaults.website_url,
    hr_contact_email: isString(raw.hr_contact_email) ? raw.hr_contact_email : defaults.hr_contact_email,
    hr_contact_name: isString(raw.hr_contact_name) ? raw.hr_contact_name : defaults.hr_contact_name,
    values: normalizeStringArray(raw.values),
    mission_statement: isString(raw.mission_statement) ? raw.mission_statement : defaults.mission_statement,
    tagline: isString(raw.tagline) ? raw.tagline : defaults.tagline,
  };
}

function normalizeCommunicationProfile(raw: unknown): CommunicationProfile {
  const defaults = buildDefaultCommunicationProfile();
  if (!isObject(raw)) return defaults;

  return {
    default_tone: isString(raw.default_tone) ? (raw.default_tone as CommunicationProfile["default_tone"]) : defaults.default_tone,
    preferred_length: isString(raw.preferred_length) ? (raw.preferred_length as CommunicationProfile["preferred_length"]) : defaults.preferred_length,
    language_code: isString(raw.language_code) ? raw.language_code : defaults.language_code,
    formal_closing: isString(raw.formal_closing) ? raw.formal_closing : defaults.formal_closing,
    greeting_style: isString(raw.greeting_style) ? raw.greeting_style : defaults.greeting_style,
    avoid_words: normalizeStringArray(raw.avoid_words),
    preferred_words: normalizeStringArray(raw.preferred_words),
    signature_template: isString(raw.signature_template) ? raw.signature_template : defaults.signature_template,
  };
}

function normalizeAutonomyPolicy(raw: unknown): AutonomyPolicy {
  const defaults = buildDefaultAutonomyPolicy();
  if (!isObject(raw)) return defaults;

  return {
    default_level: isString(raw.default_level) ? (raw.default_level as AutonomyPolicy["default_level"]) : defaults.default_level,
    allowed_auto_domains: normalizeStringArray(raw.allowed_auto_domains),
    blocked_auto_domains: normalizeStringArray(raw.blocked_auto_domains),
    max_auto_tasks_per_mission: isNumber(raw.max_auto_tasks_per_mission) ? raw.max_auto_tasks_per_mission : defaults.max_auto_tasks_per_mission,
    require_approval_above_risk: isString(raw.require_approval_above_risk) ? (raw.require_approval_above_risk as AutonomyPolicy["require_approval_above_risk"]) : defaults.require_approval_above_risk,
    sensitive_topics: normalizeStringArray(raw.sensitive_topics),
    never_auto_execute: normalizeStringArray(raw.never_auto_execute).length > 0
      ? normalizeStringArray(raw.never_auto_execute)
      : defaults.never_auto_execute,
  };
}

function normalizeDataGovernance(raw: unknown): DataGovernance {
  const defaults = buildDefaultDataGovernance();
  if (!isObject(raw)) return defaults;

  return {
    data_retention_days: isNumber(raw.data_retention_days) ? raw.data_retention_days : defaults.data_retention_days,
    gdpr_dpo_email: isString(raw.gdpr_dpo_email) ? raw.gdpr_dpo_email : defaults.gdpr_dpo_email,
    gdpr_dpo_name: isString(raw.gdpr_dpo_name) ? raw.gdpr_dpo_name : defaults.gdpr_dpo_name,
    data_processing_region: isString(raw.data_processing_region) ? (raw.data_processing_region as DataGovernance["data_processing_region"]) : defaults.data_processing_region,
    export_allowed: typeof raw.export_allowed === "boolean" ? raw.export_allowed : defaults.export_allowed,
    purge_requires_confirmation: typeof raw.purge_requires_confirmation === "boolean" ? raw.purge_requires_confirmation : defaults.purge_requires_confirmation,
    audit_log_retention_days: isNumber(raw.audit_log_retention_days) ? raw.audit_log_retention_days : defaults.audit_log_retention_days,
  };
}

function normalizeDocumentPreferences(raw: unknown): DocumentPreferences {
  const defaults = buildDefaultDocumentPreferences();
  if (!isObject(raw)) return defaults;

  return {
    preferred_format: isString(raw.preferred_format) ? (raw.preferred_format as DocumentPreferences["preferred_format"]) : defaults.preferred_format,
    always_include_signature: typeof raw.always_include_signature === "boolean" ? raw.always_include_signature : defaults.always_include_signature,
    always_include_legal_footer: typeof raw.always_include_legal_footer === "boolean" ? raw.always_include_legal_footer : defaults.always_include_legal_footer,
    legal_footer_text: isString(raw.legal_footer_text) ? raw.legal_footer_text : defaults.legal_footer_text,
    require_validation_for_risk_levels: normalizeStringArray(raw.require_validation_for_risk_levels).length > 0
      ? normalizeStringArray(raw.require_validation_for_risk_levels)
      : defaults.require_validation_for_risk_levels,
    preferred_template_ids: normalizeStringArray(raw.preferred_template_ids),
    document_language: isString(raw.document_language) ? raw.document_language : defaults.document_language,
  };
}

function normalizeMemorySeed(raw: unknown): EnterpriseMemorySeed {
  const defaults = buildDefaultMemorySeed();
  if (!isObject(raw)) return defaults;

  const vocab: Record<string, string> = {};
  if (isObject(raw.custom_vocabulary)) {
    for (const [k, v] of Object.entries(raw.custom_vocabulary)) {
      if (isString(v)) vocab[k] = v;
    }
  }

  return {
    key_facts: normalizeStringArray(raw.key_facts),
    forbidden_topics: normalizeStringArray(raw.forbidden_topics),
    preferred_workflows: normalizeStringArray(raw.preferred_workflows),
    custom_vocabulary: vocab,
  };
}

function normalizeLocations(raw: unknown): CompanyLocation[] {
  if (!isArray(raw)) return [];
  return raw.filter(isObject).map((r) => ({
    id: isString(r.id) ? r.id : `loc_${Math.random().toString(36).slice(2, 8)}`,
    label: isString(r.label) ? r.label : "",
    address_line1: isString(r.address_line1) ? r.address_line1 : null,
    address_line2: isString(r.address_line2) ? r.address_line2 : null,
    city: isString(r.city) ? r.city : null,
    postal_code: isString(r.postal_code) ? r.postal_code : null,
    country_code: isString(r.country_code) ? r.country_code : null,
    timezone: isString(r.timezone) ? r.timezone : null,
    is_headquarters: typeof r.is_headquarters === "boolean" ? r.is_headquarters : false,
    active: typeof r.active === "boolean" ? r.active : true,
  }));
}

function normalizeRoles(raw: unknown): OrganizationRole[] {
  if (!isArray(raw)) return [];
  return raw.filter(isObject).map((r) => ({
    id: isString(r.id) ? r.id : `role_${Math.random().toString(36).slice(2, 8)}`,
    title: isString(r.title) ? r.title : "",
    department: isString(r.department) ? r.department : null,
    level: isString(r.level) ? (r.level as OrganizationRole["level"]) : null,
    is_hr_role: typeof r.is_hr_role === "boolean" ? r.is_hr_role : false,
    can_approve_hr_actions: typeof r.can_approve_hr_actions === "boolean" ? r.can_approve_hr_actions : false,
    active: typeof r.active === "boolean" ? r.active : true,
  }));
}

function normalizeValidationCircuits(raw: unknown): ValidationCircuit[] {
  if (!isArray(raw)) return [];
  return raw.filter(isObject).map((r) => ({
    id: isString(r.id) ? r.id : `vc_${Math.random().toString(36).slice(2, 8)}`,
    label: isString(r.label) ? r.label : "",
    scope: isString(r.scope) ? r.scope : "",
    required_approvers: isNumber(r.required_approvers) ? r.required_approvers : 1,
    approver_roles: normalizeStringArray(r.approver_roles),
    max_delay_hours: isNumber(r.max_delay_hours) ? r.max_delay_hours : null,
    escalation_after_hours: isNumber(r.escalation_after_hours) ? r.escalation_after_hours : null,
    active: typeof r.active === "boolean" ? r.active : true,
  }));
}

function normalizeChannels(raw: unknown): ChannelIdentityConfig[] {
  if (!isArray(raw)) return [];
  return raw.filter(isObject).map((r) => ({
    channel: isString(r.channel) ? (r.channel as ChannelIdentityConfig["channel"]) : "email",
    enabled: typeof r.enabled === "boolean" ? r.enabled : false,
    from_name: isString(r.from_name) ? r.from_name : null,
    from_address: isString(r.from_address) ? r.from_address : null,
    reply_to: isString(r.reply_to) ? r.reply_to : null,
    footer_text: isString(r.footer_text) ? r.footer_text : null,
    brand_color_hex: isString(r.brand_color_hex) ? r.brand_color_hex : null,
  }));
}

// ── Main normalizer ───────────────────────────────────────────────────────────

export function normalizeEnterpriseEmpreinte(
  raw: unknown,
  id: string,
): EnterpriseEmpreinte {
  const now = new Date().toISOString();

  if (!isObject(raw)) {
    const base = buildDefaultEnterpriseEmpreinte(id);
    base.completion = computeEnterpriseEmpreinteCompletion(base);
    return base;
  }

  const empreinte: EnterpriseEmpreinte = {
    id,
    version: isString(raw.version) ? raw.version : EMPREINTE_CURRENT_VERSION,
    status: isString(raw.status) ? (raw.status as EnterpriseEmpreinte["status"]) : "not_configured",
    company_identity: normalizeCompanyIdentity(raw.company_identity),
    locations: normalizeLocations(raw.locations),
    roles: normalizeRoles(raw.roles),
    validation_circuits: normalizeValidationCircuits(raw.validation_circuits),
    communication: normalizeCommunicationProfile(raw.communication),
    channels: normalizeChannels(raw.channels),
    autonomy: normalizeAutonomyPolicy(raw.autonomy),
    data_governance: normalizeDataGovernance(raw.data_governance),
    document_preferences: normalizeDocumentPreferences(raw.document_preferences),
    memory_seed: normalizeMemorySeed(raw.memory_seed),
    completion: {
      score: 0,
      status: "not_configured",
      missing_fields: [],
      recommendations: [],
      filled_sections: [],
      empty_sections: [],
      can_activate: false,
    },
    created_at: isString(raw.created_at) ? raw.created_at : now,
    updated_at: now,
  };

  empreinte.completion = computeEnterpriseEmpreinteCompletion(empreinte);
  empreinte.status = empreinte.completion.status;

  return empreinte;
}

export function applyEnterpriseEmpreintePatch(
  base: EnterpriseEmpreinte,
  patch: EnterpriseEmpreintePatch,
): EnterpriseEmpreinte {
  const now = new Date().toISOString();

  const updated: EnterpriseEmpreinte = {
    ...base,
    updated_at: now,
  };

  if (patch.company_identity) {
    updated.company_identity = { ...base.company_identity, ...patch.company_identity };
  }
  if (patch.locations) {
    updated.locations = normalizeLocations(patch.locations);
  }
  if (patch.roles) {
    updated.roles = normalizeRoles(patch.roles);
  }
  if (patch.validation_circuits) {
    updated.validation_circuits = normalizeValidationCircuits(patch.validation_circuits);
  }
  if (patch.communication) {
    updated.communication = { ...base.communication, ...patch.communication };
  }
  if (patch.channels) {
    updated.channels = normalizeChannels(patch.channels);
  }
  if (patch.autonomy) {
    updated.autonomy = { ...base.autonomy, ...patch.autonomy };
  }
  if (patch.data_governance) {
    updated.data_governance = { ...base.data_governance, ...patch.data_governance };
  }
  if (patch.document_preferences) {
    updated.document_preferences = { ...base.document_preferences, ...patch.document_preferences };
  }
  if (patch.memory_seed) {
    updated.memory_seed = { ...base.memory_seed, ...patch.memory_seed };
  }
  if (patch.version) {
    updated.version = patch.version;
  }

  updated.completion = computeEnterpriseEmpreinteCompletion(updated);
  updated.status = updated.completion.status;

  return updated;
}
