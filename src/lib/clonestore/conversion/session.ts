// BLOC 3 — Conversion session cookie (signé HMAC serveur).
//
// Le cookie ne contient JAMAIS de PII, JAMAIS le token complet, JAMAIS
// d'email/SIREN. Seulement un identifiant UUID v4 + sa signature HMAC.
// La session complète (variante, grant, cohort) vit côté serveur.

import { signCookie, verifyCookie, readCookie } from "@/lib/founder-access/signed-cookie";
import { UUID_V4_RE } from "./validation";

export const CONVERSION_SESSION_COOKIE = "cs_conversion_session";
const CONVERSION_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function conversionSessionSecret(): string {
  return (
    process.env.CLONESTORE_CONVERSION_SESSION_SECRET ??
    process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET ??
    "clonestore-bloc3-dev-session-secret"
  );
}

export function isConversionSessionSecretConfigured(): boolean {
  return Boolean(
    process.env.CLONESTORE_CONVERSION_SESSION_SECRET ??
      process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET,
  );
}

export function buildConversionSessionCookie(sessionId: string): string {
  const token = signCookie(sessionId, conversionSessionSecret(), CONVERSION_SESSION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${CONVERSION_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${CONVERSION_SESSION_TTL_MS / 1000}`;
}

export function clearConversionSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${CONVERSION_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}

export function readConversionSessionId(cookieHeader: string | null): string | null {
  const raw = readCookie(cookieHeader, CONVERSION_SESSION_COOKIE);
  const value = verifyCookie(raw, conversionSessionSecret());
  return value && UUID_V4_RE.test(value) ? value : null;
}
