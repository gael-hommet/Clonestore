// BLOC 3 — Validation pure côté serveur (alignée LeadForge db9b166).
//
// Refuse toute donnée hors allowlist contractuelle. La validation est
// exécutée AU MOINS sur le serveur ; les routes publiques n'acceptent jamais
// le bearer client comme parole d'évangile.

import {
  CHECKOUT_METADATA_ADDITIONAL_ALLOWED,
  CHECKOUT_METADATA_FIELDS,
  CLIENT_ALLOWED_EVENT_TYPES,
  ContactKind,
  CONTACT_KINDS,
  DIAGNOSTIC_FORBIDDEN_INPUT_KEYS,
  DIAGNOSTIC_QUESTION_IDS,
  EVENT_METADATA_ALLOWED,
  EVENT_METADATA_FORBIDDEN,
  EVENT_TYPES,
  EventType,
  ORGANIC_VARIANT_ID,
  SERVER_ONLY_EVENT_TYPES,
  VARIANT_IDS,
  VariantId,
} from "./contract";

export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Type guards ─────────────────────────────────────────────────────────────
export function isVariantId(value: unknown): value is VariantId | typeof ORGANIC_VARIANT_ID {
  if (typeof value !== "string") return false;
  return value === ORGANIC_VARIANT_ID || (VARIANT_IDS as readonly string[]).includes(value);
}

export function isContactKind(value: unknown): value is ContactKind {
  return typeof value === "string" && (CONTACT_KINDS as readonly string[]).includes(value);
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}

/** Événements client autorisés à passer par `/api/conversion/events`. */
export function isClientAcceptedEvent(eventType: string): eventType is EventType {
  return (
    isEventType(eventType) &&
    CLIENT_ALLOWED_EVENT_TYPES.has(eventType) &&
    !SERVER_ONLY_EVENT_TYPES.has(eventType)
  );
}

// ── Diagnostic ─────────────────────────────────────────────────────────────
const ALLOWED_DIAG_KEYS = new Set<string>(DIAGNOSTIC_QUESTION_IDS);
const FORBIDDEN_DIAG_KEYS = new Set<string>(DIAGNOSTIC_FORBIDDEN_INPUT_KEYS);

export interface DiagnosticPayloadCheck {
  ok: boolean;
  errors: readonly string[];
  cleaned: Record<string, string | number | boolean | null>;
}

export function sanitizeDiagnosticAnswers(input: unknown): DiagnosticPayloadCheck {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["diagnostic.invalid_payload"], cleaned: {} };
  }
  const cleaned: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = String(rawKey).trim().slice(0, 80);
    const keyLow = key.toLowerCase();
    if (FORBIDDEN_DIAG_KEYS.has(key) || FORBIDDEN_DIAG_KEYS.has(keyLow)) {
      errors.push(`diagnostic.forbidden_input:${key}`);
      continue;
    }
    if (!ALLOWED_DIAG_KEYS.has(key)) continue; // ignore silencieusement
    if (rawValue === null || rawValue === undefined) {
      cleaned[key] = null;
      continue;
    }
    if (typeof rawValue === "boolean") {
      cleaned[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      cleaned[key] = Math.max(0, Math.min(100_000, Math.round(rawValue)));
      continue;
    }
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim().slice(0, 200);
      if (looksLikeSensitive(trimmed)) {
        errors.push(`diagnostic.looks_sensitive:${key}`);
        continue;
      }
      cleaned[key] = trimmed;
      continue;
    }
    errors.push(`diagnostic.invalid_value:${key}`);
  }
  return { ok: errors.length === 0, errors, cleaned };
}

const SENSITIVE_PATTERNS: RegExp[] = [
  /@/, // email
  /\b\d{9,}\b/, // siren/longs numéros
  /\bsalaire\b/i,
  /\bsalary\b/i,
  /\bmaladie\b/i,
  /\bhandicap\b/i,
];

function looksLikeSensitive(value: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(value));
}

// ── Metadata Checkout — allowlist LeadForge + ajouts CloneStore ────────────
const ALLOWED_CHECKOUT_KEYS = new Set<string>([
  ...CHECKOUT_METADATA_FIELDS,
  ...CHECKOUT_METADATA_ADDITIONAL_ALLOWED,
]);
const FORBIDDEN_CHECKOUT_PATTERNS: readonly RegExp[] = [
  /^token$/i,
  /secret/i,
  /password/i,
  /^email$/i,
  /^siren$/i,
  /authorization/i,
];

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
    if (!ALLOWED_CHECKOUT_KEYS.has(key)) {
      errors.push(`metadata.forbidden_key:${key}`);
      continue;
    }
    if (FORBIDDEN_CHECKOUT_PATTERNS.some((re) => re.test(key))) {
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
    // Le `prospect_token` accepté en metadata doit être réduit au token_id seul.
    if (key === "prospect_token" && v.includes(".")) {
      cleaned[key] = v.split(".", 1)[0];
      continue;
    }
    cleaned[key] = v;
  }
  return { ok: errors.length === 0, errors, cleaned };
}

// ── Event metadata — allowlist LeadForge stricte ───────────────────────────
const ALLOWED_EVENT_META = new Set<string>(EVENT_METADATA_ALLOWED);
const FORBIDDEN_EVENT_META = new Set<string>(EVENT_METADATA_FORBIDDEN);

export interface EventMetadataCheck {
  ok: boolean;
  cleaned: Record<string, string | number | boolean | null>;
  rejected: readonly string[];
}

export function cleanEventMetadata(input: unknown): EventMetadataCheck {
  const rejected: string[] = [];
  const cleaned: Record<string, string | number | boolean | null> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: true, cleaned, rejected };
  }
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = String(rawKey).trim();
    if (key.length === 0 || key.length > 32) continue;
    if (FORBIDDEN_EVENT_META.has(key.toLowerCase())) {
      rejected.push(key);
      continue;
    }
    if (!ALLOWED_EVENT_META.has(key)) continue; // silencieusement ignoré
    if (rawValue === null || rawValue === undefined) {
      cleaned[key] = null;
      continue;
    }
    if (typeof rawValue === "boolean") {
      cleaned[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      cleaned[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "string") {
      const v = rawValue.slice(0, 120);
      // Defense in depth : refuse PII-like même sur clés allowlistées.
      if (/[@]|\b\d{9,}\b/.test(v)) {
        rejected.push(key);
        continue;
      }
      cleaned[key] = v;
      continue;
    }
    rejected.push(key);
  }
  return { ok: true, cleaned, rejected };
}

// ── Idempotency key ─────────────────────────────────────────────────────────
const IDEMPOTENCY_RE = /^[A-Za-z0-9_\-:.]{8,80}$/;

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_RE.test(value);
}
