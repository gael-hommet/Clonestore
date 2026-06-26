// TECH-05 — GlobalEnterpriseMemory types
// CloneADN Global / Enterprise Memory — plateforme CloneStore.
// Pure types: no async, no Supabase, no Next.js, no side effects.
//
// Architecture :
//   CloneStore Platform
//   → GlobalEnterpriseMemory (TECH-05, ce fichier)
//   → Employee Runtime Contract (TECH-02)
//   → Pierre / futurs employés IA
//
// Distinction fondamentale :
//   EnterpriseHumanProfile = vrais humains de l'entreprise cliente.
//   Ces humains ne sont PAS des employés IA CloneStore.
//   Les employés IA (Pierre, Emma, Lucas…) consomment cette mémoire
//   via leur contrat de runtime, pas l'inverse.

// ── Scalar types ──────────────────────────────────────────────────────────────

export type EnterpriseMemoryId = string; // format: "mem_<uuid>"

export type EnterpriseMemoryScope =
  | "global"              // concerne toute l'entreprise
  | "department"          // concerne un département
  | "domain"              // concerne un domaine métier (hr, finance, legal…)
  | "employee_specific";  // concerne un employé IA particulier

export type EnterpriseMemorySource =
  | "explicit"            // fourni directement par le client
  | "inferred"            // déduit par l'IA depuis des interactions
  | "document"            // extrait d'un document officiel
  | "conversation"        // capturé depuis une conversation
  | "api_sync";           // synchronisé depuis un système externe

export type EnterpriseMemorySensitivity =
  | "public"      // peut être partagé librement
  | "internal"    // réservé aux employés IA autorisés
  | "confidential" // accès très restreint
  | "restricted";  // accès minimal, humain requis

export type EnterpriseMemoryStability =
  | "permanent"  // ne change jamais (nom légal, fondation…)
  | "stable"     // change rarement (ton, charte…)
  | "volatile"   // change régulièrement (préférences, habitudes…)
  | "transient"; // temporaire (contexte de mission en cours…)

export type EnterpriseMemoryCategory =
  | "identity"       // identité entreprise
  | "tone"           // ton et style de communication
  | "communication"  // règles de communication
  | "rules"          // règles métier
  | "humans"         // personnes de l'entreprise
  | "documents"      // documents de référence
  | "processes"      // processus opérationnels
  | "hr"             // ressources humaines
  | "finance"        // finance
  | "legal"          // juridique
  | "ops"            // opérations
  | "custom";        // personnalisé

export type HumanEmploymentStatus =
  | "active"
  | "inactive"
  | "on_leave"
  | "external";

export type EnterpriseDocumentType =
  | "template"
  | "policy"
  | "contract"
  | "guide"
  | "procedure"
  | "regulation"
  | "custom";

export type EnterpriseDocumentSensitivity =
  | "public"
  | "internal"
  | "confidential";

export type EnterpriseDocumentExtractionStatus =
  | "not_extracted"
  | "partial"
  | "extracted";

export type EnterpriseRuleSeverity =
  | "info"
  | "warning"
  | "block"
  | "critical";

// ── Identity profile ──────────────────────────────────────────────────────────

export interface EnterpriseIdentityProfile {
  company_name: string;
  legal_name?: string | null;
  industry?: string | null;
  size_range?: string | null;
  country: string;          // ISO 3166-1 alpha-2, ex: "FR"
  language: string;         // ISO 639-1, ex: "fr"
  timezone: string;         // IANA timezone, ex: "Europe/Paris"
  public_description?: string | null;
  internal_context?: string | null;
}

// ── Tone profile ──────────────────────────────────────────────────────────────

export interface EnterpriseToneProfile {
  default_tone: string;              // "formal" | "warm" | "direct" | "executive" | "neutral"
  forbidden_tones: string[];
  preferred_formality: string;       // "standard" | "formal" | "casual"
  writing_style?: string | null;
  vocabulary_preferences: string[];
  signature_rules: string[];
  examples: string[];
}

// ── Communication profile ─────────────────────────────────────────────────────

export interface EnterpriseCommunicationProfile {
  allowed_channels: string[];
  default_channel: string;
  escalation_channel?: string | null;
  response_time_expectations?: string | null;
  email_rules?: string | null;
  internal_message_rules?: string | null;
  external_message_rules?: string | null;
}

