// src/lib/clonechat/voice/openai-providers.ts
//
// Adaptateurs PROVIDER RÉELS (OpenAI) implémentant les interfaces abstraites. La clé reste SERVEUR
// et ne quitte jamais ce module ; aucun audio ni transcript n'est journalisé ici. Ces adaptateurs
// ne sont PAS exercés par le gate local (aucune clé requise) — le gate utilise les mocks
// déterministes. Une preuve réelle optionnelle peut les utiliser si une clé est disponible.

import { transcriptionVocabularyPrompt } from "./transcription-policy";
import type { TranscriptionProvider, TranscriptionOutcome, TtsProvider, TtsOutcome } from "./providers";

export interface OpenAiTranscriptionConfig {
  readonly key: string;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly language?: string;
}

/** Transcription OpenAI réelle (audio → texte). La clé ne quitte jamais le serveur. */
export function openAiTranscriptionProvider(cfg: OpenAiTranscriptionConfig): TranscriptionProvider {
  const timeoutMs = cfg.timeoutMs ?? 20_000;
  return {
    transcribe: async (req): Promise<TranscriptionOutcome> => {
      if (!req.content || req.content.length === 0) {
        return { ok: false, text: "", confidence: null, durationSeconds: null, error: "provider" };
      }
      const form = new FormData();
      const blob = new Blob([Buffer.from(req.content)], { type: req.mime });
      form.append("file", blob, req.filename);
      form.append("model", cfg.model);
      form.append("language", cfg.language ?? "fr");
      form.append("prompt", transcriptionVocabularyPrompt());
      form.append("response_format", "json");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.key}` },
          body: form,
          signal: controller.signal,
        });
      } catch {
        return { ok: false, text: "", confidence: null, durationSeconds: null, error: controller.signal.aborted ? "timeout" : "network" };
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) return { ok: false, text: "", confidence: null, durationSeconds: null, error: "provider" };
      const j = (await res.json().catch(() => null)) as { text?: string; duration?: number; logprobs?: Array<{ logprob: number }> } | null;
      const text = (j?.text ?? "").trim();
      const lp = j?.logprobs ?? [];
      const confidence = lp.length > 0 ? Math.exp(lp.reduce((s, l) => s + l.logprob, 0) / lp.length) : null;
      return { ok: true, text, confidence, durationSeconds: j?.duration ?? null, error: null };
    },
  };
}

export interface OpenAiTtsConfig {
  readonly key: string;
  readonly model: string; // ex. "gpt-4o-mini-tts"
  readonly voice: string; // ex. "alloy"
  readonly format?: string; // "mp3" | "opus" | "aac" | "wav"
  readonly timeoutMs?: number;
}

const TTS_MIME_BY_FORMAT: Record<string, string> = {
  mp3: "audio/mpeg", opus: "audio/ogg", aac: "audio/aac", wav: "audio/wav", flac: "audio/flac",
};

/** Synthèse vocale OpenAI réelle (texte → audio). Fallback texte géré en amont par le pipeline. */
export function openAiTtsProvider(cfg: OpenAiTtsConfig): TtsProvider {
  const timeoutMs = cfg.timeoutMs ?? 20_000;
  const format = cfg.format ?? "mp3";
  return {
    synthesize: async (req): Promise<TtsOutcome> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: cfg.model, voice: cfg.voice, input: req.text, response_format: format }),
          signal: controller.signal,
        });
      } catch {
        return { ok: false, audioBase64: null, mime: null, error: controller.signal.aborted ? "timeout" : "provider" };
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) return { ok: false, audioBase64: null, mime: null, error: "provider" };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return { ok: false, audioBase64: null, mime: null, error: "provider" };
      return { ok: true, audioBase64: buf.toString("base64"), mime: TTS_MIME_BY_FORMAT[format] ?? "audio/mpeg", error: null };
    },
  };
}
