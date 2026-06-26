#!/usr/bin/env node
// scripts/check-enterprise-footprint-manual-activation-qa.mjs
// PHASE 3.15 — Enterprise Footprint Manual Activation QA — Check Script
//
// Guide Gael dans la QA manuelle d'activation de la persistence serveur.
// Lecture seule uniquement. Jamais d'écriture. Jamais de SQL executé.
// Jamais de POST automatique. Jamais de modification .env.local.
//
// Usage :
//   node scripts/check-enterprise-footprint-manual-activation-qa.mjs
//   npm run check:enterprise-footprint-manual-activation-qa

import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function step(n, msg) { console.log(`\n${"─".repeat(60)}\n  ÉTAPE ${n} — ${msg}\n`); }
function sql(label, query) {
  console.log(`\n  [SQL ${label}]\n  ${query.replace(/\n/g, "\n  ")}\n`);
}

log("\n═".repeat(30));
log(" PHASE 3.15 — Enterprise Footprint Manual Activation QA");
log("═".repeat(30));
log(" Ce script guide la QA manuelle. Il ne fait AUCUNE écriture.");
log("═".repeat(30) + "\n");

// ── A. Vérification des fichiers ──────────────────────────────────────────────

step("A", "Vérification des fichiers P3.13/P3.14/P3.15");

const filesToCheck = [
  ["SQL draft", "supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql"],
  ["Route API", "src/app/api/profile/enterprise-footprint/route.ts"],
  ["Runtime safe-apply", "src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-runtime.ts"],
  ["Manual QA module", "src/lib/clonestore/enterprise-footprint/enterprise-footprint-manual-activation-qa.ts"],
  ["Doc P3.13", "docs/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_DESIGN.md"],
  ["Doc P3.14", "docs/PHASE_3_14_ENTERPRISE_FOOTPRINT_SAFE_APPLY.md"],
  ["Doc P3.15", "docs/PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_QA.md"],
  ["Evidence template", "docs/templates/PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_EVIDENCE.md"],
  ["Script readiness", "scripts/check-enterprise-footprint-server-readiness.mjs"],
  ["Script safe-apply", "scripts/check-enterprise-footprint-safe-apply.mjs"],
];

for (const [label, file] of filesToCheck) {
  if (existsSync(resolve(ROOT, file))) ok(`${label} — ${file}`);
  else warn(`MANQUANT : ${label} — ${file}`);
}

// ── B. Feature Flag ───────────────────────────────────────────────────────────

step("B", "Feature Flag actuel");

const flagValue = process.env.NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED;
if (flagValue === "true") {
  ok("Flag ACTIVÉ — persistence serveur active.");
  info("Activation en cours. Suivre les étapes de vérification ci-dessous.");
} else {
  info(`Flag = ${flagValue ?? "(non défini)"} — DÉSACTIVÉ (safe par défaut).`);
  info("Pour activer après SQL + RLS validés :");
  info("  → Ajouter dans .env.local :");
  info("  NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true");
}

// ── C. Env Supabase ───────────────────────────────────────────────────────────

step("C", "Environnement Supabase");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  ok("NEXT_PUBLIC_SUPABASE_URL défini.");
  ok("NEXT_PUBLIC_SUPABASE_ANON_KEY défini.");
} else {
  if (!supabaseUrl) warn("NEXT_PUBLIC_SUPABASE_URL non défini.");
  if (!supabaseAnonKey) warn("NEXT_PUBLIC_SUPABASE_ANON_KEY non défini.");
  info("Sans env Supabase, les checks côté app ne peuvent pas être effectués.");
}

// ── D. Commandes de vérification ──────────────────────────────────────────────

step("D", "Commandes à lancer (dans l'ordre)");

log("  1. npm run check:enterprise-footprint-server-readiness");
log("  2. npm run check:enterprise-footprint-safe-apply");
log("  3. npm run check:enterprise-footprint-manual-activation-qa");
log("  4. npm run test:phase3-15");
log("  5. npm run test:phase3-14");
log("  6. npm run build");

// ── E. Requêtes SQL manuelles ─────────────────────────────────────────────────

step("E", "Requêtes SQL manuelles (Supabase SQL Editor — lecture seule)");

