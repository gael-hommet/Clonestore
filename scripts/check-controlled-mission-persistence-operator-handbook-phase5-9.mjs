#!/usr/bin/env node
// scripts/check-controlled-mission-persistence-operator-handbook-phase5-9.mjs
// PHASE 5.9 — Controlled Mission Persistence Operator Handbook — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucune activation. Aucun GET/POST serveur. Aucune
// route. Aucun SQL appliqué. Aucune exécution. Handbook opérateur design-only.
//
// Usage :
//   node scripts/check-controlled-mission-persistence-operator-handbook-phase5-9.mjs
//   npm run check:controlled-mission-persistence-operator-handbook

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
log(" PHASE 5.9 — Controlled Mission Persistence Operator Handbook — Check");
log("═".repeat(60));
log(" Lecture seule. Handbook opérateur design-only. Aucune activation. Aucune exécution.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.9 + docs ─────────────────────────────────────────────────────

step("A", "Modules P5.9 + docs");

const modules = [
  ["Types", `${RI}/controlled-mission-persistence-operator-handbook-types.ts`],
  ["Handbook", `${RI}/controlled-mission-persistence-operator-handbook.ts`],
  ["UI copy", `${RI}/controlled-mission-persistence-operator-handbook-ui-copy.ts`],
  ["QA", `${RI}/controlled-mission-persistence-operator-handbook-qa.ts`],
  ["Doc P5.9", "docs/PHASE_5_9_CONTROLLED_MISSION_PERSISTENCE_OPERATOR_HANDBOOK.md"],
  ["Operator handbook doc", "docs/operator/CONTROLLED_MISSION_PERSISTENCE_OPERATOR_HANDBOOK.md"],
  ["Evidence template P5.9", "docs/templates/PHASE_5_9_CONTROLLED_MISSION_PERSISTENCE_OPERATOR_HANDBOOK_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P5.9 (scan read-only) ───────────────────────────────
// La QA énumère les noms de checks (« no_fetch_in_modules »…) → exclue du scan mot-à-mot.

step("B", "Invariants modules P5.9 (scan read-only)");

const codeLabels = ["Types", "Handbook", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.9 — token write DB détecté"); needsReview++; }
else ok("Modules P5.9 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P5.9 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.9 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.9 — client base de données détecté"); needsReview++; }
else ok("Modules P5.9 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.9 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.9 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.9 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P5.9 — aucune référence route API littérale");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.9 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.9 — aucun appel OpenAI/Anthropic/Stripe");

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
if (pkg.includes("test:phase5-9")) ok("test:phase5-9");
else { warn("MANQUANT : test:phase5-9"); needsReview++; }
if (pkg.includes("check:controlled-mission-persistence-operator-handbook")) ok("check:controlled-mission-persistence-operator-handbook");
else { warn("MANQUANT : check:controlled-mission-persistence-operator-handbook"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI Handbook opérateur (page, design-only)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_HANDBOOK_MICROCOPY")) ok("Microcopy « Handbook opérateur design-only » câblée (constante)");
else { warn("Microcopy Handbook absente"); needsReview++; }
if (page.includes("CONTROLLED_MISSION_HANDBOOK_NO_GET_POST")) ok("« Aucun GET/POST serveur » câblé (constante)");
else { warn("« Aucun GET/POST serveur » absent"); needsReview++; }
if (page.includes("buildControlledMissionPersistenceOperatorHandbook")) ok("Handbook câblé");
else { warn("Handbook non câblé"); needsReview++; }
if (/Appliquer SQL|Activer flag|Activer handbook|Activer le serveur|Persister serveur|Restaurer depuis serveur|Synchroniser serveur|Exécuter la mission|Lancer la mission/.test(page)) { warn("Action activation/exécution active détectée"); needsReview++; }
else ok("Aucune action Appliquer SQL / Activer flag / Persister / Restaurer / Synchroniser / Exécuter");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Handbook opérateur design-only. Aucune activation. localStorage source active.");
info("Aucune route. Aucun GET/POST serveur. Aucun SQL appliqué. Flag serveur default false.");
info("Aucune mission serveur réelle. Aucune exécution. Aucun appel Pierre / IA.");
info("persistence ≠ execution · restore ≠ execution · sync ≠ execution.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Handbook opérateur P5 cohérent (lecture seule, design-only).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Handbook opérateur design-only · aucune activation · localStorage source active · aucune exécution.");
log("═".repeat(60) + "\n");
