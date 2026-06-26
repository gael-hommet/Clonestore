// TECH-10 — CloneVoice Readiness Layer — Command Adapter
// Adapte un CloneVoiceTranscriptDraft vers un CloneVoiceCommandDraft.
// Ne s'exécute pas seul. Le CommandDraft doit passer par CloneOS.
// CloneOSCommandSource n'a pas "clonevoice" — source = "clonechat" + voice_origin: true.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceCommandIntent,
  CloneVoiceRiskLevel,
} from "./clonevoice-types";

// ── Résultat d'adaptation ─────────────────────────────────────────────────────

export interface CloneVoiceCommandAdaptationResult {
  ok: boolean;
  command_draft?: CloneVoiceCommandDraft;
  blocked_reasons: string[];
  warnings: string[];
  notes: string[];
}

// ── Règles de blocage ─────────────────────────────────────────────────────────

const BLOCKED_INTENTS: CloneVoiceCommandIntent[] = [];
// Aucune intention n'est automatiquement bloquée — la validation se fait dans CloneOS
// Les intentions critical_action déclenchent requires_validation mais ne bloquent pas ici

const BLOCKED_RISK_LEVELS: CloneVoiceRiskLevel[] = ["critical"];

// ── Mapping intention → employé IA ────────────────────────────────────────────

/**
 * Mappe une intention vers un employé IA candidat.
 * En V1 : seul Pierre est disponible pour les demandes RH.
 */
export function mapIntentToEmployeeSlug(
  intent: CloneVoiceCommandIntent,
): string | undefined {
  switch (intent) {
    case "hr_request":
      return "pierre"; // Pierre = employé RH en V1
    case "document_request":
      return "pierre"; // Pierre peut gérer les documents RH
    case "validation_request":
      return "pierre"; // Pierre peut initier des validations RH
    default:
      return undefined;
  }
}

/**
 * Détermine si une commande nécessite validation humaine avant CloneOS.
 */
export function requiresValidationBeforeCloneOS(
  transcript: CloneVoiceTranscriptDraft,
): boolean {
  if (transcript.requires_human_review) return true;
  if (transcript.risk_level === "critical" || transcript.risk_level === "high") return true;
  if (transcript.detected_intent === "critical_action") return true;
  return false;
}

/**
 * Détermine si la commande peut procéder vers CloneOS.
 */
export function canProceedToCloneOS(
  transcript: CloneVoiceTranscriptDraft,
  blockedReasons: string[],
): boolean {
  if (blockedReasons.length > 0) return false;
  if (transcript.status === "rejected") return false;
  if (BLOCKED_RISK_LEVELS.includes(transcript.risk_level)) return false;
  return true;
}

// ── Adapter principal ─────────────────────────────────────────────────────────

/**
 * Adapte un CloneVoiceTranscriptDraft en CloneVoiceCommandDraft.
 *
 * Le CommandDraft résultant :
 * - Ne s'exécute pas seul
 * - Doit passer par CloneOS pour exécution
 * - Source = "clonechat" + voice_origin: true dans les métadonnées
 *   (CloneOSCommandSource n'a pas de valeur "clonevoice")
 */
