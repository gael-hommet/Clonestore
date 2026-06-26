#!/usr/bin/env node
// scripts/check-enterprise-footprint-safe-apply.mjs
// PHASE 3.14 — Enterprise Footprint Safe Apply — Check Script
//
// Vérifie l'état du safe apply : SQL, route, flag, modules.
// Affiche les requêtes SQL manuelles à lancer dans Supabase.
// Lecture seule uniquement. Jamais d'écriture.
//
// Usage :
//   node scripts/check-enterprise-footprint-safe-apply.mjs
//   npm run check:enterprise-footprint-safe-apply

import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function sql(query) { console.log(`\n  SQL:\n  ${query.replace(/\n/g, "\n  ")}\n`); }

log("\n── PHASE 3.14 — Enterprise Footprint Safe Apply Check ──────────────────\n");

// ── 1. SQL Draft ──────────────────────────────────────────────────────────────
log("1. SQL Draft");
const sqlFile = resolve(ROOT, "supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql");
if (existsSync(sqlFile)) {
  ok("SQL draft PHASE_3_13 présent.");
} else {
  warn("SQL draft PHASE_3_13 manquant.");
}
info("À appliquer MANUELLEMENT dans Supabase dashboard ou via CLI supabase db push.");

// ── 2. Route API ──────────────────────────────────────────────────────────────
log("\n2. Route API");
const routeFile = resolve(ROOT, "src/app/api/profile/enterprise-footprint/route.ts");
if (existsSync(routeFile)) {
  ok("Route /api/profile/enterprise-footprint présente.");
} else {
  warn("Route absente — vérifier src/app/api/profile/enterprise-footprint/route.ts");
}

// ── 3. Feature Flag ───────────────────────────────────────────────────────────
log("\n3. Feature Flag");
const flagValue = process.env.NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED;
if (flagValue === "true") {
  ok(`Flag activé — persistence serveur active.`);
} else {
  info(`Flag = ${flagValue ?? "(non défini)"} — désactivé (défaut safe).`);
  info("Pour activer après SQL + RLS validés :");
  info("  NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true");
}

// ── 4. Modules ────────────────────────────────────────────────────────────────
log("\n4. Modules PHASE 3.14");
const modules = [
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-types.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-runtime.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-qa.ts",
  "src/lib/clonestore/enterprise-footprint/enterprise-footprint-api-client.ts",
];
for (const mod of modules) {
  if (existsSync(resolve(ROOT, mod))) ok(mod.split("/").pop());
  else warn(`MANQUANT : ${mod}`);
}

// ── 5. Requêtes SQL de vérification manuelle ──────────────────────────────────
log("\n5. Requêtes SQL à lancer manuellement dans Supabase\n");

info("5a. Table existe ?");
sql(`select table_name
from information_schema.tables
where table_schema = 'public'
and table_name = 'clonestore_enterprise_footprints';`);

info("5b. RLS activée ?");
sql(`select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints';`);

info("5c. Policies RLS ?");
sql(`select policyname, cmd
from pg_policies
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints'
order by cmd, policyname;`);

info("5d. Contraintes ?");
sql(`select conname
from pg_constraint
where conrelid = 'public.clonestore_enterprise_footprints'::regclass
order by conname;`);

info("5e. Test SELECT read-only (remplacer <user_id> par un UUID valide) :");
sql(`select id, company_id, status, readiness_score, updated_at
from public.clonestore_enterprise_footprints
where user_id = '<user_id>'
limit 1;`);

// ── 6. Instructions d'activation ─────────────────────────────────────────────
log("\n6. Instructions d'activation (ordre obligatoire)\n");
info("1. Appliquer SQL PHASE_3_13 dans Supabase (SQL Editor ou supabase db push).");
info("2. Vérifier les 4 requêtes SQL ci-dessus → tous les checks verts.");
info("3. Ajouter dans .env.local : NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true");
info("4. Relancer build : npm run build");
info("5. Tester npm run test:phase3-14");
info("6. Vérifier /profile/onboarding → statut 'Empreinte synchronisée serveur'.");

log("\n── Rappels ──────────────────────────────────────────────────────────────\n");
info("Ce script ne fait AUCUNE écriture.");
info("SQL à appliquer MANUELLEMENT — jamais automatiquement.");
info("localStorage reste le fallback actif même après activation.");
info("lancement public externe non validé.");

log("\n── Fin check PHASE 3.14 ─────────────────────────────────────────────────\n");
