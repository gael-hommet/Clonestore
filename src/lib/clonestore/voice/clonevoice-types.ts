// TECH-10 — CloneVoice Readiness Layer — Types
// CloneVoice est la couche d'entrée vocale de CloneStore.
// CloneVoice n'est PAS actif en production. TECH-10 = readiness layer uniquement.
// CloneVoice n'est pas CloneOS. CloneVoice n'est pas CloneChat. CloneVoice n'est pas Pierre.
// Pure types: no async, no Supabase, no Next.js, no side effects.

// ── Statuts globaux ───────────────────────────────────────────────────────────

/**
 * Statut global de CloneVoice sur la plateforme.
 * En V1 : preparation ou roadmap — jamais production_ready sans validation complète.
 */
export type CloneVoiceStatus =
  | "disabled"           // Désactivé — non visible
  | "preparation"        // En préparation — visible avec badge "préparation"
  | "sandbox"            // Sandbox interne seulement
  | "roadmap"            // Sur roadmap — annoncé mais non implémenté
  | "production_ready";  // Prêt production — nécessite tous les prérequis validés

/**
 * Statut runtime de l'implémentation.
 */
export type CloneVoiceRuntimeStatus =
  | "not_implemented"    // Pas encore implémenté — V1
  | "mock_only"          // Mocks uniquement — tests et démo
  | "partial"            // Partiellement implémenté
  | "ready";             // Prêt pour usage

/**
 * Niveau de readiness de CloneVoice.
 */
export type CloneVoiceReadinessLevel =
  | "not_ready"          // Pas prêt — prérequis manquants
  | "partial_ready"      // Partiellement prêt — text transcript uniquement
  | "internal_ready"     // Prêt en interne — usage interne uniquement
  | "production_ready";  // Prêt production — tous prérequis validés

/**
 * Mode d'entrée vocale.
 */
export type CloneVoiceInputMode =
  | "text_transcript"       // Transcript texte fourni directement (V1 — le seul disponible)
  | "uploaded_audio"        // Fichier audio uploadé
  | "microphone"            // Microphone en temps réel
  | "phone_call"            // Appel téléphonique
  | "meeting_recording";    // Enregistrement de réunion

/**
 * Statut du fournisseur de transcription.
 */
export type CloneVoiceProviderStatus =
  | "not_configured"         // Aucun fournisseur configuré — V1
  | "mock"                   // Mock — tests uniquement
  | "configured_disabled"    // Configuré mais désactivé
  | "configured_sandbox"     // Configuré en mode sandbox
  | "configured_live";       // Configuré en production — nécessite revue sécurité

/**
 * Niveau de risque d'une commande vocale.
 */
export type CloneVoiceRiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Statut d'un transcript.
 */
export type CloneVoiceTranscriptStatus =
  | "raw"              // Brut — non traité
  | "normalized"       // Normalisé — prêt pour extraction
  | "rejected"         // Rejeté — contenu invalide ou dangereux
  | "needs_review"     // Revue humaine requise
  | "command_ready";   // Prêt pour transformation en commande CloneOS

/**
 * Intention détectée dans un transcript.
 */
export type CloneVoiceCommandIntent =
  | "hr_request"         // Demande RH
  | "document_request"   // Demande de document
  | "information_query"  // Question d'information
  | "validation_request" // Demande de validation
  | "critical_action"    // Action critique — review obligatoire
  | "unknown";           // Intention non identifiée

/**
 * Langue détectée dans un transcript.
 */
export type CloneVoiceLanguage = "fr" | "en" | "unknown";

// ── Feature flags ─────────────────────────────────────────────────────────────

/**
 * Feature flag pour une fonctionnalité vocale.
 */
export interface CloneVoiceFeatureFlag {
  key: string;
  enabled: boolean;
  requires_production_ready: boolean;
  description: string;
  available_in_v1: boolean;
}

// ── Prérequis ─────────────────────────────────────────────────────────────────

/**
 * Prérequis pour activer CloneVoice.
 */
export interface CloneVoicePrerequisite {
  prerequisite_id: string;
  label: string;
  description: string;
  is_met: boolean;
  is_blocking: boolean;   // true = bloquant pour production
  category: "provider" | "security" | "privacy" | "legal" | "technical" | "product";
}

// ── Capacités et limitations ──────────────────────────────────────────────────

/**
 * Capacité disponible de CloneVoice.
 */
