// src/lib/pierre/v1/file-mime.ts
// PHASE 8.3 / 8.3-B — real MIME detection from magic bytes + whitelist + size
// limits + content screening (executables, HTML, active SVG, Office macros,
// archives, zip bombs). DOCX is validated by a real ZIP central-directory parse.

import { inspectDocx } from "./zip-inspect";

export type DetectedMime = { mime: string; extension: string };

const PK = (b: Buffer) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PNG = "image/png";
const JPEG = "image/jpeg";
const GIF = "image/gif";
const ZIP = "application/zip";
const OCTET = "application/octet-stream";

export function detectMime(bytes: Buffer): DetectedMime {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: PDF, extension: "pdf" };
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: PNG, extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: JPEG, extension: "jpg" };
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return { mime: GIF, extension: "gif" };
  if (PK(bytes)) {
    // ZIP container — real OOXML validation (central directory parse), not a string match.
    const insp = inspectDocx(bytes);
    if (insp.isDocx && insp.ok) return { mime: DOCX, extension: "docx" };
    return { mime: ZIP, extension: "zip" };
  }
  return { mime: OCTET, extension: "bin" };
}

export const SIZE_LIMITS_MB = { image: 15, pdf: 50, docx: 30, default: 10 };
export function maxSizeBytesFor(mime: string): number {
  const envMax = Number(process.env.FILE_MAX_SIZE_MB ?? "0");
  let mb: number;
  if (mime === PDF) mb = SIZE_LIMITS_MB.pdf;
  else if (mime === DOCX) mb = SIZE_LIMITS_MB.docx;
  else if (mime.startsWith("image/")) mb = SIZE_LIMITS_MB.image;
  else mb = SIZE_LIMITS_MB.default;
  if (envMax > 0) mb = Math.min(mb, envMax);
  return mb * 1024 * 1024;
}

/** Declared MIME types a tenant may upload. */
export const MIME_WHITELIST = new Set<string>([PDF, DOCX, PNG, JPEG, GIF]);
export function isWhitelisted(mime: string): boolean { return MIME_WHITELIST.has(mime); }

/** Canonical extension derived from the VALIDATED mime (never trust the filename). */
export function extensionForMime(mime: string): string {
  switch (mime) {
    case PDF: return "pdf"; case DOCX: return "docx"; case PNG: return "png"; case JPEG: return "jpg"; case GIF: return "gif"; default: return "bin";
  }
}

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
const EXEC_EXT = /\.(exe|bat|cmd|com|scr|msi|js|jse|vbs|vbe|ps1|sh|jar|dll|lnk|reg|wsf|hta)(\.|$)/i;
/** Reject reserved names, trailing dots, and executable (double) extensions. */
export function isDangerousFilename(name: string): boolean {
  const n = (name ?? "").trim();
  if (!n) return false;
  if (WIN_RESERVED.test(n)) return true;
  if (/[.\s]$/.test(n)) return true; // trailing dot/space (Windows strips → masquerade)
  if (EXEC_EXT.test(n)) return true;
  if (/[‮​‎‏]/.test(n)) return true; // bidi/zero-width trickery
  return false;
}

/** Reject double extensions / executables masquerading as documents. */
export function safeFilename(name: string): { safe: string; extension: string } {
  const base = (name || "file").replace(/[/\\]/g, "_").replace(/[^A-Za-z0-9._-]/g, "_").replace(/_{2,}/g, "_").slice(0, 120);
  const parts = base.split(".");
  const extension = parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  return { safe: base, extension };
}

/** Content screening beyond magic bytes. Returns a verdict used by the scan layer. */
export function screenContent(bytes: Buffer, detected: DetectedMime): { ok: boolean; reason?: string } {
  // Executables.
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return { ok: false, reason: "windows_executable" };
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return { ok: false, reason: "elf_executable" };
  const head = bytes.subarray(0, 2).toString("latin1");
  if (head === "#!") return { ok: false, reason: "script_shebang" };
  // HTML / active SVG sneaking in as a document.
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096)).toString("latin1").toLowerCase();
  if (detected.mime === OCTET && (sample.includes("<html") || sample.includes("<!doctype html"))) return { ok: false, reason: "html_content" };
  if (sample.includes("<svg") && sample.includes("<script")) return { ok: false, reason: "active_svg" };
  // ZIP containers: real inspection (macros, zip bombs, path traversal, invalid OOXML).
  if (PK(bytes)) {
    const insp = inspectDocx(bytes);
    if (insp.reason === "office_macro") return { ok: false, reason: "office_macro" };
    if (insp.reason && (insp.reason.startsWith("zip_bomb") || insp.reason === "path_traversal_entry" || insp.reason === "too_many_entries" || insp.reason === "entry_too_large")) return { ok: false, reason: insp.reason };
    if (!insp.isDocx || !insp.ok) return { ok: false, reason: insp.reason ?? "archive_not_allowed" };
  }
  return { ok: true };
}