// ── Validation circuit ────────────────────────────────────────────────────────

export interface EnterpriseValidationCircuit {
  circuit_id: string;
  name: string;
  applies_to_domains: string[];
  applies_to_risk_levels: string[];
  required_approvers: string[];   // refs to EnterpriseHumanProfile.human_id
  fallback_approver?: string | null;
  sla_hours?: number | null;
  mandatory_before_execution: boolean;
}

// ── Human profiles — VRAIS HUMAINS de l'entreprise cliente ───────────────────
// IMPORTANT : Ces humains sont les personnes réelles travaillant pour le client.
//             Ils NE SONT PAS les employés IA CloneStore (Pierre, Emma, Lucas…).
//             Les employés IA lisent ces profils pour contextualiser leurs actions.

export interface EnterpriseHumanProfile {
  human_id: string;
  full_name: string;
  role_title?: string | null;
  department_id?: string | null;
  site_id?: string | null;
  manager_human_id?: string | null;
  email?: string | null;
  phone?: string | null;
  employment_status: HumanEmploymentStatus;
  contract_type?: string | null;    // "cdi" | "cdd" | "freelance" | "intern" | …
  permissions: string[];            // permissions de validation/approbation
  sensitive_notes_allowed: boolean; // si des notes sensibles peuvent être stockées
  context_notes?: string | null;    // contexte libre (non confidentiel)
  document_refs: string[];          // refs vers EnterpriseDocumentProfile.document_id
  tags: string[];
}

export interface EnterpriseHumanRegistry {
  humans: EnterpriseHumanProfile[];
  total_count: number;
  active_count: number;
}

// ── Site profile ──────────────────────────────────────────────────────────────

export interface EnterpriseSiteProfile {
  site_id: string;
  name: string;
  country: string;
  city?: string | null;
  timezone?: string | null;
  is_headquarters: boolean;
  active: boolean;
}

// ── Department profile ────────────────────────────────────────────────────────

export interface EnterpriseDepartmentProfile {
  department_id: string;
  name: string;
  manager_human_id?: string | null;
  headcount?: number | null;
  domains: string[];     // domaines métier du département
  active: boolean;
}

// ── Document profile ──────────────────────────────────────────────────────────

export interface EnterpriseDocumentProfile {
  document_id: string;
  title: string;
  document_type: EnterpriseDocumentType;
  source: string;
  file_ref?: string | null;
  applies_to_domains: string[];
  is_official: boolean;
  version: string;
  style_notes?: string | null;
  extraction_status: EnterpriseDocumentExtractionStatus;
  sensitivity: EnterpriseDocumentSensitivity;
}

// ── Rule profile ──────────────────────────────────────────────────────────────

export interface EnterpriseRuleProfile {
  rule_id: string;
  label: string;
  category: string;    // EnterpriseMemoryCategory
  condition: string;
  action: string;
  severity: EnterpriseRuleSeverity;
  active: boolean;
  applies_to_domains: string[];
  applies_to_employee_slugs: string[];  // empty = all employees
}

// ── Preference profile ────────────────────────────────────────────────────────

export interface EnterprisePreferenceProfile {
  preference_id: string;
  key: string;
  value: string;
  source: EnterpriseMemorySource;
  confidence: number;         // 0.0 – 1.0
  domain?: string | null;
  applies_to_employee_slugs: string[];  // empty = all employees
}

// ── Operational pattern ───────────────────────────────────────────────────────

export interface EnterpriseOperationalPattern {
  pattern_id: string;
  name: string;
  description: string;
  domain: string;
  frequency?: string | null;  // "daily" | "weekly" | "ad_hoc" | …
  steps: string[];
  applies_to_employee_slugs: string[];
  learned_at?: string | null;
}

// ── Memory item ───────────────────────────────────────────────────────────────

