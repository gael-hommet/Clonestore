// src/lib/pierre/cockpit/auth-helpers.ts
// Pure auth-failure detection helpers — no React, no Next, no async.
// Used by usePierreCockpit and testable without a browser.

/**
 * Returns true when the combination of HTTP status + error message indicates
 * the session is missing or expired (not just a regular API error).
 */
export function isAuthFailure(
  status: number,
  error: string | null | undefined,
): boolean {
  if (status === 401) return true;
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("auth session missing") ||
    lower.includes("unauthorized") ||
    lower.includes("no session") ||
    lower.includes("not authenticated")
  );
}
