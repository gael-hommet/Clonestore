// src/lib/cloneos/files/security.ts
// B34 — File security validation. Pure, no async. No trust without explicit allow.

import type { FileRiskLevel, FileSecurityDecision } from "./types";
import type { FileConfig } from "./config";
import {
  isDangerousExtension,
  isArchiveExtension,
  isMimeImageType,
  isMimeOfficeDoc,
  isMimePdf,
  isMimeArchive,
  getExtension,
} from "./mime";

// ── Filename sanitization ─────────────────────────────────────────────────────

export function sanitizeFilename(original: string): string {
  const name = original.trim();

  // Strip path traversal components
  const basename = name.replace(/^.*[\\/]/, "");

  // Keep only safe characters: alphanum, dash, underscore, dot, space
  const safe = basename
    .replace(/[^a-zA-Z0-9._\- ]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "")  // no leading dots/underscores
    .slice(0, 255);  // max 255 chars

  return safe || "document";
}

// ── Individual checks ─────────────────────────────────────────────────────────

type CheckResult = { ok: boolean; error: string | null; warning: string | null };

function checkResult(ok: boolean, error: string | null, warning: string | null = null): CheckResult {
  return { ok, error, warning };
}

export function checkFileNotEmpty(sizeBytes: number): CheckResult {
  if (sizeBytes <= 0) return checkResult(false, "Fichier vide — rejeté.");
  return checkResult(true, null);
}

export function checkFileSize(sizeBytes: number, maxBytes: number): CheckResult {
  if (sizeBytes > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    const fileMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    return checkResult(false, `Fichier trop volumineux (${fileMb} Mo, max ${maxMb} Mo).`);
  }
  if (sizeBytes > maxBytes * 0.8) {
    return checkResult(true, null, `Fichier proche de la limite de taille.`);
  }
  return checkResult(true, null);
}

export function checkExtensionSafe(filename: string, config: FileConfig): CheckResult {
  if (isDangerousExtension(filename)) {
    const ext = getExtension(filename);
    return checkResult(false, `Extension ".${ext}" interdite — fichier exécutable ou dangereux.`);
  }
  if (isArchiveExtension(filename) && !config.allow_archives) {
    const ext = getExtension(filename);
    return checkResult(false, `Extension ".${ext}" non autorisée (archives désactivées).`);
  }
  return checkResult(true, null);
}

export function checkMimeAllowed(mime: string, config: FileConfig): CheckResult {
  if (!config.allow_pdf && isMimePdf(mime)) {
    return checkResult(false, "Les fichiers PDF ne sont pas autorisés (FILE_ALLOW_PDF=false).");
  }
  if (!config.allow_images && isMimeImageType(mime)) {
    return checkResult(false, "Les images ne sont pas autorisées (FILE_ALLOW_IMAGES=false).");
  }
  if (!config.allow_office_docs && isMimeOfficeDoc(mime)) {
    return checkResult(false, "Les documents Office/CSV ne sont pas autorisés (FILE_ALLOW_OFFICE_DOCS=false).");
  }
  if (!config.allow_archives && isMimeArchive(mime)) {
    return checkResult(false, "Les archives ne sont pas autorisées (FILE_ALLOW_ARCHIVES=false).");
  }
  return checkResult(true, null);
}

// ── Sensitive extension heuristic ─────────────────────────────────────────────

const IDENTITY_SENSITIVE_PATTERNS = /passport|cin|carte.identit|identit|id.card|permis.sejour/i;

export function checkFilenameForSensitiveRisk(filename: string): FileRiskLevel {
  if (IDENTITY_SENSITIVE_PATTERNS.test(filename)) return "sensitive";
  return "low";
}

// ── Aggregated security decision ──────────────────────────────────────────────

export function validateFileSecurity(params: {
  filename: string;
  mime_type: string;
  size_bytes: number;
  config: FileConfig;
}): FileSecurityDecision {
  const { filename, mime_type, size_bytes, config } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  const emptyCheck = checkFileNotEmpty(size_bytes);
  if (!emptyCheck.ok && emptyCheck.error) errors.push(emptyCheck.error);

  const sizeCheck = checkFileSize(size_bytes, config.max_upload_bytes);
  if (!sizeCheck.ok && sizeCheck.error) errors.push(sizeCheck.error);
  if (sizeCheck.warning) warnings.push(sizeCheck.warning);

  const extCheck = checkExtensionSafe(filename, config);
  if (!extCheck.ok && extCheck.error) errors.push(extCheck.error);

  const mimeCheck = checkMimeAllowed(mime_type, config);
  if (!mimeCheck.ok && mimeCheck.error) errors.push(mimeCheck.error);

  const risk: FileRiskLevel = errors.length > 0 ? "blocked" : checkFilenameForSensitiveRisk(filename);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    risk_level: risk,
  };
}
