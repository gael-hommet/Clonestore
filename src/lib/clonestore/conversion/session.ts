// BLOC 3 — Conversion session (cookie signé serveur, identifiant opaque).
//
// Cookie : cs_conversion_session = signCookie(sessionId, secret, ttl)
// Le cookie ne contient JAMAIS de PII, de token complet, d'email, de SIREN.
// Le navigateur ne reçoit qu'un identifiant UUID v4 + sa signature HMAC.
// La session complète (variante, grant, cohort) vit côté serveur.

import { signCookie, verifyCookie, readCookie } from "@/lib/founder-access/signed-cookie";
import { UUID_V4_RE } from "./validation";
import { ORGANIC_VARIANT_ID, FUNNEL_VERSION } from "./contract";
import type { ConversionSession, ConversionStage } from "./types";

export const CONVERSION_SESSION_COOKIE = "cs_conversion_session";
const CONVERSION_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function conversionSessionSecret(): string {
  return (
    process.env.CLONESTORE_CONVERSION_SESSION_SECRET ??
    process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET ??
    "clonestore-dev-conversion-session-secret"
  );
}

export function isConversionSessionSecretConfigured(): boolean {
  return Boolean(
    process.env.CLONESTORE_CONVERSION_SESSION_SECRET ??
      process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET,
  );
}

/** Construit le Set-Cookie pour une session de conversion. */
export function buildConversionSessionCookie(sessionId: string): string {
  const token = signCookie(sessionId, conversionSessionSecret(), CONVERSION_SESSION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${CONVERSION_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${CONVERSION_SESSION_TTL_MS / 1000}`;
}

/** En-tête Set-Cookie effaçant le cookie (logout / rotation). */
export function clearConversionSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${CONVERSION_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}

/** Lit l'identifiant de session VALIDÉ depuis le cookie. */
export function readConversionSessionId(cookieHeader: string | null): string | null {
  const raw = readCookie(cookieHeader, CONVERSION_SESSION_COOKIE);
  const value = verifyCookie(raw, conversionSessionSecret());
  return value && UUID_V4_RE.test(value) ? value : null;
}

/** Génère un identifiant de session (UUID v4 — node:crypto disponible globalement). */
export function newConversionSessionId(): string {
  return globalThis.crypto.randomUUID();
}

/** Session "organique" — visiteur sans token, jamais d'attribution inventée. */
export function buildOrganicSession(now: Date = new Date()): ConversionSession {
  return {
    id: newConversionSessionId(),
    grantId: null,
    variant: ORGANIC_VARIANT_ID,
    campaign: null,
    cohort: null,
    contactKind: null,
    funnelVersion: FUNNEL_VERSION,
    stage: "landed",
    userId: null,
    tenantId: null,
    orderId: null,
    diagnosticDraftKey: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONVERSION_SESSION_TTL_MS).toISOString(),
  };
}

export function advanceStage(current: ConversionStage, next: ConversionStage): ConversionStage {
  // Une session ne régresse jamais. checkout_completed prime sur tout sauf onboarding/activated.
  const order: ConversionStage[] = [
    "landed",
    "demo_seen",
    "diagnostic_in_progress",
    "diagnostic_completed",
    "checkout_pending",
    "checkout_completed",
    "onboarding",
    "activated",
    "expired",
  ];
  const currentIdx = order.indexOf(current);
  const nextIdx = order.indexOf(next);
  if (nextIdx < 0 || currentIdx < 0) return current;
  return nextIdx > currentIdx ? next : current;
}
