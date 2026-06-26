// TECH-10 — CloneVoice Readiness Layer — Pierre → CloneVoice Bridge
// Permet à Pierre d'utiliser CloneVoice sans modifier son moteur.
// Bridge seulement. Ne modifie pas Pierre. N'invente pas d'activité RH.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceCommandIntent,
} from "./clonevoice-types";
import { normalizeTranscript } from "./clonevoice-transcript-normalizer";
import { adaptTranscriptToCommandDraft } from "./clonevoice-command-adapter";
import {
  buildDemoCloneVoiceTranscriptDraft,
  buildDemoCloneVoiceCommandDraft,
} from "./clonevoice-defaults";

// ── Types bridge ─────────────────────────────────────────────────────────────

export interface PierreVoiceBridgeInput {
  company_id: string;
  text_input: string;    // Transcript texte fourni par Pierre
  mission_id?: string;
  is_demo?: boolean;
}

export interface PierreVoiceBridgeResult {
  ok: boolean;
  transcript_draft?: CloneVoiceTranscriptDraft;
  command_draft?: CloneVoiceCommandDraft;
  can_proceed_to_cloneos: boolean;
  requires_validation: boolean;
  blocked_reasons: string[];
  warnings: string[];
  notes: string[];
}

export interface PierreVoiceCommandSummary {
  command_draft_id: string;
  detected_intent: CloneVoiceCommandIntent;
  risk_level: string;
  can_proceed_to_cloneos: boolean;
  requires_validation: boolean;
  candidate_employee_slug?: string;
  warnings: string[];
  // Important : source CloneOS = "clonechat" avec voice_origin: true
  cloneos_source: string;
  voice_origin: true;
}

// ── Bridge functions ──────────────────────────────────────────────────────────

/**
 * Traite une entrée vocale texte de Pierre.
 * Normalise le transcript et construit un command draft.
 * Ne modifie pas Pierre. Ne crée pas de DB.
 *
 * Important : le command draft résultant utilise la source "clonechat"
 * avec voice_origin=true dans les métadonnées
 * (CloneOSCommandSource n'a pas de valeur "clonevoice").
 */
export function processPierreVoiceInput(
  input: PierreVoiceBridgeInput,
): PierreVoiceBridgeResult {
  const notes: string[] = [];

  // Normalisation du transcript
  const normalizationResult = normalizeTranscript({
    raw_text: input.text_input,
    company_id: input.company_id,
    is_demo: input.is_demo ?? false,
  });

  if (!normalizationResult.ok || !normalizationResult.draft) {
    return {
      ok: false,
      can_proceed_to_cloneos: false,
      requires_validation: false,
      blocked_reasons: [
        normalizationResult.rejection_reason ??
          "Échec de normalisation du transcript.",
      ],
      warnings: [],
      notes: normalizationResult.notes,
    };
  }

  const transcriptDraft = normalizationResult.draft;
  notes.push(...normalizationResult.notes);
  notes.push("Transcript normalisé avec succès.");

  // Adaptation en command draft
  const adaptationResult = adaptTranscriptToCommandDraft(transcriptDraft);
  notes.push(...adaptationResult.notes);

  if (!adaptationResult.ok || !adaptationResult.command_draft) {
    return {
      ok: false,
      transcript_draft: transcriptDraft,
      can_proceed_to_cloneos: false,
      requires_validation: false,
      blocked_reasons: adaptationResult.blocked_reasons,
      warnings: adaptationResult.warnings,
      notes,
    };
  }

  const commandDraft = adaptationResult.command_draft;

  // Injecter mission_id si fourni
  if (input.mission_id) {
    const updatedMetadata = {
      ...commandDraft.voice_metadata,
      mission_id: input.mission_id,
    };
    (commandDraft as CloneVoiceCommandDraft).voice_metadata = updatedMetadata;
    notes.push(`Mission ID injecté : ${input.mission_id}.`);
  }

  return {
    ok: true,
    transcript_draft: transcriptDraft,
    command_draft: commandDraft,
    can_proceed_to_cloneos: commandDraft.can_proceed_to_cloneos,
    requires_validation: commandDraft.requires_validation,
    blocked_reasons: commandDraft.blocked_reasons,
    warnings: [...adaptationResult.warnings, ...commandDraft.warnings],
    notes,
  };
}

/**
 * Construit un résumé de commande vocale pour Pierre.
 * Utilisé pour affichage dans le contexte Pierre sans exposer les types internes.
 */
export function buildPierreVoiceCommandSummary(
  commandDraft: CloneVoiceCommandDraft,
): PierreVoiceCommandSummary {
  return {
    command_draft_id: commandDraft.command_draft_id,
    detected_intent: commandDraft.detected_intent,
    risk_level: commandDraft.risk_level,
    can_proceed_to_cloneos: commandDraft.can_proceed_to_cloneos,
    requires_validation: commandDraft.requires_validation,
    candidate_employee_slug: commandDraft.candidate_employee_slug,
    warnings: commandDraft.warnings,
    cloneos_source: "clonechat", // Toujours clonechat — pas de valeur "clonevoice"
    voice_origin: true,
  };
}

/**
 * Retourne un transcript de démo Pierre.
 * Utilisé pour démonstrations et tests.
 */
export function buildPierreDemoVoiceTranscript(
  companyId: string = "demo_company",
): CloneVoiceTranscriptDraft {
  return buildDemoCloneVoiceTranscriptDraft(companyId);
}

/**
 * Retourne un command draft de démo Pierre.
 */
export function buildPierreDemoVoiceCommand(
  companyId: string = "demo_company",
): CloneVoiceCommandDraft {
  return buildDemoCloneVoiceCommandDraft(companyId);
}

/**
 * Vérifie si Pierre peut utiliser CloneVoice pour une intention donnée.
 * En V1 : seules les intentions RH et document sont supportées.
 */
export function canPierreUseCloneVoiceForIntent(
  intent: CloneVoiceCommandIntent,
): boolean {
  const supportedIntents: CloneVoiceCommandIntent[] = [
    "hr_request",
    "document_request",
    "validation_request",
    "information_query",
  ];
  return supportedIntents.includes(intent);
}

/**
 * Retourne les intentions supportées par Pierre dans CloneVoice V1.
 */
export function getPierreSupportedVoiceIntents(): CloneVoiceCommandIntent[] {
  return [
    "hr_request",
    "document_request",
    "validation_request",
    "information_query",
  ];
}
