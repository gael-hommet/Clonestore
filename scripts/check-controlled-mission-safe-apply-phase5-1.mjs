#!/usr/bin/env node
// scripts/check-controlled-mission-safe-apply-phase5-1.mjs
// PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL. Aucun POST. Aucun Supabase.
// Aucune route execute créée. Aucune exécution. localStorage-first uniquement.
//
// Usage :
//   node scripts/check-controlled-mission-safe-apply-phase5-1.mjs
//   npm run check:controlled-mission-safe-apply

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
log(" PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First — Check");
log("═".repeat(60));
log(" Lecture seule. localStorage-first. Aucune exécution. Aucun serveur.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.1 ───────────────────────────────────────────────────────────

step("A", "Modules P5.1");

const modules = [
  ["Types", `${RI}/controlled-mission-safe-apply-types.ts`],
  ["Safe apply", `${RI}/controlled-mission-safe-apply.ts`],
  ["LocalStorage", `${RI}/controlled-mission-local-storage.ts`],
  ["UI copy", `${RI}/controlled-mission-safe-apply-ui-copy.ts`],
  ["QA", `${RI}/controlled-mission-safe-apply-qa.ts`],
  ["Doc P5.1", "docs/PHASE_5_1_CONTROLLED_MISSION_SAFE_APPLY_LOCALSTORAGE_FIRST.md"],
  ["Evidence template", "docs/templates/PHASE_5_1_CONTROLLED_MISSION_SAFE_APPLY_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules (scan read-only) ────────────────────────────────────

step("B", "Invariants modules (scan read-only)");

const blob = modules
  .filter(([l]) => ["Types", "Safe apply", "LocalStorage", "UI copy", "QA"].includes(l))
  .map(([, f]) => read(f))
  .join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
const netToken = "fe" + "tch(";
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.1 — token write DB détecté"); needsReview++; }
else ok("Modules P5.1 — aucun token write DB");
if (blob.includes(netToken)) { warn("Modules P5.1 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.1 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.1 — client base de données détecté"); needsReview++; }
else ok("Modules P5.1 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.1 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.1 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.1 — référence route API détectée"); needsReview++; }
else ok("Modules P5.1 — aucune référence route API");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.1 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.1 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. Routes execute interdites (absentes) ───────────────────────────────────

step("C", "Routes execute interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
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
if (pkg.includes("test:phase5-1")) ok("test:phase5-1");
else { warn("MANQUANT : test:phase5-1"); needsReview++; }
if (pkg.includes("check:controlled-mission-safe-apply")) ok("check:controlled-mission-safe-apply");
else { warn("MANQUANT : check:controlled-mission-safe-apply"); needsReview++; }

// ── E. Microcopy / wording (page) ─────────────────────────────────────────────

step("E", "Microcopy localStorage-first (page)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Missions contrôlées locales")) ok("Section « Missions contrôlées locales » présente");
else { warn("Section missions contrôlées locales absente"); needsReview++; }
if (page.includes("CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL")) ok("Bouton « Créer une mission contrôlée locale » présent (microcopy via constante)");
else { warn("Bouton safe apply absent"); needsReview++; }
if (page.includes("createLocalControlledMission")) ok("Safe apply câblé (createLocalControlledMission)");
else { warn("createLocalControlledMission non câblé"); needsReview++; }

// ── F. Commandes ──────────────────────────────────────────────────────────────

step("F", "Commandes à lancer");

log("  npm run check:controlled-mission-safe-apply");
log("  npm run test:phase5-1");
log("  npm run test:phase4-12");
log("  npm run build");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("localStorage-first uniquement. Aucune persistance serveur. Aucune route execute.");
info("Mission préparée, pas exécutée. Pierre ne travaille pas en autonomie.");
info("Aucune mission réelle. Aucune exécution. Aucun appel Pierre / IA.");
info("Aucun email/document/PDF. CloneVoice non actif.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — safe apply local cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" localStorage-first · aucune exécution · aucun serveur · lancement public externe non validé.");
log("═".repeat(60) + "\n");
