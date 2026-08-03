// src/lib/clonechat/inspector/evidence-validate.ts
//
// Validation STRICTE et SÛRE d'une preuve. Réutilise `sanitizeImageBuffer` (magic bytes / dimensions
// / bombs) et `contentHash`. Refuse proprement : vide, MIME mensonger, extension incompatible, type
// non supporté, trop volumineux, image corrompue, contenu actif/exécutable, archive, chiffré/illisible,
// sécurité indéterminable. Aucun fichier n'est exécuté ; aucune requête réseau ; aucune évaluation.

import { sanitizeImageBuffer } from "@/lib/clonechat/openai/image-sanitizer";
import { contentHash } from "@/lib/clonechat/knowledge/types";
import { getRouteEntry } from "@/lib/nav/route-registry";
import { redactText } from "@/lib/clonechat/care";
import type { RawEvidence, ValidatedEvidence, EvidenceType } from "./evidence-types";

export const DEFAULT_MAX_EVIDENCE_BYTES = 5 * 1024 * 1024; // 5 Mo

function matchAt(b: Uint8Array, off: number, sig: readonly number[]): boolean {
  if (off + sig.length > b.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[off + i] !== sig[i]) return false;
  return true;
}
const A = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

/** Contenu binaire actif/exécutable/archive/chiffré → refus. Renvoie un code, ou null. */
export function detectActiveOrUnsupportedBinary(b: Uint8Array): { code: string; kind: "security" | "unsupported" } | null {
  if (matchAt(b, 0, [0x4d, 0x5a])) return { code: "EXECUTABLE_PE", kind: "security" }; // MZ (Windows exe/dll)
  if (matchAt(b, 0, [0x7f, 0x45, 0x4c, 0x46])) return { code: "EXECUTABLE_ELF", kind: "security" };
  if (matchAt(b, 0, [0xca, 0xfe, 0xba, 0xbe]) || matchAt(b, 0, [0xfe, 0xed, 0xfa, 0xce])) return { code: "EXECUTABLE_MACHO", kind: "security" };
  if (matchAt(b, 0, [0x50, 0x4b, 0x03, 0x04]) || matchAt(b, 0, [0x50, 0x4b, 0x05, 0x06])) return { code: "ARCHIVE_ZIP", kind: "unsupported" };
  if (matchAt(b, 0, [0x1f, 0x8b])) return { code: "ARCHIVE_GZIP", kind: "unsupported" };
  if (matchAt(b, 0, [0x52, 0x61, 0x72, 0x21])) return { code: "ARCHIVE_RAR", kind: "unsupported" };
  if (matchAt(b, 0, A("%PDF"))) return { code: "PDF_UNSUPPORTED", kind: "unsupported" }; // aucun extracteur PDF sûr câblé
  return null;
}

/** Décode un buffer en texte UTF-8 SÛR, ou null si binaire (NUL / trop de caractères de contrôle). */
export function decodeSafeText(b: Uint8Array): string | null {
  const sample = b.subarray(0, Math.min(b.length, 65536));
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 0) return null; // NUL → binaire
    if (c < 9 || (c > 13 && c < 32)) control++;
  }
  if (sample.length > 0 && control / sample.length > 0.05) return null; // trop de contrôle → binaire
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(b);
  } catch {
    return null;
  }
}

