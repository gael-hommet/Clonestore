// src/lib/clonechat/voice/transcription-policy.ts
// C1.7 §8 — Politique de DICTÉE (pure, testable, sans réseau).
//
// Dictée = voix → texte ÉDITABLE → l'utilisateur décide d'envoyer.
// Ce n'est PAS une conversation audio-à-audio, et la dictée n'envoie JAMAIS toute seule.
//
// Le texte dicté est une ENTRÉE UTILISATEUR NON FIABLE : il repasse par exactement les mêmes
// gardes que le texte tapé (classification C1.6, anti-injection, isolation tenant, gates
// d'action, confirmation humaine). La voix ne contourne AUCUNE gouvernance.

export const TRANSCRIBE_MODEL_DEFAULT = "gpt-4o-mini-transcribe";
export const TRANSCRIBE_MODEL_FALLBACK = "gpt-4o-transcribe";

export function loadTranscriptionModels(env: NodeJS.ProcessEnv = process.env): { primary: string; fallback: string } {
  return {
    primary: (env.CLONECHAT_TRANSCRIBE_MODEL ?? "").trim() || TRANSCRIBE_MODEL_DEFAULT,
    fallback: (env.CLONECHAT_TRANSCRIBE_FALLBACK_MODEL ?? "").trim() || TRANSCRIBE_MODEL_FALLBACK,
  };
}

// ── Validation stricte de l'entrée audio ─────────────────────────────────────
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 Mo
export const MIN_AUDIO_BYTES = 1_200;            // en-dessous : silence / clic accidentel
export const MAX_AUDIO_SECONDS = 240;            // 4 minutes de dictée

/** Types audio réellement acceptés par le provider ET produits par les navigateurs. */
const ACCEPTED_AUDIO = new Set([
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mpga",
  "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/flac",
]);

export type AudioRejection =
  | { readonly ok: false; readonly code: "EMPTY_AUDIO"; readonly message: string }
  | { readonly ok: false; readonly code: "AUDIO_TOO_SHORT"; readonly message: string }
  | { readonly ok: false; readonly code: "AUDIO_TOO_LARGE"; readonly message: string }
  | { readonly ok: false; readonly code: "AUDIO_TYPE_UNSUPPORTED"; readonly message: string };

export type AudioAcceptance = { readonly ok: true; readonly mime: string; readonly bytes: number };

/**
 * Valide l'audio. Le MIME déclaré par le client n'est qu'un indice : on normalise
 * (`audio/webm;codecs=opus` → `audio/webm`) et on refuse tout ce qui n'est pas de l'audio.
 */
export function validateAudio(input: { mime: string; bytes: number }): AudioAcceptance | AudioRejection {
  const mime = (input.mime ?? "").split(";")[0].trim().toLowerCase();
  if (input.bytes <= 0) return { ok: false, code: "EMPTY_AUDIO", message: "Aucun son n'a été capté. Réessayez la dictée." };
  if (!ACCEPTED_AUDIO.has(mime)) return { ok: false, code: "AUDIO_TYPE_UNSUPPORTED", message: "Ce format audio n'est pas pris en charge." };
  if (input.bytes < MIN_AUDIO_BYTES) return { ok: false, code: "AUDIO_TOO_SHORT", message: "L'enregistrement est trop court. Réessayez la dictée." };
  if (input.bytes > MAX_AUDIO_BYTES) return { ok: false, code: "AUDIO_TOO_LARGE", message: "L'enregistrement est trop long (4 minutes maximum)." };
  return { ok: true, mime, bytes: input.bytes };
}

// ── Vocabulaire CloneStore (versionné) ───────────────────────────────────────
// Il AIDE la reconnaissance des noms propres. Il n'autorise JAMAIS le modèle à inventer un mot
// absent de l'audio : le prompt décrit le DOMAINE, il ne demande pas de compléter.
export const TRANSCRIPTION_VOCABULARY_VERSION = "c1.7-1";

const VOCABULARY_TERMS = [
  "CloneStore", "CloneChat", "CloneRoom", "CloneCall", "CloneOS", "Pierre",
  "Empreinte Entreprise", "employé IA", "employés IA",
  "onboarding", "offboarding", "avenant", "fiche de paie", "bulletin de paie",
  "contrat", "CDI", "CDD", "RH", "mission", "validation",
  "France", "Belgique", "Luxembourg", "Suisse", "euros", "CHF",
] as const;

/**
 * Prompt de vocabulaire : liste de termes du domaine, sans aucune instruction de complétion.
 * Le modèle de transcription ne doit RIEN inventer — il doit seulement mieux orthographier
 * ce qui a réellement été prononcé.
 */
export function transcriptionVocabularyPrompt(): string {
  return (
    "Transcription en français. Termes du domaine pouvant apparaître : " +
    VOCABULARY_TERMS.join(", ") +
    ". Conserve les accents, la ponctuation, les noms propres, les nombres et les montants (€, CHF). " +
    "Ne transcris que ce qui est réellement prononcé."
  );
}

// ── Décision de repli (on ne double-transcrit PAS tout le monde) ─────────────
export interface TranscriptionAttempt {
  readonly text: string;
  /** Confiance moyenne si le provider la fournit (logprob normalisée), sinon null. */
  readonly confidence: number | null;
  /** Durée audio en secondes, si connue. */
  readonly durationSeconds: number | null;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.55;

export type FallbackDecision = { readonly useFallback: boolean; readonly reason: string | null };

/**
 * Le repli (`gpt-4o-transcribe`) coûte plus cher : il n'est justifié QUE si le résultat
 * primaire est manifestement défaillant, ou si l'utilisateur redemande explicitement.
 */
export function shouldFallback(attempt: TranscriptionAttempt, opts: { userRequestedRetry?: boolean } = {}): FallbackDecision {
  if (opts.userRequestedRetry) return { useFallback: true, reason: "l'utilisateur a demandé une nouvelle dictée améliorée" };

  const text = (attempt.text ?? "").trim();
  const spokeLongEnough = (attempt.durationSeconds ?? 0) >= 1.5;

  // Vide malgré une parole assez longue → la transcription primaire a échoué.
  if (text.length === 0 && spokeLongEnough) return { useFallback: true, reason: "transcription primaire vide malgré une parole détectée" };

  // Confiance mesurée sous le seuil (uniquement si le provider la fournit).
  if (attempt.confidence !== null && attempt.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { useFallback: true, reason: `confiance mesurée trop faible (${attempt.confidence.toFixed(2)} < ${LOW_CONFIDENCE_THRESHOLD})` };
  }

  // Quelques caractères pour plusieurs secondes de parole → sortie manifestement dégradée.
  if (spokeLongEnough && text.length > 0 && text.length < 3) {
    return { useFallback: true, reason: "sortie manifestement dégradée" };
  }

  return { useFallback: false, reason: null }; // le cas NORMAL : une seule transcription
}
