// src/lib/security/redaction.ts
// B41 — Data redaction for audit logs and exports. Pure, no side effects.

import { isSecretFieldName, isPersonalFieldName, isSensitiveFieldName } from "./pii";

// ── Constants ─────────────────────────────────────────────────────────────────

const REDACTED_SECRET = "[REDACTED_SECRET]";
const REDACTED_EMAIL = "[REDACTED_EMAIL]";
const REDACTED_PHONE = "[REDACTED_PHONE]";
const REDACTED_PII = "[REDACTED_PII]";

// Fields whose values are NEVER stored even as redacted references
const NEVER_LOG_FIELDS = new Set([
  "prompt", "completion", "openai_response", "anthropic_response",
  "body_text", "email_body", "email_html", "email_content",
  "document_content", "full_text", "raw_text", "pdf_content",
  "cv_content", "contract_text",
]);

// ── Email redaction ───────────────────────────────────────────────────────────

export function redactEmail(email: string): string {
  if (!email || typeof email !== "string") return REDACTED_EMAIL;
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return REDACTED_EMAIL;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const visibleLocal = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  const domainParts = domain.split(".");
  const tld = domainParts.pop() ?? "";
  const domainVisible = domainParts[0]?.slice(0, 2) ?? "**";
  return `${visibleLocal}***@${domainVisible}***.${tld}`;
}

// ── Phone redaction ───────────────────────────────────────────────────────────

export function redactPhone(phone: string): string {
  if (!phone || typeof phone !== "string") return REDACTED_PHONE;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return REDACTED_PHONE;
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

// ── Generic redaction ─────────────────────────────────────────────────────────

export function redactSecret(_value: unknown): string {
  return REDACTED_SECRET;
}

export function redactString(value: string, fieldName?: string): string {
  if (!value || typeof value !== "string") return REDACTED_PII;
  if (fieldName) {
    if (fieldName.toLowerCase().includes("email")) return redactEmail(value);
    if (fieldName.toLowerCase().includes("phone") || fieldName.toLowerCase().includes("tel")) {
      return redactPhone(value);
    }
  }
  if (value.includes("@")) return redactEmail(value);
  return REDACTED_PII;
}

// ── Deep object redaction ─────────────────────────────────────────────────────

export function redactObjectDeep(
  obj: unknown,
  depth = 0,
): unknown {
  if (depth > 10) return "[REDACTED_DEPTH]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObjectDeep(item, depth + 1));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lkey = key.toLowerCase();

      if (NEVER_LOG_FIELDS.has(lkey)) {
        result[key] = "[CONTENT_NOT_LOGGED]";
      } else if (isSecretFieldName(key)) {
        result[key] = REDACTED_SECRET;
      } else if (lkey.includes("email") && typeof value === "string") {
        result[key] = redactEmail(value);
      } else if ((lkey.includes("phone") || lkey.includes("tel")) && typeof value === "string") {
        result[key] = redactPhone(value);
      } else if (isPersonalFieldName(key) && typeof value === "string") {
        result[key] = REDACTED_PII;
      } else if (typeof value === "object" && value !== null) {
        result[key] = redactObjectDeep(value, depth + 1);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

// ── Audit helpers ─────────────────────────────────────────────────────────────

export function hashForAudit(value: string): string {
  // Deterministic pseudo-hash for audit correlation without storing PII.
  // Not cryptographic — for audit correlation only.
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const unsigned = hash >>> 0;
  return `h_${unsigned.toString(16).padStart(8, "0")}`;
}

export function safeJsonForAudit(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const cleaned = redactObjectDeep(obj) as Record<string, unknown>;
  // Remove top-level never-log fields explicitly
  for (const field of NEVER_LOG_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}

// ── Sensitive field check for export ─────────────────────────────────────────

export function shouldRedactField(fieldName: string): boolean {
  return isSecretFieldName(fieldName) || NEVER_LOG_FIELDS.has(fieldName.toLowerCase());
}

export function redactExportRecord(
  record: Record<string, unknown>,
  preserveFields: string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (preserveFields.includes(key)) {
      result[key] = value;
    } else if (NEVER_LOG_FIELDS.has(key.toLowerCase())) {
      result[key] = "[CONTENT_NOT_EXPORTED]";
    } else if (isSecretFieldName(key)) {
      result[key] = REDACTED_SECRET;
    } else if (key.toLowerCase().includes("email") && typeof value === "string" && value.includes("@")) {
      result[key] = redactEmail(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
