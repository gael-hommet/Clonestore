// src/lib/cloneos/ai/utils.ts
// CloneOS AI Runtime — Pure utility functions. No Supabase, no Next, no async.

import type {
  CloneAIMessage,
  CloneAIJsonSchemaField,
  CloneAIUsage,
  CloneAIValidationResult,
} from "./types";

// ── Token estimation ──────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

export function estimateTokensFromText(text: string): number {
  if (typeof text !== "string" || text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function estimateCloneAIUsage(input: string, output: string): CloneAIUsage {
  const inputTokens = estimateTokensFromText(typeof input === "string" ? input : "");
  const outputTokens = estimateTokensFromText(typeof output === "string" ? output : "");
  return {
    input_tokens_estimated: inputTokens,
    output_tokens_estimated: outputTokens,
    total_tokens_estimated: inputTokens + outputTokens,
  };
}

// ── Safe trimming ─────────────────────────────────────────────────────────────

export function safeTrimForPrompt(value: unknown, maxChars: number): string {
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (value === null || value === undefined) {
    return "";
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }
  const max = typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0 ? maxChars : 2000;
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

// ── Template rendering ────────────────────────────────────────────────────────

const TEMPLATE_VAR_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

export function renderPromptTemplate(
  template: string,
  variables: Record<string, unknown>,
): string {
  if (typeof template !== "string") return "";
  const safeVars: Record<string, unknown> = variables && typeof variables === "object" && !Array.isArray(variables) ? variables : {};
  return template.replace(TEMPLATE_VAR_RE, (_match, key: string) => {
    const val = safeVars[key];
    if (val === undefined || val === null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    try { return JSON.stringify(val); } catch { return String(val); }
  });
}

// ── Output sanitization ───────────────────────────────────────────────────────

export function sanitizeAITextOutput(text: unknown, maxChars?: number): string {
  if (typeof text !== "string") return "";
  const max = typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0 ? maxChars : 32000;
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max - 3) + "..." : cleaned;
}

// ── JSON parsing ──────────────────────────────────────────────────────────────

function tryParseJSON(str: string): { value: unknown; ok: boolean } {
  try {
    return { value: JSON.parse(str), ok: true };
  } catch {
    return { value: null, ok: false };
  }
}

function extractFencedJSON(raw: string): string | null {
  // Match ```json ... ``` or ``` ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  return null;
}

function extractBraceBlock(raw: string): string | null {
  // Find first { ... } or [ ... ] block
  const firstBrace = raw.indexOf("{");
  const firstBracket = raw.indexOf("[");
  let start = -1;
  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace <= firstBracket)) {
    start = firstBrace;
  } else if (firstBracket >= 0) {
    start = firstBracket;
  }
  if (start < 0) return null;

  const openChar = raw[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let i = start;
  while (i < raw.length) {
    if (raw[i] === openChar) depth++;
    else if (raw[i] === closeChar) {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
    i++;
  }
  return null;
}

export function parsePossiblyJsonOutput(raw: string): CloneAIValidationResult {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, parsed_json: null, errors: ["Empty output"], warnings: [] };
  }

  const warnings: string[] = [];

  // Attempt 1: direct parse
  const direct = tryParseJSON(raw.trim());
  if (direct.ok) {
    return { ok: true, parsed_json: direct.value, errors: [], warnings };
  }

  // Attempt 2: fenced JSON block
  const fenced = extractFencedJSON(raw);
  if (fenced) {
    const fromFenced = tryParseJSON(fenced);
    if (fromFenced.ok) {
      warnings.push("JSON was wrapped in code fence — extracted successfully.");
      return { ok: true, parsed_json: fromFenced.value, errors: [], warnings };
    }
  }

  // Attempt 3: extract brace/bracket block from surrounding text
  const braceBlock = extractBraceBlock(raw);
  if (braceBlock) {
    const fromBrace = tryParseJSON(braceBlock);
    if (fromBrace.ok) {
      warnings.push("JSON extracted from surrounding text.");
      return { ok: true, parsed_json: fromBrace.value, errors: [], warnings };
    }
  }

  return {
    ok: false,
    parsed_json: null,
    errors: ["Could not parse JSON from output."],
    warnings,
  };
}

// ── Schema validation ─────────────────────────────────────────────────────────

function jsTypeMatchesSchemaType(
  value: unknown,
  schemaType: CloneAIJsonSchemaField["type"],
): boolean {
  if (schemaType === "null") return value === null;
  if (schemaType === "array") return Array.isArray(value);
  if (schemaType === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === schemaType;
}

export function validateJsonAgainstSimpleSchema(
  value: unknown,
  schema?: Record<string, CloneAIJsonSchemaField>,
): CloneAIValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schema || Object.keys(schema).length === 0) {
    warnings.push("No schema provided — skipping validation.");
    return { ok: true, parsed_json: value, errors, warnings };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      parsed_json: value,
      errors: ["Expected JSON object at root level."],
      warnings,
    };
  }

  const obj = value as Record<string, unknown>;

  for (const [key, fieldDef] of Object.entries(schema)) {
    const fieldVal = obj[key];

    if (fieldDef.required && (fieldVal === undefined || fieldVal === null)) {
      errors.push(`Required field "${key}" is missing or null.`);
      continue;
    }

    if (fieldVal !== undefined && fieldVal !== null) {
      if (!jsTypeMatchesSchemaType(fieldVal, fieldDef.type)) {
        warnings.push(`Field "${key}" expected type "${fieldDef.type}" but got "${typeof fieldVal}".`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    parsed_json: value,
    errors,
    warnings,
  };
}

// ── Message hash ──────────────────────────────────────────────────────────────

export function buildCloneAIMessageHash(messages: CloneAIMessage[]): string {
  if (!Array.isArray(messages) || messages.length === 0) return "empty:0";
  // Simple deterministic hash: concatenate role+content length and first chars
  let h = 0;
  const combined = messages
    .map((m) => `${m.role}:${typeof m.content === "string" ? m.content : ""}`)
    .join("|");
  for (let i = 0; i < combined.length; i++) {
    h = (Math.imul(31, h) + combined.charCodeAt(i)) | 0;
  }
  // Return as unsigned hex
  return `h${(h >>> 0).toString(16)}:${messages.length}`;
}
