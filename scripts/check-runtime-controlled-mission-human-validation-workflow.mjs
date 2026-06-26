#!/usr/bin/env node
// scripts/check-runtime-controlled-mission-human-validation-workflow.mjs
// PHASE 4.11 — Controlled Mission Human Validation Workflow — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL exécuté. Aucun POST. Aucun Supabase.
// Aucune approbation appliquée. Aucune mission créée. Aucune exécution.
//
// Usage :
//   node scripts/check-runtime-controlled-mission-human-validation-workflow.mjs
//   npm run check:runtime-controlled-mission-human-validation-workflow

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

let needsReview = 0;

log("\n" + "═".repeat(60));
log(" PHASE 4.11 — Controlled Mission Human Validation Workflow — Check");
log("═".repeat(60));
log(" Lecture seule. Aucun write. Aucune approbation appliquée. Aucune mission.");
log("═".repeat(60) + "\n");

// ── A. Fichiers ───────────────────────────────────────────────────────────────

step("A", "Vérification des fichiers P4.11");

const RI = "src/lib/clonestore/runtime-integration";
const files = [
  ["Types", `${RI}/runtime-controlled-mission-human-validation-types.ts`],
  ["Policy", `${RI}/runtime-controlled-mission-human-validation-policy.ts`],
  ["Gates", `${RI}/runtime-controlled-mission-human-validation-gates.ts`],
  ["Workflow", `${RI}/runtime-controlled-mission-human-validation-workflow.ts`],
  ["Snapshot", `${RI}/runtime-controlled-mission-human-validation-snapshot.ts`],
  ["QA", `${RI}/runtime-controlled-mission-human-validation-qa.ts`],
  ["Doc P4.11", "docs/PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_DESIGN.md"],
  ["Evidence template", "docs/templates/PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_EVIDENCE.md"],
];
for (const [label, file] of files) {
  if (existsSync(resolve(ROOT, file))) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules (scan read-only) ────────────────────────────────────

step("B", "Invariants modules (scan read-only)");

const blob = files
  .filter(([l]) => ["Types", "Policy", "Gates", "Workflow", "Snapshot"].includes(l))
  .map(([, f]) => read(f))
  .join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P4.11 — token write détecté"); needsReview++; }
else ok("Modules P4.11 — aucun token write");
if (/createClient\s*\(/.test(blob) || /from\s+["']@supabase\/supabase-js["']/.test(blob)) { warn("Modules P4.11 — client base de données détecté"); needsReview++; }
else ok("Modules P4.11 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P4.11 — import Pierre détecté"); needsReview++; }
else ok("Modules P4.11 — aucun import Pierre moteur");
if (/\/api\/pierre/.test(blob)) { warn("Modules P4.11 — référence /api/pierre détectée"); needsReview++; }
else ok("Modules P4.11 — aucune référence /api/pierre");

// Aucune route POST approve/reject
const validationRoute = "src/app/api/clonestore/runtime/controlled-mission-validation/route.ts";
if (existsSync(resolve(ROOT, validationRoute))) { warn("Route POST validation détectée — non attendue en P4.11"); needsReview++; }
else ok("Aucune route POST approve/reject créée (attendu)");

// Package scripts présents
const pkg = read("package.json");
if (pkg.includes("test:phase4-11")) ok("package.json — test:phase4-11 présent");
else { warn("package.json — test:phase4-11 absent"); needsReview++; }
if (pkg.includes("check:runtime-controlled-mission-human-validation-workflow")) ok("package.json — check script présent");
else { warn("package.json — check script absent"); needsReview++; }

// ── C. Étapes humaines (design) ───────────────────────────────────────────────

step("C", "Étapes humaines (design — aucune exécution)");

const humanSteps = [
  "1. Créer l'aperçu de candidate de mission contrôlée (contrat de promotion).",
  "2. Classer la sensibilité (RH sensible / juridique / bloqué).",
  "3. Construire les gates de validation humaine.",
  "4. Assigner les validateurs (validator / second / hr_manager / legal_reviewer).",
  "5. Décision : approve_preview / request_changes / reject / block / escalate.",
  "6. Trace preview (CloneTrace, design).",
  "7. Aucune exécution — approval_applied false.",
  "8. Phase future : safe apply gouverné (PHASE 4.12+).",
];
for (const stepLine of humanSteps) info(stepLine);

// ── D. Commandes ──────────────────────────────────────────────────────────────

step("D", "Commandes à lancer");

log("  npm run check:runtime-controlled-mission-human-validation-workflow");
log("  npm run test:phase4-11");
log("  npm run test:phase4-10");
log("  npm run build");

// ── E. Rappels ────────────────────────────────────────────────────────────────

step("E", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Aucune route POST approve/reject créée. Aucune approbation appliquée.");
info("approved_preview ne crée AUCUNE vraie mission. approval_applied false.");
info("Aucune mission réelle. Aucune exécution. Aucun appel Pierre. Aucun appel IA.");
info("CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — design de validation humaine cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Aucune approbation appliquée · aucun write · lancement public externe non validé.");
log("═".repeat(60) + "\n");