export function adaptTranscriptToCommandDraft(
  transcript: CloneVoiceTranscriptDraft,
): CloneVoiceCommandAdaptationResult {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Vérifications de blocage
  if (transcript.status === "rejected") {
    blockedReasons.push(
      `Transcript rejeté : ${transcript.rejection_reason ?? "raison non spécifiée"}.`,
    );
  }

  if (BLOCKED_RISK_LEVELS.includes(transcript.risk_level)) {
    blockedReasons.push(
      `Niveau de risque ${transcript.risk_level} — validation humaine obligatoire avant CloneOS.`,
    );
  }

  if (!transcript.is_sanitized) {
    blockedReasons.push("Transcript non sanitizé — sanitization obligatoire avant adaptation.");
  }

  // Avertissements
  if (transcript.requires_human_review) {
    warnings.push(
      "Revue humaine recommandée avant transmission à CloneOS.",
    );
  }

  if (transcript.risk_level === "high") {
    warnings.push("Niveau de risque élevé — validation accrue recommandée.");
  }

  if (transcript.is_demo) {
    warnings.push("Transcript de démo — ne pas utiliser en production.");
  }

  if (transcript.detected_intent === "unknown") {
    warnings.push("Intention non identifiée — vérification manuelle recommandée.");
  }

  notes.push(
    "Source CloneOS sera 'clonechat' avec metadata voice_origin=true " +
    "(CloneOSCommandSource n'a pas de valeur 'clonevoice').",
  );

  // Employé candidat
  const candidateSlug = mapIntentToEmployeeSlug(transcript.detected_intent);
  if (candidateSlug) {
    notes.push(`Employé candidat détecté : ${candidateSlug}.`);
  }

  const requiresValidation = requiresValidationBeforeCloneOS(transcript);
  const canProceed = canProceedToCloneOS(transcript, blockedReasons);

  if (blockedReasons.length > 0) {
    return {
      ok: false,
      blocked_reasons: blockedReasons,
      warnings,
      notes,
    };
  }

  const commandDraft: CloneVoiceCommandDraft = {
    command_draft_id: `cmd_draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    transcript_draft_id: transcript.draft_id,
    company_id: transcript.company_id,
    raw_request: transcript.normalized_text,
    detected_intent: transcript.detected_intent,
    risk_level: transcript.risk_level,
    candidate_employee_slug: candidateSlug,
    requires_validation: requiresValidation,
    can_proceed_to_cloneos: canProceed,
    blocked_reasons: blockedReasons,
    warnings,
    voice_metadata: {
      // Important : source = "clonechat", pas "clonevoice" (non disponible dans CloneOSCommandSource)
      cloneos_source: "clonechat",
      voice_origin: true,
      input_mode: transcript.input_mode,
      language: transcript.language,
      transcript_status: transcript.status,
      is_demo: transcript.is_demo,
      provider_status: "not_configured",
      redacted_keys_count: transcript.redacted_keys.length,
    },
    created_at: new Date().toISOString(),
  };

  return {
    ok: true,
    command_draft: commandDraft,
    blocked_reasons: [],
    warnings,
    notes,
  };
}

/**
 * Construit les métadonnées vocales pour CloneOS.
 * À utiliser lors de la transmission à CloneOS.
 */
export function buildVoiceMetadataForCloneOS(
  commandDraft: CloneVoiceCommandDraft,
): Record<string, string | number | boolean | null> {
  return {
    voice_origin: true,
    cloneos_source_override: "clonechat", // Source à utiliser dans CloneOS
    transcript_draft_id: commandDraft.transcript_draft_id,
    command_draft_id: commandDraft.command_draft_id,
    input_mode: "text_transcript",
    risk_level: commandDraft.risk_level,
    detected_intent: commandDraft.detected_intent,
    requires_validation: commandDraft.requires_validation,
    is_demo: commandDraft.voice_metadata.is_demo ?? false,
  };
}

/**
 * Filtre les commandes pouvant procéder vers CloneOS.
 */
export function filterCommandsReadyForCloneOS(
  drafts: CloneVoiceCommandDraft[],
): CloneVoiceCommandDraft[] {
  return drafts.filter(
    (d) => d.can_proceed_to_cloneos && d.blocked_reasons.length === 0,
  );
}

/**
 * Filtre les commandes nécessitant validation humaine.
 */
export function filterCommandsRequiringValidation(
  drafts: CloneVoiceCommandDraft[],
): CloneVoiceCommandDraft[] {
  return drafts.filter((d) => d.requires_validation);
}

/**
 * Filtre les commandes bloquées.
 */
export function filterBlockedCommands(
  drafts: CloneVoiceCommandDraft[],
): CloneVoiceCommandDraft[] {
  return drafts.filter(
    (d) => !d.can_proceed_to_cloneos || d.blocked_reasons.length > 0,
  );
}
