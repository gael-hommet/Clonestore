// src/lib/cloneos/files/config.ts
// B34 — FILE_RUNTIME_MODE + env config. Pure, no async.

import type { FileRuntimeMode } from "./types";

const VALID_MODES: FileRuntimeMode[] = ["mock", "disabled", "local", "production"];

export function getFileRuntimeMode(): FileRuntimeMode {
  const raw = process.env.FILE_RUNTIME_MODE ?? "";
  const mode = raw.trim().toLowerCase() as FileRuntimeMode;
  return VALID_MODES.includes(mode) ? mode : "mock";
}

export function isFileMockMode(): boolean {
  return getFileRuntimeMode() === "mock";
}

export function isFileDisabled(): boolean {
  return getFileRuntimeMode() === "disabled";
}

export function isFileProductionMode(): boolean {
  return getFileRuntimeMode() === "production";
}

export function isFileLocalMode(): boolean {
  return getFileRuntimeMode() === "local";
}

// ── Config shape ──────────────────────────────────────────────────────────────

export type FileConfig = {
  runtime_mode: FileRuntimeMode;
  max_upload_bytes: number;
  text_preview_chars: number;
  log_extracted_text: boolean;
  allow_images: boolean;
  allow_office_docs: boolean;
  allow_pdf: boolean;
  allow_archives: boolean;
  storage_bucket: string;
};

function parseMb(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n * 1024 * 1024 : fallback * 1024 * 1024;
}

function parseInt10(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export function getFileConfig(): FileConfig {
  return {
    runtime_mode: getFileRuntimeMode(),
    max_upload_bytes: parseMb(process.env.FILE_MAX_UPLOAD_MB, 25),
    text_preview_chars: parseInt10(process.env.FILE_TEXT_PREVIEW_CHARS, 4000),
    log_extracted_text: parseBool(process.env.FILE_LOG_EXTRACTED_TEXT, false),
    allow_images: parseBool(process.env.FILE_ALLOW_IMAGES, true),
    allow_office_docs: parseBool(process.env.FILE_ALLOW_OFFICE_DOCS, true),
    allow_pdf: parseBool(process.env.FILE_ALLOW_PDF, true),
    allow_archives: parseBool(process.env.FILE_ALLOW_ARCHIVES, false),
    storage_bucket: process.env.FILE_STORAGE_BUCKET ?? "pierre-documents",
  };
}
