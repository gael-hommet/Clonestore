// Miroir EXACT de src/lib/founder-access/owner-password-config.ts + owner-gate.ts pour les
// scripts opérateur (.mjs ne peut pas importer du TS). Mêmes normalisation, format et
// paramètres scrypt → aucune divergence entre « hash testé par un script » et « hash Next ».
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const HASH_RE = /^scrypt\$\d+\$\d+\$\d+\$[0-9a-fA-F]+\$[0-9a-fA-F]+$/;

/** Normalisation NON destructive : BOM, \r finaux, espaces extérieurs, guillemets englobants. */
export function normalizeHash(raw) {
  if (raw == null) return "";
  return String(raw)
    .replace(/^﻿/, "")
    .replace(/\r+$/, "")
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .trim();
}

export function hashInfo(raw) {
  const n = normalizeHash(raw);
  return {
    present: n.length > 0,
    normalized: n,
    length: n.length,
    parts: n ? n.split("$").length : 0,
    formatValid: HASH_RE.test(n),
    fingerprint: n ? createHash("sha256").update(n, "utf8").digest("hex").slice(0, 8) : null,
  };
}

/** Résout le hash depuis un dictionnaire d'env : base64 prioritaire (immunisé contre
 *  l'expansion « $ » de @next/env), repli sur la variable directe. Miroir du TS. */
export function resolveHashInfo(env) {
  const b64 = env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH_B64;
  if (b64 && b64.trim()) {
    try {
      const decoded = Buffer.from(normalizeHash(b64), "base64").toString("utf8");
      const info = hashInfo(decoded);
      if (info.formatValid) return info;
    } catch { /* repli */ }
  }
  return hashInfo(env.CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH);
}

/** Vérifie un mot de passe contre un hash scrypt$N$r$p$saltHex$hashHex (mêmes params que Next). */
export function verifyPassword(password, storedRaw) {
  const stored = normalizeHash(storedRaw);
  const p = stored.split("$");
  if (p.length !== 6 || p[0] !== "scrypt") return false;
  const N = Number(p[1]), r = Number(p[2]), pp = Number(p[3]);
  const salt = Buffer.from(p[4], "hex"), expected = Buffer.from(p[5], "hex");
  if (!salt.length || !expected.length) return false;
  let derived;
  try { derived = scryptSync(password, salt, expected.length, { N, r, p: pp, maxmem: 256 * 1024 * 1024 }); }
  catch { return false; }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Parse simple d'un fichier .env (pour lire la VRAIE source .env.local sans dépendance). */
export function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
