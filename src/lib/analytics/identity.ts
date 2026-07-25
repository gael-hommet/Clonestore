// Analytics Identity Contract v1 — visitor_id / session_id serveur-signés.
// Réutilise le pattern HMAC-cookie déjà éprouvé (founder-access/signed-cookie.ts,
// clonestore/conversion/session.ts), secret dédié, jamais partagé avec les identités existantes.
// Voir audit-20260723-full/ANALYTICS_IDENTITY_CONTRACT.md.

import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

interface SignedIdentityPayload {
  v: string;
  exp: number;
}

function signIdentity(value: string, secret: string, ttlMs: number): string {
  const payload: SignedIdentityPayload = { v: value, exp: Date.now() + ttlMs };
  const json = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = b64url(createHmac("sha256", secret).update(json).digest());
  return `${json}.${mac}`;
}

function verifyIdentity(token: string | null | undefined, secret: string): string | null {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const json = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = b64url(createHmac("sha256", secret).update(json).digest());
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(json).toString("utf8")) as SignedIdentityPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return typeof payload.v === "string" ? payload.v : null;
  } catch {
    return null;
  }
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function randomUuidV4(): string {
  return globalThis.crypto.randomUUID();
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function identitySecret(): string {
  return (
    process.env.CLONESTORE_ANALYTICS_SESSION_SECRET ??
    "clonestore-dev-analytics-identity-secret"
  );
}

// ── visitor_id ───────────────────────────────────────────────────────────────
export const VISITOR_COOKIE = "cs_visitor_id";
// Durée test/par défaut, conservatrice — la durée de production reste une décision propriétaire/
// juridique en attente (voir ANALYTICS_PRIVACY_AND_RETENTION_MATRIX.md), jamais choisie ici.
export const VISITOR_COOKIE_MAX_AGE_DAYS = Number(process.env.ANALYTICS_VISITOR_COOKIE_DAYS ?? 90);
const VISITOR_TTL_MS = VISITOR_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export interface ResolvedVisitor {
  visitorId: string;
  setCookie: string | null; // null si le cookie existant était déjà valide (rien à réémettre)
}

export function resolveVisitorId(cookieHeader: string | null): ResolvedVisitor {
  const raw = readCookie(cookieHeader, VISITOR_COOKIE);
  const existing = verifyIdentity(raw, identitySecret());
  if (existing && UUID_V4_RE.test(existing)) {
    return { visitorId: existing, setCookie: null };
  }
  const visitorId = randomUuidV4();
  const token = signIdentity(visitorId, identitySecret(), VISITOR_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  const setCookie = `${VISITOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${Math.floor(VISITOR_TTL_MS / 1000)}`;
  return { visitorId, setCookie };
}

// ── session_id ───────────────────────────────────────────────────────────────
export const SESSION_COOKIE = "cs_session_id";
// 30 minutes : aucune règle canonique préexistante trouvée dans le code lu ; valeur standard du
// secteur retenue par défaut, documentée comme telle (ANALYTICS_IDENTITY_CONTRACT.md).
const SESSION_TTL_MS = 30 * 60 * 1000;

export interface ResolvedSession {
  sessionId: string;
  isNewSession: boolean;
  setCookie: string;
}

export function resolveSessionId(cookieHeader: string | null): ResolvedSession {
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  const existing = verifyIdentity(raw, identitySecret());
  const sessionId = existing && UUID_V4_RE.test(existing) ? existing : randomUuidV4();
  const isNewSession = !existing;
  // Toujours réémis (rotation glissante à chaque requête) pour repousser l'expiration tant que
  // l'utilisateur est actif — une session inactive ≥ 30 min expire naturellement (cookie non
  // renouvelé par le navigateur au-delà de son Max-Age).
  const token = signIdentity(sessionId, identitySecret(), SESSION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  const setCookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  return { sessionId, isNewSession, setCookie };
}

// ── Résolveurs LECTURE SEULE (corrélation serveur) ───────────────────────────
// Retournent l'identité EXISTANTE signée dans le cookie, ou null si absente/falsifiée —
// ne génèrent JAMAIS une nouvelle identité. Indispensable pour corréler un événement serveur
// au visiteur/session D'ORIGINE (celui qui a fait la démo) plutôt qu'à un id fraîchement créé.
export function readVisitorId(cookieHeader: string | null): string | null {
  const existing = verifyIdentity(readCookie(cookieHeader, VISITOR_COOKIE), identitySecret());
  return existing && UUID_V4_RE.test(existing) ? existing : null;
}

export function readSessionId(cookieHeader: string | null): string | null {
  const existing = verifyIdentity(readCookie(cookieHeader, SESSION_COOKIE), identitySecret());
  return existing && UUID_V4_RE.test(existing) ? existing : null;
}

export { UUID_V4_RE };
