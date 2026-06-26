// TECH-10 — CloneVoice Readiness Layer — Readiness Engine
// Évalue l'état de préparation de CloneVoice.
// CloneVoice n'est PAS actif en production. TECH-10 = readiness layer uniquement.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceStatus,
  CloneVoiceRuntimeStatus,
  CloneVoiceReadinessLevel,
  CloneVoiceReadinessReport,
  CloneVoicePrerequisite,
  CloneVoiceCapability,
  CloneVoiceInputMode,
  CloneVoiceProviderStatus,
} from "./clonevoice-types";
import {
  buildDefaultCloneVoiceReadinessReport,
  DEFAULT_CLONEVOICE_CAPABILITIES,
  DEFAULT_CLONEVOICE_LIMITATIONS,
  DEFAULT_CLONEVOICE_GUARDRAILS,
  DEFAULT_CLONEVOICE_PREREQUISITES,
} from "./clonevoice-defaults";

// ── Options d'évaluation ──────────────────────────────────────────────────────

export interface CloneVoiceReadinessEvaluationOptions {
  company_id?: string;
  provider_status?: CloneVoiceProviderStatus;
  security_review_done?: boolean;
  privacy_review_done?: boolean;
  legal_review_done?: boolean;
  product_validation_done?: boolean;
  is_internal?: boolean;
  force_status?: CloneVoiceStatus;
}

// ── Résultat d'évaluation ─────────────────────────────────────────────────────

export interface CloneVoiceReadinessEvaluationResult {
  ok: boolean;
  report: CloneVoiceReadinessReport;
  can_sandbox: boolean;
  can_production: boolean;   // Toujours false en V1
  blockers_count: number;
  missing_prerequisites_count: number;
  evaluation_notes: string[];
}

// ── Score de readiness ────────────────────────────────────────────────────────

/**
 * Calcule un score de readiness (0-100) basé sur les prérequis validés.
 * Ne peut jamais atteindre 100 sans tous les prérequis bloquants validés.
 */
export function calculateReadinessScore(prerequisites: CloneVoicePrerequisite[]): number {
  if (prerequisites.length === 0) return 0;

  const blockingPrereqs = prerequisites.filter((p) => p.is_blocking);
  const nonBlockingPrereqs = prerequisites.filter((p) => !p.is_blocking);

  const blockingMet = blockingPrereqs.filter((p) => p.is_met).length;
  const nonBlockingMet = nonBlockingPrereqs.filter((p) => p.is_met).length;

  // 70% du score sur les prérequis bloquants, 30% sur les non-bloquants
  const blockingScore =
    blockingPrereqs.length > 0
      ? (blockingMet / blockingPrereqs.length) * 70
      : 35; // Si pas de prérequis bloquants, score partiel

  const nonBlockingScore =
    nonBlockingPrereqs.length > 0
      ? (nonBlockingMet / nonBlockingPrereqs.length) * 30
      : 15;

  return Math.round(blockingScore + nonBlockingScore);
}

/**
 * Détermine le niveau de readiness.
 */
export function determineReadinessLevel(
  prerequisites: CloneVoicePrerequisite[],
  capabilities: CloneVoiceCapability[],
): CloneVoiceReadinessLevel {
  const blockingMissing = prerequisites.filter((p) => p.is_blocking && !p.is_met);
  const allBlockingMet = blockingMissing.length === 0;
  const allPrereqsMet = prerequisites.every((p) => p.is_met);
  const hasTextTranscript = capabilities.some(
    (c) => c.input_mode === "text_transcript" && c.available,
  );

  if (allPrereqsMet) return "production_ready";
  if (allBlockingMet && hasTextTranscript) return "internal_ready";
  if (hasTextTranscript) return "partial_ready";
  return "not_ready";
}

/**
 * Détermine le statut global CloneVoice.
 * En V1 : jamais production_ready sans tous les prérequis bloquants validés.
 */