/** Contenu texte activement dangereux (HTML/JS/script/shebang) → refus sécurité. */
export function detectActiveText(text: string): string | null {
  const t = text.slice(0, 4096).toLowerCase();
  if (/<\s*script\b/.test(t)) return "ACTIVE_HTML_SCRIPT";
  if (/<\?php\b/.test(t)) return "ACTIVE_PHP";
  if (/<!doctype\s+html|<\s*html\b/.test(t)) return "ACTIVE_HTML";
  if (/^\s*#!\s*\//.test(t)) return "ACTIVE_SHEBANG";
  if (/javascript:\s*[^\s]/.test(t)) return "ACTIVE_JS_URI";
  return null;
}

const IMG_SUBTYPE: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

function extMatchesType(ext: string, type: EvidenceType, detectedMime: string | null): boolean {
  const e = (ext ?? "").replace(/^\./, "").toLowerCase();
  if (!e) return true; // pas d'extension → on ne bloque pas là-dessus
  const imageExts = ["png", "jpg", "jpeg", "webp"];
  const textExts = ["txt", "log", "json", "err", "error", "ndjson", "text", "md", "csv"];
  if (type === "image") return imageExts.includes(e) && (!detectedMime || detectedMime === (IMG_SUBTYPE[e === "jpg" ? "jpeg" : e] ?? detectedMime));
  return textExts.includes(e);
}

function classifyText(raw: RawEvidence, text: string): EvidenceType {
  const name = (raw.name ?? "").toLowerCase();
  const trimmed = text.trimStart();
  if (raw.declaredMime === "application/json" || name.endsWith(".json") || name.endsWith(".ndjson") || (trimmed.startsWith("{") || trimmed.startsWith("["))) return "json";
  if (raw.origin === "error" || name.endsWith(".err") || name.endsWith(".error")) return "error";
  if (raw.origin === "log" || name.endsWith(".log")) return "log";
  return "text";
}

function reject(raw: RawEvidence, state: ValidatedEvidence["state"], code: string, detectedMime: string | null = null): ValidatedEvidence {
  return {
    id: raw.id, origin: raw.origin, safeName: redactText(raw.name ?? "").slice(0, 120), declaredMime: raw.declaredMime,
    detectedMime, extension: raw.extension, bytes: raw.bytes, hash: "", type: "unknown",
    width: null, height: null, route: getRouteEntry(raw.route ?? "") ? raw.route ?? null : null,
    viewport: raw.viewport ?? null, tenantScoped: raw.tenantScoped ?? null,
    state, refusalReason: code, providerNeeded: false,
  };
}

export interface ValidateOptions {
  readonly maxBytes?: number;
}

/** Valide une preuve. Ne throw jamais. Renvoie un état + une raison de refus honnête. */
export function validateEvidence(raw: RawEvidence, opts: ValidateOptions = {}): ValidatedEvidence {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_EVIDENCE_BYTES;
  const hasContent = raw.content instanceof Uint8Array && raw.content.length > 0;
  const hasText = typeof raw.text === "string" && raw.text.length > 0;

  if (raw.bytes <= 0 || (!hasContent && !hasText)) return reject(raw, "invalid", "EMPTY");
  if (raw.bytes > maxBytes) return reject(raw, "invalid", "TOO_LARGE");

  const route = getRouteEntry(raw.route ?? "") ? raw.route ?? null : null;
  const base = {
    id: raw.id, origin: raw.origin, safeName: redactText(raw.name ?? "").slice(0, 120), declaredMime: raw.declaredMime,
    extension: raw.extension, bytes: raw.bytes, route, viewport: raw.viewport ?? null, tenantScoped: raw.tenantScoped ?? null,
    state: "valid" as const, refusalReason: null as string | null,
  };

  // ── Contenu binaire fourni ────────────────────────────────────────────────
  if (hasContent) {
    const content = raw.content!;
    const active = detectActiveOrUnsupportedBinary(content);
    if (active) return reject(raw, active.kind === "security" ? "security_refusal" : "unsupported", active.code);

    const img = sanitizeImageBuffer(content);
    if (img.ok) {
      const detectedMime = IMG_SUBTYPE[img.format] ?? null;
      // MIME mensonger : un MIME déclaré incompatible avec le format réel détecté.
      const declared = (raw.declaredMime ?? "").toLowerCase();
      if (declared && detectedMime && declared.startsWith("image/") && declared !== detectedMime) return reject(raw, "invalid", "MIME_MISMATCH", detectedMime);
      if (declared && !declared.startsWith("image/")) return reject(raw, "invalid", "MIME_MISMATCH", detectedMime);
      if (!extMatchesType(raw.extension, "image", detectedMime)) return reject(raw, "invalid", "EXTENSION_MISMATCH", detectedMime);
      return { ...base, detectedMime, hash: `ev_${contentHash(Buffer.from(content).toString("base64"))}`, type: "image", width: img.width, height: img.height, providerNeeded: true };
    }
    // Pas une image : raisons dures d'abord.
    if (img.reason === "too_large") return reject(raw, "invalid", "TOO_LARGE");
    if (img.reason === "decompression_bomb") return reject(raw, "invalid", "DECOMPRESSION_BOMB");
    if (img.reason === "parse_error" && (raw.declaredMime ?? "").startsWith("image/")) return reject(raw, "invalid", "CORRUPT_IMAGE");

    // Sinon : tenter un décodage texte sûr.
    const decoded = decodeSafeText(content);
    if (decoded === null) return reject(raw, "unsupported", "UNDETERMINABLE_BINARY");
    // MIME mensonger : déclaré image mais le contenu n'est pas une image (décodé en texte).
    if ((raw.declaredMime ?? "").toLowerCase().startsWith("image/")) return reject(raw, "invalid", "MIME_MISMATCH");
    const activeText = detectActiveText(decoded);
    if (activeText) return reject(raw, "security_refusal", activeText);
    const type = classifyText(raw, decoded);
    if (!extMatchesType(raw.extension, type, null)) return reject(raw, "invalid", "EXTENSION_MISMATCH");
    return { ...base, detectedMime: type === "json" ? "application/json" : "text/plain", hash: `ev_${contentHash(decoded)}`, type, width: null, height: null, providerNeeded: false };
  }

  // ── Texte déjà extrait fourni ─────────────────────────────────────────────
  const text = raw.text!;
  const activeText = detectActiveText(text);
  if (activeText) return reject(raw, "security_refusal", activeText);
  const declared = (raw.declaredMime ?? "").toLowerCase();
  if (declared.startsWith("image/")) return reject(raw, "invalid", "MIME_MISMATCH"); // déclaré image mais texte fourni
  const type = classifyText(raw, text);
  if (!extMatchesType(raw.extension, type, null)) return reject(raw, "invalid", "EXTENSION_MISMATCH");
  return { ...base, detectedMime: type === "json" ? "application/json" : "text/plain", hash: `ev_${contentHash(text)}`, type, width: null, height: null, providerNeeded: false };
}
