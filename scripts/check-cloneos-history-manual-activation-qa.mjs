#!/usr/bin/env node
// scripts/check-cloneos-history-manual-activation-qa.mjs
// PHASE 3.19 — CloneOS History Manual Activation QA — Check Script
//
// Guide Gael dans la QA manuelle d'activation de la persistance serveur CloneOS History.
// Lecture seule uniquement. Jamais d'écriture. Jamais de SQL exécuté.
// Jamais de POST automatique. Jamais de modification .env.local. Jamais d'exécution CloneOS.
//
// Usage :
//   node scripts/check-cloneos-history-manual-activation-qa.mjs
//   npm run check:cloneos-history-manual-activation-qa

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

const TABLE_NAME = "clonestore_cloneos_history";
const LOCALSTORAGE_KEY = "clonestore.cloneos.commandHistory.v1";
const FLAG = "NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED";

log("\n" + "═".repeat(60));
log(" PHASE 3.19 — CloneOS History Manual Activation QA");
log("═".repeat(60));
log(" Ce script guide la QA manuelle. Il ne fait AUCUNE écriture.");
log(" Aucun SQL exécuté. Aucun POST. Aucune exécution CloneOS.");
log("═".repeat(60) + "\n");

// ── A. Vérification des fichiers ──────────────────────────────────────────────

step("A", "Vérification des fichiers CloneOS History");

const filesToCheck = [
  ["LocalStorage module", "src/lib/clonestore/cloneos-history/cloneos-history-localstorage.ts"],
  ["Manual QA module", "src/lib/clonestore/cloneos-history/cloneos-history-manual-activation-qa.ts"],
  ["SQL draft", "supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql"],
  ["Doc P3.2", "docs/PHASE_3_2_CLONEOS_HISTORY_SERVER_PERSISTENCE_DESIGN.md"],
  ["Doc P3.3", "docs/PHASE_3_3_CLONEOS_HISTORY_SAFE_APPLY.md"],
  ["Doc P3.17", "docs/PHASE_3_17_PROFILE_MESSAGES_CLONEOS_HISTORY_FEED_MERGE.md"],
  ["Doc P3.19", "docs/PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_QA.md"],
  ["Evidence template", "docs/templates/PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_EVIDENCE.md"],
  ["Context feed", "src/lib/clonestore/messages/profile-messages-context-feed.ts"],
  ["CloneOS history feed", "src/lib/clonestore/messages/profile-messages-cloneos-history-feed.ts"],
  ["Script readiness", "scripts/check-cloneos-history-readiness.mjs"],
];

let sqlDraftFound = false;
for (const [label, file] of filesToCheck) {
  if (existsSync(resolve(ROOT, file))) {
    ok(`${label} — ${file}`);
    if (label === "SQL draft") sqlDraftFound = true;
  } else {
    warn(`MANQUANT : ${label} — ${file}`);
  }
}

// ── B. Cas A / Cas B ──────────────────────────────────────────────────────────

step("B", "Détection du cas d'activation");

if (sqlDraftFound) {
  ok("CAS A — SQL draft CloneOS History présent. Activation manuelle possible.");
  info("Suivre la procédure CAS A : appliquer le SQL manuellement puis tester.");
} else {
  warn("CAS B — SQL draft absent. Conserver localStorage-only.");
  info("Marquer l'evidence NEEDS REVIEW. Prévoir un bloc Server Persistence Design.");
}

// ── C. Clé localStorage ───────────────────────────────────────────────────────

step("C", "Clé localStorage CloneOS History");

info(`Clé attendue : ${LOCALSTORAGE_KEY}`);
info("Loader : loadCloneOSHistoryItemsFromLocalStorage()");
info("DevTools → Application → LocalStorage → vérifier la clé après une demande CloneOS locale.");

// ── D. Feature Flag ───────────────────────────────────────────────────────────

step("D", "Feature Flag CloneOS History");

const flagValue = process.env[FLAG];
if (flagValue === "true") {
  ok(`Flag ACTIVÉ — ${FLAG}=true.`);
  info("Activation en cours. Suivre les étapes de vérification ci-dessous.");
} else {
  info(`Flag = ${flagValue ?? "(non défini)"} — DÉSACTIVÉ (safe par défaut).`);
  info("Pour activer après SQL + RLS validés :");
  info(`  → Ajouter dans .env.local : ${FLAG}=true`);
}

// ── E. Env Supabase ───────────────────────────────────────────────────────────

step("E", "Environnement Supabase");

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

