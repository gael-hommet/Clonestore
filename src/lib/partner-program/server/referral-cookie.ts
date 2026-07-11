// Programme partenaires — cookie d'attribution signé (HMAC). Ne porte QU'un touch_key ;
// la vérité (partenaire, expiration, source) reste en base. On ne fait jamais confiance à
// la seule valeur du cookie. Réutilise la primitive signed-cookie de founder-access.

import { signCookie, verifyCookie, readCookie } from "@/lib/founder-access/signed-cookie";

const COOKIE_NAME = "cs_pp_ref";
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // aligné sur la fenêtre d'attribution max

function secret(): string | null {
  return process.env.CLONESTORE_PP_COOKIE_SECRET ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET ?? null;
}

/** Construit l'en-tête Set-Cookie porteur du touch_key (ou null si secret absent). */
export function buildReferralCookie(touchKey: string): string | null {
  const s = secret();
  if (!s) return null;
  const value = signCookie(touchKey, s, TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${Math.floor(TTL_MS / 1000)}; HttpOnly; SameSite=Lax;${secure}`;
}

/** Lit le touch_key depuis l'en-tête Cookie (null si absent/invalide/expiré). */
export function readReferralTouchKey(cookieHeader: string | null): string | null {
  const s = secret();
  if (!s) return null;
  const raw = readCookie(cookieHeader ?? "", COOKIE_NAME);
  if (!raw) return null;
  return verifyCookie(raw, s);
}

export const REFERRAL_COOKIE_NAME = COOKIE_NAME;
