// src/lib/security/headers.ts
// B41 — Security headers for sensitive API responses. Pure.

export type SecurityHeadersOptions = {
  no_store?: boolean;
  no_index?: boolean;
  json_content_type?: boolean;
};

export const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function buildSecurityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options.no_store !== false) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private";
    headers["Pragma"] = "no-cache";
  }

  headers["X-Content-Type-Options"] = "nosniff";
  headers["Referrer-Policy"] = "no-referrer";
  headers["X-Frame-Options"] = "DENY";
  headers["X-XSS-Protection"] = "0";

  if (options.no_index !== false) {
    headers["X-Robots-Tag"] = "noindex, nofollow";
  }

  if (options.json_content_type !== false) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }

  return headers;
}

export function applyNoStoreHeaders(
  existingHeaders: Record<string, string> = {},
): Record<string, string> {
  return {
    ...existingHeaders,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export function ensureJsonNoCache(): Record<string, string> {
  return buildSecurityHeaders({ no_store: true, no_index: true, json_content_type: true });
}

// ── Next.js Response helper ───────────────────────────────────────────────────

export function applySecurityHeadersToInit(
  init: ResponseInit = {},
): ResponseInit {
  const headers = new Headers(init.headers);
  const secHeaders = buildSecurityHeaders();
  for (const [key, value] of Object.entries(secHeaders)) {
    headers.set(key, value);
  }
  return { ...init, headers };
}
