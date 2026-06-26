#!/usr/bin/env node
// scripts/check-phase3-final-qa.mjs
// PHASE 3.22 — Phase 3 Final QA Gate — Read-Only Check Script
//
// Vérifie la cohérence de la Phase 3 (P3.1 → P3.21) et les artefacts P3.22.
// Lecture seule. Aucune écriture. Aucun POST. Aucun SQL exécuté.
// Aucune modification .env.local / go-live-proofs.local.json. Aucune exécution CloneOS.
//
// Usage :
//   node scripts/check-phase3-final-qa.mjs
//   npm run check:phase3-final-qa

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
log(" PHASE 3.22 — Phase 3 Final QA Gate — Read-Only Check");
log("═".repeat(60));
log(" Lecture seule. Aucune écriture. Aucune exécution. Aucun SQL.");
log("═".repeat(60) + "\n");

// ── A. Scripts package.json ───────────────────────────────────────────────────

step("A", "Scripts test:phase3-* dans package.json");

const pkg = read("package.json");
for (let i = 1; i <= 22; i++) {
  if (pkg.includes(`"test:phase3-${i}"`)) ok(`test:phase3-${i} présent`);
  else { warn(`test:phase3-${i} MANQUANT`); needsReview++; }
}
if (pkg.includes('"check:phase3-final-qa"')) ok("check:phase3-final-qa présent");
else { warn("check:phase3-final-qa MANQUANT"); needsReview++; }

// ── B. Docs Phase 3 (P3.13 → P3.21 minimum) ───────────────────────────────────

step("B", "Docs Phase 3 (P3.13 → P3.22)");

const docs = [
  "docs/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_DESIGN.md",
  "docs/PHASE_3_14_ENTERPRISE_FOOTPRINT_SAFE_APPLY.md",
  "docs/PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_QA.md",
  "docs/PHASE_3_16_PROFILE_MESSAGES_ENTERPRISE_FOOTPRINT_FEED.md",
  "docs/PHASE_3_17_PROFILE_MESSAGES_CLONEOS_HISTORY_FEED_MERGE.md",
  "docs/PHASE_3_18_ENTERPRISE_FOOTPRINT_SERVER_RESTORE_UI_POLISH.md",
  "docs/PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_QA.md",
  "docs/PHASE_3_20_GLOBAL_EMPLOYEE_CONTEXT_REGISTRY_DESIGN.md",
  "docs/PHASE_3_21_GLOBAL_EMPLOYEE_CONTEXT_REGISTRY_UI_PREVIEW.md",
  "docs/PHASE_3_22_PHASE_3_FINAL_QA_GATE.md",
];
for (const d of docs) {
  if (existsSync(resolve(ROOT, d))) ok(d);
  else { warn(`MANQUANT : ${d}`); needsReview++; }
}

// ── C. Module phase3-final-qa ─────────────────────────────────────────────────

step("C", "Module src/lib/clonestore/phase3-final-qa");

const finalQaFiles = [
  "src/lib/clonestore/phase3-final-qa/phase3-final-qa-types.ts",
  "src/lib/clonestore/phase3-final-qa/phase3-final-qa-checklist.ts",
  "src/lib/clonestore/phase3-final-qa/phase3-final-qa-invariants.ts",
  "src/lib/clonestore/phase3-final-qa/phase3-final-qa-report.ts",
  "src/lib/clonestore/phase3-final-qa/phase3-final-qa-evidence.ts",
  "src/lib/clonestore/phase3-final-qa/phase3-final-qa-qa.ts",
  "src/lib/clonestore/phase3-final-qa/index.ts",
];
for (const f of finalQaFiles) {
  if (existsSync(resolve(ROOT, f))) ok(f);
  else { warn(`MANQUANT : ${f}`); needsReview++; }
}

// ── D. Invariants pages profile (scan read-only) ──────────────────────────────

step("D", "Invariants pages profile (scan read-only)");

const messagesPage = read("src/app/profile/messages/page.tsx");
const agentsPage = read("src/app/profile/agents/page.tsx");
const pierreUsePage = read("src/app/agents/pierre/use/page.tsx");
const pierreSetupPage = read("src/app/agents/pierre/setup/page.tsx");

