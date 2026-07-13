// src/app/api/assistant/transcribe/route.ts
// C1.7 §8C — DICTÉE : audio → texte éditable. Le serveur reste l'autorité.
//
// Doctrine C1.6 préservée : la dictée est de la CONVERSATION, pas une action.
//   · aucune authentification requise (un visiteur anonyme peut dicter) ;
//   · aucune entreprise requise ; aucun droit Pierre requis ;
//   · AUCUNE action opérationnelle n'est déclenchée — on rend du TEXTE, rien d'autre ;
//   · le texte revient dans le composer et l'utilisateur décide d'envoyer (jamais d'auto-envoi).
//
// Sécurité :
//   · la clé OpenAI reste SERVEUR (jamais dans le bundle navigateur) ;
//   · aucun audio n'est persisté ; aucun audio brut n'est journalisé ;
//   · aucun transcript n'est écrit dans la télémétrie ;
//   · limite d'abus anonyme partagée avec le chat.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import { readOpenAIKey } from "@/lib/clonechat/openai";
import {
  validateAudio, loadTranscriptionModels, transcriptionVocabularyPrompt,
  shouldFallback, MAX_AUDIO_BYTES, type TranscriptionAttempt,
} from "@/lib/clonechat/voice/transcription-policy";
import { checkAnonymousRateLimit, anonymousFingerprint, anonymousRateLimitMessage } from "@/lib/clonechat/server/anonymous-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(json: unknown, status = 200) {
  return NextResponse.json(json, { status, headers: { "Cache-Control": "no-store" } });
}

/** Appelle la transcription OpenAI. Ne journalise NI l'audio, NI le transcript. */
async function transcribe(key: string, model: string, audio: Blob, filename: string): Promise<TranscriptionAttempt & { ok: boolean; error: string | null }> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", model);
  form.append("language", "fr");
  form.append("prompt", transcriptionVocabularyPrompt()); // vocabulaire du domaine, jamais « invente »
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` }, // la clé ne quitte JAMAIS le serveur
    body: form,
  });

  if (!res.ok) {
    // On ne remonte que le CODE du provider — jamais son corps, qui pourrait contenir l'audio.
    return { ok: false, text: "", confidence: null, durationSeconds: null, error: `provider_${res.status}` };
  }
  const j = (await res.json().catch(() => null)) as { text?: string; duration?: number; logprobs?: Array<{ logprob: number }> } | null;
  const text = (j?.text ?? "").trim();
  const lp = j?.logprobs ?? [];
  const confidence = lp.length > 0 ? Math.exp(lp.reduce((s, l) => s + l.logprob, 0) / lp.length) : null;
  return { ok: true, text, confidence, durationSeconds: j?.duration ?? null, error: null };
}

export async function POST(req: Request) {
  // 1) Arrêt d'urgence produit (même règle canonique que le chat).
  if (!isCloneChatEnabled()) return noStore({ ok: false, code: "CLONECHAT_DISABLED", error: "CloneChat n'est pas disponible." }, 503);

  // 2) Identité — JAMAIS une porte (C1.6). Anonyme autorisé : dicter, c'est parler.
  let userId: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null; // session illisible → visiteur anonyme, pas un refus
  }

  // 3) Abus : la voie anonyme est bornée (message honnête, jamais « indisponible »).
  if (!userId) {
    const rl = checkAnonymousRateLimit(anonymousFingerprint(req.headers));
    if (!rl.allowed) {
      return noStore({ ok: false, code: "RATE_LIMITED", error: anonymousRateLimitMessage(rl.retryAfterSeconds), retryAfterSeconds: rl.retryAfterSeconds }, 429);
    }
  }

  // 4) Clé SERVEUR.
  const key = readOpenAIKey();
  if (!key) return noStore({ ok: false, code: "TRANSCRIPTION_UNAVAILABLE", error: "La dictée est momentanément indisponible." }, 503);

  // 5) Multipart borné.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return noStore({ ok: false, code: "BAD_REQUEST", error: "Requête invalide." }, 400);
  }
  const file = form.get("audio");
  if (!(file instanceof Blob)) return noStore({ ok: false, code: "EMPTY_AUDIO", error: "Aucun son n'a été capté. Réessayez la dictée." }, 400);
  if (file.size > MAX_AUDIO_BYTES) return noStore({ ok: false, code: "AUDIO_TOO_LARGE", error: "L'enregistrement est trop long (4 minutes maximum)." }, 413);

  const verdict = validateAudio({ mime: file.type, bytes: file.size });
  if (!verdict.ok) return noStore({ ok: false, code: verdict.code, error: verdict.message }, 400);

  const userRequestedRetry = String(form.get("retry") ?? "") === "true";
  const models = loadTranscriptionModels();

  // 6) Transcription — modèle ÉCONOMIQUE d'abord. On ne double-transcrit PAS tout le monde.
  const started = Date.now();
  const primary = await transcribe(key, models.primary, file, "dictation.webm");
  let used = models.primary;
  let result = primary;
  let fallbackReason: string | null = null;

  if (!primary.ok) {
    return noStore({ ok: false, code: "TRANSCRIPTION_FAILED", error: "La transcription n'a pas abouti. Réessayez la dictée." }, 502);
  }

  const fb = shouldFallback(primary, { userRequestedRetry });
  if (fb.useFallback) {
    const second = await transcribe(key, models.fallback, file, "dictation.webm");
    if (second.ok && second.text.trim().length >= primary.text.trim().length) {
      used = models.fallback;
      result = second;
      fallbackReason = fb.reason;
    }
  }

  if (result.text.trim().length === 0) {
    return noStore({ ok: false, code: "EMPTY_TRANSCRIPT", error: "Je n'ai rien entendu. Réessayez la dictée." }, 200);
  }

  // 7) Télémétrie SANS contenu : ni audio, ni transcript. Uniquement des métriques.
  const telemetry = {
    model: used,
    fallbackUsed: used === models.fallback,
    fallbackReason,
    audioBytes: file.size,
    durationSeconds: result.durationSeconds,
    latencyMs: Date.now() - started,
    anonymous: userId === null,
    transcriptChars: result.text.length, // une LONGUEUR, jamais le texte
  };

  // Le transcript revient au composer. L'utilisateur décide d'envoyer — le serveur
  // n'exécute RIEN ici : aucune mission, aucune proposition, aucun effet.
  return noStore({ ok: true, transcript: result.text, autoSend: false, telemetry });
}