// ── F. Commandes de vérification ──────────────────────────────────────────────

step("F", "Commandes à lancer (dans l'ordre)");

log("  1. npm run check:cloneos-history-readiness");
log("  2. npm run check:cloneos-history-manual-activation-qa");
log("  3. npm run test:phase3-19");
log("  4. npm run test:phase3-18");
log("  5. npm run build");

// ── G. Requêtes SQL manuelles ─────────────────────────────────────────────────

step("G", "Requêtes SQL manuelles (Supabase SQL Editor — lecture seule)");

sql("A — Table existe ?",
  `select table_name
from information_schema.tables
where table_schema = 'public'
and table_name = '${TABLE_NAME}';`
);

sql("B — RLS activée ?",
  `select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename = '${TABLE_NAME}';`
);

sql("C — Policies RLS ?",
  `select policyname, cmd
from pg_policies
where schemaname = 'public'
and tablename = '${TABLE_NAME}'
order by cmd, policyname;`
);

sql("D — Contraintes ?",
  `select conname
from pg_constraint
where conrelid = 'public.${TABLE_NAME}'::regclass
order by conname;`
);

sql("E — Lignes après demande CloneOS locale (lecture seule) ?",
  `select *
from public.${TABLE_NAME}
order by updated_at desc
limit 5;`
);

// ── H. Checklist QA ───────────────────────────────────────────────────────────

step("H", "Checklist QA manuelle (27 étapes)");

const steps = [
  "cloneos_history_localstorage_key_verified",
  "cloneos_history_sql_file_reviewed",
  "cloneos_history_sql_applied_manually",
  "cloneos_history_table_exists",
  "cloneos_history_rls_enabled",
  "cloneos_history_select_policy_exists",
  "cloneos_history_insert_policy_exists",
  "cloneos_history_update_policy_exists",
  "cloneos_history_no_delete_policy",
  "cloneos_history_constraints_verified",
  "cloneos_history_flag_disabled_before_test",
  "cloneos_history_safe_apply_script_passes",
  "cloneos_history_flag_enabled_for_local_test",
  "cloneos_history_app_restarted_after_flag",
  "cloneos_history_authenticated_user_available",
  "cloneos_history_local_write_works",
  "cloneos_history_server_sync_works",
  "cloneos_history_api_get_returns_server_snapshot",
  "cloneos_history_refresh_restores_latest_snapshot",
  "cloneos_history_profile_messages_reads_context_feed",
  "cloneos_history_rollback_flag_disabled",
  "cloneos_history_localstorage_still_works_after_rollback",
  "cloneos_history_no_write_from_profile_messages",
  "cloneos_history_no_write_from_pierre_pages",
  "cloneos_history_no_service_role_detected",
  "cloneos_history_no_cloneos_execution",
  "public_launch_external_not_validated",
];

steps.forEach((id, i) => {
  log(`  ${String(i + 1).padStart(2, "0")}. [ ] ${id}`);
});

// ── I. Ordre exact d'activation ───────────────────────────────────────────────

step("I", "Ordre exact d'activation (CAS A)");

log("  1. npm run check:cloneos-history-readiness");
log(`  2. Supabase → SQL Editor → Coller ${TABLE_NAME} SQL → Run`);
log("  3. Lancer les 5 requêtes SQL (A à E)");
log(`  4. Ajouter dans .env.local : ${FLAG}=true`);
log("  5. npm run dev");
log("  6. Se connecter → générer une demande CloneOS locale");
log(`  7. Vérifier localStorage ${LOCALSTORAGE_KEY}`);
log("  8. Lancer requête SQL E → vérifier ligne créée (si sync active)");
log("  9. Aller sur /profile/messages → vérifier section Historique CloneOS");
log("  10. F5 → vérifier historique intact");
log("  11. Rollback : retirer flag .env.local → redémarrer → vérifier localStorage OK");
log("  12. Remplir docs/templates/PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_EVIDENCE.md");

// ── J. Rappels ────────────────────────────────────────────────────────────────

step("J", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("SQL à appliquer MANUELLEMENT — jamais automatiquement.");
info("Flag à activer MANUELLEMENT dans .env.local.");
info("go-live-proofs.local.json ne doit pas être modifié.");
info("localStorage reste le fallback actif même après activation.");
info("Aucune exécution CloneOS. Aucun message envoyé.");
info("lancement public externe non validé.");

log("\n" + "═".repeat(60));
log(" Fin check PHASE 3.19");
log("═".repeat(60) + "\n");