export interface CloneVoiceCapability {
  capability_id: string;
  label: string;
  available: boolean;
  available_in_v1: boolean;
  input_mode: CloneVoiceInputMode;
  description: string;
}

/**
 * Limitation documentée de CloneVoice.
 */
export interface CloneVoiceLimitation {
  limitation_id: string;
  label: string;
  description: string;
  is_permanent: boolean;  // true = limite architecturale permanente
  workaround?: string;
}

// ── Garde-fous ────────────────────────────────────────────────────────────────

/**
 * Garde-fou de sécurité pour commandes vocales.
 */
export interface CloneVoiceGuardrail {
  guardrail_id: string;
  label: string;
  description: string;
  action_types_blocked: string[];
  requires_human_review: boolean;
  always_active: boolean;
}

// ── Transcript Draft ──────────────────────────────────────────────────────────

/**
 * Brouillon de transcript — résultat du traitement d'un texte vocal.
 * En V1 : entrée texte uniquement — pas d'audio réel.
 */
export interface CloneVoiceTranscriptDraft {
  draft_id: string;
  company_id: string;
  raw_text: string;                      // Texte brut fourni
  normalized_text: string;               // Texte normalisé/sanitizé
  status: CloneVoiceTranscriptStatus;
  language: CloneVoiceLanguage;
  detected_intent: CloneVoiceCommandIntent;
  risk_level: CloneVoiceRiskLevel;
  input_mode: CloneVoiceInputMode;       // En V1 : toujours text_transcript
  is_sanitized: boolean;
  redacted_keys: string[];               // Clés sensibles redactées
  requires_human_review: boolean;
  rejection_reason?: string;
  created_at: string;
  is_demo: boolean;
  processing_notes: string[];
}

// ── Command Draft ─────────────────────────────────────────────────────────────

/**
 * Brouillon de commande vocale — prêt pour adaptation en CloneOSCommandInput.
 * Ne s'exécute pas seul. Doit passer par CloneOS.
 */
export interface CloneVoiceCommandDraft {
  command_draft_id: string;
  transcript_draft_id: string;
  company_id: string;
  raw_request: string;           // Le normalized_text du transcript
  detected_intent: CloneVoiceCommandIntent;
  risk_level: CloneVoiceRiskLevel;
  candidate_employee_slug?: string;  // "pierre" si RH détecté
  requires_validation: boolean;
  can_proceed_to_cloneos: boolean;
  blocked_reasons: string[];
  warnings: string[];
  voice_metadata: Record<string, string | number | boolean | null>;
  created_at: string;
}

// ── Readiness Report ──────────────────────────────────────────────────────────

/**
 * Rapport de readiness CloneVoice.
 * Évalue l'état de préparation de la fonctionnalité vocale.
 */
export interface CloneVoiceReadinessReport {
  status: CloneVoiceStatus;
  runtime_status: CloneVoiceRuntimeStatus;
  readiness_level: CloneVoiceReadinessLevel;
  readiness_score: number;           // 0-100
  production_enabled: false;         // Toujours false en TECH-10
  sandbox_possible: boolean;         // true si text_transcript disponible
  live_audio_ready: false;           // Toujours false en V1
  microphone_ready: false;           // Toujours false en V1
  audio_storage_enabled: false;      // Toujours false en V1
  provider_status: CloneVoiceProviderStatus;
  provider_configured: boolean;
  privacy_review_required: true;     // Toujours requis
  security_review_required: true;    // Toujours requis
  missing_prerequisites: CloneVoicePrerequisite[];
  blockers: string[];
  capabilities: CloneVoiceCapability[];
  limitations: CloneVoiceLimitation[];
  guardrails: CloneVoiceGuardrail[];
  available_input_modes: CloneVoiceInputMode[];
  verdict: string;
  generated_at: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface CloneVoiceValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CloneVoiceValidationReport {
  ok: boolean;
  errors: CloneVoiceValidationIssue[];
  warnings: CloneVoiceValidationIssue[];
  checked_at: string;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface CloneVoiceSnapshot {
  status: CloneVoiceStatus;
  runtime_status: CloneVoiceRuntimeStatus;
  readiness_level: CloneVoiceReadinessLevel;
  readiness_score: number;
  production_enabled: false;
  sandbox_possible: boolean;
  live_audio_ready: false;
  missing_prerequisites: string[];
  blockers: string[];
  capabilities_available: number;
  capabilities_total: number;
  limitations_count: number;
  guardrails_count: number;
  generated_at: string;
}
