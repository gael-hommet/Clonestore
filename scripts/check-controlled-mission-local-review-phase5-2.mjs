#!/usr/bin/env node
// scripts/check-controlled-mission-local-review-phase5-2.mjs
// PHASE 5.2 — Controlled Mission Local Review & Manual Validation — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL. Aucun POST. Aucun Supabase.
// Aucune route execute. Aucune exécution. localStorage-first uniquement.
// Approbation locale = jamais exécution.
//
// Usage :
//   node scripts/check-controlled-mission-local-review-phase5-2.mjs
//   npm run check:controlled-mission-local-review

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
log(" PHASE 5.2 — Controlled Mission Local Review & Manual Validation — Check");
log("═".repeat(60));
log(" Lecture seule. Approbation locale = jamais exécution. localStorage-first.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.2 ───────────────────────────────────────────────────────────

step("A", "Modules P5.2");

const modules = [
  ["Review types", `${RI}/controlled-mission-local-review-types.ts`],
  ["Review", `${RI}/controlled-mission-local-review.ts`],
  ["Review UI copy", `${RI}/controlled-mission-local-review-ui-copy.ts`],
  ["Review QA", `${RI}/controlled-mission-local-review-qa.ts`],
  ["Doc P5.2", "docs/PHASE_5_2_CONTROLLED_MISSION_LOCAL_REVIEW_MANUAL_VALIDATION.md"],
  ["Evidence template", "docs/templates/PHASE_5_2_CONTROLLED_MISSION_LOCAL_REVIEW_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules (scan read-only) ────────────────────────────────────

step("B", "Invariants modules (scan read-only)");

const blob = modules
  .filter(([l]) => ["Review types", "Review", "Review UI copy", "Review QA"].includes(l))
  .map(([, f]) => read(f))
  .join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
const netToken = "fe" + "tch(";
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.2 — token write DB détecté"); needsReview++; }
else ok("Modules P5.2 — aucun token write DB");
if (blob.includes(netToken)) { warn("Modules P5.2 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.2 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.2 — client base de données détecté"); needsReview++; }
else ok("Modules P5.2 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.2 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.2 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.2 — référence route API détectée"); needsReview++; }
else ok("Modules P5.2 — aucune référence route API");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.2 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.2 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. Routes execute interdites (absentes) ───────────────────────────────────

step("C", "Routes execute interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/pierre/runtime/execute/route.ts",
  "src/app/api/cloneos/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route execute présente : ${r}`); needsReview++; }
}

// ── D. Package scripts ────────────────────────────────────────────────────────

step("D", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase5-2")) ok("test:phase5-2");
else { warn("MANQUANT : test:phase5-2"); needsReview++; }
if (pkg.includes("check:controlled-mission-local-review")) ok("check:controlled-mission-local-review");
else { warn("MANQUANT : check:controlled-mission-local-review"); needsReview++; }

// ── E. UI review (page) ───────────────────────────────────────────────────────

step("E", "UI review (page)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_REVIEW_APPROVE_LABEL")) ok("Action « Approuver localement » présente (microcopy via constante)");
else { warn("Action approuver localement absente"); needsReview++; }
if (page.includes("approveLocalControlledMission")) ok("Review câblée (approveLocalControlledMission)");
else { warn("approveLocalControlledMission non câblé"); needsReview++; }
if (page.includes("CONTROLLED_MISSION_REVIEW_PANEL_GUARDRAIL")) ok("Guardrail panneau review présent");
else { warn("Guardrail panneau review absent"); needsReview++; }
// Aucune action d'exécution dans la section review.
if (/Exécuter la mission|Lancer la mission|Démarrer Pierre|Automatiser la mission/.test(page)) { warn("Action d'exécution détectée"); needsReview++; }
else ok("Aucune action Exécuter / Lancer / Démarrer Pierre / Automatiser");

// ── F. Commandes ──────────────────────────────────────────────────────────────

step("F", "Commandes à lancer");

log("  npm run check:controlled-mission-local-review");
log("  npm run test:phase5-2");
log("  npm run test:phase5-1");
log("  npm run check:controlled-mission-safe-apply");
log("  npm run build");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Approbation locale uniquement. Même approuvée, la mission n'est PAS exécutée.");
info("localStorage-first. Aucune persistance serveur. Aucune route execute.");
info("Aucune mission réelle. Aucun appel Pierre / IA. Aucun email/document/PDF.");
info("CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — review locale cohérente (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Approbation locale · aucune exécution · aucun serveur · lancement public externe non validé.");
log("═".repeat(60) + "\n");
