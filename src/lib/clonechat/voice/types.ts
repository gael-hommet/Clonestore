// src/lib/clonechat/voice/types.ts
//
// CloneChat BLOC 6 — CLONEVOICE. La voix est une INTERFACE d'entrée/sortie de CloneChat, jamais une
// autorité. Le parcours complet : capture/réception audio → validation stricte → transcription →
// transformation en demande CloneChat normale → Brain → Contexte → Diagnostic → Guide → réponse
// texte → sortie vocale (TTS) facultative → fallback texte honnête. La transcription repasse par
// EXACTEMENT le même pipeline sécurisé que le texte (anti-injection, gouvernance, confirmation) :
// la voix ne contourne rien. Types PURS, versionnés, déterministes.

import type { CloneChatViewer, CloneChatRequestClass } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";
import type { ContextEnvironment, CloneChatContext } from "@/lib/clonechat/context";
import type { BrainDecision, LegacyStructured } from "@/lib/clonechat/brain";
import type { CloneChatDiagnosis } from "@/lib/clonechat/diagnosis";
import type { CloneGuide } from "@/lib/clonechat/guide";

export const CLONECHAT_VOICE_VERSION = "voice-1" as const;

/** États typés du parcours vocal (lifecycle complet client + serveur). */
export type VoiceState =
  | "idle"
  | "recording"
  | "processing" // validation + transcription en cours
  | "transcribed" // transcript obtenu
  | "responded" // CloneChat a produit une réponse texte
  | "speaking" // audio TTS réellement disponible
  | "completed" // parcours terminé
  | "cancelled"
  | "error";

export const VOICE_STATES: readonly VoiceState[] = [
  "idle", "recording", "processing", "transcribed", "responded", "speaking", "completed", "cancelled", "error",
] as const;

/** Catégorie d'échec — distingue clairement erreur utilisateur / format / provider / timeout / sécurité. */
export type VoiceErrorCategory =
  | "user_error" // audio vide/trop court/trop long, rien entendu
  | "unsupported_format" // MIME/extension/contenu non audio (ou déguisé)
  | "security_refusal" // injection / contournement de gouvernance dans la transcription
  | "provider_failure" // panne du provider (transcription ou TTS)
  | "timeout" // délai dépassé (transcription ou TTS)
  | "cancelled";

export type VoiceStage = "input" | "transcription" | "response" | "tts";

export interface VoiceError {
  readonly category: VoiceErrorCategory;
  readonly code: string; // code SÛR et stable (jamais un message brut de provider)
  readonly message: string; // message utilisateur honnête et sûr
  readonly stage: VoiceStage;
}

/** Statut de la transcription — l'incertitude est explicite, jamais présentée comme exacte. */
export type TranscriptStatus = "ok" | "low_confidence" | "empty" | "unavailable";

export interface VoiceTtsResult {
  readonly requested: boolean;
  readonly available: boolean; // audio RÉELLEMENT produit
  readonly audioBase64: string | null; // présent uniquement si available
  readonly mime: string | null;
  readonly fallbackText: string | null; // texte de repli TOUJOURS présent quand l'audio est indisponible
  readonly refusedReason: string | null; // "not_authorized" | "unsuitable" | "tts_unavailable" | null
  readonly error: VoiceError | null;
}

/** Résultat structuré, versionné et ADDITIF du parcours vocal. */
export interface VoiceJourneyResult {
  readonly version: typeof CLONECHAT_VOICE_VERSION;
  readonly state: VoiceState;
  readonly error: VoiceError | null;

  // Transcription (transcript EXACT utilisé par CloneChat).
  readonly transcript: string | null;
  readonly transcriptConfidence: number | null;
  readonly transcriptStatus: TranscriptStatus | null;

  // Sorties CloneChat (additives ; null quand l'étape n'est pas atteinte).
  readonly decision: BrainDecision | null;
  readonly context: CloneChatContext | null;
  readonly diagnosis: CloneChatDiagnosis | null;
  readonly guide: CloneGuide | null;
  readonly structured: LegacyStructured | null; // format historique INCHANGÉ
  readonly responseText: string | null; // réponse texte (toujours présente quand CloneChat a une réponse)

  // Sortie vocale.
  readonly tts: VoiceTtsResult | null;

  /** Le refus de sécurité (injection/gouvernance) a-t-il été déclenché ? La voix ne l'exécute jamais. */
  readonly securityRefusal: boolean;

  /** INVARIANT : la voix n'active JAMAIS d'envoi automatique implicite. */
  readonly autoSend: false;
}

/** Audio reçu (le contenu permet la validation de contenu ; facultatif côté client). */
export interface VoiceAudioInput {
  readonly mime: string;
  readonly bytes: number;
  readonly content?: Uint8Array;
}

export interface VoiceJourneyInput {
  readonly audio: VoiceAudioInput;

  // Contexte CloneChat déjà résolu côté serveur (mêmes sources réelles que le texte).
  readonly viewer: CloneChatViewer;
  readonly tenant?: TenantResolution | null;
  readonly entitlement?: PierreAccessResult | null;
  readonly routePath?: string | null;
  readonly surfacedErrors?: readonly string[];
  readonly environment?: ContextEnvironment;

  // Sortie vocale : opt-in EXPLICITE uniquement.
  readonly speak?: boolean; // TTS demandé ?
  readonly ttsAuthorized?: boolean; // autorisation réelle de lire un contenu privé à voix haute

  // Contrôle.
  readonly cancelled?: boolean;
  readonly cancelledStage?: "recording" | "processing";
  readonly modelUnavailable?: boolean; // modèle CloneChat indisponible après transcription

  /** Métadonnée d'accessibilité (jamais un état deviné) : l'appel vient-il d'un lecteur d'écran / clavier ? */
  readonly assistiveContext?: { readonly keyboardOnly?: boolean; readonly screenReader?: boolean };
}

export interface VoiceLogEvent {
  readonly event: "clonechat_voice_journey";
  readonly state: VoiceState;
  readonly stage: VoiceStage | null;
  readonly errorCode: string | null;
  readonly transcriptChars: number | null; // une LONGUEUR, jamais le texte
  readonly transcriptStatus: TranscriptStatus | null;
  readonly requestClass: CloneChatRequestClass | null;
  readonly securityRefusal: boolean;
  readonly ttsRequested: boolean;
  readonly ttsAvailable: boolean;
  readonly audioBytes: number;
}
