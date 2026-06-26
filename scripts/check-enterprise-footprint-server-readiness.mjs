#!/usr/bin/env node
// scripts/check-enterprise-footprint-server-readiness.mjs
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Readiness Check
//
// Vérifie que le SQL draft existe, l'env Supabase, et la disponibilité de la table.
// Lecture seule uniquement. Jamais d'écriture.
//
// Usage :
//   node scripts/check-enterprise-footprint-server-readiness.mjs
//   npm run check:enterprise-footprint-server-readiness

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SQL_FILE = resolve(
  ROOT,
  "supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql"
);
const TABLE_NAME = "clonestore_enterprise_footprints";
const FLAG_KEY = "NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED";

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(msg);
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
}

function info(msg) {
  console.log(`  ℹ️  ${msg}`);
}

// ── 1. SQL Draft ──────────────────────────────────────────────────────────────

log("\n── PHASE 3.13 — Enterprise Footprint Server Readiness ──────────────────\n");

log("1. SQL Draft");
if (existsSync(SQL_FILE)) {
  ok(`SQL draft trouvé : supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql`);

  const content = readFileSync(SQL_FILE, "utf-8");
  if (content.includes(TABLE_NAME)) {
    ok(`Table ${TABLE_NAME} définie dans le SQL draft.`);
  } else {
    warn(`Table ${TABLE_NAME} non trouvée dans le SQL draft.`);
  }
  if (content.includes("enable row level security")) {
    ok("RLS définie dans le SQL draft.");
  } else {
    warn("RLS non trouvée dans le SQL draft.");
  }
  if (content.includes("select_own_enterprise_footprint")) {
    ok("Policy SELECT own définie.");
  }
  if (content.includes("insert_own_enterprise_footprint")) {
    ok("Policy INSERT own définie.");
  }
  if (content.includes("update_own_enterprise_footprint")) {
    ok("Policy UPDATE own définie.");
  }
  if (!content.includes("delete policy") && !content.includes("for delete")) {
    ok("Pas de DELETE policy (attendu — préservation des empreintes).");
  }
} else {
  warn("SQL draft non trouvé. Vérifier supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql");
}

// ── 2. Feature Flag ───────────────────────────────────────────────────────────

log("\n2. Feature Flag");
const flagValue = process.env[FLAG_KEY];
if (flagValue === "true") {
  ok(`${FLAG_KEY} = true — persistence activée.`);
} else {
  info(`${FLAG_KEY} = ${flagValue ?? "(non défini)"} — persistence désactivée (défaut).`);
  info("Pour activer après SQL + RLS validés : ajouter dans .env.local :");
  info(`  ${FLAG_KEY}=true`);
}

// ── 3. Env Supabase ───────────────────────────────────────────────────────────

log("\n3. Environnement Supabase");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  ok("NEXT_PUBLIC_SUPABASE_URL défini.");
  ok("NEXT_PUBLIC_SUPABASE_ANON_KEY défini.");
  info("Connexion Supabase possible — health check via l'app recommandé.");
} else {
  if (!supabaseUrl) warn("NEXT_PUBLIC_SUPABASE_URL non défini.");
  if (!supabaseAnonKey) warn("NEXT_PUBLIC_SUPABASE_ANON_KEY non défini.");
  info("Sans env Supabase, health check non disponible depuis ce script.");
}

// ── 4. TypeScript modules ─────────────────────────────────────────────────────

log("\n4. Modules TypeScript");
const modulesToCheck = [
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-types.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-schema.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-flags.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-mappers.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-validation.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-readonly-client.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-storage.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-health.ts",
];

for (const mod of modulesToCheck) {
  const full = resolve(ROOT, mod);
  if (existsSync(full)) {
    ok(mod.split("/").pop());
  } else {
    warn(`MANQUANT : ${mod}`);
  }
}

// ── 5. Rappels ────────────────────────────────────────────────────────────────

log("\n5. Rappels importants");
info("Ce script ne fait AUCUNE écriture (select read-only recommandé via app).");
info("SQL PHASE_3_13 à appliquer MANUELLEMENT via Supabase dashboard ou CLI.");
info("localStorage reste le fallback actif même après activation du flag.");
info("lancement public externe non validé.");

log("\n── Fin du check PHASE 3.13 ─────────────────────────────────────────────\n");
