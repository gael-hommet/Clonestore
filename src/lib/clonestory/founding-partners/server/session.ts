// CloneStory — session membre + cookie d'attribution de branche (SERVER-ONLY).
// Réutilise les primitives HMAC génériques de Phase E (signCookie/verifyCookie).
// Aucun secret en clair : seul un UUID signé transite dans le cookie.

import { signCookie, verifyCookie, readCookie } from "@/lib/founder-access/signed-cookie";
import { sessionSecret } from "./config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Session membre (« Mon Registre ») ────────────────────────────────────────
export const MEMBER_COOKIE = "csy_member";
const MEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function buildMemberCookie(partnerId: string): string {
  const token = signCookie(partnerId, sessionSecret(), MEMBER_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${MEMBER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${MEMBER_TTL_MS / 1000}`;
}

export function clearMemberCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${MEMBER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}

/** Lit l'id de partenaire de la session membre VALIDÉE (ou null). */
export function readMemberSession(cookieHeader: string | null): string | null {
  const raw = readCookie(cookieHeader, MEMBER_COOKIE);
  const value = verifyCookie(raw, sessionSecret());
  return value && UUID_RE.test(value) ? value : null;
}

// ── Jeton de consultation du STATUT d'inscription (page d'attente, polling) ──
// Jeton SIGNÉ porté côté client (sessionStorage), à durée limitée. Ne donne accès
// qu'au STATUT (pending/verified/linked) du partenaire, jamais à sa session ni à sa PII.
const STATUS_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures

export function buildStatusToken(partnerId: string): string {
  return signCookie(partnerId, sessionSecret(), STATUS_TTL_MS);
}
export function readStatusToken(token: string | null): string | null {
  if (!token) return null;
  const value = verifyCookie(token, sessionSecret());
  return value && UUID_RE.test(value) ? value : null;
}

// ── Cookie d'attribution de branche (qui a fait découvrir CloneStory) ────────
// Posé quand un prospect arrive via un lien/code, lu à l'inscription pour
// rattacher introduced_by_partner_id. Aucune PII : seul l'id de l'introducteur signé.
export const REF_COOKIE = "csy_ref";
const REF_TTL_MS = 45 * 24 * 60 * 60 * 1000; // 45 jours

export function buildRefCookie(introducerPartnerId: string): string {
  const token = signCookie(introducerPartnerId, sessionSecret(), REF_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${REF_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${REF_TTL_MS / 1000}`;
}

export function readRefCookie(cookieHeader: string | null): string | null {
  const raw = readCookie(cookieHeader, REF_COOKIE);
  const value = verifyCookie(raw, sessionSecret());
  return value && UUID_RE.test(value) ? value : null;
}
