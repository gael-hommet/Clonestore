#!/usr/bin/env node
// scripts/check-controlled-mission-server-restore-ui-phase5-6.mjs
// PHASE 5.6 — Controlled Mission Server Restore UI Polish — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun GET serveur. Aucune route. Aucune DB.
// Aucun SQL appliqué. Restauration serveur design-only. localStorage source active.
//
// Usage :
//   node scripts/check-controlled-mission-server-restore-ui-phase5-6.mjs
//   npm run check:controlled-mission-server-restore-ui

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
function has(rel) { return existsSync(resolve(ROOT, rel)); }
function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function step(n, msg) { console.log(`\n${"─".repeat(60)}\n  ÉTAPE ${n} — ${msg}\n`); }

let needsReview = 0;

log("\n" + "═".repeat(60));
log(" PHASE 5.6 — Controlled Mission Server Restore UI — Check");
log("═".repeat(60));
log(" Lecture seule. Restauration serveur non active. localStorage source active.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.6 + docs ─────────────────────────────────────────────────────

step("A", "Modules P5.6 + docs");

const modules = [
  ["Types", `${RI}/controlled-mission-server-restore-types.ts`],
  ["Design", `${RI}/controlled-mission-server-restore-design.ts`],
  ["UI copy", `${RI}/controlled-mission-server-restore-ui-copy.ts`],
  ["QA", `${RI}/controlled-mission-server-restore-qa.ts`],
  ["Doc P5.6", "docs/PHASE_5_6_CONTROLLED_MISSION_SERVER_RESTORE_UI_POLISH.md"],
  ["Evidence template P5.6", "docs/templates/PHASE_5_6_CONTROLLED_MISSION_SERVER_RESTORE_UI_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P5.6 (scan read-only) ───────────────────────────────
// La QA énumère les noms de checks (« no_fetch_in_modules »…) → exclue du scan mot-à-mot.

step("B", "Invariants modules P5.6 (scan read-only)");

const codeLabels = ["Types", "Design", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.6 — token write DB détecté"); needsReview++; }
else ok("Modules P5.6 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P5.6 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.6 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.6 — client base de données détecté"); needsReview++; }
else ok("Modules P5.6 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.6 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.6 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.6 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P5.6 — aucune référence route API littérale");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.6 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.6 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. Routes interdites (absentes) ───────────────────────────────────────────

step("C", "Routes serveur interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/restore/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/pierre/runtime/execute/route.ts",
  "src/app/api/cloneos/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── D. SQL P5.4 DO NOT APPLY + flag default false ─────────────────────────────

step("D", "SQL P5.4 (non appliqué) + flag default false");

const sqlFile = read("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
if (sqlFile.includes("DO NOT APPLY")) ok("SQL P5.4 contient « DO NOT APPLY »");
else { warn("SQL P5.4 manque « DO NOT APPLY »"); needsReview++; }
const policy = read(`${RI}/controlled-mission-server-persistence-policy.ts`);
if (/DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED\s*=\s*false/.test(policy)) ok("Flag serveur default false");
else { warn("Flag serveur default false absent"); needsReview++; }

// ── E. Package scripts ────────────────────────────────────────────────────────

step("E", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase5-6")) ok("test:phase5-6");
else { warn("MANQUANT : test:phase5-6"); needsReview++; }
if (pkg.includes("check:controlled-mission-server-restore-ui")) ok("check:controlled-mission-server-restore-ui");
else { warn("MANQUANT : check:controlled-mission-server-restore-ui"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI restauration serveur (page, design-only)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY")) ok("Microcopy « Restauration serveur non active » câblée (constante)");
else { warn("Microcopy restauration absente"); needsReview++; }
if (page.includes("CONTROLLED_MISSION_SERVER_RESTORE_NO_GET")) ok("« Aucun GET serveur » câblé (constante)");
else { warn("« Aucun GET serveur » absent"); needsReview++; }
if (page.includes("buildControlledMissionServerRestoreDesignState")) ok("État restore câblé");
else { warn("État restore non câblé"); needsReview++; }
if (/Restaurer depuis serveur|Charger serveur|Synchroniser serveur|Activer serveur|Appliquer SQL|Créer route|Exécuter la mission|Lancer la mission/.test(page)) { warn("Action restore/activation/exécution active détectée"); needsReview++; }
else ok("Aucune action Restaurer / Charger / Synchroniser / Activer serveur");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Restauration serveur non active. Aucun GET serveur. localStorage source active.");
info("Aucune route restore. Aucun SQL appliqué. Flag serveur default false.");
info("Aucune mission serveur réelle. Aucune exécution. Aucun appel Pierre / IA.");
info("Aucun email/document/PDF. CloneVoice non actif.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — UI de restauration serveur design-only cohérente (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Restauration serveur non active · localStorage source active · aucune exécution.");
log("═".repeat(60) + "\n");
