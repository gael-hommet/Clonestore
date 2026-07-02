// src/lib/clonechat/openai/multimodal.ts
// P9.4 — Support multimodal RÉEL (capture d'écran) borné et sûr. Les images sont :
//  - VALIDÉES (mime allowlist, taille plafonnée, nombre plafonné) ;
//  - ÉPHÉMÈRES (jamais écrites sur disque, jamais persistées, aucune rétention) ;
//  - TENANT-SCOPED par la route authentifiée (une image n'appartient qu'à l'appelant) ;
//  - envoyées au modèle en `detail: "low"` (coût minimal) ;
//  - analysées en sortie STRUCTURÉE séparant : prouvé-visuellement / inférence /
//    inconnu / problème-connu / prochaine-action. Aucune fausse certitude.
// La clé OpenAI reste serveur ; jamais d'appel depuis le navigateur.

import { z } from "zod";

export const IMAGE_MIME_ALLOWLIST = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedImageMime = (typeof IMAGE_MIME_ALLOWLIST)[number];

/** Plafonds de coût/sécurité. Volontairement stricts (fonds limités du propriétaire). */
export const MAX_IMAGES_PER_TURN = 2;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 Mo par image (avant base64)

export interface ImageValidation {
  readonly ok: boolean;
  readonly mime: AllowedImageMime | null;
  readonly bytes: number;
  readonly reason: string | null;
}

const DATA_URL_RE = /^data:([a-z0-9.+\/-]+);base64,([A-Za-z0-9+\/=]+)$/i;

/** Estime la taille décodée d'un base64 sans l'allouer. */
function base64Bytes(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.endsWith("==")) padding = 2;
  else if (b64.endsWith("=")) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

/** Valide une image data-URL (mime allowlist + taille). Ne throw jamais. */
export function validateImage(dataUrl: string): ImageValidation {
  if (typeof dataUrl !== "string" || dataUrl.length < 32) {
    return { ok: false, mime: null, bytes: 0, reason: "empty_or_short" };
  }
  const m = DATA_URL_RE.exec(dataUrl.trim());
  if (!m) return { ok: false, mime: null, bytes: 0, reason: "not_a_data_url" };
  const mime = m[1].toLowerCase();
  if (!IMAGE_MIME_ALLOWLIST.includes(mime as AllowedImageMime)) {
    return { ok: false, mime: null, bytes: 0, reason: `mime_not_allowed:${mime}` };
  }
  const bytes = base64Bytes(m[2]);
  if (bytes <= 0) return { ok: false, mime: mime as AllowedImageMime, bytes, reason: "decoded_empty" };
  if (bytes > MAX_IMAGE_BYTES) return { ok: false, mime: mime as AllowedImageMime, bytes, reason: "too_large" };
  return { ok: true, mime: mime as AllowedImageMime, bytes, reason: null };
}

export interface SanitizedImages {
  /** data-URLs acceptées (bornées à MAX_IMAGES_PER_TURN, éphémères). */
  readonly accepted: string[];
  /** Rejets, pour un retour honnête à l'utilisateur (jamais silencieux). */
  readonly rejected: { index: number; reason: string }[];
  /** Métadonnées non-persistées (pour l'audit du tour, jamais l'image elle-même). */
  readonly meta: { index: number; mime: AllowedImageMime; bytes: number }[];
}

/**
 * Filtre + borne une liste d'images. Rien n'est écrit sur disque : les data-URLs
 * acceptées ne vivent que le temps de l'appel modèle, puis sont libérées par le GC.
 * On ne conserve QUE des métadonnées (mime/taille), jamais le contenu de l'image.
 */
export function sanitizeImages(dataUrls: readonly string[] | undefined): SanitizedImages {
  const accepted: string[] = [];
  const rejected: { index: number; reason: string }[] = [];
  const meta: { index: number; mime: AllowedImageMime; bytes: number }[] = [];
  const list = dataUrls ?? [];
  for (let i = 0; i < list.length; i++) {
    if (accepted.length >= MAX_IMAGES_PER_TURN) {
      rejected.push({ index: i, reason: "over_image_limit" });
      continue;
    }
    const v = validateImage(list[i]);
    if (v.ok && v.mime) {
      accepted.push(list[i]);
      meta.push({ index: i, mime: v.mime, bytes: v.bytes });
    } else {
      rejected.push({ index: i, reason: v.reason ?? "invalid" });
    }
  }
  return { accepted, rejected, meta };
}

// ── Analyse structurée d'une capture d'écran ────────────────────────────────
// Sépare explicitement ce qui est PROUVÉ visuellement de l'inférence et de l'inconnu.
// Aucune fausse certitude : le modèle ne doit jamais affirmer ce qu'il n'observe pas.

export const ScreenshotAnalysisSchema = z.object({
  /** Résumé humain, sans jargon technique. */
  summary: z.string().min(1),
  /** Éléments réellement visibles à l'écran (faits observés). */
  visibly_proven: z.array(z.string()).max(12).default([]),
  /** Hypothèses raisonnables (clairement marquées comme inférences). */
  inference: z.array(z.string()).max(8).default([]),
  /** Ce qui reste indéterminé faute d'information à l'écran. */
  unknown: z.array(z.string()).max(8).default([]),
  /** Correspondance éventuelle avec un problème connu (empreinte de bug). */
  known_issue: z.string().nullable().default(null),
  /** Prochaine action concrète proposée (jamais exécutée sans confirmation). */
  next_action: z.string().nullable().default(null),
});

export type ScreenshotAnalysis = z.infer<typeof ScreenshotAnalysisSchema>;

/** Prompt système pour l'analyse d'une capture (honnêteté stricte, tenant-safe). */
export function buildScreenshotSystemPrompt(): string {
  return [
    "Tu es CloneChat en mode diagnostic visuel. On te montre une capture d'écran fournie par l'utilisateur connecté.",
    "Analyse UNIQUEMENT ce que tu vois. Sépare strictement :",
    "- visibly_proven : ce qui est réellement visible à l'écran ;",
    "- inference : hypothèses raisonnables, clairement marquées comme telles ;",
    "- unknown : ce que tu ne peux pas déterminer depuis l'image ;",
    "- known_issue : si cela ressemble à un problème connu, décris-le, sinon null ;",
    "- next_action : une action concrète (jamais exécutée sans confirmation), sinon null.",
    "N'invente aucune donnée d'entreprise. N'expose aucun détail d'infrastructure.",
    "Réponds en français, sans jargon technique, par un objet JSON valide correspondant au schéma demandé.",
  ].join("\n");
}
