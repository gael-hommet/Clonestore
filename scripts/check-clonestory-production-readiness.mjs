#!/usr/bin/env node
// CloneStory — porte de préparation production (NE RÉVÈLE JAMAIS LES VALEURS).
// Vérifie la présence + la robustesse des secrets obligatoires. Lit process.env
// et, si présent, .env.local (présence/longueur uniquement). Aucune valeur affichée.
//
// Sorties : exit 0 = prêt (tous présents/robustes) ; exit 1 = bloqué (secret manquant
// ou trop faible) — blocage EXTERNE (configuration opérateur), pas un défaut de code.

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const MIN_SECRET_LEN = 24;
const SECRET_VARS = new Set(["CLONESTORY_SESSION_SECRET", "CLONESTORY_COMPANY_SALT"]);
const REQUIRED = [
  "CLONESTORY_SESSION_SECRET",
  "CLONESTORY_COMPANY_SALT",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "CLONESTORE_FOUNDER_EMAIL_FROM",
];

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const lineRaw of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(resolve(process.cwd(), ".env.local"));
function valueOf(name) {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  return fileEnv[name] ?? "";
}

console.log("CloneStory — préparation production (booléens uniquement, aucune valeur affichée)\n");
let ready = true;
for (const name of REQUIRED) {
  const v = (valueOf(name) ?? "").trim();
  const present = v.length > 0;
  const strong = SECRET_VARS.has(name) ? v.length >= MIN_SECRET_LEN : present;
  if (!present || !strong) ready = false;
  const flag = !present ? "ABSENT" : !strong ? `TROP FAIBLE (<${MIN_SECRET_LEN})` : "OK";
  console.log(`  ${present && strong ? "✓" : "✗"}  ${name.padEnd(34)} ${flag}`);
}

const migration = resolve(process.cwd(), "supabase/migrations/2026-06-24_01__clonestory_fp_founding_partners.sql");
const migration2 = resolve(process.cwd(), "supabase/migrations/2026-06-24_02__clonestory_fp_token_hash.sql");
const migPresent = existsSync(migration) && existsSync(migration2);
console.log(`  ${migPresent ? "✓" : "✗"}  ${"migrations clonestory_fp".padEnd(34)} ${migPresent ? "présentes" : "MANQUANTES"}`);

// État du flag d'ouverture (INFORMATIF — décision opérateur explicite, jamais
// déduite de l'infra). N'affecte pas le code de sortie.
const regOpen = (valueOf("CLONESTORY_REGISTRATION_OPEN") ?? "").trim() === "true";
console.log(`  ${regOpen ? "○" : "●"}  ${"CLONESTORY_REGISTRATION_OPEN".padEnd(34)} inscriptions ${regOpen ? "OUVERTES" : "FERMÉES"}`);

console.log("");
console.log("Note : l'ouverture est une décision opérateur SÉPARÉE (flag), prise APRÈS readiness exit 0,");
console.log("migrations appliquées, RLS vérifiée, déploiement et smoke A→K. Jamais déduite des secrets.");
console.log("");
if (ready && migPresent) {
  console.log("VERDICT: PRÊT — secrets présents et robustes. Reste : appliquer la migration sur la vraie base,");
  console.log("vérifier RLS (npm run check:clonestory-rls), déployer, puis smoke test réel.");
  process.exit(0);
} else {
  console.log("VERDICT: BLOQUÉ (configuration externe) — voir docs/operator/CLONESTORY_PRODUCTION_ACTIVATION.md.");
  console.log("Raison: au moins un secret obligatoire est absent ou trop faible (détail ci-dessus).");
  process.exit(1);
}
