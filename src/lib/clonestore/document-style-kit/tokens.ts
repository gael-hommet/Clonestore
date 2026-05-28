// B45 — Document Style Kit token system
// Token format: {{variable_name}}
// Pure: no async, no Supabase, no Next.js, no side effects.

import { sanitizeTokenValue, escapeHtml } from "./sanitize";

const TOKEN_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

// ── Extract tokens ────────────────────────────────────────────────────────────

export function extractTemplateTokens(template: string): string[] {
  if (typeof template !== "string") return [];
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(template)) !== null) {
    found.add(match[1]);
  }
  TOKEN_REGEX.lastIndex = 0;
  return Array.from(found);
}

// ── Resolve tokens ────────────────────────────────────────────────────────────

export function resolveTemplateTokens(
  template: string,
  variables: Record<string, unknown>,
  options?: { escapeValues?: boolean },
): string {
  if (typeof template !== "string") return "";
  const escape = options?.escapeValues ?? false;
  TOKEN_REGEX.lastIndex = 0;
  return template.replace(TOKEN_REGEX, (_match, key: string) => {
    const val = variables[key];
    if (val === undefined || val === null) return _match; // leave unresolved
    const sanitized = sanitizeTokenValue(val);
    return escape ? escapeHtml(sanitized) : sanitized;
  });
}

// ── Resolve tokens with HTML escaping (for HTML rendering) ───────────────────

export function resolveTemplateTokensHtml(
  template: string,
  variables: Record<string, unknown>,
): string {
  return resolveTemplateTokens(template, variables, { escapeValues: true });
}

// ── Find missing variables ────────────────────────────────────────────────────

export function findMissingVariables(
  requiredVariables: string[],
  variables: Record<string, unknown>,
): string[] {
  if (!Array.isArray(requiredVariables)) return [];
  return requiredVariables.filter((key) => {
    const val = variables[key];
    if (val === undefined || val === null) return true;
    if (typeof val === "string" && val.trim().length === 0) return true;
    return false;
  });
}

// ── Find unresolved tokens in rendered text ───────────────────────────────────

export function findUnresolvedTokens(rendered: string): string[] {
  if (typeof rendered !== "string") return [];
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(rendered)) !== null) {
    found.add(match[0]);
  }
  TOKEN_REGEX.lastIndex = 0;
  return Array.from(found);
}

// ── Assert no ugly placeholders ───────────────────────────────────────────────

const UGLY_BRACKET_PATTERN = /\[[A-ZÀ-Ü][^\]]{0,59}\]/;

export function assertNoUglyPlaceholders(text: string): string | null {
  if (typeof text !== "string") return null;
  const match = text.match(UGLY_BRACKET_PATTERN);
  return match ? match[0] : null;
}

// ── Build a variables map from multiple sources ───────────────────────────────

export function mergeVariables(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (result[key] === undefined && value !== undefined && value !== null) {
        result[key] = value;
      }
    }
  }
  return result;
}

// ── Format a token key to a human-readable label ─────────────────────────────

export function tokenKeyToLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
