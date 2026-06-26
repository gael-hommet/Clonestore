#!/usr/bin/env node
// scripts/check-runtime-controlled-mission-persistence-design.mjs
// PHASE 4.10 — Controlled Mission Governed Persistence Design — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL exécuté. Aucun POST. Aucun Supabase.
// Aucune modification .env.local / go-live-proofs.local.json. Aucune mission créée.
//
// Usage :
//   node scripts/check-runtime-controlled-mission-persistence-design.mjs
//   npm run check:runtime-controlled-mission-persistence-design

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
function sqlBlock(label, query) { console.log(`\n  [SQL ${label}]\n  ${query.replace(/\n/g, "\n  ")}\n`); }

const TABLE = "clonestore_controlled_mission_candidates";
const FLAG = "NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED";
let needsReview = 0;

log("\n" + "═".repeat(60));
log(" PHASE 4.10 — Controlled Mission Governed Persistence Design — Check");
log("═".repeat(60));
log(" Lecture seule. Aucun write. Aucun SQL exécuté. Aucune mission créée.");
log("═".repeat(60) + "\n");

// ── A. Fichiers ───────────────────────────────────────────────────────────────

step("A", "Vérification des fichiers P4.10");

const RI = "src/lib/clonestore/runtime-integration";
const files = [
  ["SQL draft", "supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql"],
  ["Persistence types", `${RI}/runtime-controlled-mission-persistence-types.ts`],
  ["Persistence flags", `${RI}/runtime-controlled-mission-persistence-flags.ts`],
  ["Persistence design", `${RI}/runtime-controlled-mission-persistence-design.ts`],
  ["Persistence health", `${RI}/runtime-controlled-mission-persistence-health.ts`],
  ["LocalStorage design", `${RI}/runtime-controlled-mission-localstorage-design.ts`],
  ["Persistence QA", `${RI}/runtime-controlled-mission-persistence-qa.ts`],
  ["Doc P4.10", "docs/PHASE_4_10_CONTROLLED_MISSION_GOVERNED_PERSISTENCE_DESIGN.md"],
  ["Evidence template", "docs/templates/PHASE_4_10_CONTROLLED_MISSION_PERSISTENCE_DESIGN_EVIDENCE.md"],
];
for (const [label, file] of files) {
  if (existsSync(resolve(ROOT, file))) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. SQL draft : table + RLS + gouvernance ──────────────────────────────────

step("B", "SQL draft (lecture seule)");

const sqlSrc = read("supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql");
if (sqlSrc.includes(TABLE)) ok(`Table ${TABLE} déclarée`);
else { warn(`Table ${TABLE} absente du SQL`); needsReview++; }
if (sqlSrc.toLowerCase().includes("enable row level security")) ok("RLS déclarée");
else { warn("RLS absente"); needsReview++; }
if (sqlSrc.includes("promotion_applied") && sqlSrc.includes("execution_enabled")) ok("Contraintes no-execution présentes");
else { warn("Contraintes no-execution absentes"); needsReview++; }
if (sqlSrc.includes("human_validation_required")) ok("Contrainte human_validation_required présente");
else { warn("Contrainte human_validation_required absente"); needsReview++; }
if (sqlSrc.includes("preview_only") && sqlSrc.includes("read_only")) ok("Contraintes preview_only/read_only présentes");
else { warn("Contraintes preview_only/read_only absentes"); needsReview++; }
if (!/for\s+delete/i.test(sqlSrc)) ok("Aucune policy DELETE (préservation)");
else { warn("Policy DELETE détectée"); needsReview++; }

// ── C. Feature flag ───────────────────────────────────────────────────────────

step("C", "Feature flag");

const flagValue = process.env[FLAG];
if (flagValue === "true") {
  ok(`Flag ACTIVÉ — ${FLAG}=true`);
} else {
  info(`Flag = ${flagValue ?? "(non défini)"} — DÉSACTIVÉ (default false, safe).`);
  info(`Pour activer après SQL + RLS + validation humaine + safe apply (PHASE 4.11+) : ${FLAG}=true`);
}

// ── D. Invariants modules / pages (scan read-only) ────────────────────────────

step("D", "Invariants modules / pages (scan read-only)");

const blob = files
  .filter(([l]) => l.startsWith("Persistence") || l.startsWith("LocalStorage"))
  .map(([, f]) => read(f))
  .join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P4.10 — token write détecté"); needsReview++; }
else ok("Modules P4.10 — aucun token write");
if (/createClient\s*\(/.test(blob) || /from\s+["']@supabase\/supabase-js["']/.test(blob)) { warn("Modules P4.10 — client base de données détecté"); needsReview++; }
else ok("Modules P4.10 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P4.10 — import Pierre détecté"); needsReview++; }
else ok("Modules P4.10 — aucun import Pierre moteur");
if (/localStorage\.setItem/.test(blob)) { warn("Modules P4.10 — écriture navigateur détectée"); needsReview++; }
else ok("Modules P4.10 — aucune écriture navigateur");

// Aucune route POST de persistance candidate
const candidateRoute = "src/app/api/clonestore/runtime/controlled-mission-candidates/route.ts";
if (existsSync(resolve(ROOT, candidateRoute))) { warn("Route POST candidate détectée — non attendue en P4.10"); needsReview++; }
else ok("Aucune route POST de persistance candidate créée (attendu)");

// /profile/messages ne doit pas référencer la table candidate (aucun POST)
const messagesPage = read("src/app/profile/messages/page.tsx");
if (messagesPage.includes(TABLE)) { warn("/profile/messages référence la table candidate — non attendu en P4.10"); needsReview++; }
else ok("/profile/messages — aucune persistance candidate (aucun POST)");

// Package scripts présents
const pkg = read("package.json");
if (pkg.includes("test:phase4-10")) ok("package.json — test:phase4-10 présent");
else { warn("package.json — test:phase4-10 absent"); needsReview++; }
if (pkg.includes("check:runtime-controlled-mission-persistence-design")) ok("package.json — check script présent");
else { warn("package.json — check script absent"); needsReview++; }

// ── E. Requêtes SQL manuelles (Supabase SQL Editor — lecture seule) ───────────

step("E", "Requêtes SQL manuelles (lecture seule)");

sqlBlock("A — Table existe ?",
  `select table_name\nfrom information_schema.tables\nwhere table_schema = 'public'\nand table_name = '${TABLE}';`);
sqlBlock("B — RLS activée ?",
  `select tablename, rowsecurity\nfrom pg_tables\nwhere schemaname = 'public'\nand tablename = '${TABLE}';`);
sqlBlock("C — Policies ?",
  `select policyname, cmd\nfrom pg_policies\nwhere schemaname = 'public'\nand tablename = '${TABLE}'\norder by cmd, policyname;`);
sqlBlock("D — Contraintes ?",
  `select conname\nfrom pg_constraint\nwhere conrelid = 'public.${TABLE}'::regclass\norder by conname;`);
sqlBlock("E — Index ?",
  `select indexname, indexdef\nfrom pg_indexes\nwhere schemaname = 'public'\nand tablename = '${TABLE}'\norder by indexname;`);
sqlBlock("F — Safety flags (échantillon) ?",
  `select candidate_id, promotion_id, draft_id, promotion_applied, mission_created,\n  execution_enabled, human_validation_required, preview_only, read_only, safety_flags\nfrom public.${TABLE}\norder by updated_at desc\nlimit 5;`);

// ── F. Commandes ──────────────────────────────────────────────────────────────

step("F", "Commandes à lancer");

log("  npm run check:runtime-controlled-mission-persistence-design");
log("  npm run test:phase4-10");
log("  npm run test:phase4-9");
log("  npm run test:phase4-8");
log("  npm run build");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("SQL à appliquer MANUELLEMENT — jamais automatiquement.");
info("Flag à activer MANUELLEMENT (default false).");
info("Aucune route POST de persistance créée. Aucune mission créée en base.");
info("promotion_applied false. human_validation_required true. Aucune exécution.");
info("Aucun appel Pierre. CloneVoice non actif.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — design de persistance gouvernée cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" SQL non appliqué · flag default false · aucun write · lancement public externe non validé.");
log("═".repeat(60) + "\n");
