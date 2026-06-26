#!/usr/bin/env node
// scripts/check-runtime-mission-draft-manual-activation-qa.mjs
// PHASE 4.6 — Runtime Mission Draft Manual Activation QA — Read-Only Guidance
//
// Guide Gael dans la QA manuelle d'activation serveur des brouillons de mission.
// Lecture seule. Aucune écriture. Aucun SQL exécuté. Aucun POST. Aucun Supabase.
// Aucune modification .env.local / go-live-proofs.local.json. Aucune mission créée.
//
// Usage :
//   node scripts/check-runtime-mission-draft-manual-activation-qa.mjs
//   npm run check:runtime-mission-draft-manual-activation-qa

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function read(rel) {
  const full = resolve(ROOT, rel);
  if (!existsSync(full)) return "";
  try { return readFileSync(full, "utf-8"); } catch { return ""; }
}
function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function step(n, msg) { console.log(`\n${"─".repeat(60)}\n  ÉTAPE ${n} — ${msg}\n`); }
function sql(label, query) { console.log(`\n  [SQL ${label}]\n  ${query.replace(/\n/g, "\n  ")}\n`); }

const TABLE = "clonestore_runtime_mission_drafts";
const FLAG = "NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED";
let needsReview = 0;

log("\n" + "═".repeat(60));
log(" PHASE 4.6 — Runtime Mission Draft Manual Activation QA");
log("═".repeat(60));
log(" Lecture seule. Aucun write. Aucun SQL exécuté. Aucune mission créée.");
log("═".repeat(60) + "\n");

// ── A. Fichiers ───────────────────────────────────────────────────────────────

step("A", "Vérification des fichiers P4.4/P4.5/P4.6");

