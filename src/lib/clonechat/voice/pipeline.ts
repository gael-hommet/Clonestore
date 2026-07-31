// src/lib/clonechat/voice/pipeline.ts
//
// ORCHESTRATEUR du parcours vocal complet, déterministe et injecté par providers :
//   audio → validation stricte → transcription → decideDiagnoseAndGuide() → réponse texte →
//   TTS facultatif → fallback texte honnête.
// La voix ne contourne RIEN : la transcription repasse par le pipeline sécurisé (Brain → Contexte →
// Diagnostic → Guide), donc l'anti-injection, la gouvernance et la confirmation s'appliquent. Jamais
// d'auto-envoi, jamais d'exécution d'action, jamais de faux succès, jamais de fuite (logs sûrs).

import { buildCloneChatContext, type CloneChatContext } from "@/lib/clonechat/context";
import { decideDiagnoseAndGuide } from "@/lib/clonechat/guide";
import { LOW_CONFIDENCE_THRESHOLD } from "./transcription-policy";
import { validateAudioContent, canonicalExtension } from "./formats";
import { assessTtsSuitability } from "./tts-policy";
import type { TranscriptionProvider, TtsProvider } from "./providers";
import {
  CLONECHAT_VOICE_VERSION, type VoiceJourneyInput, type VoiceJourneyResult, type VoiceError,
  type VoiceTtsResult, type TranscriptStatus, type VoiceState, type VoiceLogEvent,
} from "./types";

export interface VoiceJourneyDeps {
  readonly transcriber: TranscriptionProvider;
  readonly tts?: TtsProvider;
}

const CANCEL_ERROR: VoiceError = { category: "cancelled", code: "CANCELLED", message: "Dictée annulée.", stage: "input" };

function base(): VoiceJourneyResult {
  return {
    version: CLONECHAT_VOICE_VERSION,
    state: "idle",
    error: null,
    transcript: null,
    transcriptConfidence: null,
    transcriptStatus: null,
    decision: null,
    context: null,
    diagnosis: null,
    guide: null,
    structured: null,
    responseText: null,
    tts: null,
    securityRefusal: false,
    autoSend: false,
  };
}

function withResult(patch: Partial<VoiceJourneyResult>): VoiceJourneyResult {
  return Object.freeze({ ...base(), ...patch, autoSend: false as const });
}

function errorResult(state: VoiceState, error: VoiceError, extra: Partial<VoiceJourneyResult> = {}): VoiceJourneyResult {
  return withResult({ state, error, ...extra });
}

// ── Étape validation → code d'échec → erreur typée ────────────────────────────
function inputError(code: string, message: string): VoiceError {
  const category = code === "AUDIO_TYPE_UNSUPPORTED" || code === "AUDIO_CONTENT_NOT_AUDIO" ? "unsupported_format" : "user_error";
  return { category, code, message, stage: "input" };
}

