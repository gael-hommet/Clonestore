// Phase E.3 — liens absolus et jetons de désinscription pour les emails fondateur.
// Le jeton de désinscription est un HMAC déterministe (stable, non devinable) ;
// il n'expire pas et ne révèle aucune donnée. Aucun secret n'est exposé côté client.

import { createHmac, timingSafeEqual } from "node:crypto";

/** URL publique de l'app pour construire des liens absolus dans les emails. */
export function publicAppUrl(): string {
  const raw = process.env.CLONESTORE_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://clonestore.pro";
  return raw.replace(/\/+$/, "");
}

function linkSecret(): string | null {
  return process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET
    ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET
    ?? null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Jeton de désinscription pour une réservation (HMAC stable). null si non configuré. */
export function unsubscribeToken(reservationId: string): string | null {
  const secret = linkSecret();
  if (!secret) return null;
  return b64url(createHmac("sha256", secret).update("unsub:" + reservationId).digest());
}

export function verifyUnsubscribeToken(reservationId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = unsubscribeToken(reservationId);
  if (!expected) return false;
  const a = Buffer.from(token), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lien de désinscription absolu (ou null si non configuré). */
export function unsubscribeUrl(reservationId: string): string | null {
  const token = unsubscribeToken(reservationId);
  if (!token) return null;
  return `${publicAppUrl()}/api/founder-access/unsubscribe?rid=${encodeURIComponent(reservationId)}&token=${encodeURIComponent(token)}`;
}

/** Lien d'activation absolu (la page d'activation valide ensuite l'éligibilité). */
export function activationUrl(reservationId: string): string {
  return `${publicAppUrl()}/activate/pierre?rid=${encodeURIComponent(reservationId)}`;
}
