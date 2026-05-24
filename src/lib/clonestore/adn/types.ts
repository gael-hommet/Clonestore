// src/lib/clonestore/adn/types.ts
// CloneADN — Empreinte opérationnelle d'une entreprise (platform-wide CloneStore technology)
// Pierre is first consumer; architecture is reusable by future agents (Clara, Emma, Adrien, etc.)
// Pure types: no Next.js, no Supabase, no async, no side effects.

// ── Scalar types ──────────────────────────────────────────────────────────────

export type CloneADNProfileStatus =
  | "not_configured"
  | "partial"
  | "configured"
  | "strong"
  | "locked";

export type CloneADNAutonomyLevel =
  | "manual"
  | "assist"
  | "supervised"
  | "trusted"
  | "restricted";

export type CloneADNTone =
  | "formal"
  | "warm"
  | "direct"
  | "executive"
  | "neutral"
  | "legal_careful"
  | "candidate_friendly"
  | "internal_concise";

export type CloneADNCommunicationLength =
  | "concise"
  | "standard"
  | "detailed"
  | "comprehensive";

export type CloneADNValidationMode =
  | "none"
  | "recommended"
  | "required"
  | "human_only";

export type CloneADNRuleSeverity =
  | "info"
  | "warning"
  | "block"
  | "critical";

export type CloneADNRuleCategory =
  | "communication"
  | "validation"
  | "autonomy"
  | "document"
  | "compliance"
  | "security"
  | "hr_process"
  | "custom";

export type CloneADNPreferenceSource =
  | "explicit"
  | "inferred"
  | "default"
  | "inherited";

// ── Rule ──────────────────────────────────────────────────────────────────────

export interface CloneADNRule {
  id: string;
  label: string;
  description: string;
  category: CloneADNRuleCategory;
  severity: CloneADNRuleSeverity;
  condition: string;
  action: string;
  active: boolean;
  applies_to_domains: string[];
  applies_to_task_types: string[];
  requires_human_validation: boolean;
  created_at: string;
  updated_at: string;
}

// ── Communication profile ─────────────────────────────────────────────────────

export interface CloneADNCommunicationProfile {
  tone: CloneADNTone;
  preferred_length: CloneADNCommunicationLength;
  formal_closing: string | null;
  greeting_style: string | null;
  avoid_words: string[];
  preferred_words: string[];
  signature_template: string | null;
  language_code: string;
}

// ── Validation profile ────────────────────────────────────────────────────────

export interface CloneADNValidationProfile {
  default_mode: CloneADNValidationMode;
  always_require_human_for: string[];
  never_auto_execute: string[];
  sensitive_topics: string[];
  approval_required_risk_levels: string[];
}

// ── Autonomy profile ──────────────────────────────────────────────────────────

export interface CloneADNAutonomyProfile {
  level: CloneADNAutonomyLevel;
  allowed_auto_task_types: string[];
  blocked_auto_task_types: string[];
  max_auto_tasks_per_mission: number;
  require_approval_above_risk: string;
}

// ── Document profile ──────────────────────────────────────────────────────────

export interface CloneADNDocumentProfile {
  preferred_format: "text" | "markdown" | "html" | "pdf_ready_html";
  preferred_tone: CloneADNTone;
  always_include_signature: boolean;
  always_include_legal_footer: boolean;
  require_validation_for_risk_levels: string[];
  preferred_template_ids: string[];
}

// ── Company identity ──────────────────────────────────────────────────────────

export interface CloneADNCompanyIdentity {
  legal_name: string | null;
  trade_name: string | null;
  sector: string | null;
  size_range: string | null;
  country_code: string | null;
  main_language: string | null;
  hr_contact_email: string | null;
  values: string[];
  mission_statement: string | null;
}

// ── Site ──────────────────────────────────────────────────────────────────────

export interface CloneADNSite {
  id: string;
  name: string;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
  active: boolean;
}

// ── Department ────────────────────────────────────────────────────────────────

export interface CloneADNDepartment {
  id: string;
  name: string;
  manager_name: string | null;
  headcount: number | null;
  active: boolean;
}

// ── Inferred preference ───────────────────────────────────────────────────────

export interface CloneADNInferredPreference {
  key: string;
  value: string;
  source: CloneADNPreferenceSource;
  confidence: number;
  inferred_at: string;
  domain: string | null;
}

// ── Main CloneADN profile ─────────────────────────────────────────────────────

export interface CloneADNProfile {
  status: CloneADNProfileStatus;
  version: string;
  company_identity: CloneADNCompanyIdentity;
  communication: CloneADNCommunicationProfile;
  validation: CloneADNValidationProfile;
  autonomy: CloneADNAutonomyProfile;
  document: CloneADNDocumentProfile;
  rules: CloneADNRule[];
  sites: CloneADNSite[];
  departments: CloneADNDepartment[];
  inferred_preferences: CloneADNInferredPreference[];
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export interface CloneADNAnalysis {
  status: CloneADNProfileStatus;
  completeness_score: number;
  has_communication_profile: boolean;
  has_validation_rules: boolean;
  has_autonomy_config: boolean;
  has_document_profile: boolean;
  has_company_identity: boolean;
  active_rules_count: number;
  blocking_rules_count: number;
  inferred_preferences_count: number;
  missing_fields: string[];
  recommendations: string[];
  strengths: string[];
}

// ── Application context (what AI agents receive) ──────────────────────────────

export interface CloneADNApplicationContext {
  tone: CloneADNTone;
  autonomy_level: CloneADNAutonomyLevel;
  validation_mode: CloneADNValidationMode;
  language_code: string;
  sensitive_topics: string[];
  never_auto_execute: string[];
  always_require_human_for: string[];
  preferred_format: string;
  company_name: string | null;
  sector: string | null;
  active_rules: CloneADNRule[];
  avoid_words: string[];
  preferred_words: string[];
  formal_closing: string | null;
  greeting_style: string | null;
}

// ── Rule decision ─────────────────────────────────────────────────────────────

export interface CloneADNRuleDecision {
  rule_id: string;
  label: string;
  severity: CloneADNRuleSeverity;
  triggered: boolean;
  reason: string;
  requires_human_validation: boolean;
  action: string;
}

// ── Rule evaluation result ────────────────────────────────────────────────────

export interface CloneADNRuleEvaluationResult {
  decisions: CloneADNRuleDecision[];
  blocked: boolean;
  requires_validation: boolean;
  blocking_rules: CloneADNRuleDecision[];
  triggered_rules: CloneADNRuleDecision[];
  summary: string;
}

// ── Patch (partial update) ────────────────────────────────────────────────────

export type CloneADNProfilePatch = {
  company_identity?: Partial<CloneADNCompanyIdentity>;
  communication?: Partial<CloneADNCommunicationProfile>;
  validation?: Partial<CloneADNValidationProfile>;
  autonomy?: Partial<CloneADNAutonomyProfile>;
  document?: Partial<CloneADNDocumentProfile>;
  rules?: CloneADNRule[];
  sites?: CloneADNSite[];
  departments?: CloneADNDepartment[];
  inferred_preferences?: CloneADNInferredPreference[];
  version?: string;
};
