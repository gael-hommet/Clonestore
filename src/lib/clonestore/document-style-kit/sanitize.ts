// B45 — Document Style Kit sanitize utilities
// Pure: no async, no Supabase, no Next.js, no side effects.

// ── HTML escaping ─────────────────────────────────────────────────────────────

export function escapeHtml(value: unknown): string {
  const s = typeof value === "string" ? value : String(value ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Strip unsafe HTML ─────────────────────────────────────────────────────────

const UNSAFE_TAG_PATTERN = /<\s*(script|iframe|object|embed|form|input|button|select|textarea|link|base|meta|style)\b[^>]*>/gi;
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=/gi;
const JAVASCRIPT_PROTOCOL_PATTERN = /href\s*=\s*["']?\s*javascript:/gi;
const DATA_PROTOCOL_PATTERN = /href\s*=\s*["']?\s*data:/gi;
const SCRIPT_CLOSE_PATTERN = /<\/\s*script\s*>/gi;

export function stripUnsafeHtml(html: string): string {
  if (typeof html !== "string") return "";
  return html
    .replace(UNSAFE_TAG_PATTERN, "")
    .replace(SCRIPT_CLOSE_PATTERN, "")
    .replace(EVENT_HANDLER_PATTERN, "data-removed=")
    .replace(JAVASCRIPT_PROTOCOL_PATTERN, "href=\"#\"")
    .replace(DATA_PROTOCOL_PATTERN, "href=\"#\"");
}

// ── Sanitize plain text ───────────────────────────────────────────────────────

export function sanitizeHtmlText(value: unknown, maxLength = 5000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

// ── Sanitize token value ──────────────────────────────────────────────────────

export function sanitizeTokenValue(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const s = String(value).trim().slice(0, maxLength);
  // Strip any HTML tags from token values
  return s.replace(/<[^>]+>/g, "");
}

// ── Normalize hex color ───────────────────────────────────────────────────────

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const HEX_SHORT_PATTERN = /^#[0-9A-Fa-f]{3}$/;

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (HEX_PATTERN.test(trimmed)) return trimmed.toUpperCase();
  if (HEX_SHORT_PATTERN.test(trimmed)) {
    // Expand short hex
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

// ── Sanitize style kit input ──────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

// Strip tenant spoofing fields that must never come from client body
const TENANT_SPOOFING_FIELDS = ["user_id", "company_id", "organization_id", "tenant_id", "id"];

export function stripTenantSpoofingFields<T extends Record<string, unknown>>(
  obj: T,
): Omit<T, "user_id" | "company_id" | "organization_id" | "tenant_id" | "id"> {
  const result = { ...obj };
  for (const field of TENANT_SPOOFING_FIELDS) {
    delete result[field];
  }
  return result as Omit<T, "user_id" | "company_id" | "organization_id" | "tenant_id" | "id">;
}

export function sanitizeStyleKitInput(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) return {};
  const stripped = stripTenantSpoofingFields(raw as Record<string, unknown>);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(stripped)) {
    if (isString(value)) {
      result[key] = value.trim().slice(0, 2000);
    } else if (isNumber(value)) {
      result[key] = value;
    } else if (typeof value === "boolean") {
      result[key] = value;
    } else if (isObject(value)) {
      result[key] = sanitizeStyleKitInput(value);
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 200);
    } else {
      result[key] = null;
    }
  }
  return result;
}

// ── Detect forbidden patterns in rendered output ──────────────────────────────

export function containsScriptTag(html: string): boolean {
  return /<script\b/i.test(html);
}

export function containsEventHandler(html: string): boolean {
  return /\bon\w+\s*=/i.test(html);
}

export function containsForbiddenPhrase(text: string, phrases: string[]): string | null {
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

export function containsUglyPlaceholder(text: string): string | null {
  // Matches [Votre nom], [À compléter], [insérer], etc.
  const bracketPattern = /\[[^\]]{1,60}\]/;
  const match = text.match(bracketPattern);
  return match ? match[0] : null;
}

export function containsUnresolvedToken(text: string): string | null {
  // Matches {{anything}}
  const tokenPattern = /\{\{[^}]+\}\}/;
  const match = text.match(tokenPattern);
  return match ? match[0] : null;
}
