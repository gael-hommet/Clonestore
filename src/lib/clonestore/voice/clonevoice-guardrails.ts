// TECH-10 — CloneVoice Readiness Layer — Guardrails
// Garde-fous de sécurité pour la pipeline vocale.
// Vérifie que CloneVoice respecte ses invariants fondamentaux.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceReadinessReport,
  CloneVoiceGuardrail,
} from "./clonevoice-types";
import { DEFAULT_CLONEVOICE_GUARDRAILS } from "./clonevoice-defaults";

// ── Résultat de vérification guardrail ────────────────────────────────────────

export interface CloneVoiceGuardrailCheckResult {
  ok: boolean;
  violated_guardrails: string[];
  blocked_actions: string[];
  requires_human_review: boolean;
  notes: string[];
}

// ── Vérifications invariants absolus ─────────────────────────────────────────

/**
 * Vérifie que production_enabled est false.
 * Invariant absolu — ne peut jamais être true en V1.
 */
export function checkProductionEnabledGuardrail(
  report: CloneVoiceReadinessReport,
): boolean {
  return report.production_enabled === false;
}

/**
 * Vérifie que live_audio_ready est false.
 */
export function checkLiveAudioGuardrail(
  report: CloneVoiceReadinessReport,
): boolean {
  return report.live_audio_ready === false;
}

/**
 * Vérifie que microphone_ready est false.
 */
export function checkMicrophoneGuardrail(
  report: CloneVoiceReadinessReport,
): boolean {
  return report.microphone_ready === false;
}

/**
 * Vérifie que audio_storage_enabled est false.
 */
export function checkAudioStorageGuardrail(
  report: CloneVoiceReadinessReport,
): boolean {
  return report.audio_storage_enabled === false;
}

// ── Vérifications transcript ──────────────────────────────────────────────────

/**
 * Vérifie les guardrails sur un transcript.
 */
