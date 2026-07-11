// src/lib/clonechat/intelligence/c1-1/parrain-attachment-policy.ts
// C1.1 — Politique pièces jointes FAIL-CLOSED : réconciliation stricte MIME/extension,
// limites de taille, protections anti-bombe de décompression, aucune exécution de
// macro/exécutable/formule, aucun fetch d'URL depuis un contenu, messages d'erreur
// rédigés (jamais de dump interne), timeouts et budgets d'extraction.

import type { AttachmentFormat } from "./parrain-attachment-types";

export const ATTACHMENT_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024, // 10 Mo par fichier
  maxImageBytes: 4 * 1024 * 1024,
  maxPdfPages: 100,
  maxSheets: 10,
  maxRowsPerSheet: 2000,
  maxCellsTotal: 20_000,
  maxExtractedChars: 400_000, // anti-bombe de décompression (texte extrait)
  maxChunkChars: 1600,
  maxChunksPerAttachment: 40,
  maxModelCharsPerAttachment: 6000, // bornage AVANT modèle (résumé au-delà)
  extractionTimeoutMs: 8000,
  maxAttachmentsPerTurn: 4,
});

const MIME_BY_EXT: Readonly<Record<string, { format: AttachmentFormat; mimes: readonly string[] }>> = Object.freeze({
  pdf: { format: "pdf", mimes: ["application/pdf"] },
  docx: { format: "docx", mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  xlsx: { format: "xlsx", mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  csv: { format: "csv", mimes: ["text/csv", "application/csv", "text/plain"] },
  txt: { format: "txt", mimes: ["text/plain"] },
  md: { format: "md", mimes: ["text/markdown", "text/plain", "text/x-markdown"] },
  png: { format: "png", mimes: ["image/png"] },
  jpg: { format: "jpeg", mimes: ["image/jpeg"] },
  jpeg: { format: "jpeg", mimes: ["image/jpeg"] },
  webp: { format: "webp", mimes: ["image/webp"] },
  pptx: { format: "pptx", mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
});

/** Extensions dangereuses — refus immédiat (jamais d'exécution, jamais de quarantaine douce). */
const FORBIDDEN_EXTENSIONS = /\.(exe|bat|cmd|sh|ps1|js|mjs|vbs|jar|apk|dll|scr|com|docm|xlsm|pptm|zip|rar|7z|gz|tar|iso|html?)$/i;

export interface PolicyDecision {
  readonly accepted: boolean;
  readonly format: AttachmentFormat;
  readonly detectedMime: string;
  readonly reason: string | null;
  readonly quarantined: boolean;
}

/** Détection par signature (magic bytes) — jamais confiance aveugle au MIME déclaré. */
export function detectMime(bytes: Uint8Array, filename: string): string {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf"; // %PDF
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"; // RIFF....WEBP
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    // Conteneur ZIP (docx/xlsx/pptx) — l'extension déclarée départage, la structure sera validée par le parseur.
    const ext = extensionOf(filename);
    if (ext === "docx") return MIME_BY_EXT.docx.mimes[0];
    if (ext === "xlsx") return MIME_BY_EXT.xlsx.mimes[0];
    if (ext === "pptx") return MIME_BY_EXT.pptx.mimes[0];
    return "application/zip";
  }
  // Texte plausible (heuristique : pas d'octets nuls dans le premier Ko).
  const head = bytes.slice(0, 1024);
  if (head.length > 0 && !head.includes(0)) {
    const ext = extensionOf(filename);
    if (ext === "csv") return "text/csv";
    if (ext === "md") return "text/markdown";
    return "text/plain";
  }
  return "application/octet-stream";
}

export function extensionOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function formatForExtension(ext: string): AttachmentFormat {
  return MIME_BY_EXT[ext]?.format ?? "unknown";
}

/** Décision de politique complète — fail-closed sur tout mismatch ou danger. */
export function evaluateAttachmentPolicy(filename: string, declaredMime: string, bytes: Uint8Array): PolicyDecision {
  if (FORBIDDEN_EXTENSIONS.test(filename)) {
    return { accepted: false, format: "unknown", detectedMime: "application/octet-stream", reason: "Type de fichier refusé par la politique de sécurité.", quarantined: true };
  }
  if (bytes.length === 0) {
    return { accepted: false, format: "unknown", detectedMime: "application/octet-stream", reason: "Fichier vide.", quarantined: false };
  }
  if (bytes.length > ATTACHMENT_LIMITS.maxFileBytes) {
    return { accepted: false, format: formatForExtension(extensionOf(filename)), detectedMime: declaredMime, reason: "Fichier trop volumineux (limite 10 Mo).", quarantined: false };
  }
  const ext = extensionOf(filename);
  const known = MIME_BY_EXT[ext];
  if (!known) {
    return { accepted: false, format: "unknown", detectedMime: detectMime(bytes, filename), reason: "Extension non prise en charge.", quarantined: false };
  }
  const detected = detectMime(bytes, filename);
  const image = known.format === "png" || known.format === "jpeg" || known.format === "webp";
  if (image && bytes.length > ATTACHMENT_LIMITS.maxImageBytes) {
    return { accepted: false, format: known.format, detectedMime: detected, reason: "Image trop volumineuse (limite 4 Mo).", quarantined: false };
  }
  // Réconciliation stricte : le contenu détecté doit être compatible avec l'extension déclarée.
  const compatible =
    known.mimes.includes(detected) ||
    (detected === "text/plain" && ["csv", "txt", "md"].includes(ext)) ||
    (detected === "application/zip" && ["docx", "xlsx", "pptx"].includes(ext));
  if (!compatible) {
    return { accepted: false, format: known.format, detectedMime: detected, reason: "Le contenu du fichier ne correspond pas à son extension — fichier mis en quarantaine.", quarantined: true };
  }
  if (known.format === "pptx") {
    return { accepted: false, format: "pptx", detectedMime: detected, reason: "PPTX n'est pas encore pris en charge (aucun parseur approuvé) — export PDF conseillé.", quarantined: false };
  }
  return { accepted: true, format: known.format, detectedMime: detected, reason: null, quarantined: false };
}

/** Neutralise les URL/liens d'un texte extrait — jamais suivis, jamais fetchés. */
export function neutralizeLinks(text: string): string {
  return text.replace(/https?:\/\/[^\s)>"']+/gi, "[lien non suivi]").replace(/\bwww\.[^\s)>"']+/gi, "[lien non suivi]");
}

/** Message d'erreur RÉDIGÉ pour l'utilisateur (jamais de détail interne). */
export function redactedAttachmentError(reason: string): string {
  return `Je n'ai pas pu traiter cette pièce jointe : ${reason} Aucun contenu n'a été analysé — je ne devine jamais le contenu d'un fichier.`;
}

/** Timeout d'extraction — l'échec est honnête (parse_failed), jamais silencieux. */
export async function withExtractionTimeout<T>(work: Promise<T>, ms = ATTACHMENT_LIMITS.extractionTimeoutMs): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("extraction_timeout")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