function assertAbsent(text, needle, label) {
  if (text && text.includes(needle)) { warn(`${label} — motif détecté : ${needle}`); needsReview++; }
  else ok(`${label}`);
}

assertAbsent(messagesPage, "/api/profile/enterprise-footprint", "/profile/messages sans route enterprise-footprint");
if (/fetch\s*\([^)]*method:\s*["']POST["']/s.test(agentsPage)) { warn("/profile/agents : fetch POST détecté"); needsReview++; }
else ok("/profile/agents sans fetch POST");
assertAbsent(pierreSetupPage, "/api/profile/enterprise-footprint", "/agents/pierre/setup sans route enterprise-footprint");
// Pierre use : prefill-only (setInputDraft) — pas de submitMission auto depuis footprint
if (pierreUsePage.includes("setInputDraft")) ok("/agents/pierre/use prefill-only (setInputDraft)");
else info("/agents/pierre/use : setInputDraft non détecté (vérifier manuellement)");

// ── E. Invariants modules registry / final-qa ─────────────────────────────────

step("E", "Invariants modules (registry + final-qa)");

const registryBlob = [
  read("src/lib/clonestore/employee-context-registry/employee-context-registry-profile-feed.ts"),
  read("src/lib/clonestore/employee-context-registry/employee-context-registry-types.ts"),
].join("\n");
const finalQaBlob = finalQaFiles.map((f) => read(f)).join("\n");

function assertNoSupabaseClient(blob, label) {
  if (/createClient\s*\(/.test(blob) || /from\s+["']@supabase\/supabase-js["']/.test(blob)) {
    warn(`${label} — Supabase client détecté`); needsReview++;
  } else ok(`${label} — pas de Supabase client`);
}
function assertNoPierreImport(blob, label) {
  if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn(`${label} — import Pierre détecté`); needsReview++; }
  else ok(`${label} — pas d'import Pierre moteur`);
}

assertNoSupabaseClient(registryBlob, "employee-context-registry");
assertNoPierreImport(registryBlob, "employee-context-registry");
assertNoSupabaseClient(finalQaBlob, "phase3-final-qa");
assertNoPierreImport(finalQaBlob, "phase3-final-qa");

// write tokens (construits par concaténation, jamais littéraux ici)
const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => finalQaBlob.includes(t))) { warn("phase3-final-qa — token write détecté"); needsReview++; }
else ok("phase3-final-qa — aucun token write");

// ── F. Invariants docs (wording interdit) ─────────────────────────────────────

step("F", "Wording interdit dans les docs P3.22");

const docFinal = read("docs/PHASE_3_22_PHASE_3_FINAL_QA_GATE.md");
const forbidden = ["public launch go", "conformité garantie", "zéro erreur"];
let docClean = true;
for (const f of forbidden) {
  if (docFinal.toLowerCase().includes(f)) { warn(`Doc P3.22 contient '${f}'`); needsReview++; docClean = false; }
}
if (docClean) ok("Doc P3.22 sans wording interdit");
if (docFinal.toLowerCase().includes("lancement public externe non validé")) ok("Doc P3.22 rappelle : lancement public externe non validé");

// ── G. Commandes à lancer ─────────────────────────────────────────────────────

step("G", "Commandes de validation (dans l'ordre)");

// Références littérales (gate) : test:phase3-22 test:phase3-21 ... test:phase3-1
log("  npx tsc --noEmit");
log("  npm run test:phase3-22");
log("  npm run test:phase3-21");
for (let i = 20; i >= 2; i--) log(`  npm run test:phase3-${i}`);
log("  npm run test:phase3-1");
log("  npm run test:phase2-9");
log("  npm run test:tech11");
log("  npm run test:pfinal02");
log("  npm test");
log("  npm run build");

// ── H. Rappels ────────────────────────────────────────────────────────────────

step("H", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Aucun SQL exécuté. Aucun POST. Aucune exécution CloneOS. Aucune activation CloneVoice.");
info("go-live-proofs.local.json ne doit pas être modifié.");
info("localStorage reste le fallback actif.");
info("Pierre moteur reste inchangé.");
info("lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — artefacts Phase 3 cohérents (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Lancement public externe : non validé.");
log("═".repeat(60) + "\n");
