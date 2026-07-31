// src/lib/clonechat/voice/providers.ts
//
// Interfaces PROVIDER abstraites (transcription + TTS) + mocks DÉTERMINISTES pour un gate local qui
// ne dépend d'AUCUNE clé externe. Les adaptateurs réels (OpenAI) sont fournis séparément
// (openai-providers.ts) et implémentent ces mêmes interfaces.

export interface TranscriptionRequest {
  readonly mime: string;
  readonly bytes: number;
  readonly content?: Uint8Array;
  readonly filename: string; // suit le MIME réel (jamais figé)
}

export interface TranscriptionOutcome {
  readonly ok: boolean;
  readonly text: string;
  readonly confidence: number | null;
  readonly durationSeconds: number | null;
  readonly error: "timeout" | "provider" | "network" | null;
}

export interface TranscriptionProvider {
  transcribe(req: TranscriptionRequest): Promise<TranscriptionOutcome>;
}

export interface TtsRequest {
  readonly text: string;
}

export interface TtsOutcome {
  readonly ok: boolean;
  readonly audioBase64: string | null;
  readonly mime: string | null;
  readonly error: "timeout" | "provider" | null;
}

export interface TtsProvider {
  synthesize(req: TtsRequest): Promise<TtsOutcome>;
}

// ── Mocks déterministes ────────────────────────────────────────────────────────

/** Transcripteur mock : renvoie exactement l'issue fournie (ou dérivée d'une fonction). */
export function mockTranscriber(outcome: TranscriptionOutcome | ((req: TranscriptionRequest) => TranscriptionOutcome)): TranscriptionProvider {
  return {
    transcribe: async (req) => (typeof outcome === "function" ? outcome(req) : outcome),
  };
}

/** TTS mock : renvoie exactement l'issue fournie. */
export function mockTts(outcome: TtsOutcome | ((req: TtsRequest) => TtsOutcome)): TtsProvider {
  return {
    synthesize: async (req) => (typeof outcome === "function" ? outcome(req) : outcome),
  };
}

/** Raccourci : transcription réussie déterministe. */
export function transcriberOf(text: string, confidence: number | null = 0.92, durationSeconds: number | null = 3): TranscriptionProvider {
  return mockTranscriber({ ok: true, text, confidence, durationSeconds, error: null });
}

/** Raccourci : TTS réussi déterministe (audio factice base64, jamais vide). */
export function ttsOf(mime = "audio/mpeg"): TtsProvider {
  return mockTts({ ok: true, audioBase64: "AAAA", mime, error: null });
}