export function determineCloneVoiceStatus(
  readinessLevel: CloneVoiceReadinessLevel,
  options?: CloneVoiceReadinessEvaluationOptions,
): CloneVoiceStatus {
  if (options?.force_status) return options.force_status;

  if (readinessLevel === "production_ready") return "production_ready";
  if (readinessLevel === "internal_ready") return "sandbox";
  return "preparation";
}

/**
 * Détermine le statut runtime.
 */
export function determineRuntimeStatus(
  capabilities: CloneVoiceCapability[],
): CloneVoiceRuntimeStatus {
  const availableCapabilities = capabilities.filter((c) => c.available);

  if (availableCapabilities.length === 0) return "not_implemented";
  if (availableCapabilities.every((c) => c.input_mode === "text_transcript")) return "mock_only";
  if (availableCapabilities.length < capabilities.length) return "partial";
  return "ready";
}

// ── Évaluation complète ───────────────────────────────────────────────────────

/**
 * Évalue l'état de readiness de CloneVoice.
 * Retourne toujours production_enabled: false en V1.
 */
export function evaluateCloneVoiceReadiness(
  options?: CloneVoiceReadinessEvaluationOptions,
): CloneVoiceReadinessEvaluationResult {
  const evaluationNotes: string[] = [];

  // Construire les prérequis en tenant compte des options
  const prerequisites = buildEvaluatedPrerequisites(options);
  const capabilities = DEFAULT_CLONEVOICE_CAPABILITIES;

  const readinessScore = calculateReadinessScore(prerequisites);
  const readinessLevel = determineReadinessLevel(prerequisites, capabilities);
  const status = determineCloneVoiceStatus(readinessLevel, options);
  const runtimeStatus = determineRuntimeStatus(capabilities);

  const missingPrereqs = prerequisites.filter((p) => !p.is_met);
  const blockingMissing = missingPrereqs.filter((p) => p.is_blocking);

  const sandboxPossible =
    capabilities.some((c) => c.input_mode === "text_transcript" && c.available);

  // Notes d'évaluation
  evaluationNotes.push(
    `Niveau de readiness : ${readinessLevel} (score: ${readinessScore}/100)`,
  );

  if (blockingMissing.length > 0) {
    evaluationNotes.push(
      `${blockingMissing.length} prérequis bloquant(s) manquant(s) : ` +
        blockingMissing.map((p) => p.label).join(", "),
    );
  }

  if (sandboxPossible) {
    evaluationNotes.push(
      "Sandbox possible : mode text_transcript disponible pour tests internes.",
    );
  }

  evaluationNotes.push(
    "CloneVoice n'est pas actif en production. TECH-10 = readiness layer uniquement.",
  );

  const availableInputModes: CloneVoiceInputMode[] = capabilities
    .filter((c) => c.available)
    .map((c) => c.input_mode);

  const providerStatus = options?.provider_status ?? "not_configured";

  const report: CloneVoiceReadinessReport = {
    status,
    runtime_status: runtimeStatus,
    readiness_level: readinessLevel,
    readiness_score: readinessScore,
    production_enabled: false,
    sandbox_possible: sandboxPossible,
    live_audio_ready: false,
    microphone_ready: false,
    audio_storage_enabled: false,
    provider_status: providerStatus,
    provider_configured: providerStatus !== "not_configured" && providerStatus !== "mock",
    privacy_review_required: true,
    security_review_required: true,
    missing_prerequisites: missingPrereqs,
    blockers: blockingMissing.map((p) => p.label),
    capabilities,
    limitations: DEFAULT_CLONEVOICE_LIMITATIONS,
    guardrails: DEFAULT_CLONEVOICE_GUARDRAILS,
    available_input_modes: availableInputModes,
    verdict: buildReadinessVerdict(readinessLevel, blockingMissing),
    generated_at: new Date().toISOString(),
  };

  return {
    ok: true,
    report,
    can_sandbox: sandboxPossible,
    can_production: false, // Toujours false en V1
    blockers_count: blockingMissing.length,
    missing_prerequisites_count: missingPrereqs.length,
    evaluation_notes: evaluationNotes,
  };
}

