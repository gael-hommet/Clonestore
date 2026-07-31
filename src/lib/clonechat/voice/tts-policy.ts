// src/lib/clonechat/voice/tts-policy.ts
//
// Politique PURE de synthèse vocale. Le texte source est TOUJOURS la réponse finale sécurisée de
// CloneChat (jamais un texte libre). Règles : longueur maximale (résumé sûr déterministe, jamais
// via un modèle), refus de lire à voix haute un contenu privé sans autorisation réelle, refus d'un
// contenu vide. Aucune invention, aucun faux succès.

export const TTS_MAX_CHARS = 800;

export type TtsRefusedReason = "not_authorized" | "unsuitable" | null;

export interface TtsSuitability {
  readonly speakable: boolean;
  readonly text: string; // texte réellement synthétisable (éventuellement résumé/tronqué de façon sûre)
  readonly refusedReason: TtsRefusedReason;
  readonly truncated: boolean;
}

/** Résumé SÛR et déterministe : coupe à la dernière frontière de phrase avant la limite. */
export function safeSpeechSummary(text: string, maxChars: number = TTS_MAX_CHARS): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const head = t.slice(0, maxChars);
  const lastStop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.lastIndexOf("\n"));
  const cut = lastStop > maxChars * 0.4 ? head.slice(0, lastStop + 1) : head;
  return `${cut.trim()} (…)`;
}

/**
 * Évalue si la réponse est lisible à voix haute.
 * - `readsPrivateData` (demande privée/gouvernée) sans `authorized` → REFUS (on ne lit jamais de
 *   données privées à voix haute sans autorisation réelle).
 * - texte vide → non lisible.
 * - trop long → résumé sûr déterministe (jamais via un modèle).
 */
export function assessTtsSuitability(input: { responseText: string; authorized: boolean; readsPrivateData: boolean; maxChars?: number }): TtsSuitability {
  const max = input.maxChars ?? TTS_MAX_CHARS;
  if (input.readsPrivateData && !input.authorized) {
    return { speakable: false, text: "", refusedReason: "not_authorized", truncated: false };
  }
  const text = (input.responseText ?? "").trim();
  if (text.length === 0) {
    return { speakable: false, text: "", refusedReason: "unsuitable", truncated: false };
  }
  if (text.length > max) {
    return { speakable: true, text: safeSpeechSummary(text, max), refusedReason: null, truncated: true };
  }
  return { speakable: true, text, refusedReason: null, truncated: false };
}
