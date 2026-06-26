// Phase E — cookies signés (HMAC) côté serveur. Aucune donnée sensible en clair,
// aucune confiance dans un cookie non vérifié. Sert :
//   • la preuve de possession de l'étape 2 (§3.3) ;
//   • la porte propriétaire du Founder Command Center (§4.4).
//
// Format : base64url(json).base64url(hmacSha256(json)). json = { v, exp }.
// La signature est vérifiée en temps constant ; l'expiration est obligatoire.

import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface SignedPayload {
  /** Valeur portée (ex. reservation_id, ou marqueur de rôle). */
  v: string;
  /** Expiration epoch ms. */
  exp: number;
}

/** Signe une valeur avec un secret et une TTL (ms). Retourne le jeton de cookie. */
export function signCookie(value: string, secret: string, ttlMs: number): string {
  const payload: SignedPayload = { v: value, exp: Date.now() + ttlMs };
  const json = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = b64url(createHmac("sha256", secret).update(json).digest());
  return `${json}.${mac}`;
}

/** Vérifie un jeton de cookie. Retourne la valeur si signature + expiration valides. */
export function verifyCookie(token: string | null | undefined, secret: string): string | null {
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
    const payload = JSON.parse(fromB64url(json).toString("utf8")) as SignedPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return typeof payload.v === "string" ? payload.v : null;
  } catch {
    return null;
  }
}

// ── Cookie de réservation (preuve de possession étape 2) ────────────────────
export const RESERVATION_COOKIE = "cs_founder_reservation";
const RESERVATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 h

export function reservationCookieSecret(): string | null {
  return process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET ?? null;
}

/** Construit l'en-tête Set-Cookie liant le navigateur à une réservation précise. */
export function buildReservationCookie(reservationId: string): string | null {
  const secret = reservationCookieSecret();
  if (!secret) return null;
  const token = signCookie(reservationId, secret, RESERVATION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${RESERVATION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${RESERVATION_TTL_MS / 1000}`;
}

/** Vérifie que le cookie de réservation autorise bien l'action sur cette réservation. */
export function reservationCookieAuthorizes(cookieHeader: string | null, reservationId: string): boolean {
  const secret = reservationCookieSecret();
  if (!secret) return false;
  const raw = readCookie(cookieHeader, RESERVATION_COOKIE);
  const value = verifyCookie(raw, secret);
  return value !== null && value === reservationId;
}

// ── E-R2 §8 — Session analytics ÉMISE PAR LE SERVEUR ────────────────────────
// Identifiant UUID v4 aléatoire généré côté serveur, signé HMAC dans un cookie.
// Les routes publiques lisent CETTE session validée et IGNORENT tout id de session
// fourni dans le corps. Aucune PII. SameSite=Lax, Secure en prod.
export const ANALYTICS_SESSION_COOKIE = "cs_analytics_session";
const ANALYTICS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function analyticsSessionSecret(): string {
  return process.env.CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET
    ?? process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET
    ?? "clonestore-dev-analytics-session-secret";
}

/** Génère une nouvelle session analytics signée. Retourne le Set-Cookie et l'id. */
export function buildAnalyticsSessionCookie(): { cookie: string; sessionId: string } {
  const sessionId = randomUuidV4();
  const token = signCookie(sessionId, analyticsSessionSecret(), ANALYTICS_SESSION_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return {
    cookie: `${ANALYTICS_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${ANALYTICS_SESSION_TTL_MS / 1000}`,
    sessionId,
  };
}

/** Lit la session analytics VALIDÉE depuis l'en-tête Cookie (ou null si absente/falsifiée). */
export function readAnalyticsSession(cookieHeader: string | null): string | null {
  const raw = readCookie(cookieHeader, ANALYTICS_SESSION_COOKIE);
  const value = verifyCookie(raw, analyticsSessionSecret());
  return value && UUID_V4_RE.test(value) ? value : null;
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function randomUuidV4(): string {
  // node:crypto randomUUID renvoie un UUID v4.
  // (import dynamique évité : disponible globalement côté serveur Next/Node.)
  return globalThis.crypto.randomUUID();
}

// ── Cookie de porte propriétaire ────────────────────────────────────────────
export const OWNER_GATE_COOKIE = "cs_owner_gate";
const OWNER_GATE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h max

export function ownerGateSecret(): string | null {
  return process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET ?? null;
}

export function buildOwnerGateCookie(): string | null {
  const secret = ownerGateSecret();
  if (!secret) return null;
  const token = signCookie("owner", secret, OWNER_GATE_TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${OWNER_GATE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict;${secure} Max-Age=${OWNER_GATE_TTL_MS / 1000}`;
}

/** En-tête Set-Cookie effaçant la porte (action « Verrouiller le cockpit »). */
export function clearOwnerGateCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${OWNER_GATE_COOKIE}=; Path=/; HttpOnly; SameSite=Strict;${secure} Max-Age=0`;
}

export function ownerGateUnlocked(cookieHeader: string | null): boolean {
  const secret = ownerGateSecret();
  if (!secret) return false;
  const raw = readCookie(cookieHeader, OWNER_GATE_COOKIE);
  return verifyCookie(raw, secret) === "owner";
}

/** Lecture brute d'un cookie par nom depuis un en-tête Cookie. */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
