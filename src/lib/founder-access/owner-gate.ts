// Phase E §4 — Porte propriétaire du Founder Command Center.
// Hachage de mot de passe scrypt (sel aléatoire) + vérification en temps constant.
// Le mot de passe N'EST JAMAIS stocké en clair ni codé en dur : seule l'empreinte
// vit dans CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH. Couche additionnelle — ne
// remplace ni le slug, ni la session Supabase, ni l'allowlist.

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { loadOwnerPasswordHash, normalizeOwnerPasswordHash } from "./owner-password-config";

// Paramètres scrypt (coût mémoire/CPU raisonnable pour une porte interne).
const N = 16384, R = 8, P = 1, KEYLEN = 64;

/** Produit une empreinte `scrypt$N$r$p$saltHex$hashHex`. Pour le script de hachage. */
export function hashOwnerPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Vérifie un mot de passe contre une empreinte, en temps constant. La même normalisation
 *  NON destructive est appliquée (BOM/\r/espaces/guillemets) pour éviter toute divergence. */
export function verifyOwnerPasswordAgainst(password: string, stored: string | null | undefined): boolean {
  const normalized = normalizeOwnerPasswordHash(stored);
  if (!normalized) return false;
  const parts = normalized.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (!salt.length || !expected.length) return false;
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, expected.length, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Vérifie via le hash chargé+normalisé de l'environnement (source unique). */
export function verifyOwnerPassword(password: string): boolean {
  return verifyOwnerPasswordAgainst(password, loadOwnerPasswordHash().normalized);
}

/** La porte est-elle configurée (hash NON vide + secret cookie + slug présents) ? */
export function isOwnerGateConfigured(): boolean {
  return Boolean(
    loadOwnerPasswordHash().present &&
    process.env.CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET &&
    process.env.CLONESTORE_OWNER_COCKPIT_SLUG,
  );
}
