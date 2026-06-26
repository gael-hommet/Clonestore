// src/lib/clonestore/enterprise-footprint/enterprise-footprint-types.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Types
//
// EnterpriseFootprint = version structurée, validée et exploitable
// de ce que l'entreprise donne à CloneStore.
//
// Flux :
//   GlobalOnboardingDraft → EnterpriseFootprint → GlobalEnterpriseMemory (CloneADN)
//
// Invariants :
//   - footprint.read_only = true si affiché sans droits d'édition
//   - metadata toujours redacté avant persistence
//   - jamais de secret/token/API key dans les données
//   - source toujours déclarée

// ── Statut de l'empreinte ─────────────────────────────────────────────────────

export type EnterpriseFootprintStatus =
  | "draft"         // brouillon initial, données incomplètes
  | "ready"         // empreinte complète, prête pour CloneADN
  | "incomplete"    // données manquantes mais utilisable partiellement
  | "needs_review"  // incohérences détectées
  | "archived";     // archivée, non modifiable

// ── Source des données ────────────────────────────────────────────────────────

export type EnterpriseFootprintSource =
  | "onboarding_local"   // depuis le draft onboarding localStorage (PHASE 3.5+)
  | "onboarding_server"  // depuis le draft onboarding persisté en DB
  | "cloneadn"           // depuis GlobalEnterpriseMemory TECH-05
  | "demo";              // données fictives de démonstration

// ── Mode de persistence ───────────────────────────────────────────────────────

export type EnterpriseFootprintPersistenceMode =
  | "localstorage_only"  // snapshot local uniquement (défaut PHASE 3.8)
  | "server_draft"       // schéma SQL prêt, non appliqué
  | "server_active";     // persistence serveur activée (PHASE 3.9+)

// ── Sous-types ────────────────────────────────────────────────────────────────

export type EnterpriseFootprintCompanyIdentity = {
  company_name: string;
  industry: string;
  size_range: string;
  country: string;
  language: string;
  timezone: string;
  description: string;
};

export type EnterpriseFootprintHumanRole = {
  id: string;
  full_name: string;
  role_title: string;
  department: string;
  email?: string;          // optionnel — PII, ne pas forcer
  is_approver: boolean;
  validation_scope: string[];
};

export type EnterpriseFootprintApprovalRule = {
  id: string;
  title: string;
  domain: string;
  risk_level: "low" | "medium" | "high" | "critical";
  requires_validation: boolean;
  description: string;
};

export type EnterpriseFootprintDocumentReference = {
  id: string;
  title: string;
  document_type: string;
  status: "planned" | "uploaded_later" | "missing";
  applies_to_domains: string[];
  is_official: boolean;
};

export type EnterpriseFootprintTechnologyStatus = {
  key: string;
  label: string;
  status: "active" | "partial" | "roadmap" | "disabled";
  readiness: number;        // 0–100
  is_locked: boolean;
  is_configurable: boolean;
};

export type EnterpriseFootprintCloneADNSummary = {
  tone: string | null;
  operating_rules_count: number;
  approval_rules_count: number;
  humans_count: number;
  documents_count: number;
  technologies_count: number;
  coverage_score: number;    // 0–100 depuis computeCoverageScore
  warnings: string[];
};

// ── Score de readiness ────────────────────────────────────────────────────────
// Distinct du coverage_score CloneADN — mesure la complétude "produit"
// de l'empreinte, pas juste la couverture mémoire.

export type EnterpriseFootprintReadinessScore = {
  score: number;             // 0–100
  level: "low" | "medium" | "high" | "complete";
  has_company_identity: boolean;
  has_approvers: boolean;
  has_approval_rules: boolean;
  has_documents: boolean;
  has_first_mission: boolean;
  details: string[];
};

// ── Validation ────────────────────────────────────────────────────────────────

export type EnterpriseFootprintValidationIssue = {
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
};

export type EnterpriseFootprintValidationReport = {
  valid: boolean;
  issues: EnterpriseFootprintValidationIssue[];
  issue_count: number;
};

// ── Payload persistable ───────────────────────────────────────────────────────

export type EnterpriseFootprintPersistablePayload = Omit<EnterpriseFootprint,
  "id" | "read_only" | "cloneadn_summary"
> & {
  user_id: string;    // obligatoire pour persistence serveur
};

// ── Résultats read/write ──────────────────────────────────────────────────────

export type EnterpriseFootprintReadResult = {
  footprint: EnterpriseFootprint | null;
  source: "localstorage" | "server" | "empty";
  error: string | null;
};

export type EnterpriseFootprintWriteResult = {
  ok: boolean;
  footprint_id: string;
  persisted: boolean;
  source: "localstorage" | "server";
  error: string | null;
};

// ── QA Read/Write ─────────────────────────────────────────────────────────────

export type EnterpriseFootprintReadWriteQaStepId =
  | "onboarding_draft_available"
  | "onboarding_maps_to_footprint"
  | "footprint_maps_to_cloneadn"
  | "cloneadn_maps_back_to_footprint"
  | "validation_passes_or_warns"
  | "localstorage_snapshot_saved"
  | "localstorage_snapshot_restored"
  | "server_write_not_forced"
  | "server_flag_default_false"
  | "no_sensitive_leak"
  | "cockpit_preview_available"
  | "rollback_localstorage_available";

export type EnterpriseFootprintReadWriteQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type EnterpriseFootprintReadWriteQaStep = {
  id: EnterpriseFootprintReadWriteQaStepId;
  label: string;
  description: string;
  severity: "blocking" | "warning" | "info";
  status: EnterpriseFootprintReadWriteQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EnterpriseFootprintReadWriteQaVerdict =
  | "ready_for_qa"
  | "blocked"
  | "passed"
  | "needs_review";

// ── EnterpriseFootprint — Type principal ──────────────────────────────────────

export type EnterpriseFootprint = {
  id: string;
  user_id?: string;             // optionnel en localStorage
  company_id: string;
  status: EnterpriseFootprintStatus;
  source: EnterpriseFootprintSource;
  company: EnterpriseFootprintCompanyIdentity;
  humans: EnterpriseFootprintHumanRole[];
  approval_rules: EnterpriseFootprintApprovalRule[];
  documents: EnterpriseFootprintDocumentReference[];
  technologies: EnterpriseFootprintTechnologyStatus[];
  cloneadn_summary: EnterpriseFootprintCloneADNSummary;
  coverage_score: number;       // 0–100 — depuis CloneADN si disponible
  readiness_score: EnterpriseFootprintReadinessScore;
  missing_items: string[];      // descriptions des éléments manquants
  warnings: string[];           // avertissements non bloquants
  created_at: string;
  updated_at: string;
  read_only: boolean;
  metadata: Record<string, unknown>;
};

// ── Constantes ────────────────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_TABLE_NAME =
  "clonestore_enterprise_footprints" as const;

// Phrases interdites dans les données de l'empreinte
export const ENTERPRISE_FOOTPRINT_UNSAFE_PATTERNS = [
  "public launch go",
  "zéro erreur", "zero erreur",
  "conformité garantie", "conformite garantie",
  "clonevoice actif production",
  "configuration serveur confirmée",
] as const;

// Clés sensibles à redacter
export const ENTERPRISE_FOOTPRINT_REDACT_KEYS = [
  "password", "token", "secret", "api_key", "authorization",
  "stripe", "supabase", "openai", "anthropic", "private_key",
  "webhook_secret", "sk_live_", "whsec_", "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;