const files = [
  ["SQL draft", "supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql"],
  ["Route mission-drafts", "src/app/api/clonestore/runtime/mission-drafts/route.ts"],
  ["LocalStorage runtime", "src/lib/clonestore/runtime-integration/runtime-mission-draft-localstorage.ts"],
  ["Safe apply runtime", "src/lib/clonestore/runtime-integration/runtime-mission-draft-safe-apply.ts"],
  ["Manual QA module", "src/lib/clonestore/runtime-integration/runtime-mission-draft-manual-activation-qa.ts"],
  ["Doc P4.4", "docs/PHASE_4_4_RUNTIME_MISSION_DRAFT_SAFE_PERSISTENCE_DESIGN.md"],
  ["Doc P4.5", "docs/PHASE_4_5_RUNTIME_MISSION_DRAFT_SAFE_APPLY_LOCALSTORAGE_FIRST.md"],
  ["Doc P4.6", "docs/PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_QA.md"],
  ["Evidence template P4.6", "docs/templates/PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_EVIDENCE.md"],
];
for (const [label, file] of files) {
  if (existsSync(resolve(ROOT, file))) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Route : 423 + flag ─────────────────────────────────────────────────────

step("B", "Route mission-drafts (lecture seule)");

const routeSrc = read("src/app/api/clonestore/runtime/mission-drafts/route.ts");
if (routeSrc.includes("423")) ok("Route contient le guard 423 (POST disabled si flag false)");
else { warn("Guard 423 absent de la route"); needsReview++; }
if (routeSrc.includes(FLAG.replace("NEXT_PUBLIC_", "")) || routeSrc.includes("isRuntimeMissionDraftServerPersistenceEnabled")) {
  ok("Route lit le feature flag");
} else { warn("Lecture du flag absente de la route"); needsReview++; }

// ── C. Feature flag actuel ────────────────────────────────────────────────────

step("C", "Feature flag");

const flagValue = process.env[FLAG];
if (flagValue === "true") {
  ok(`Flag ACTIVÉ — ${FLAG}=true. POST mission-drafts peut écrire (si table + auth).`);
} else {
  info(`Flag = ${flagValue ?? "(non défini)"} — DÉSACTIVÉ (default false). POST retourne 423.`);
  info(`Pour activer (test local après SQL) : ${FLAG}=true`);
}

// ── D. SQL checks manuels ─────────────────────────────────────────────────────

step("D", "Requêtes SQL manuelles (Supabase SQL Editor — lecture seule)");

sql("A — Table existe ?", `select table_name\nfrom information_schema.tables\nwhere table_schema = 'public'\nand table_name = '${TABLE}';`);
sql("B — RLS activée ?", `select tablename, rowsecurity\nfrom pg_tables\nwhere schemaname = 'public'\nand tablename = '${TABLE}';`);
sql("C — Policies ?", `select policyname, cmd\nfrom pg_policies\nwhere schemaname = 'public'\nand tablename = '${TABLE}'\norder by cmd, policyname;`);
sql("D — Contraintes ?", `select conname\nfrom pg_constraint\nwhere conrelid = 'public.${TABLE}'::regclass\norder by conname;`);
sql("E — Index ?", `select indexname, indexdef\nfrom pg_indexes\nwhere schemaname = 'public'\nand tablename = '${TABLE}'\norder by indexname;`);
sql("F — Last rows after POST test ?",
  `select id, user_id, company_id, draft_id, command_id, plan_id, employee_key, kind, status,\nsafety_flags, created_at, updated_at\nfrom public.${TABLE}\norder by updated_at desc\nlimit 5;`);
sql("G — Safety flags check ?",
  `select draft_id,\nsafety_flags->>'execution_enabled' as execution_enabled,\nsafety_flags->>'db_write_enabled' as db_write_enabled,\nsafety_flags->>'api_execution_enabled' as api_execution_enabled,\nsafety_flags->>'pierre_engine_called' as pierre_engine_called,\nsafety_flags->>'ai_call_performed' as ai_call_performed,\nsafety_flags->>'email_sent' as email_sent,\nsafety_flags->>'message_sent' as message_sent,\nsafety_flags->>'document_generated' as document_generated,\nsafety_flags->>'clonevoice_active' as clonevoice_active,\nsafety_flags->>'public_launch_external_validated' as public_launch_external_validated\nfrom public.${TABLE}\norder by updated_at desc\nlimit 5;`);

// ── E. Ordre des étapes manuelles ─────────────────────────────────────────────

step("E", "Ordre exact d'activation (manuel)");

const steps = [
  "Garder flag false.",
  "npm run dev.",
  "Vérifier POST mission-drafts → 423 (avant activation).",
  `Appliquer SQL P4.4 manuellement dans Supabase SQL Editor.`,
  "Vérifier table/RLS/policies/constraints/indexes (requêtes A→E).",
  `Activer ${FLAG}=true dans .env.local (test local uniquement).`,
  "Redémarrer l'app.",
  "Se connecter.",
  "Créer une simulation + préparer un brouillon.",
  "Sauvegarder le brouillon (POST mission-drafts).",
  "Vérifier POST → 200 · db_write_performed true.",
  "Vérifier row Supabase (requête F).",
  "Vérifier safety_flags tous false (requête G).",
  "Rollback : remettre flag false.",
  "Redémarrer.",
  "Vérifier POST → 423.",
  "Vérifier localStorage restore encore OK.",
  "Remplir l'evidence template P4.6.",
];
steps.forEach((s, i) => log(`  ${String(i + 1).padStart(2, "0")}. ${s}`));

// ── F. Commandes ──────────────────────────────────────────────────────────────

step("F", "Commandes à lancer");

log("  npm run check:runtime-mission-draft-manual-activation-qa");
log("  npm run test:phase4-6");
log("  npm run test:phase4-5");
log("  npm run test:phase4-4");
log("  npm run build");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("SQL à appliquer MANUELLEMENT. Flag à activer MANUELLEMENT (default false).");
info("POST 423 tant que flag false. Brouillon uniquement — aucune mission réelle.");
info("Aucun appel Pierre. Aucune exécution. CloneVoice non actif.");
info("go-live-proofs.local.json ne doit pas être modifié.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — artefacts P4.6 cohérents (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" SQL non appliqué auto · flag default false · POST 423 · lancement public externe non validé.");
log("═".repeat(60) + "\n");
