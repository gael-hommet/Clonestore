#!/usr/bin/env node
// scripts/check-runtime-mission-draft-persistence-design.mjs
// PHASE 4.4 — Runtime Mission Draft Safe Persistence Design — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL exécuté. Aucun POST. Aucun Supabase.
// Aucune modification .env.local / go-live-proofs.local.json. Aucune mission créée.
//
// Usage :
//   node scripts/check-runtime-mission-draft-persistence-design.mjs
//   npm run check:runtime-mission-draft-persistence-design

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
log(" PHASE 4.4 — Runtime Mission Draft Safe Persistence Design — Check");
log("═".repeat(60));
log(" Lecture seule. Aucun write. Aucun SQL exécuté. Aucune mission créée.");
log("═".repeat(60) + "\n");

// ── A. Fichiers ───────────────────────────────────────────────────────────────

step("A", "Vérification des fichiers P4.4");

const files = [
  ["SQL draft", "supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql"],
  ["Persistence types", "src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-types.ts"],
  ["Persistence flags", "src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-flags.ts"],
  ["Persistence design", "src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-design.ts"],
  ["Persistence health", "src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-health.ts"],
  ["LocalStorage design", "src/lib/clonestore/runtime-integration/runtime-mission-draft-localstorage-design.ts"],
  ["Persistence QA", "src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-qa.ts"],
  ["Doc P4.4", "docs/PHASE_4_4_RUNTIME_MISSION_DRAFT_SAFE_PERSISTENCE_DESIGN.md"],
  ["Evidence template", "docs/templates/PHASE_4_4_RUNTIME_MISSION_DRAFT_PERSISTENCE_DESIGN_EVIDENCE.md"],
];
for (const [label, file] of files) {
  if (existsSync(resolve(ROOT, file))) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. SQL draft : table + RLS + safety flags ─────────────────────────────────

step("B", "SQL draft (lecture seule)");

const sqlSrc = read("supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql");
if (sqlSrc.includes(TABLE)) ok(`Table ${TABLE} déclarée`);
else { warn(`Table ${TABLE} absente du SQL`); needsReview++; }
if (sqlSrc.toLowerCase().includes("enable row level security")) ok("RLS déclarée");
else { warn("RLS absente"); needsReview++; }
if (sqlSrc.includes("execution_enabled") && sqlSrc.includes("db_write_enabled")) ok("Contraintes safety_flags présentes");
else { warn("Contraintes safety_flags absentes"); needsReview++; }
if (!/for\s+delete/i.test(sqlSrc)) ok("Aucune policy DELETE (préservation)");
else { warn("Policy DELETE détectée"); needsReview++; }

// ── C. Feature flag ───────────────────────────────────────────────────────────

step("C", "Feature flag");

const flagValue = process.env[FLAG];
if (flagValue === "true") {
  ok(`Flag ACTIVÉ — ${FLAG}=true`);
} else {
  info(`Flag = ${flagValue ?? "(non défini)"} — DÉSACTIVÉ (default false, safe).`);
  info(`Pour activer après SQL + RLS + safe apply (PHASE 4.5) : ${FLAG}=true`);
}

// ── D. Invariants modules / pages ─────────────────────────────────────────────

step("D", "Invariants modules / pages (scan read-only)");

const p44Blob = files
  .filter(([l]) => l.startsWith("Persistence") || l.startsWith("LocalStorage"))
  .map(([, f]) => read(f))
  .join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => p44Blob.includes(t))) { warn("Modules P4.4 — token write détecté"); needsReview++; }
else ok("Modules P4.4 — aucun token write");
if (/createClient\s*\(/.test(p44Blob) || /from\s+["']@supabase\/supabase-js["']/.test(p44Blob)) { warn("Modules P4.4 — Supabase client détecté"); needsReview++; }
else ok("Modules P4.4 — aucun Supabase client");
if (/from\s+["']@\/lib\/pierre/.test(p44Blob)) { warn("Modules P4.4 — import Pierre détecté"); needsReview++; }
else ok("Modules P4.4 — aucun import Pierre moteur");
if (/localStorage\.setItem/.test(p44Blob)) { warn("Modules P4.4 — localStorage.setItem détecté"); needsReview++; }
else ok("Modules P4.4 — aucun localStorage.setItem");

// P4.4 : aucune persistance. P4.5 : safe apply localStorage-first (helper), jamais
// de fetch POST direct vers la route mission-drafts depuis la page.
const messagesPage = read("src/app/profile/messages/page.tsx");
if (/fetch\s*\([^)]*mission-drafts/s.test(messagesPage)) {
  warn("/profile/messages — fetch POST direct mission-drafts détecté"); needsReview++;
} else ok("/profile/messages — aucun fetch POST direct mission-drafts (safe apply via helper)");

// Aucune route de persistance créée
if (existsSync(resolve(ROOT, "src/app/api/clonestore/runtime/mission-draft/route.ts"))) {
  warn("Route de persistance draft détectée — non attendue en P4.4"); needsReview++;
} else ok("Aucune route de persistance draft créée (attendu)");

// ── E. Requêtes SQL manuelles ─────────────────────────────────────────────────

step("E", "Requêtes SQL manuelles (Supabase SQL Editor — lecture seule)");

sql("A — Table existe ?",
  `select table_name\nfrom information_schema.tables\nwhere table_schema = 'public'\nand table_name = '${TABLE}';`);
sql("B — RLS activée ?",
  `select tablename, rowsecurity\nfrom pg_tables\nwhere schemaname = 'public'\nand tablename = '${TABLE}';`);
sql("C — Policies ?",
  `select policyname, cmd\nfrom pg_policies\nwhere schemaname = 'public'\nand tablename = '${TABLE}'\norder by cmd, policyname;`);
sql("D — Contraintes ?",
  `select conname\nfrom pg_constraint\nwhere conrelid = 'public.${TABLE}'::regclass\norder by conname;`);
sql("E — Index ?",
  `select indexname, indexdef\nfrom pg_indexes\nwhere schemaname = 'public'\nand tablename = '${TABLE}'\norder by indexname;`);

// ── F. Commandes ──────────────────────────────────────────────────────────────

step("F", "Commandes à lancer");

log("  npm run check:runtime-mission-draft-persistence-design");
log("  npm run test:phase4-4");
log("  npm run test:phase4-3");
log("  npm run test:phase4-2");
log("  npm run build");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("SQL à appliquer MANUELLEMENT — jamais automatiquement.");
info("Flag à activer MANUELLEMENT (default false).");
info("Aucune route POST de persistance créée. Aucune mission créée en base.");
info("Aucun appel Pierre. Aucune exécution. CloneVoice non actif.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — design de persistance cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" SQL non appliqué · flag default false · aucun write · lancement public externe non validé.");
log("═".repeat(60) + "\n");