export interface EnterpriseMemoryItem {
  item_id: string;
  category: EnterpriseMemoryCategory;
  content: string;
  source: EnterpriseMemorySource;
  scope: EnterpriseMemoryScope;
  stability: EnterpriseMemoryStability;
  sensitivity: EnterpriseMemorySensitivity;
  confidence: number;         // 0.0 – 1.0
  applies_to_employee_slugs: string[];  // empty = all employees
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Employee AI access profile ────────────────────────────────────────────────
// Qui peut lire/écrire quoi dans GlobalEnterpriseMemory.
// V1 : aucun employé IA ne peut écrire librement — CloneLearn activera ça plus tard.

export interface EnterpriseEmployeeAccessProfile {
  employee_slug: string;               // slug de l'employé IA (ex: "pierre")
  readable_categories: EnterpriseMemoryCategory[];
  writable_categories: EnterpriseMemoryCategory[];  // [] pour tous les employés en V1
  can_access_humans: boolean;          // peut lire les profils humains
  can_access_documents: boolean;       // peut lire les documents
  can_access_sensitive: boolean;       // peut lire les éléments confidentiels
  allowed_domains: string[];           // domaines autorisés
  write_requires_human_validation: boolean;  // toujours true en V1
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export interface GlobalEnterpriseMemoryMetadata {
  version: string;
  created_at: string;
  updated_at: string;
  source: string;        // "manual" | "import" | "api" | "demo"
  is_demo: boolean;      // true = données fictives, ne pas envoyer en production
  coverage_score: number; // 0–100, calculé par le snapshot
}

// ── Main type : GlobalEnterpriseMemory ────────────────────────────────────────

export interface GlobalEnterpriseMemory {
  memory_id: EnterpriseMemoryId;
  company_id: string;

  // Blocs fondamentaux
  identity: EnterpriseIdentityProfile;
  tone: EnterpriseToneProfile;
  communication: EnterpriseCommunicationProfile;

  // Gouvernance
  validation_circuits: EnterpriseValidationCircuit[];

  // Annuaire humain (vrais humains, pas des IA)
  humans: EnterpriseHumanRegistry;

  // Structure organisationnelle
  sites: EnterpriseSiteProfile[];
  departments: EnterpriseDepartmentProfile[];

  // Documents
  documents: EnterpriseDocumentProfile[];

  // Règles et préférences
  rules: EnterpriseRuleProfile[];
  preferences: EnterprisePreferenceProfile[];

  // Patterns opérationnels
  operational_patterns: EnterpriseOperationalPattern[];

  // Items de mémoire génériques
  memory_items: EnterpriseMemoryItem[];

  // Accès des employés IA
  employee_access_profiles: EnterpriseEmployeeAccessProfile[];

  // Métadonnées
  metadata: GlobalEnterpriseMemoryMetadata;
}

// ── Patch ─────────────────────────────────────────────────────────────────────

export type GlobalEnterpriseMemoryPatch = {
  identity?: Partial<EnterpriseIdentityProfile>;
  tone?: Partial<EnterpriseToneProfile>;
  communication?: Partial<EnterpriseCommunicationProfile>;
  validation_circuits?: EnterpriseValidationCircuit[];
  humans?: EnterpriseHumanRegistry;
  sites?: EnterpriseSiteProfile[];
  departments?: EnterpriseDepartmentProfile[];
  documents?: EnterpriseDocumentProfile[];
  rules?: EnterpriseRuleProfile[];
  preferences?: EnterprisePreferenceProfile[];
  operational_patterns?: EnterpriseOperationalPattern[];
  memory_items?: EnterpriseMemoryItem[];
  employee_access_profiles?: EnterpriseEmployeeAccessProfile[];
};

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface GlobalEnterpriseMemorySnapshot {
  memory_id: EnterpriseMemoryId;
  company_id: string;
  generated_at: string;
  identity_coverage: number;     // 0–100
  tone_coverage: number;
  human_registry_coverage: number;
  validation_circuits_coverage: number;
  documents_coverage: number;
  rules_coverage: number;
  memory_items_coverage: number;
  overall_coverage: number;
  human_count: number;
  active_human_count: number;
  site_count: number;
  department_count: number;
  document_count: number;
  rule_count: number;
  memory_item_count: number;
  validation_circuit_count: number;
  is_demo: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface GlobalEnterpriseMemoryValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface GlobalEnterpriseMemoryValidationReport {
  ok: boolean;
  errors: GlobalEnterpriseMemoryValidationIssue[];
  warnings: GlobalEnterpriseMemoryValidationIssue[];
  human_count: number;
  site_count: number;
  department_count: number;
  document_count: number;
  rule_count: number;
  memory_item_count: number;
  coverage_score: number;
  checked_at: string;
}