export function checkTranscriptGuardrails(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceGuardrailCheckResult {
  const violatedGuardrails: string[] = [];
  const blockedActions: string[] = [];
  const notes: string[] = [];

  // Vérifier que le transcript est sanitizé
  if (!transcript.is_sanitized) {
    violatedGuardrails.push("guard_pii_redaction");
    blockedActions.push("pii_transmission_unredacted");
    notes.push("VIOLATION : Transcript non sanitizé. Redaction PII obligatoire.");
  }

  // Vérifier qu'on n'utilise pas l'audio réel
  if (transcript.input_mode !== "text_transcript") {
    // En V1, seul text_transcript est autorisé
    violatedGuardrails.push("guard_no_real_audio_capture");
    blockedActions.push("audio_capture");
    notes.push(
      `VIOLATION : Mode ${transcript.input_mode} non autorisé en V1. Seul text_transcript est disponible.`,
    );
  }

  // Vérifier pas d'action critique sans revue
  if (
    transcript.detected_intent === "critical_action" &&
    !transcript.requires_human_review
  ) {
    violatedGuardrails.push("guard_critical_action_review");
    blockedActions.push("critical_action_auto_execute");
    notes.push(
      "VIOLATION : Action critique sans revue humaine obligatoire.",
    );
  }

  const requiresHumanReview = violatedGuardrails.includes("guard_critical_action_review") ||
    transcript.risk_level === "critical" ||
    transcript.risk_level === "high";

  if (violatedGuardrails.length === 0) {
    notes.push("Tous les guardrails transcript validés.");
  }

  return {
    ok: violatedGuardrails.length === 0,
    violated_guardrails: violatedGuardrails,
    blocked_actions: blockedActions,
    requires_human_review: requiresHumanReview,
    notes,
  };
}

/**
 * Vérifie les guardrails sur un command draft.
 */
export function checkCommandDraftGuardrails(
  commandDraft: CloneVoiceCommandDraft,
): CloneVoiceGuardrailCheckResult {
  const violatedGuardrails: string[] = [];
  const blockedActions: string[] = [];
  const notes: string[] = [];

  // Vérifier la source CloneOS
  const cloneosSource = commandDraft.voice_metadata.cloneos_source;
  if (cloneosSource !== "clonechat") {
    notes.push(
      `Avertissement : cloneos_source='${cloneosSource}'. Doit être 'clonechat' (pas 'clonevoice').`,
    );
  }

  // Vérifier voice_origin
  if (!commandDraft.voice_metadata.voice_origin) {
    notes.push(
      "Avertissement : voice_origin non marqué dans les métadonnées.",
    );
  }

  // Vérifier risque critique
  if (commandDraft.risk_level === "critical" && !commandDraft.requires_validation) {
    violatedGuardrails.push("guard_critical_action_review");
    blockedActions.push("critical_action_auto_execute");
    notes.push(
      "VIOLATION : Commande critique sans validation requise.",
    );
  }

  // Vérifier stockage audio
  const hasAudioStorage = commandDraft.voice_metadata.audio_storage_enabled;
  if (hasAudioStorage === true) {
    violatedGuardrails.push("guard_no_audio_storage");
    blockedActions.push("audio_storage");
    notes.push("VIOLATION : Stockage audio activé — interdit en V1.");
  }

  if (violatedGuardrails.length === 0) {
    notes.push("Tous les guardrails command draft validés.");
  }

  return {
    ok: violatedGuardrails.length === 0,
    violated_guardrails: violatedGuardrails,
    blocked_actions: blockedActions,
    requires_human_review:
      violatedGuardrails.length > 0 ||
      commandDraft.requires_validation,
    notes,
  };
}

/**
 * Vérifie tous les guardrails sur un readiness report.
 */
export function checkReadinessReportGuardrails(
  report: CloneVoiceReadinessReport,
): CloneVoiceGuardrailCheckResult {
  const violatedGuardrails: string[] = [];
  const blockedActions: string[] = [];
  const notes: string[] = [];

  if (!checkProductionEnabledGuardrail(report)) {
    violatedGuardrails.push("invariant_production_disabled");
    blockedActions.push("production_activation");
    notes.push("VIOLATION CRITIQUE : production_enabled doit être false.");
  }

  if (!checkLiveAudioGuardrail(report)) {
    violatedGuardrails.push("invariant_live_audio_disabled");
    blockedActions.push("live_audio_access");
    notes.push("VIOLATION CRITIQUE : live_audio_ready doit être false en V1.");
  }

  if (!checkMicrophoneGuardrail(report)) {
    violatedGuardrails.push("invariant_microphone_disabled");
    blockedActions.push("microphone_access");
    notes.push("VIOLATION CRITIQUE : microphone_ready doit être false en V1.");
  }

  if (!checkAudioStorageGuardrail(report)) {
    violatedGuardrails.push("invariant_audio_storage_disabled");
    blockedActions.push("audio_storage");
    notes.push("VIOLATION CRITIQUE : audio_storage_enabled doit être false en V1.");
  }

  if (violatedGuardrails.length === 0) {
    notes.push(
      "Tous les invariants absolus CloneVoice respectés (production=false, audio=false, microphone=false, storage=false).",
    );
  }

  return {
    ok: violatedGuardrails.length === 0,
    violated_guardrails: violatedGuardrails,
    blocked_actions: blockedActions,
    requires_human_review: violatedGuardrails.length > 0,
    notes,
  };
}

/**
 * Retourne la liste des guardrails actifs.
 */
export function getActiveGuardrails(): CloneVoiceGuardrail[] {
  return DEFAULT_CLONEVOICE_GUARDRAILS.filter((g) => g.always_active);
}

/**
 * Retourne la liste des guardrails nécessitant revue humaine.
 */
export function getGuardrailsRequiringHumanReview(): CloneVoiceGuardrail[] {
  return DEFAULT_CLONEVOICE_GUARDRAILS.filter((g) => g.requires_human_review);
}

/**
 * Vérifie si une action est bloquée par les guardrails.
 */
export function isActionBlockedByGuardrails(actionType: string): boolean {
  return DEFAULT_CLONEVOICE_GUARDRAILS.some(
    (g) => g.always_active && g.action_types_blocked.includes(actionType),
  );
}
