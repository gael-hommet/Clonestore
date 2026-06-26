// Source UNIQUE du hash de mot de passe propriétaire : chargement + normalisation NON
// destructive + validation de format + empreinte sûre. Utilisé par isOwnerGateConfigured(),
// verifyOwnerPassword(), le diagnostic de la route et les scripts locaux — pour éliminer
// toute divergence entre « le hash testé par un script » et « le hash chargé par Next ».
//
// Le hash N'EST JAMAIS journalisé ni renvoyé en entier ailleurs que normalisé ; on n'expose
// que sa longueur, son nombre de segments et une empreinte SHA-256 tronquée.

import { createHash } from "node:crypto";

const ENV_KEY = "CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH";
// Forme base64 RECOMMANDÉE : le hash scrypt contient des « $ » que le chargeur d'env de
// Next (@next/env → dotenv-expand) interprète comme des variables et CORROMPT au chargement
// (ex. 178 → 10 caractères) → mot de passe jamais reconnu (401). Le base64 n'a aucun « $ » et
// traverse le chargeur intact ; on le préfère et on décode au runtime.
const ENV_KEY_B64 = "CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH_B64";
// Format attendu, identique au générateur (hashOwnerPassword) : scrypt$N$r$p$saltHex$hashHex
const HASH_RE = /^scrypt\$\d+\$\d+\$\d+\$[0-9a-fA-F]+\$[0-9a-fA-F]+$/;

export interface OwnerPasswordHashInfo {
  present: boolean;            // variable présente et non vide APRÈS normalisation
  normalized: string | null;   // hash normalisé (à comparer en interne uniquement)
  length: number;
  parts: number;               // nombre de segments séparés par « $ »
  formatValid: boolean;        // scrypt$N$r$p$saltHex$hashHex
  fingerprint: string | null;  // SHA-256 tronquée (8 hex) — sûr à journaliser
}

/**
 * Normalisation NON destructive : retire SEULEMENT le BOM initial, les `\r` finaux, les
 * espaces extérieurs et des guillemets englobants accidentels. Ne touche jamais au contenu
 * interne du hash (sel/hash hex, séparateurs `$`).
 */
export function normalizeOwnerPasswordHash(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw
    .replace(/^﻿/, "")
    .replace(/\r+$/, "")
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .trim();
}

function buildInfo(normalized: string): OwnerPasswordHashInfo {
  const present = normalized.length > 0;
  return {
    present,
    normalized: present ? normalized : null,
    length: normalized.length,
    parts: present ? normalized.split("$").length : 0,
    formatValid: HASH_RE.test(normalized),
    fingerprint: present ? createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 8) : null,
  };
}

/** Candidats de hash, dans l'ordre de préférence : base64 décodé, puis variable directe. */
function candidateHashes(): string[] {
  const out: string[] = [];
  const b64 = process.env[ENV_KEY_B64];
  if (b64 && b64.trim()) {
    try {
      const decoded = Buffer.from(normalizeOwnerPasswordHash(b64), "base64").toString("utf8");
      if (decoded) out.push(decoded);
    } catch { /* base64 invalide → on tentera la variable directe */ }
  }
  if (process.env[ENV_KEY] != null) out.push(process.env[ENV_KEY] as string);
  return out;
}

/** Charge + normalise + valide le hash depuis l'environnement (base64 prioritaire). */
export function loadOwnerPasswordHash(): OwnerPasswordHashInfo {
  let firstSeen: OwnerPasswordHashInfo | null = null;
  for (const candidate of candidateHashes()) {
    const info = buildInfo(normalizeOwnerPasswordHash(candidate));
    if (info.formatValid) return info;        // première forme VALIDE → gagne
    if (!firstSeen) firstSeen = info;          // sinon garde la 1re pour le diagnostic
  }
  return firstSeen ?? buildInfo("");
}
