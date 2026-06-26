// src/lib/clonestore/onboarding/global-onboarding-types.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Types
//
// Modèle persistable pour le wizard d'onboarding global CloneStore.
// Ces types sont la forme canonique exportée depuis la couche onboarding.
//
// Invariants :
//   - first_mission.employee_slug = "pierre" toujours
//   - first_mission.plan_only = true toujours
//   - read_only = true si affiché en lecture seule
//   - metadata toujours redacté avant persistence
//   - jamais de secret/token/API key dans les données

// ── Étapes ───────────────────────────────────────────────────────────────────

export type GlobalOnboardingStepId =
  | "company_identity"
  | "team_humans"
  | "documents"
  | "rules_validations"
  | "technologies"
  | "first_pierre_mission";

export type GlobalOnboardingStepStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped";

// ── Statut du draft ───────────────────────────────────────────────────────────

export type GlobalOnboardingDraftStatus =
  | "local_draft"     // brouillon local uniquement (PHASE 3.5)
  | "server_draft"    // sauvegardé côté serveur (PHASE 3.6+)
  | "completed"       // toutes les étapes terminées
  | "archived";       // archivé, non modifiable

// ── Mode persistence ──────────────────────────────────────────────────────────

export type GlobalOnboardingPersistenceMode =
  | "localstorage_only"  // mode actuel PHASE 3.5
  | "server_draft"       // schéma SQL prêt, non appliqué
  | "server_active";     // table + RLS appliquées (PHASE 3.6+)

// ── Sous-types draft ──────────────────────────────────────────────────────────

export type GlobalOnboardingCompanyDraft = {
  company_name: string;
  industry: string;
  size_range: string;
  country: string;
  language: string;
  timezone: string;
  description: string;
};

export type GlobalOnboardingHumanDraft = {
  id: string;
  full_name: string;
  role_title: string;
  department: string;
  email?: string;        // optionnel — PII, ne pas forcer
  is_approver: boolean;
  validation_scope: string[];
};

export type GlobalOnboardingDocumentDraft = {
  id: string;
  title: string;
  document_type: string;
  is_official: boolean;
  applies_to_domains: string[];
  status: "planned" | "uploaded_later" | "missing";
};

export type GlobalOnboardingRuleDraft = {
  id: string;
  title: string;
  domain: string;
  risk_level: "low" | "medium" | "high" | "critical";
  requires_validation: boolean;
  description: string;
};

export type GlobalOnboardingTechnologyDraft = {
  key: string;
  display_name: string;
  status: "active" | "partial" | "roadmap";
  readiness_score: number;
};

export type GlobalOnboardingFirstMissionDraft = {
  mission_type: string;
  prompt: string;
  employee_slug: "pierre";    // invariant : toujours pierre
  plan_only: true;            // invariant : toujours plan_only
};

// ── Draft principal ───────────────────────────────────────────────────────────

export type GlobalOnboardingDraft = {
  id: string;
  user_id?: string;           // optionnel en localStorage
  company_id: string;
  status: GlobalOnboardingDraftStatus;
  current_step: GlobalOnboardingStepId;
  completion_score: number;   // 0–100
  step_statuses: Record<GlobalOnboardingStepId, GlobalOnboardingStepStatus>;
  company: GlobalOnboardingCompanyDraft;
  humans: GlobalOnboardingHumanDraft[];
  documents: GlobalOnboardingDocumentDraft[];
  rules: GlobalOnboardingRuleDraft[];
  technologies: GlobalOnboardingTechnologyDraft[];
  first_mission: GlobalOnboardingFirstMissionDraft | null;
  cloneadn_preview: Record<string, unknown>;  // aperçu CloneADN local, non persisté serveur
  created_at: string;
  updated_at: string;
  source: "localstorage" | "server" | "demo";
  read_only: boolean;
  metadata: Record<string, unknown>;
};

// ── Payload persistable ───────────────────────────────────────────────────────
// Version envoyée vers la DB — sans données sensibles PII.

export type GlobalOnboardingPersistablePayload = Omit<GlobalOnboardingDraft,
  "id" | "source" | "read_only" | "cloneadn_preview"
> & {
  user_id: string;    // obligatoire pour persistence serveur
};

// ── Résultats ─────────────────────────────────────────────────────────────────

export type GlobalOnboardingReadResult = {
  draft: GlobalOnboardingDraft | null;
  source: "localstorage" | "server" | "empty";
  error: string | null;
};

export type GlobalOnboardingWriteResult = {
  ok: boolean;
  draft_id: string;
  persisted: boolean;
  source: "localstorage" | "server";
  error: string | null;
};

// ── Validation ────────────────────────────────────────────────────────────────

export type GlobalOnboardingValidationIssue = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type GlobalOnboardingValidationReport = {
  valid: boolean;
  issues: GlobalOnboardingValidationIssue[];
  issue_count: number;
};

// ── Constantes ────────────────────────────────────────────────────────────────

export const GLOBAL_ONBOARDING_TABLE_NAME =
  "clonestore_global_onboarding_drafts" as const;

export const GLOBAL_ONBOARDING_CURRENT_STEP_IDS: GlobalOnboardingStepId[] = [
  "company_identity",
  "team_humans",
  "documents",
  "rules_validations",
  "technologies",
  "first_pierre_mission",
];

export const GLOBAL_ONBOARDING_PERSISTENCE_MODE: GlobalOnboardingPersistenceMode =
  "server_draft"; // Non activé — PHASE 3.6

// Phrases interdites dans les données onboarding
export const GLOBAL_ONBOARDING_UNSAFE_PATTERNS = [
  "public launch go",
  "zéro erreur", "zero erreur",
  "conformité garantie", "conformite garantie",
  "clonevoice actif production",
  "configuration enregistrée serveur",
] as const;

// Clés sensibles à redacter dans metadata
export const GLOBAL_ONBOARDING_REDACT_KEYS = [
  "password", "token", "secret", "api_key", "authorization",
  "stripe", "supabase", "openai", "anthropic", "private_key",
  "webhook_secret", "sk_live_", "whsec_", "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;