sql("A — Table existe ?",
  `select table_name
from information_schema.tables
where table_schema = 'public'
and table_name = 'clonestore_enterprise_footprints';`
);

sql("B — RLS activée ?",
  `select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints';`
);

sql("C — Policies RLS ?",
  `select policyname, cmd
from pg_policies
where schemaname = 'public'
and tablename = 'clonestore_enterprise_footprints'
order by cmd, policyname;`
);

sql("D — Contraintes ?",
  `select conname
from pg_constraint
where conrelid = 'public.clonestore_enterprise_footprints'::regclass
order by conname;`
);

sql("E — Lignes après test onboarding (lecture seule) ?",
  `select id, user_id, company_id, status, readiness_score, coverage_score, updated_at
from public.clonestore_enterprise_footprints
order by updated_at desc
limit 5;`
);

// ── F. Checklist QA ───────────────────────────────────────────────────────────

step("F", "Checklist QA manuelle (24 étapes)");

const steps = [
  ["sql_file_reviewed", "SQL draft revu manuellement"],
  ["sql_applied_manually", "SQL appliqué manuellement dans Supabase"],
  ["table_exists", "Table clonestore_enterprise_footprints existe"],
  ["rls_enabled", "RLS activée sur la table"],
  ["select_policy_exists", "Policy SELECT own existe"],
  ["insert_policy_exists", "Policy INSERT own existe"],
  ["update_policy_exists", "Policy UPDATE own existe"],
  ["no_delete_policy", "Aucune policy DELETE"],
  ["constraints_verified", "Contraintes vérifiées"],
  ["flag_disabled_before_test", "Flag désactivé avant le test"],
  ["safe_apply_script_passes", "Script safe-apply passe"],
  ["flag_enabled_for_local_test", "Flag activé pour le test local"],
  ["app_restarted_after_flag", "App redémarrée après flag"],
  ["authenticated_user_available", "Utilisateur authentifié disponible"],
  ["onboarding_local_save_works", "Save localStorage fonctionne"],
  ["onboarding_server_sync_works", "Sync serveur fonctionne"],
  ["api_get_returns_server_snapshot", "GET API retourne snapshot serveur"],
  ["refresh_restores_latest_snapshot", "Refresh restaure le snapshot correct"],
  ["rollback_flag_disabled", "Rollback : retirer le flag"],
  ["localstorage_still_works_after_rollback", "localStorage intact après rollback"],
  ["no_write_from_agents_pages", "Aucun write depuis /profile/agents"],
  ["no_write_from_pierre_pages", "Aucun write depuis pages Pierre"],
  ["no_service_role_detected", "Pas de service role côté client"],
  ["public_launch_external_not_validated", "Lancement public externe non validé"],
];

steps.forEach(([id, label], i) => {
  log(`  ${String(i + 1).padStart(2, "0")}. [ ] ${label}`);
});

// ── G. Instructions d'activation ─────────────────────────────────────────────

step("G", "Ordre exact d'activation");

log("  1. Lancer check:enterprise-footprint-server-readiness");
log("  2. Ouvrir Supabase → SQL Editor → Coller PHASE_3_13_...sql → Run");
log("  3. Lancer les 5 requêtes SQL (E1 à E5)");
log("  4. Ajouter dans .env.local :");
log("     NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true");
log("  5. npm run dev");
log("  6. Se connecter → aller sur /profile/onboarding");
log("  7. Remplir formulaire → vérifier status 'Empreinte synchronisée serveur'");
log("  8. Lancer requête SQL E → vérifier ligne créée");
log("  9. F5 → vérifier données intactes");
log("  10. Rollback : retirer flag .env.local → redémarrer → vérifier localStorage OK");
log("  11. Remplir docs/templates/PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_EVIDENCE.md");

// ── H. Rappels ────────────────────────────────────────────────────────────────

step("H", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("SQL à appliquer MANUELLEMENT — jamais automatiquement.");
info("flag à activer MANUELLEMENT dans .env.local.");
info("go-live-proofs.local.json ne doit pas être modifié.");
info("localStorage reste le fallback actif même après activation.");
info("lancement public externe non validé.");

log("\n" + "═".repeat(30));
log(" Fin check PHASE 3.15");
log("═".repeat(30) + "\n");
