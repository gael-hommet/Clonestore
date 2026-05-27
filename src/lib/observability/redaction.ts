// B43 — Observability redaction: strips secrets from metadata/errors

// ── Forbidden keys (never log raw) ───────────────────────────────────────────

export const FORBIDDEN_SECRET_KEYS = new Set([
  "api_key",
  "apikey",
  "api-key",
  "authorization",
  "bearer",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "password",
  "passwd",
  "resend_api_key",
  "openai_api_key",
  "anthropic_api_key",
  "supabase_key",
  "service_role_key",
]);

export const FORBIDDEN_CONTENT_KEYS = new Set([
  "prompt",
  "completion",
  "body_html",
  "body_text",
  "document_raw",
  "document_content",
  "document_html",
  "document_text",
  "file_content",
  "payslip_raw",
  "email_body",
  "email_html",
  "raw_input",
  "generated_document_text",
  "generated_document_html",
  "openai_response",
  "ai_response",
]);

const ALL_FORBIDDEN_KEYS = new Set([...FORBIDDEN_SECRET_KEYS, ...FORBIDDEN_CONTENT_KEYS]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, "_");
}

function isForbiddenKey(key: string): boolean {
  const k = normalizeKey(key);
  return ALL_FORBIDDEN_KEYS.has(k) || FORBIDDEN_SECRET_KEYS.has(k) || FORBIDDEN_CONTENT_KEYS.has(k);
}

// ── Strip sensitive keys from an object ───────────────────────────────────────

export function stripSensitiveKeys(
  obj: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 5) return { _truncated: true };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isForbiddenKey(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = stripSensitiveKeys(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripSensitiveKeys(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ── Check if object or string contains a forbidden leak ───────────────────────

export function containsForbiddenSecretLeak(input: unknown): boolean {
  if (typeof input === "string") {
    const lower = input.toLowerCase();
    // OpenAI key pattern: sk-
    if (/sk-[a-zA-Z0-9]{20,}/.test(input)) return true;
    // Anthropic key pattern: sk-ant-
    if (/sk-ant-[a-zA-Z0-9]{10,}/.test(input)) return true;
    // Generic API key pattern
    if (/api[_-]?key\s*[:=]\s*\S+/i.test(input)) return true;
    return false;
  }
  if (typeof input === "object" && input !== null) {
    return Object.entries(input as Record<string, unknown>).some(([k, v]) => {
      if (isForbiddenKey(k) && typeof v === "string" && v !== "[REDACTED]") return true;
      return containsForbiddenSecretLeak(v);
    });
  }
  return false;
}

// ── Redact metadata for observable events ────────────────────────────────────

export function redactObservabilityMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  return stripSensitiveKeys(meta);
}

// ── Redact error message ──────────────────────────────────────────────────────

export function redactErrorMessage(message: string): string {
  if (!message) return message;
  // Remove OpenAI/Anthropic API keys
  let out = message.replace(/sk-[a-zA-Z0-9-]{20,}/g, "[REDACTED_KEY]");
  out = out.replace(/sk-ant-[a-zA-Z0-9-]{10,}/g, "[REDACTED_KEY]");
  // Remove email-like API key patterns
  out = out.replace(/api[_-]?key\s*[:=]\s*\S+/gi, "api_key=[REDACTED]");
  // Remove Bearer tokens
  out = out.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]");
  return out;
}

// ── Redact stack trace ────────────────────────────────────────────────────────

export function redactStackTrace(stack: string | undefined): string {
  if (!stack) return "[no stack]";
  // Keep structure but remove file paths that might reveal system info
  const lines = stack.split("\n").slice(0, 8);
  return lines
    .map((line) => {
      // Keep the function name info, remove absolute paths
      return line.replace(/\(.*?([^/\\]+\.[jt]s:\d+:\d+)\)/g, "($1)");
    })
    .join("\n") + (stack.split("\n").length > 8 ? "\n  ... (truncated)" : "");
}
