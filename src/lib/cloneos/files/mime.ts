// src/lib/cloneos/files/mime.ts
// B34 — MIME type detection, extension validation, FileKind mapping. Pure.

import type { FileKind } from "./types";

// ── MIME → FileKind ───────────────────────────────────────────────────────────

const MIME_TO_KIND: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xlsx",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/plain": "text",
  "text/markdown": "text",
  "text/html": "text",
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/tiff": "image",
  "image/bmp": "image",
  "image/svg+xml": "image",
  "message/rfc822": "email_attachment",
  "application/octet-stream": "unknown",
};

const EXT_TO_KIND: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "docx",
  doc: "doc",
  xlsx: "xlsx",
  xls: "xlsx",
  csv: "csv",
  txt: "text",
  text: "text",
  md: "text",
  markdown: "text",
  rtf: "text",
  html: "text",
  htm: "text",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  tiff: "image",
  tif: "image",
  bmp: "image",
  svg: "image",
  eml: "email_attachment",
  msg: "email_attachment",
};

// Extensions that must never be accepted regardless of config
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "dll", "scr", "pif", "vbs", "vbe",
  "js", "jse", "wsf", "wsh", "ps1", "ps2", "psm1", "psd1", "sh", "bash",
  "zsh", "csh", "fish", "jar", "class", "py", "rb", "pl", "php",
  "cpl", "hta", "inf", "reg", "sys", "drv", "ocx", "msc", "lnk",
]);

// Extensions considered archives (blocked unless FILE_ALLOW_ARCHIVES=true)
const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "rar", "7z", "bz2", "xz", "tgz"]);

export function getExtension(filename: string): string {
  const parts = filename.trim().split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function isDangerousExtension(filename: string): boolean {
  return DANGEROUS_EXTENSIONS.has(getExtension(filename));
}

export function isArchiveExtension(filename: string): boolean {
  return ARCHIVE_EXTENSIONS.has(getExtension(filename));
}

export function detectFileKindFromMime(mime: string): FileKind {
  const normalized = mime.trim().toLowerCase();
  if (MIME_TO_KIND[normalized]) return MIME_TO_KIND[normalized];
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("text/")) return "text";
  return "unknown";
}

export function detectFileKindFromExtension(filename: string): FileKind {
  const ext = getExtension(filename);
  return EXT_TO_KIND[ext] ?? "unknown";
}

export function detectFileKind(filename: string, mime?: string | null): FileKind {
  if (mime) {
    const fromMime = detectFileKindFromMime(mime);
    if (fromMime !== "unknown") return fromMime;
  }
  return detectFileKindFromExtension(filename);
}

export function guessMimeType(filename: string): string {
  const ext = getExtension(filename);
  const reverse: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    eml: "message/rfc822",
  };
  return reverse[ext] ?? "application/octet-stream";
}

export function isMimeImageType(mime: string): boolean {
  return mime.trim().toLowerCase().startsWith("image/");
}

export function isMimeOfficeDoc(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  return (
    m.includes("wordprocessingml") ||
    m.includes("spreadsheetml") ||
    m.includes("msword") ||
    m.includes("ms-excel") ||
    m === "text/csv" ||
    m === "application/csv" ||
    m === "application/rtf" ||
    m === "text/rtf"
  );
}

export function isMimePdf(mime: string): boolean {
  return mime.trim().toLowerCase() === "application/pdf";
}

export function isMimeArchive(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  return (
    m === "application/zip" ||
    m === "application/x-rar-compressed" ||
    m === "application/x-tar" ||
    m === "application/gzip" ||
    m === "application/x-7z-compressed"
  );
}
