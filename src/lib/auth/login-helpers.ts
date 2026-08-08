// src/lib/auth/login-helpers.ts
// B31.6 — Pure redirect validation helpers for auth flows. No side effects.

import { getDefaultPostLoginPath } from "./redirects";

export function isSafeRelativeRedirect(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  // Must start with / followed by a non-/ character (blocks protocol-relative //evil.com)
  if (!/^\/[^/]/.test(trimmed)) return false;
  // Reject anything with a protocol scheme (http:, https:, data:, javascript:, etc.)
  if (/[a-z][a-z0-9+\-.]*:/i.test(trimmed)) return false;
  return true;
}

export function sanitizeAuthRedirect(value: string | null | undefined): string | null {
  if (!isSafeRelativeRedirect(value)) return null;
  return (value as string).trim();
}

export function resolvePostLoginRedirect(value: string | null | undefined): string {
  const safe = sanitizeAuthRedirect(value);
  return safe ?? getDefaultPostLoginPath();
}

/**
 * Résout la destination post-login depuis la query string de /login.
 * Le middleware (garde d'accès primaire) redirige avec `?next=` ; d'anciens appels utilisent
 * `?redirect=`. On accepte les DEUX (next prioritaire) — sinon un utilisateur renvoyé de
 * /cockpit vers /login?next=/cockpit atterrissait sur le défaut au lieu de sa destination.
 * L'anti-open-redirect (isSafeRelativeRedirect) reste appliqué à la valeur choisie.
 */
export function resolvePostLoginTarget(search: string | URLSearchParams | null | undefined): string {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search)
      : search instanceof URLSearchParams
        ? search
        : new URLSearchParams();
  return resolvePostLoginRedirect(params.get("next") ?? params.get("redirect"));
}
