// src/lib/clonechat/openai/image-sanitizer.ts
// Sanitisation d'image RÉELLE (server-only). Deux couches :
//   1) garde bas-niveau `sanitizeImageBuffer` (toujours) : MAGIC BYTES (PNG/JPEG/WebP, pas le
//      mime déclaré), DIMENSIONS réelles depuis l'en-tête, refus des decompression bombs,
//      SUPPRESSION des métadonnées par filtrage des chunks du conteneur ;
//   2) transformation PIXEL par sharp (P9.4.2 r2 §9, OBLIGATOIRE en production) : décodage réel,
//      normalisation d'orientation, REDIMENSIONNEMENT ≤ TARGET_MAX_DIM, RECOMPRESSION, suppression
//      totale des métadonnées, VALIDATION de sortie. Si sharp est indisponible / échoue → l'image
//      est REFUSÉE (jamais l'originale, jamais un repli métadonnées-seul silencieux). Le repli
//      chunk-strip (sans resize) n'existe que sous le drapeau LOCAL/TEST CLONECHAT_IMAGE_DEGRADED_OK=1.

import { contentHash } from "../knowledge/types";

export interface SanitizeResult {
  readonly ok: boolean;
  readonly format: "png" | "jpeg" | "webp" | "unknown";
  readonly width: number | null;
  readonly height: number | null;
  readonly originalBytes: number;
  readonly sanitizedBytes: number;
  readonly strippedChunks: string[];
  readonly sanitized: Uint8Array | null;
  readonly reason: string | null;
}

const MAX_DIM = 12000;         // refuse les images absurdement grandes (bomb)
const MAX_PIXELS = 40_000_000; // ~40 Mpx
const MAX_BYTES = 4 * 1024 * 1024;

function u32be(b: Uint8Array, o: number): number { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function u16be(b: Uint8Array, o: number): number { return (b[o] << 8) | b[o + 1]; }
function u32le(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

function detect(b: Uint8Array): "png" | "jpeg" | "webp" | "unknown" {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return "unknown";
}

// ── PNG : garde les chunks de rendu, retire tEXt/zTXt/iTXt/eXIf/tIME ─────────
function sanitizePng(b: Uint8Array): { out: Uint8Array; stripped: string[]; w: number | null; h: number | null } | null {
  const stripped: string[] = [];
  const DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME", "iCCP"]); // métadonnées / profils potentiellement identifiants
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let o = 8, w: number | null = null, h: number | null = null;
  while (o + 8 <= b.length) {
    const len = u32be(b, o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    const end = o + 12 + len;
    if (end > b.length) break;
    if (type === "IHDR") { w = u32be(b, o + 8); h = u32be(b, o + 12); }
    if (DROP.has(type)) stripped.push(type);
    else parts.push(b.subarray(o, end));
    o = end;
    if (type === "IEND") break;
  }
  return { out: concat(parts), stripped, w, h };
}

// ── JPEG : retire APP1(EXIF/XMP)/APPn/COM, garde le reste + données d'image ──
function sanitizeJpeg(b: Uint8Array): { out: Uint8Array; stripped: string[]; w: number | null; h: number | null } | null {
  const stripped: string[] = [];
  const parts: Uint8Array[] = [b.subarray(0, 2)]; // SOI
  let o = 2, w: number | null = null, h: number | null = null;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) break;
    const marker = b[o + 1];
    if (marker === 0xd9) { parts.push(b.subarray(o, o + 2)); break; } // EOI
    if (marker === 0xda) { parts.push(b.subarray(o)); break; }        // SOS → copie tout le reste (données) verbatim
    const len = u16be(b, o + 2);
    const seg = b.subarray(o, o + 2 + len);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) { h = u16be(b, o + 5); w = u16be(b, o + 7); }
    const isAppOrCom = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    const keepApp0Jfif = marker === 0xe0; // JFIF de base : inoffensif, on garde
    if (isAppOrCom && !keepApp0Jfif) stripped.push("FFE" + marker.toString(16));
    else parts.push(seg);
    o += 2 + len;
  }
  return { out: concat(parts), stripped, w, h };
}

