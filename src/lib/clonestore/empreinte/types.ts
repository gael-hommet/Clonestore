// B44 — Empreinte Entreprise types
// Per-company fingerprint that transforms Pierre from generic HR engine
// to a personalised HR workstation for each client.
// Pure types: no Next.js, no Supabase, no async, no side effects.

// ── Scalar types ──────────────────────────────────────────────────────────────

export type EmpreinteStatus =
  | "not_configured"
  | "minimal"
  | "partial"
  | "configured"
  | "complete"
  | "locked";

export type EmpTeamSize =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1000+";

export type EmpTone =
  | "formal"
  | "warm"
  | "direct"
  | "executive"
  | "neutral"
  | "legal_careful"
  | "candidate_friendly"
  | "internal_concise";

export type EmpCommunicationLength =
  | "concise"
  | "standard"
  | "detailed"
  | "comprehensive";

export type EmpDocumentFormat =
  | "text"
  | "markdown"
  | "html"
  | "pdf_ready_html";

export type EmpAutonomyLevel =
  | "manual"
  | "assist"
  | "supervised"
  | "trusted"
  | "restricted";

export type EmpRiskThreshold =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type EmpChannel =
  | "email"
  | "slack"
  | "teams"
  | "sms"
  | "portal";

export type EmpDataRegion =
  | "eu"
  | "fr"
  | "us"
  | "other";

// ── CompanyIdentity ───────────────────────────────────────────────────────────

export interface CompanyIdentity {
  legal_name: string | null;
  trade_name: string | null;
  brand_mark: string | null;           // visual identity asset — NOT "logo"
  brand_asset_url: string | null;      // URL for company_mark asset
  sector: string | null;
  size_range: EmpTeamSize | null;
  founded_year: number | null;
  country_code: string | null;
  main_language: string;               // ISO 639-1, default "fr"
  website_url: string | null;
  hr_contact_email: string | null;
  hr_contact_name: string | null;
  values: string[];
  mission_statement: string | null;
  tagline: string | null;
}

// ── CompanyLocation ───────────────────────────────────────────────────────────

export interface CompanyLocation {
  id: string;
  label: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
  is_headquarters: boolean;
  active: boolean;
}

// ── OrganizationRole ──────────────────────────────────────────────────────────

export type OrgRoleLevel =
  | "individual_contributor"
  | "team_lead"
  | "manager"
  | "director"
  | "executive";

export interface OrganizationRole {
  id: string;
  title: string;
  department: string | null;
  level: OrgRoleLevel | null;
  is_hr_role: boolean;
  can_approve_hr_actions: boolean;
  active: boolean;
}

// ── ValidationCircuit ─────────────────────────────────────────────────────────

export interface ValidationCircuit {
  id: string;
  label: string;
  scope: string;                        // domain or task type
  required_approvers: number;
  approver_roles: string[];             // OrganizationRole IDs
  max_delay_hours: number | null;
  escalation_after_hours: number | null;
  active: boolean;
}

// ── CommunicationProfile ──────────────────────────────────────────────────────

export interface CommunicationProfile {
  default_tone: EmpTone;
  preferred_length: EmpCommunicationLength;
  language_code: string;
  formal_closing: string | null;
  greeting_style: string | null;
  avoid_words: string[];
  preferred_words: string[];
  signature_template: string | null;
}

// ── ChannelIdentityConfig ─────────────────────────────────────────────────────

export interface ChannelIdentityConfig {
  channel: EmpChannel;
  enabled: boolean;
  from_name: string | null;
  from_address: string | null;          // email channel only
  reply_to: string | null;
  footer_text: string | null;
  brand_color_hex: string | null;       // visual identity color — NOT "logo color"
}

// ── AutonomyPolicy ────────────────────────────────────────────────────────────

export interface AutonomyPolicy {
  default_level: EmpAutonomyLevel;
  allowed_auto_domains: string[];
  blocked_auto_domains: string[];
  max_auto_tasks_per_mission: number;
  require_approval_above_risk: EmpRiskThreshold;
  sensitive_topics: string[];
  never_auto_execute: string[];
}

// ── DataGovernance ────────────────────────────────────────────────────────────

export interface DataGovernance {
  data_retention_days: number;          // default 365
  gdpr_dpo_email: string | null;
  gdpr_dpo_name: string | null;
  data_processing_region: EmpDataRegion | null;
  export_allowed: boolean;
  purge_requires_confirmation: boolean;
  audit_log_retention_days: number;     // default 730
}

// ── DocumentPreferences ───────────────────────────────────────────────────────

export interface DocumentPreferences {
  preferred_format: EmpDocumentFormat;
  always_include_signature: boolean;
  always_include_legal_footer: boolean;
  legal_footer_text: string | null;
  require_validation_for_risk_levels: string[];
  preferred_template_ids: string[];
  document_language: string;            // default = company main_language
}

// ── EnterpriseMemorySeed ──────────────────────────────────────────────────────

export interface EnterpriseMemorySeed {
  key_facts: string[];                  // facts Pierre must always remember
  forbidden_topics: string[];           // Pierre must never discuss these
  preferred_workflows: string[];        // domain slugs to prioritize
  custom_vocabulary: Record<string, string>; // internal term → plain language
}

// ── EmpreinteCompletion ───────────────────────────────────────────────────────

export interface EmpreinteCompletion {
  score: number;                        // 0-100
  status: EmpreinteStatus;
  missing_fields: string[];
  recommendations: string[];
  filled_sections: string[];
  empty_sections: string[];
  can_activate: boolean;
}

// ── Main EnterpriseEmpreinte ──────────────────────────────────────────────────

export interface EnterpriseEmpreinte {
  id: string;
  version: string;
  status: EmpreinteStatus;
  company_identity: CompanyIdentity;
  locations: CompanyLocation[];
  roles: OrganizationRole[];
  validation_circuits: ValidationCircuit[];
  communication: CommunicationProfile;
  channels: ChannelIdentityConfig[];
  autonomy: AutonomyPolicy;
  data_governance: DataGovernance;
  document_preferences: DocumentPreferences;
  memory_seed: EnterpriseMemorySeed;
  completion: EmpreinteCompletion;
  created_at: string;
  updated_at: string;
}

// ── Patch ─────────────────────────────────────────────────────────────────────

export type EnterpriseEmpreintePatch = {
  company_identity?: Partial<CompanyIdentity>;
  locations?: CompanyLocation[];
  roles?: OrganizationRole[];
  validation_circuits?: ValidationCircuit[];
  communication?: Partial<CommunicationProfile>;
  channels?: ChannelIdentityConfig[];
  autonomy?: Partial<AutonomyPolicy>;
  data_governance?: Partial<DataGovernance>;
  document_preferences?: Partial<DocumentPreferences>;
  memory_seed?: Partial<EnterpriseMemorySeed>;
  version?: string;
};

// ── Validation result ─────────────────────────────────────────────────────────

export interface EmpreinteValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface EmpreinteValidationResult {
  valid: boolean;
  issues: EmpreinteValidationIssue[];
  error_count: number;
  warning_count: number;
}
