// Phase E — Founder Access : tokens de vérification (jamais stockés en clair).
// node:crypto — utilisé uniquement côté serveur (routes / jobs).

import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";

export const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// E-R2 §6 — Token de vérification DÉTERMINISTE (HMAC). Reconstruit par le serveur à
// chaque retry à partir de (reservation_id, version) — JAMAIS stocké en clair en base.
// Un dump de la base seul ne permet pas de reconstruire le token (le secret est hors base).
// Un resend explicite incrémente la version → l'ancien lien devient invalide.
function tokenSecret(): string | null {
  const configured = process.env.CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET
    ?? process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET
    ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET;
  if (configured) return configured;
  // §7 — fail-closed en production : aucun secret faible par défaut.
  if (process.env.NODE_ENV === "production") return null;
  return "clonestore-dev-token-secret"; // dev/test uniquement
}

/** Calcule le token déterministe. Lève en production si aucun secret réel n'est configuré. */
export function deterministicVerificationToken(reservationId: string, version: number): string {
  const secret = tokenSecret();
  if (!secret) throw new Error("CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET manquant : tokens de vérification impossibles en production.");
  const mac = createHmac("sha256", secret).update(`v${version}:${reservationId}`).digest();
  return mac.toString("base64url");
}

/** Indique si un vrai secret de token est configuré (sinon fallback dev). */
export function isTokenSecretConfigured(): boolean {
  return Boolean(
    process.env.CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET
    ?? process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET
    ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET,
  );
}

export interface IssuedToken {
  /** Token en clair — envoyé UNIQUEMENT par email, jamais persisté. */
  token: string;
  /** Hash SHA-256 à stocker en base. */
  hash: string;
  /** Expiration ISO. */
  expiresAt: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(String(token), "utf8").digest("hex");
}

export function issueVerificationToken(now: Date = new Date(), ttlMs = VERIFICATION_TTL_MS): IssuedToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(now.getTime() + ttlMs).toISOString() };
}

/** Comparaison à temps constant du hash fourni vs le hash stocké. */
export function verifyTokenHash(providedToken: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashToken(providedToken), "hex");
  const b = Buffer.from(String(storedHash), "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  return Number.isNaN(t) || now.getTime() > t;
}
