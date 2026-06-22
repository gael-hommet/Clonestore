// BLOC 3 — Attribution token, format LeadForge db9b166.
//
// Cf. `services/conversion/attribution.py` :
//   token = "{token_id}.{signature_hex}"
//   token_id  = uuid.hex (32) + uuid.hex[:8] (8) = 40 hex chars
//   signature = hmac.sha256(token_id.encode(), key).hexdigest()  → 64 hex chars
//   KEY_VERSION = "a1" (string, stocké en colonne `attribution_links.key_version`,
//                       JAMAIS dans le token public)
//
// Comparaison de signature en TEMPS CONSTANT. Aucune révélation publique
// du motif d'échec (la route `/p/[token]` redirige vers une démo générique
// pour TOUT échec — indistinguable d'un visiteur organique).

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import {
  ATTRIBUTION_KEY_ENV,
  ATTRIBUTION_KEY_VERSION,
  ATTRIBUTION_SIGNATURE_LENGTH,
  ATTRIBUTION_TOKEN_ID_LENGTH,
} from "./contract";

const TOKEN_ID_RE = /^[0-9a-f]{40}$/;
const SIGNATURE_RE = /^[0-9a-f]{64}$/;

function signingKey(): string | null {
  // Source primaire : variable d'environnement explicite (alignée sur LeadForge).
  const explicit = process.env[ATTRIBUTION_KEY_ENV];
  if (explicit && explicit.length > 0) return explicit;
  // Fallback CloneStore générique pour tests/dev — JAMAIS en production.
  if (process.env.NODE_ENV === "production") return null;
  return "clonestore-bloc3-dev-attribution-secret";
}

/**
 * Indique si un vrai secret est configuré. En production sans secret →
 * `false` → toute vérification de token retourne `secret_missing`.
 */
export function isAttributionSecretConfigured(): boolean {
  return Boolean(process.env[ATTRIBUTION_KEY_ENV]);
}

export interface AttributionTokenParts {
  readonly tokenId: string;       // 40 hex (LeadForge)
  readonly signatureHex: string;  // 64 hex (HMAC-SHA256)
}

/** Parse le token public sans vérifier la signature. */
export function parseAttributionToken(raw: unknown): AttributionTokenParts | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  // Format strict LeadForge : 40 hex + "." + 64 hex (long total = 105).
  if (trimmed.length !== ATTRIBUTION_TOKEN_ID_LENGTH + 1 + ATTRIBUTION_SIGNATURE_LENGTH) return null;
  const dot = trimmed.indexOf(".");
  if (dot !== ATTRIBUTION_TOKEN_ID_LENGTH) return null;
  const tokenId = trimmed.slice(0, dot).toLowerCase();
  const signatureHex = trimmed.slice(dot + 1).toLowerCase();
  if (!TOKEN_ID_RE.test(tokenId)) return null;
  if (!SIGNATURE_RE.test(signatureHex)) return null;
  return { tokenId, signatureHex };
}

/** Calcule la signature LeadForge attendue : HMAC-SHA256(token_id, secret) en hex. */
export function computeAttributionSignature(tokenId: string, secret?: string): string | null {
  const key = secret ?? signingKey();
  if (!key) return null;
  if (!TOKEN_ID_RE.test(tokenId)) return null;
  return createHmac("sha256", key).update(tokenId).digest("hex");
}

export type TokenVerificationReason =
  | "ok"
  | "malformed"
  | "secret_missing"
  | "bad_signature";

export interface TokenVerification {
  readonly ok: boolean;
  readonly tokenId: string | null;
  readonly reason: TokenVerificationReason;
}

/**
 * Vérifie un token complet en TEMPS CONSTANT. Pas d'accès base.
 * Le motif d'échec est usage INTERNE — la réponse publique reste neutre.
 */
export function verifyAttributionToken(raw: unknown, opts?: { secret?: string }): TokenVerification {
  const parsed = parseAttributionToken(raw);
  if (!parsed) return { ok: false, tokenId: null, reason: "malformed" };
  const expected = computeAttributionSignature(parsed.tokenId, opts?.secret);
  if (!expected) return { ok: false, tokenId: null, reason: "secret_missing" };
  const a = Buffer.from(parsed.signatureHex, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return { ok: false, tokenId: null, reason: "bad_signature" };
  try {
    if (!timingSafeEqual(a, b)) {
      return { ok: false, tokenId: null, reason: "bad_signature" };
    }
  } catch {
    return { ok: false, tokenId: null, reason: "bad_signature" };
  }
  return { ok: true, tokenId: parsed.tokenId, reason: "ok" };
}

/** Fingerprint SHA-256 hex stable du token_id — sert à la jointure côté DB. */
export function tokenFingerprint(tokenId: string): string {
  return createHash("sha256").update(tokenId).digest("hex");
}

/**
 * Émet un token attribué — réservé aux fixtures de test et à l'importeur privé
 * opérateur. JAMAIS appelé par une route publique.
 */
export function issueAttributionToken(tokenId: string, opts?: { secret?: string }): string | null {
  if (!TOKEN_ID_RE.test(tokenId)) return null;
  const sig = computeAttributionSignature(tokenId, opts?.secret);
  if (!sig) return null;
  return `${tokenId.toLowerCase()}.${sig}`;
}

/**
 * Réduit un token public au token_id seul (jamais le bearer complet dans un
 * event ni un log). Cf. events.py:safe_prospect_token.
 */
export function safeProspectToken(value: string): string {
  const v = (value ?? "").trim();
  if (v.length === 0) return "";
  if (v.includes("@")) return ""; // jamais un email
  const dot = v.indexOf(".");
  return dot >= 0 ? v.slice(0, dot) : v;
}

export const ATTRIBUTION_KEY_VERSION_REF = ATTRIBUTION_KEY_VERSION;
