// src/lib/clonechat/openai/image-sanitizer.ts
// P9.4.1 — Sanitisation d'image RÉELLE (server-only, sans dépendance lourde). Ce qui est
// RÉELLEMENT fait (prouvé par test) :
//   • vérification des MAGIC BYTES (PNG/JPEG/WebP) — pas juste le mime déclaré ;
//   • lecture des DIMENSIONS réelles depuis l'en-tête ;
//   • refus des decompression bombs (dimensions / pixels / octets plafonnés) ;
//   • SUPPRESSION des métadonnées (EXIF/GPS/XMP/commentaires/texte) par filtrage des
//     chunks du conteneur — l'image envoyée au modèle N'A PLUS d'EXIF.
// Ce qui n'est HONNÊTEMENT pas fait ici : le redimensionnement / recompression au niveau
// PIXEL (nécessiterait un codec/dépendance native). Le coût est maîtrisé autrement :
// detail:"low" (sous-échantillonnage côté OpenAI) + plafond d'octets strict. Documenté.

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
  readonly meta: Array<{ mime: string; originalBytes: number; sanitizedBytes: number; width: number | null; height: number | null; strippedChunks: string[]; sanitizedHash: string }>;
  readonly report: { count: number; strippedTotal: number; magicVerified: boolean; metadataStripped: boolean; pixelResize: false; note: string };
}

const MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Prépare des data-URLs pour le modèle : décodage, sanitisation, ré-encodage sûr. */
export async function prepareImagesForModel(dataUrls: readonly string[]): Promise<PreparedImages> {
  const outUrls: string[] = [];
  const meta: PreparedImages["meta"] = [];
  let strippedTotal = 0;
  for (const url of dataUrls) {
    const m = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url.trim());
    if (!m) continue;
    const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
    const s = sanitizeImageBuffer(bytes);
    if (!s.ok || !s.sanitized) continue; // rejet silencieux — l'appelant a déjà validé mime/taille
    strippedTotal += s.strippedChunks.length;
    const b64 = Buffer.from(s.sanitized).toString("base64");
    const mime = MIME[s.format] ?? m[1];
    outUrls.push(`data:${mime};base64,${b64}`);
    meta.push({ mime, originalBytes: s.originalBytes, sanitizedBytes: s.sanitizedBytes, width: s.width, height: s.height, strippedChunks: s.strippedChunks, sanitizedHash: contentHash(b64) });
  }
  return {
    dataUrls: outUrls,
    meta,
    report: { count: outUrls.length, strippedTotal, magicVerified: true, metadataStripped: true, pixelResize: false, note: "Métadonnées EXIF/GPS/XMP retirées au niveau conteneur ; magic bytes vérifiés ; bombs refusées. Le redimensionnement pixel n'est pas effectué localement (pas de codec) — coût maîtrisé par detail:low + plafond d'octets." },
  };
}
