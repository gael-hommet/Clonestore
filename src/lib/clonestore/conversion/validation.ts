// BLOC 3 — Validation pure côté serveur (jamais de confiance au navigateur).
import {
  CHECKOUT_METADATA_KEYS,
  CLIENT_ALLOWED_EVENT_IDS,
  CohortId,
  COHORT_IDS,
  CONTACT_KINDS,
  ContactKind,
  DIAGNOSTIC_FORBIDDEN_FIELDS,
  DIAGNOSTIC_QUESTIONS,
  EVENT_IDS,
  EventId,
  FORBIDDEN_METADATA_PATTERNS,
  ORGANIC_VARIANT_ID,
  SERVER_ONLY_EVENT_IDS,
  VARIANT_IDS,
  VariantId,
} from "./contract";

export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVariantId(value: unknown): value is VariantId | typeof ORGANIC_VARIANT_ID {
  if (typeof value !== "string") return false;
  return value === ORGANIC_VARIANT_ID || (VARIANT_IDS as readonly string[]).includes(value);
}

export function isCohortId(value: unknown): value is CohortId {
  return typeof value === "string" && (COHORT_IDS as readonly string[]).includes(value);
}

export function isContactKind(value: unknown): value is ContactKind {
  return typeof value === "string" && (CONTACT_KINDS as readonly string[]).includes(value);
}

export function isEventId(value: unknown): value is EventId {
  return typeof value === "string" && (EVENT_IDS as readonly string[]).includes(value);
}

export function isClientAcceptedEvent(eventId: string): eventId is EventId {
  return isEventId(eventId) && CLIENT_ALLOWED_EVENT_IDS.has(eventId) && !SERVER_ONLY_EVENT_IDS.has(eventId);
}

// ── Diagnostic ──────────────────────────────────────────────────────────────
const ALLOWED_QUESTION_IDS = new Set(DIAGNOSTIC_QUESTIONS.map((q) => q.id));
const FORBIDDEN_FIELD_SET = new Set<string>(DIAGNOSTIC_FORBIDDEN_FIELDS);

export interface DiagnosticPayloadCheck {
  ok: boolean;
  errors: readonly string[];
  cleaned: Record<string, string | number | string[] | null>;
}

export function sanitizeDiagnosticAnswers(input: unknown): DiagnosticPayloadCheck {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["diagnostic.invalid_payload"], cleaned: {} };
  }
  const cleaned: Record<string, string | number | string[] | null> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = String(rawKey).trim().toLowerCase().slice(0, 64);
    if (FORBIDDEN_FIELD_SET.has(key)) {
      errors.push(`diagnostic.forbidden_field:${key}`);
      continue;
    }
    if (!ALLOWED_QUESTION_IDS.has(key)) continue; // ignorer silencieusement les inconnus
    if (rawValue === null || rawValue === undefined) {
      cleaned[key] = null;
      continue;
    }
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim().slice(0, 80);
      if (looksLikeSensitive(trimmed)) {
        errors.push(`diagnostic.looks_sensitive:${key}`);
        continue;
      }
      cleaned[key] = trimmed;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      cleaned[key] = clampNumber(rawValue);
      continue;
    }
    if (Array.isArray(rawValue)) {
      const arr = (rawValue as unknown[])
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().slice(0, 40))
        .filter((v) => v.length > 0 && !looksLikeSensitive(v))
        .slice(0, 12);
      cleaned[key] = arr;
      continue;
    }
    errors.push(`diagnostic.invalid_value:${key}`);
  }
  return { ok: errors.length === 0, errors, cleaned };
}

const SENSITIVE_PATTERNS: RegExp[] = [
  /@/, // email
  /\b\d{9,}\b/, // siren / numéros longs
  /\bsalaire\b/i,
  /\bsalary\b/i,
  /\bmaladie\b/i,
  /\bhandicap\b/i,
];

function looksLikeSensitive(value: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(value));
}

function clampNumber(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100_000) return 100_000;
  return Math.round(n * 100) / 100;
}

// ── Metadata Checkout ───────────────────────────────────────────────────────
const ALLOWED_METADATA_SET = new Set<string>(CHECKOUT_METADATA_KEYS);

export interface CheckoutMetadataCheck {
  ok: boolean;
  errors: readonly string[];
  cleaned: Record<string, string>;
}

export function sanitizeCheckoutMetadata(input: unknown): CheckoutMetadataCheck {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["metadata.invalid_payload"], cleaned: {} };
  }
  const cleaned: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = String(rawKey).trim();
    if (key.length === 0 || key.length > 40) continue;
    if (!ALLOWED_METADATA_SET.has(key)) {
      errors.push(`metadata.forbidden_key:${key}`);
      continue;
    }
    if (FORBIDDEN_METADATA_PATTERNS.some((re) => re.test(key))) {
      errors.push(`metadata.forbidden_pattern:${key}`);
      continue;
    }
    if (typeof rawValue !== "string") {
      errors.push(`metadata.non_string:${key}`);
      continue;
    }
    const v = rawValue.trim().slice(0, 200);
    if (v.length === 0) continue;
    if (/[\r\n\t]/.test(v)) {
      errors.push(`metadata.control_chars:${key}`);
      continue;
    }
    cleaned[key] = v;
  }
  return { ok: errors.length === 0, errors, cleaned };
}

// ── Idempotency key ─────────────────────────────────────────────────────────
const IDEMPOTENCY_RE = /^[A-Za-z0-9_\-:.]{8,80}$/;

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_RE.test(value);
}