// ── WebP : retire les chunks EXIF / XMP du conteneur RIFF ────────────────────
function sanitizeWebp(b: Uint8Array): { out: Uint8Array; stripped: string[]; w: number | null; h: number | null } | null {
  const stripped: string[] = [];
  const kept: Uint8Array[] = [];
  let o = 12, w: number | null = null, h: number | null = null;
  while (o + 8 <= b.length) {
    const fourcc = String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    const size = u32le(b, o + 4);
    const padded = size + (size & 1);
    const end = o + 8 + padded;
    if (end > b.length) break;
    if (fourcc === "VP8X" && o + 8 + 10 <= b.length) { w = (u16be(b, o + 8 + 4) | (b[o + 8 + 6] << 16)) + 1; h = (b[o + 8 + 7] | (b[o + 8 + 8] << 8) | (b[o + 8 + 9] << 16)) + 1; }
    if (fourcc === "EXIF" || fourcc === "XMP ") stripped.push(fourcc.trim());
    else kept.push(b.subarray(o, end));
    o = end;
  }
  const body = concat(kept);
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46]); // RIFF
  const total = 4 + body.length;
  header[4] = total & 0xff; header[5] = (total >> 8) & 0xff; header[6] = (total >> 16) & 0xff; header[7] = (total >> 24) & 0xff;
  header.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return { out: concat([header, body]), stripped, w, h };
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Sanitise un buffer image. Vérifie magic bytes, dimensions, bombs, retire les métadonnées. */
export function sanitizeImageBuffer(bytes: Uint8Array): SanitizeResult {
  const format = detect(bytes);
  const base = { format, originalBytes: bytes.length, sanitizedBytes: 0, strippedChunks: [] as string[], sanitized: null as Uint8Array | null, width: null as number | null, height: null as number | null };
  if (format === "unknown") return { ...base, ok: false, reason: "unrecognized_magic_bytes" };
  if (bytes.length > MAX_BYTES) return { ...base, ok: false, reason: "too_large" };
  let r: { out: Uint8Array; stripped: string[]; w: number | null; h: number | null } | null = null;
  try {
    r = format === "png" ? sanitizePng(bytes) : format === "jpeg" ? sanitizeJpeg(bytes) : sanitizeWebp(bytes);
  } catch { return { ...base, ok: false, reason: "parse_error" }; }
  if (!r) return { ...base, ok: false, reason: "parse_error" };
  if (r.w && r.h) {
    if (r.w > MAX_DIM || r.h > MAX_DIM || r.w * r.h > MAX_PIXELS) return { ...base, ok: false, width: r.w, height: r.h, reason: "decompression_bomb" };
  }
  return { format, originalBytes: bytes.length, sanitizedBytes: r.out.length, strippedChunks: r.stripped, sanitized: r.out, width: r.w, height: r.h, ok: true, reason: null };
}

export interface PreparedImages {
  readonly dataUrls: string[];
  readonly meta: Array<{ mime: string; engine: "sharp" | "chunk-strip"; originalBytes: number; sanitizedBytes: number; originalWidth: number | null; originalHeight: number | null; width: number | null; height: number | null; resized: boolean; strippedChunks: string[]; sanitizedHash: string }>;
  readonly rejected: Array<{ reason: string }>;
  readonly report: { count: number; rejectedCount: number; engine: "sharp" | "chunk-strip" | "mixed" | "none" | "rejected"; sharpRequired: boolean; sharpAvailable: boolean; strippedTotal: number; magicVerified: boolean; metadataStripped: boolean; pixelResize: boolean; maxDim: number; note: string };
}

