// CloneStory — Le Cercle des Partenaires Fondateurs
// token.ts — Lien personnel + code personnel + empreinte d'entreprise hachée.
//
// SERVER-ONLY : ce module importe `node:crypto`. Ne JAMAIS l'importer depuis un
// composant client (cela casse `next build` — UnhandledSchemeError). Les helpers
// purs de chaînes vivent dans `normalize.ts`.
//
// Principe de sécurité (repris du pattern Phase E / Bloc 3) : on ne stocke JAMAIS
// le secret en clair — uniquement son empreinte sha256. La validation se fait en
// temps constant.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Préfixe d'un lien personnel partenaire (route publique d'introduction). */
export const PARTNER_LINK_PREFIX = "fp_" as const;

/**
 * Alphabet du code personnel : sans caractères ambigus (0/O, 1/I/L). Lisible à
 * l'oral et à l'écrit, adapté à une transmission « noble » (pas un code promo).
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_GROUPS = 2;
const CODE_GROUP_LEN = 4; // ex. "ABCD-2K9M"

export interface IssuedSecret {
  /** Valeur en clair — à transmettre UNE fois au partenaire, jamais persistée. */
  readonly value: string;
  /** Empreinte sha256 (hex) — la seule chose à stocker. */
  readonly hash: string;
}

/** Génère un token de lien personnel opaque + son empreinte. */
export function issuePartnerLinkToken(): IssuedSecret {
  const value = PARTNER_LINK_PREFIX + randomBytes(24).toString("base64url");
  return { value, hash: sha256Hex(value) };
}

/** Génère un code personnel lisible (ex. "ABCD-2K9M") + son empreinte. */
export function issuePartnerCode(): IssuedSecret {
  const bytes = randomBytes(CODE_GROUPS * CODE_GROUP_LEN);
  let out = "";
  for (let g = 0; g < CODE_GROUPS; g++) {
    if (g > 0) out += "-";
    for (let i = 0; i < CODE_GROUP_LEN; i++) {
      const idx = bytes[g * CODE_GROUP_LEN + i] % CODE_ALPHABET.length;
      out += CODE_ALPHABET[idx];
    }
  }
  return { value: out, hash: sha256Hex(normalizeCode(out)) };
}

/** Empreinte d'un token de lien (pour comparaison au stockage). */
export function hashLinkToken(value: string): string {
  return sha256Hex(value.trim());
}

/** Empreinte d'un code personnel (insensible à la casse / aux tirets / espaces). */
export function hashPartnerCode(value: string): string {
  return sha256Hex(normalizeCode(value));
}

/** Normalise un code saisi : majuscules, sans tirets/espaces. */
export function normalizeCode(value: string): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Comparaison d'empreintes en temps constant (anti-timing). */
export function secretMatchesHash(presentedValue: string, storedHash: string, kind: "link" | "code"): boolean {
  const computed = kind === "link" ? hashLinkToken(presentedValue) : hashPartnerCode(presentedValue);
  return constantTimeHexEqual(computed, storedHash);
}

/**
 * Empreinte d'entreprise NON RÉVERSIBLE, pour la déduplication sans exposer de
 * PII. On hache une clé stable (domaine ou nom normalisé) avec un sel de service.
 * Le sel garantit qu'on ne peut pas reconstruire l'entrée par dictionnaire.
 */
export function companyFingerprint(dedupKey: string, salt: string): string {
  if (!dedupKey) return "";
  return sha256Hex(`csy-company:${salt}:${dedupKey}`);
}

// ── primitives ───────────────────────────────────────────────────────────────
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
