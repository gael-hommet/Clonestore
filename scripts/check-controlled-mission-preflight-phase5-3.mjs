#!/usr/bin/env node
// scripts/check-controlled-mission-preflight-phase5-3.mjs
// PHASE 5.3 — Controlled Mission Local Execution Readiness Gate / Preflight — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL. Aucun POST. Aucun Supabase.
// Aucune route preflight/execute. Aucune exécution. localStorage-first uniquement.
// « ready » = candidate future exécution gouvernée, jamais exécution.
//
// Usage :
//   node scripts/check-controlled-mission-preflight-phase5-3.mjs
//   npm run check:controlled-mission-preflight

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
log(" PHASE 5.3 — Controlled Mission Preflight / Readiness Gate — Check");
log("═".repeat(60));
log(" Lecture seule. « ready » = candidate future, jamais exécution. localStorage-first.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.3 ───────────────────────────────────────────────────────────

step("A", "Modules P5.3");

const modules = [
  ["Preflight types", `${RI}/controlled-mission-preflight-types.ts`],
  ["Preflight", `${RI}/controlled-mission-preflight.ts`],
  ["Preflight UI copy", `${RI}/controlled-mission-preflight-ui-copy.ts`],
  ["Preflight QA", `${RI}/controlled-mission-preflight-qa.ts`],
  ["Doc P5.3", "docs/PHASE_5_3_CONTROLLED_MISSION_LOCAL_EXECUTION_READINESS_GATE.md"],
  ["Evidence template", "docs/templates/PHASE_5_3_CONTROLLED_MISSION_PREFLIGHT_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules (scan read-only) ────────────────────────────────────

step("B", "Invariants modules (scan read-only)");

const blob = modules
  .filter(([l]) => ["Preflight types", "Preflight", "Preflight UI copy", "Preflight QA"].includes(l))
  .map(([, f]) => read(f))
  .join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
const netToken = "fe" + "tch(";
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.3 — token write DB détecté"); needsReview++; }
else ok("Modules P5.3 — aucun token write DB");
if (blob.includes(netToken)) { warn("Modules P5.3 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.3 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.3 — client base de données détecté"); needsReview++; }
else ok("Modules P5.3 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.3 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.3 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.3 — référence route API détectée"); needsReview++; }
else ok("Modules P5.3 — aucune référence route API");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.3 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.3 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. Routes preflight / execute interdites (absentes) ───────────────────────

step("C", "Routes preflight / execute interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/preflight/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/pierre/runtime/execute/route.ts",
  "src/app/api/cloneos/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── D. Package scripts ────────────────────────────────────────────────────────

step("D", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase5-3")) ok("test:phase5-3");
else { warn("MANQUANT : test:phase5-3"); needsReview++; }
if (pkg.includes("check:controlled-mission-preflight")) ok("check:controlled-mission-preflight");
else { warn("MANQUANT : check:controlled-mission-preflight"); needsReview++; }

// ── E. UI preflight (page) ────────────────────────────────────────────────────

step("E", "UI preflight (page)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_PREFLIGHT_RUN_LABEL")) ok("Action « Lancer le preflight local » présente (microcopy via constante)");
else { warn("Action preflight absente"); needsReview++; }
if (page.includes("runLocalControlledMissionPreflight")) ok("Preflight câblé (runLocalControlledMissionPreflight)");
else { warn("runLocalControlledMissionPreflight non câblé"); needsReview++; }
if (page.includes("CONTROLLED_MISSION_PREFLIGHT_PANEL_GUARDRAIL")) ok("Guardrail panneau preflight présent");
else { warn("Guardrail panneau preflight absent"); needsReview++; }
if (/Exécuter la mission|Lancer la mission|Démarrer Pierre|Automatiser la mission|runtime activé/.test(page)) { warn("Action d'exécution détectée"); needsReview++; }
else ok("Aucune action Exécuter / Lancer / Démarrer Pierre / Automatiser");

// ── F. Commandes ──────────────────────────────────────────────────────────────

step("F", "Commandes à lancer");

log("  npm run check:controlled-mission-preflight");
log("  npm run test:phase5-3");
log("  npm run test:phase5-2");
log("  npm run test:phase5-1");
log("  npm run build");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("« ready » = candidate pour future exécution gouvernée, JAMAIS exécution.");
info("localStorage-first. Aucune persistance serveur. Aucune route preflight/execute.");
info("Aucune mission réelle. Aucun appel Pierre / IA. Aucun email/document/PDF.");
info("CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — readiness gate locale cohérente (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Preflight local · « ready » = candidate future · aucune exécution · lancement public externe non validé.");
log("═".repeat(60) + "\n");