/**
 * PRODUCTION : la transformation PIXEL par sharp est OBLIGATOIRE (décodage / orientation /
 * resize / recompression / suppression métadonnées / validation de sortie). Si sharp est
 * indisponible ou échoue → l'image est REFUSÉE (jamais l'originale, jamais un repli
 * métadonnées-seul silencieux). Un repli chunk-strip (métadonnées uniquement) n'est autorisé
 * QUE sous le drapeau LOCAL/TEST explicite CLONECHAT_IMAGE_DEGRADED_OK=1.
 */
export function imageDegradedAllowed(): boolean {
  return process.env.CLONECHAT_IMAGE_DEGRADED_OK === "1";
}

const MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Dimension max cible pour le modèle (réduit réellement les pixels ⇒ coût minimal). */
export const TARGET_MAX_DIM = 1024;

// Import dynamique de sharp (natif, fourni par la chaîne d'outils ; jamais bundlé client).
// Résolu une fois ; null s'il est indisponible (⇒ repli chunk-strip honnête).
let sharpMod: ((input: Uint8Array, opts?: unknown) => SharpLike) | null | undefined;
async function loadSharp(): Promise<((input: Uint8Array, opts?: unknown) => SharpLike) | null> {
  if (sharpMod === undefined) {
    try { const mod = await import("sharp"); sharpMod = ((mod as { default?: unknown }).default ?? mod) as (input: Uint8Array, opts?: unknown) => SharpLike; }
    catch { sharpMod = null; }
  }
  return sharpMod ?? null;
}
interface SharpLike {
  metadata(): Promise<{ width?: number; height?: number; format?: string }>;
  rotate(): SharpLike;   // applique l'orientation EXIF puis la retire (normalisation)
  resize(o: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }): SharpLike;
  png(o?: { compressionLevel?: number }): SharpLike;
  jpeg(o?: { quality?: number; mozjpeg?: boolean }): SharpLike;
  webp(o?: { quality?: number }): SharpLike;
  toBuffer(): Promise<Buffer>;
}

/**
 * Prépare des data-URLs pour le modèle. Chemin PRINCIPAL (sharp) : décode les pixels,
 * REDIMENSIONNE réellement à TARGET_MAX_DIM, RECOMPRESSE, et retire TOUTES les métadonnées
 * (sharp ne réémet pas l'EXIF par défaut). Repli honnête (sharp indisponible) : chunk-strip
 * de conteneur (P9.4.1) — métadonnées retirées, sans resize pixel.
 */