/**
 * Construit les prérequis évalués selon les options fournies.
 */
function buildEvaluatedPrerequisites(
  options?: CloneVoiceReadinessEvaluationOptions,
): CloneVoicePrerequisite[] {
  return DEFAULT_CLONEVOICE_PREREQUISITES.map((prereq) => {
    switch (prereq.prerequisite_id) {
      case "prereq_provider_config":
        return {
          ...prereq,
          is_met:
            options?.provider_status !== undefined &&
            options.provider_status !== "not_configured" &&
            options.provider_status !== "mock",
        };
      case "prereq_security_review":
        return { ...prereq, is_met: options?.security_review_done === true };
      case "prereq_privacy_review":
        return { ...prereq, is_met: options?.privacy_review_done === true };
      case "prereq_legal_review":
        return { ...prereq, is_met: options?.legal_review_done === true };
      case "prereq_text_transcript_ready":
        return { ...prereq, is_met: true }; // Toujours vrai en V1
      case "prereq_product_validation":
        return { ...prereq, is_met: options?.product_validation_done === true };
      default:
        return prereq;
    }
  });
}

/**
 * Construit un verdict textuel basé sur le niveau de readiness.
 */
export function buildReadinessVerdict(
  level: CloneVoiceReadinessLevel,
  blockingMissing: CloneVoicePrerequisite[],
): string {
  switch (level) {
    case "production_ready":
      return "CloneVoice est prêt pour la production. Tous les prérequis sont validés.";
    case "internal_ready":
      return (
        "CloneVoice est prêt pour usage interne uniquement. " +
        "Activation production nécessite validation complémentaire."
      );
    case "partial_ready":
      return (
        "CloneVoice est partiellement prêt. " +
        "Seul le mode text_transcript est disponible pour tests internes. " +
        "Prérequis bloquants manquants : " +
        blockingMissing.map((p) => p.label).join(", ") +
        "."
      );
    case "not_ready":
    default:
      return (
        "CloneVoice n'est pas prêt. Prérequis bloquants manquants : " +
        blockingMissing.map((p) => p.label).join(", ") +
        "."
      );
  }
}

// ── Vérifications rapides ─────────────────────────────────────────────────────

/**
 * Vérifie si le mode text_transcript est disponible.
 */
export function isTextTranscriptAvailable(): boolean {
  return DEFAULT_CLONEVOICE_CAPABILITIES.some(
    (c) => c.input_mode === "text_transcript" && c.available,
  );
}

/**
 * Vérifie si CloneVoice est en mode production.
 * Toujours false en V1.
 */
export function isCloneVoiceProductionEnabled(): false {
  return false;
}

/**
 * Vérifie si l'audio live est disponible.
 * Toujours false en V1.
 */
export function isLiveAudioReady(): false {
  return false;
}

/**
 * Vérifie si le microphone est disponible.
 * Toujours false en V1.
 */
export function isMicrophoneReady(): false {
  return false;
}

/**
 * Retourne le rapport de readiness par défaut.
 */
export function getDefaultReadinessReport(): CloneVoiceReadinessReport {
  return buildDefaultCloneVoiceReadinessReport();
}

/**
 * Liste les prérequis bloquants non satisfaits.
 */
export function listBlockingPrerequisites(
  prerequisites?: CloneVoicePrerequisite[],
): CloneVoicePrerequisite[] {
  const prereqs = prerequisites ?? DEFAULT_CLONEVOICE_PREREQUISITES;
  return prereqs.filter((p) => p.is_blocking && !p.is_met);
}

/**
 * Liste les modes d'entrée disponibles en V1.
 */
export function listAvailableInputModes(): CloneVoiceInputMode[] {
  return DEFAULT_CLONEVOICE_CAPABILITIES
    .filter((c) => c.available)
    .map((c) => c.input_mode);
}