/** Exécute le parcours vocal complet. Pur vis-à-vis des providers (injectés) → testable sans clé. */
export async function runVoiceJourney(input: VoiceJourneyInput, deps: VoiceJourneyDeps): Promise<VoiceJourneyResult> {
  // 0) Annulation (pendant enregistrement ou traitement) — jamais une erreur, jamais un envoi.
  if (input.cancelled) {
    return withResult({ state: "cancelled", error: null });
  }

  // 1) Validation stricte (MIME + taille + contenu déguisé).
  const verdict = validateAudioContent({ mime: input.audio.mime, bytes: input.audio.bytes, content: input.audio.content });
  if (!verdict.ok) {
    return errorResult("error", inputError(verdict.code, verdict.message));
  }

  // 2) Transcription (provider injecté).
  const filename = `dictation.${canonicalExtension(verdict.detectedMime ?? verdict.mime)}`;
  const outcome = await deps.transcriber.transcribe({ mime: verdict.mime, bytes: verdict.bytes, content: input.audio.content, filename });

  if (!outcome.ok) {
    if (outcome.error === "timeout") {
      return errorResult("error", { category: "timeout", code: "TRANSCRIPTION_TIMEOUT", message: "La dictée a pris trop de temps. Réessayez.", stage: "transcription" }, { transcriptStatus: "unavailable" });
    }
    return errorResult("error", { category: "provider_failure", code: "TRANSCRIPTION_FAILED", message: "La transcription n'a pas abouti. Réessayez la dictée.", stage: "transcription" }, { transcriptStatus: "unavailable" });
  }

  const transcript = (outcome.text ?? "").trim();
  if (transcript.length === 0) {
    return errorResult("error", { category: "user_error", code: "EMPTY_TRANSCRIPT", message: "Je n'ai rien entendu. Réessayez la dictée.", stage: "transcription" }, { transcriptStatus: "empty" });
  }
  const transcriptStatus: TranscriptStatus =
    outcome.confidence !== null && outcome.confidence < LOW_CONFIDENCE_THRESHOLD ? "low_confidence" : "ok";

  // 3) Le transcript devient une demande CloneChat NORMALE (même pipeline sécurisé que le texte).
  const ctx: CloneChatContext = buildCloneChatContext({
    message: transcript,
    viewer: input.viewer,
    tenant: input.tenant ?? null,
    entitlement: input.entitlement ?? null,
    routePath: input.routePath,
    surfacedErrors: input.surfacedErrors,
    environment: input.environment,
  });
  const diagnosed = decideDiagnoseAndGuide({ message: transcript, modelUnavailable: input.modelUnavailable }, ctx);

  const responseText = diagnosed.structured.answer;
  const securityRefusal = diagnosed.decision.requestedAction?.refusedReason === "governance_bypass_or_injection";

  const responded: Partial<VoiceJourneyResult> = {
    transcript, // conservation EXACTE du transcript utilisé
    transcriptConfidence: outcome.confidence,
    transcriptStatus,
    decision: diagnosed.decision,
    context: ctx,
    diagnosis: diagnosed.diagnosis,
    guide: diagnosed.guide,
    structured: diagnosed.structured,
    responseText,
    securityRefusal,
  };

  // 4) TTS — uniquement si EXPLICITEMENT demandé.
  if (input.speak !== true) {
    return withResult({ state: "responded", ...responded, tts: null });
  }

  const readsPrivateData = ctx.requestClass !== "CONVERSATIONAL_OR_PUBLIC";
  const suitability = assessTtsSuitability({ responseText, authorized: input.ttsAuthorized === true, readsPrivateData });

  if (!suitability.speakable) {
    const tts: VoiceTtsResult = {
      requested: true, available: false, audioBase64: null, mime: null,
      fallbackText: responseText, refusedReason: suitability.refusedReason, error: null,
    };
    return withResult({ state: "responded", ...responded, tts });
  }

  if (!deps.tts) {
    const tts: VoiceTtsResult = {
      requested: true, available: false, audioBase64: null, mime: null,
      fallbackText: responseText, refusedReason: "tts_unavailable", error: null,
    };
    return withResult({ state: "responded", ...responded, tts });
  }

  const spoken = await deps.tts.synthesize({ text: suitability.text });
  if (spoken.ok && spoken.audioBase64) {
    const tts: VoiceTtsResult = {
      requested: true, available: true, audioBase64: spoken.audioBase64, mime: spoken.mime,
      fallbackText: null, refusedReason: null, error: null,
    };
    return withResult({ state: "speaking", ...responded, tts });
  }

  // Panne / timeout TTS → fallback texte SYSTÉMATIQUE, jamais un faux succès audio.
  const ttsError: VoiceError = spoken.error === "timeout"
    ? { category: "timeout", code: "TTS_TIMEOUT", message: "La lecture vocale a expiré ; réponse en texte.", stage: "tts" }
    : { category: "provider_failure", code: "TTS_FAILED", message: "La lecture vocale est indisponible ; réponse en texte.", stage: "tts" };
  const tts: VoiceTtsResult = {
    requested: true, available: false, audioBase64: null, mime: null,
    fallbackText: responseText, refusedReason: null, error: ttsError,
  };
  return withResult({ state: "responded", ...responded, tts });
}

/**
 * Transition terminale du parcours (après lecture/consommation côté client) : responded/speaking →
 * completed. N'invente jamais de succès : ne s'applique qu'à un parcours déjà abouti.
 */
export function completeVoiceJourney(result: VoiceJourneyResult): VoiceJourneyResult {
  if (result.state === "responded" || result.state === "speaking") {
    return Object.freeze({ ...result, state: "completed" });
  }
  return result;
}

// ── Journalisation SÛRE : jamais l'audio brut, jamais le transcript, jamais un secret ─────────────
export function buildVoiceLog(result: VoiceJourneyResult, input: VoiceJourneyInput): VoiceLogEvent {
  return {
    event: "clonechat_voice_journey",
    state: result.state,
    stage: result.error?.stage ?? null,
    errorCode: result.error?.code ?? null,
    transcriptChars: result.transcript?.length ?? null, // une LONGUEUR, jamais le texte
    transcriptStatus: result.transcriptStatus,
    requestClass: result.context?.requestClass ?? null,
    securityRefusal: result.securityRefusal,
    ttsRequested: result.tts?.requested ?? false,
    ttsAvailable: result.tts?.available ?? false,
    audioBytes: input.audio.bytes,
  };
}

export function logVoiceJourney(result: VoiceJourneyResult, input: VoiceJourneyInput, logger: (e: VoiceLogEvent) => void = (e) => console.info(JSON.stringify(e))): void {
  logger(buildVoiceLog(result, input));
}