export async function prepareImagesForModel(dataUrls: readonly string[]): Promise<PreparedImages> {
  const outUrls: string[] = [];
  const meta: PreparedImages["meta"] = [];
  const rejected: Array<{ reason: string }> = [];
  let strippedTotal = 0;
  const engines = new Set<"sharp" | "chunk-strip">();
  const sharp = await loadSharp();
  const degradedOk = imageDegradedAllowed();

  for (const url of dataUrls) {
    const m = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url.trim());
    if (!m) { rejected.push({ reason: "invalid_data_url" }); continue; }
    const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
    // Garde défensive AVANT tout décodage pixel : magic bytes + bombs.
    const pre = sanitizeImageBuffer(bytes);
    if (!pre.ok) { rejected.push({ reason: pre.reason ?? "prevalidation_failed" }); continue; }

    if (sharp) {
      try {
        // Décodage RÉEL + normalisation d'orientation (rotate() applique l'EXIF Orientation
        // puis le supprime) + resize pixel + recompression. sharp ne réémet pas l'EXIF.
        const img = sharp(bytes, { failOn: "none", limitInputPixels: MAX_PIXELS });
        const md = await img.metadata();
        const ow = md.width ?? pre.width ?? null, oh = md.height ?? pre.height ?? null;
        const fmt = (md.format === "jpeg" || md.format === "jpg") ? "jpeg" : md.format === "webp" ? "webp" : "png";
        let pipe = img.rotate().resize({ width: TARGET_MAX_DIM, height: TARGET_MAX_DIM, fit: "inside", withoutEnlargement: true });
        pipe = fmt === "jpeg" ? pipe.jpeg({ quality: 72, mozjpeg: true }) : fmt === "webp" ? pipe.webp({ quality: 72 }) : pipe.png({ compressionLevel: 9 });
        const out = await pipe.toBuffer();
        // VALIDATION DE SORTIE : la sortie doit se re-décoder (dimensions réelles) — sinon refus.
        const outMd = await sharp(out).metadata();
        if (!outMd.width || !outMd.height) { rejected.push({ reason: "output_validation_failed" }); continue; }
        const b64 = out.toString("base64");
        const mime = MIME[fmt];
        outUrls.push(`data:${mime};base64,${b64}`);
        const resized = (ow != null && oh != null) && (ow > TARGET_MAX_DIM || oh > TARGET_MAX_DIM);
        engines.add("sharp");
        meta.push({ mime, engine: "sharp", originalBytes: bytes.length, sanitizedBytes: out.length, originalWidth: ow, originalHeight: oh, width: outMd.width ?? null, height: outMd.height ?? null, resized, strippedChunks: [], sanitizedHash: contentHash(b64) });
        continue;
      } catch {
        // sharp a échoué sur cette image. PRODUCTION : refus (jamais l'originale). Repli
        // chunk-strip UNIQUEMENT sous le drapeau local/test explicite.
        if (!degradedOk) { rejected.push({ reason: "sharp_transform_failed" }); continue; }
      }
    } else if (!degradedOk) {
      // sharp indisponible + pas de mode dégradé → REFUS (pas de dégradation métadonnées-seul).
      rejected.push({ reason: "sharp_unavailable" });
      continue;
    }

    // Repli LOCAL/TEST explicite uniquement : chunk-strip de conteneur (sans resize pixel).
    if (!pre.sanitized) { rejected.push({ reason: "no_sanitized_buffer" }); continue; }
    strippedTotal += pre.strippedChunks.length;
    const b64 = Buffer.from(pre.sanitized).toString("base64");
    const mime = MIME[pre.format] ?? m[1];
    engines.add("chunk-strip");
    outUrls.push(`data:${mime};base64,${b64}`);
    meta.push({ mime, engine: "chunk-strip", originalBytes: pre.originalBytes, sanitizedBytes: pre.sanitizedBytes, originalWidth: pre.width, originalHeight: pre.height, width: pre.width, height: pre.height, resized: false, strippedChunks: pre.strippedChunks, sanitizedHash: contentHash(b64) });
  }

  const engine = outUrls.length === 0 ? (rejected.length ? "rejected" : "none") : engines.size > 1 ? "mixed" : engines.has("sharp") ? "sharp" : "chunk-strip";
  const anyResize = meta.some((x) => x.resized);
  return {
    dataUrls: outUrls, meta, rejected, report: {
      count: outUrls.length, rejectedCount: rejected.length, engine, sharpRequired: !degradedOk, sharpAvailable: !!sharp, strippedTotal, magicVerified: true, metadataStripped: outUrls.length > 0, pixelResize: anyResize, maxDim: TARGET_MAX_DIM,
      note: engine === "rejected"
        ? "Transformation pixel OBLIGATOIRE indisponible (sharp absent/échec) : image(s) REFUSÉE(S) — l'originale n'est jamais envoyée, aucun repli métadonnées-seul en production."
        : engine === "chunk-strip"
        ? "MODE DÉGRADÉ LOCAL/TEST (CLONECHAT_IMAGE_DEGRADED_OK=1) : métadonnées retirées au niveau conteneur, PAS de resize pixel. Interdit en production."
        : `sharp : pixels décodés, orientation normalisée, REDIMENSIONNÉS à ${TARGET_MAX_DIM}px max + RECOMPRESSÉS, TOUTES métadonnées retirées.`,
    },
  };
}
