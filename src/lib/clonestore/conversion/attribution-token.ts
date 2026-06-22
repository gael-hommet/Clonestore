// BLOC 3 — Attribution token (résolution opaque /p/[token]).
//
// Format token serveur :
//   v{keyVersion}.{tokenIdHex16}.{signatureBase64Url}
// Exemple : v1.7a3c9bd2f1e0c2a4ab12e9d7c6e8a1b3.aGVsbG8tc2lnbmF0dXJl
//
// Le tokenId (16 octets hex) sert d'identifiant non-secret pour retrouver le
// grant en base. La signature HMAC-SHA256 est comparée en temps constant.
//
// Le client ne reçoit jamais la signature dans l'URL finale : /p/[token] crée
// une session puis redirige en 303 vers /demo/pierre — sans paramètres.

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { AttributionTokenParts } from "./types";

export const TOKEN_VERSION_MAX = 9;
const TOKEN_ID_HEX_LEN = 32; // 16 octets
const SIGNATURE_MIN_LEN = 22; // base64url(SHA256 8 octets tronqués → minimum)

function tokenSecret(): string | null {
  return (
    process.env.CLONESTORE_CONVERSION_ATTRIBUTION_SECRET ??
    process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET ??
    (process.env.NODE_ENV === "production" ? null : "clonestore-dev-conversion-attribution-secret")
  );
}

export function isAttributionSecretConfigured(): boolean {
  return Boolean(
    process.env.CLONESTORE_CONVERSION_ATTRIBUTION_SECRET ??
      process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET,
  );
}

/** Parse un token attribué (sans vérifier la signature). Retourne null si forme invalide. */
export function parseAttributionToken(raw: unknown): AttributionTokenParts | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 20 || trimmed.length > 200) return null;
  const parts = trimmed.split(".");
  if (parts.length !== 3) return null;
  const [versionPart, tokenIdPart, sigPart] = parts;
  if (!versionPart.startsWith("v")) return null;
  const versionStr = versionPart.slice(1);
  if (!/^[0-9]+$/.test(versionStr)) return null;
  const keyVersion = Number(versionStr);
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > TOKEN_VERSION_MAX) return null;
  if (tokenIdPart.length !== TOKEN_ID_HEX_LEN || !/^[0-9a-f]+$/i.test(tokenIdPart)) return null;
  if (sigPart.length < SIGNATURE_MIN_LEN || sigPart.length > 120) return null;
  if (!/^[A-Za-z0-9_\-]+$/.test(sigPart)) return null;
  return { tokenId: tokenIdPart.toLowerCase(), signature: sigPart, keyVersion };
}

/** Calcule la signature HMAC attendue pour un (tokenId, keyVersion). */
export function computeAttributionSignature(tokenId: string, keyVersion: number): string | null {
  const secret = tokenSecret();
  if (!secret) return null;
  const mac = createHmac("sha256", `${secret}:v${keyVersion}`).update(tokenId.toLowerCase()).digest();
  return mac.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface TokenVerification {
  readonly ok: boolean;
  /** Identifiant non-secret pour retrouver le grant. */
  readonly tokenId: string | null;
  readonly keyVersion: number | null;
  /** Code de motif d'échec — jamais exposé au client (réponse publique neutre). */
  readonly reason: "ok" | "form_invalid" | "secret_missing" | "signature_mismatch";
}

/** Vérifie un token complet en TEMPS CONSTANT. Pas d'accès base. */
export function verifyAttributionToken(raw: unknown): TokenVerification {
  const parsed = parseAttributionToken(raw);
  if (!parsed) return { ok: false, tokenId: null, keyVersion: null, reason: "form_invalid" };
  const expected = computeAttributionSignature(parsed.tokenId, parsed.keyVersion);
  if (!expected) return { ok: false, tokenId: null, keyVersion: null, reason: "secret_missing" };
  const a = Buffer.from(parsed.signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false, tokenId: null, keyVersion: null, reason: "signature_mismatch" };
  try {
    if (!timingSafeEqual(a, b)) {
      return { ok: false, tokenId: null, keyVersion: null, reason: "signature_mismatch" };
    }
  } catch {
    return { ok: false, tokenId: null, keyVersion: null, reason: "signature_mismatch" };
  }
  return { ok: true, tokenId: parsed.tokenId, keyVersion: parsed.keyVersion, reason: "ok" };
}

/** Fingerprint stable (SHA-256 hex) à stocker côté grant — jamais le token complet. */
export function tokenFingerprint(tokenId: string, keyVersion: number): string {
  return createHash("sha256").update(`v${keyVersion}:${tokenId.toLowerCase()}`).digest("hex");
}

/** Émet un token (uniquement utilisé par les fixtures de test et l'importeur privé). */
export function issueAttributionToken(tokenId: string, keyVersion: number = 1): string | null {
  if (!/^[0-9a-f]{32}$/i.test(tokenId)) return null;
  const sig = computeAttributionSignature(tokenId, keyVersion);
  if (!sig) return null;
  return `v${keyVersion}.${tokenId.toLowerCase()}.${sig}`;
}
