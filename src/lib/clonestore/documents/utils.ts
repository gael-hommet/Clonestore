// src/lib/clonestore/documents/utils.ts
// Pure utility functions for the CloneStore document system — Bloc 27
// No async, no side effects, no Next.js, no Supabase. No throw.

import type { CloneDocumentRiskLevel, CloneDocumentValidationMode } from "./types";

// ── Type guards ───────────────────────────────────────────────────────────────

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── Document type normalization ───────────────────────────────────────────────

export function normalizeDocumentType(value: unknown): string {
  if (typeof value !== "string") return "generic_hr_document";
  const trimmed = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return trimmed.length > 0 ? trimmed : "generic_hr_document";
}

// ── Variable key normalization ────────────────────────────────────────────────

export function normalizeDocumentVariableKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// ── Safe text extraction ──────────────────────────────────────────────────────

export function safeDocumentText(value: unknown, maxChars = 50000): string {
  if (typeof value === "string") {
    return value.slice(0, maxChars);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }
  return "";
}

// ── HTML escaping ─────────────────────────────────────────────────────────────

export function escapeHtml(value: unknown): string {
  const s = safeDocumentText(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Variable interpolation ────────────────────────────────────────────────────

export function renderDocumentVariables(
  content: string,
  variables: Record<string, unknown>,
): string {
  if (!content) return "";

  return content.replace(/\{\{(\w+)\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const normalKey = normalizeDocumentVariableKey(key);

    // Try exact match first, then normalized
    const val =
      variables[rawKey] !== undefined
        ? variables[rawKey]
        : variables[key] !== undefined
        ? variables[key]
        : variables[normalKey] !== undefined
        ? variables[normalKey]
        : undefined;

    if (val === undefined || val === null) {
      return `{{${rawKey}}}`;
    }

    if (typeof val === "boolean") return val ? "Oui" : "Non";
    if (typeof val === "number") return String(val);
    if (typeof val === "string") return val;
    return String(val);
  });
}

// ── Variable key extraction ───────────────────────────────────────────────────

export function extractDocumentVariableKeys(content: string): string[] {
  if (!content) return [];
  const matches = content.match(/\{\{(\w+)\}\}/g) ?? [];
  const keys = matches
    .map((m) => m.replace(/^\{\{/, "").replace(/\}\}$/, ""))
    .filter(Boolean);
  return [...new Set(keys)];
}

// ── Color normalization ───────────────────────────────────────────────────────

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return trimmed;
  return fallback;
}

// ── Variable merging ──────────────────────────────────────────────────────────

export function mergeDocumentVariables(
  base: Record<string, unknown>,
  override?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!isPlainObject(base)) return isPlainObject(override) ? { ...override } : {};
  if (!isPlainObject(override)) return { ...base };
  return { ...base, ...override };
}

// ── Quality score clamping ────────────────────────────────────────────────────

export function clampDocumentQualityScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ── Risk level hierarchy ──────────────────────────────────────────────────────

const RISK_ORDER: Record<CloneDocumentRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function getHighestDocumentRiskLevel(
  risks: CloneDocumentRiskLevel[],
): CloneDocumentRiskLevel {
  if (!Array.isArray(risks) || risks.length === 0) return "low";
  let highest: CloneDocumentRiskLevel = "low";
  for (const r of risks) {
    if (
      r === "low" || r === "medium" || r === "high" || r === "critical"
    ) {
      if (RISK_ORDER[r] > RISK_ORDER[highest]) {
        highest = r;
      }
    }
  }
  return highest;
}

// ── Human validation requirement ──────────────────────────────────────────────

export function requiresHumanValidationForDocument(params: {
  risk_level: CloneDocumentRiskLevel;
  validation_mode: CloneDocumentValidationMode;
  missing_required_variables: number;
  critical_issues: number;
}): boolean {
  if (params.validation_mode === "human_only") return true;
  if (params.validation_mode === "required") return true;
  if (params.risk_level === "critical") return true;
  if (params.risk_level === "high") return true;
  if (params.critical_issues > 0) return true;
  if (params.missing_required_variables > 2) return true;
  return false;
}
