#!/usr/bin/env node
// scripts/check-runtime-phase4-final-qa-gate.mjs
// PHASE 4.12 — Phase 4 Final QA Gate / Runtime Closure — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL exécuté. Aucun POST. Aucun Supabase.
// Aucune mission créée. Aucune route créée. Aucune activation runtime.
//
// Usage :
//   node scripts/check-runtime-phase4-final-qa-gate.mjs
//   npm run check:runtime-phase4-final-qa

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
log(" PHASE 4.12 — Phase 4 Final QA Gate / Runtime Closure — Check");
log("═".repeat(60));
log(" Lecture seule. Aucun write. Aucune activation runtime. Clôture, pas activation.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P4.12 ──────────────────────────────────────────────────────────

step("A", "Modules P4.12");

const p412Modules = [
  `${RI}/runtime-phase4-final-qa-types.ts`,
  `${RI}/runtime-phase4-final-qa-registry.ts`,
  `${RI}/runtime-phase4-final-qa-invariants.ts`,
  `${RI}/runtime-phase4-final-qa-gate.ts`,
  `${RI}/runtime-phase4-final-qa-snapshot.ts`,
  `${RI}/runtime-phase4-next-phase-plan.ts`,
  `${RI}/runtime-phase4-final-qa-qa.ts`,
];
for (const m of p412Modules) {
  if (has(m)) ok(m);
  else { warn(`MANQUANT : ${m}`); needsReview++; }
}

// ── B. Docs P4.1 → P4.12 ──────────────────────────────────────────────────────

step("B", "Docs P4.1 → P4.12");

const docs = [
  "docs/PHASE_4_1_CLONEOS_PIERRE_RUNTIME_OPERATIONAL_INTEGRATION_FOUNDATION.md",
  "docs/PHASE_4_2_RUNTIME_API_SIMULATION_ENDPOINT_COMMAND_CENTER_PREVIEW.md",
  "docs/PHASE_4_3_RUNTIME_MISSION_DRAFT_CREATION_CONTRACT.md",
  "docs/PHASE_4_4_RUNTIME_MISSION_DRAFT_SAFE_PERSISTENCE_DESIGN.md",
  "docs/PHASE_4_5_RUNTIME_MISSION_DRAFT_SAFE_APPLY_LOCALSTORAGE_FIRST.md",
  "docs/PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_QA.md",
  "docs/PHASE_4_7_RUNTIME_MISSION_DRAFT_SERVER_RESTORE_UI_POLISH.md",
  "docs/PHASE_4_8_RUNTIME_MISSION_PROMOTION_CONTRACT.md",
  "docs/PHASE_4_9_RUNTIME_CONTROLLED_MISSION_PREVIEW_UI.md",
  "docs/PHASE_4_10_CONTROLLED_MISSION_GOVERNED_PERSISTENCE_DESIGN.md",
  "docs/PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_DESIGN.md",
  "docs/PHASE_4_12_PHASE_4_FINAL_QA_GATE_RUNTIME_CLOSURE.md",
];
for (const d of docs) {
  if (has(d)) ok(d);
  else { warn(`MANQUANT : ${d}`); needsReview++; }
}

// ── C. Evidence templates P4.4 → P4.12 ────────────────────────────────────────

step("C", "Evidence templates P4.4 → P4.12");

const evidences = [
  "docs/templates/PHASE_4_4_RUNTIME_MISSION_DRAFT_PERSISTENCE_DESIGN_EVIDENCE.md",
  "docs/templates/PHASE_4_5_RUNTIME_MISSION_DRAFT_SAFE_APPLY_EVIDENCE.md",
  "docs/templates/PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_EVIDENCE.md",
  "docs/templates/PHASE_4_7_RUNTIME_MISSION_DRAFT_RESTORE_UI_POLISH_EVIDENCE.md",
  "docs/templates/PHASE_4_8_RUNTIME_MISSION_PROMOTION_CONTRACT_EVIDENCE.md",
  "docs/templates/PHASE_4_9_RUNTIME_CONTROLLED_MISSION_PREVIEW_UI_EVIDENCE.md",
  "docs/templates/PHASE_4_10_CONTROLLED_MISSION_PERSISTENCE_DESIGN_EVIDENCE.md",
  "docs/templates/PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_EVIDENCE.md",
  "docs/templates/PHASE_4_12_PHASE_4_FINAL_QA_GATE_RUNTIME_CLOSURE_EVIDENCE.md",
];
for (const e of evidences) {
  if (has(e)) ok(e);
  else { warn(`MANQUANT : ${e}`); needsReview++; }
}

// ── D. SQL drafts (non appliqués) + scripts ───────────────────────────────────

step("D", "SQL drafts (non appliqués) + scripts read-only");

const sqlDrafts = [
  "supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql",
  "supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql",
];
for (const sd of sqlDrafts) {
  if (has(sd)) ok(`${sd} (non appliqué)`);
  else { warn(`MANQUANT : ${sd}`); needsReview++; }
}

const scripts = [
  "scripts/check-runtime-mission-draft-persistence-design.mjs",
  "scripts/check-runtime-mission-draft-manual-activation-qa.mjs",
  "scripts/check-runtime-controlled-mission-persistence-design.mjs",
  "scripts/check-runtime-controlled-mission-human-validation-workflow.mjs",
  "scripts/check-runtime-phase4-final-qa-gate.mjs",
];
for (const sc of scripts) {
  if (has(sc)) ok(sc);
  else { warn(`MANQUANT : ${sc}`); needsReview++; }
}

// ── E. Package scripts ────────────────────────────────────────────────────────

step("E", "Package scripts phase4-1 → phase4-12");

const pkg = read("package.json");
for (let i = 1; i <= 12; i++) {
  const name = `test:phase4-${i}`;
  if (pkg.includes(name)) ok(name);
  else { warn(`MANQUANT : ${name}`); needsReview++; }
}
if (pkg.includes("check:runtime-phase4-final-qa")) ok("check:runtime-phase4-final-qa");
else { warn("MANQUANT : check:runtime-phase4-final-qa"); needsReview++; }

// ── F. Routes autorisées / interdites ─────────────────────────────────────────

step("F", "Routes runtime autorisées / interdites");

const allowedRoutes = [
  "src/app/api/clonestore/runtime/simulate/route.ts",
  "src/app/api/clonestore/runtime/mission-drafts/route.ts",
];
for (const r of allowedRoutes) {
  if (has(r)) ok(`autorisée présente : ${r}`);
  else { warn(`Route autorisée manquante : ${r}`); needsReview++; }
}

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-mission-validation/route.ts",
  "src/app/api/clonestore/runtime/controlled-mission-candidates/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/promote/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`interdite absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── G. Invariants modules P4.12 (scan read-only) ──────────────────────────────

step("G", "Invariants modules P4.12 (scan read-only)");

const blob = p412Modules.map((m) => read(m)).join("\n");
const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
const netToken = "fe" + "tch(";
const fileWriteTokens = ["write" + "File", "append" + "File"];

if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P4.12 — token write détecté"); needsReview++; }
else ok("Modules P4.12 — aucun token write");
if (blob.includes(netToken)) { warn("Modules P4.12 — appel réseau détecté"); needsReview++; }
else ok("Modules P4.12 — aucun appel réseau");
if (fileWriteTokens.some((t) => blob.includes(t))) { warn("Modules P4.12 — écriture fichier détectée"); needsReview++; }
else ok("Modules P4.12 — aucune écriture fichier");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P4.12 — client base de données détecté"); needsReview++; }
else ok("Modules P4.12 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P4.12 — import Pierre détecté"); needsReview++; }
else ok("Modules P4.12 — aucun import Pierre moteur");
if (/\/api\/pierre/.test(blob)) { warn("Modules P4.12 — référence /api/pierre détectée"); needsReview++; }
else ok("Modules P4.12 — aucune référence /api/pierre");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P4.12 — référence fournisseur IA/paiement détectée"); needsReview++; }
else ok("Modules P4.12 — aucun appel OpenAI/Anthropic/Stripe");

// ── H. Blocks summary ─────────────────────────────────────────────────────────

step("H", "Blocks P4.1 → P4.12 (résumé)");

const blocks = [
  "4.1 Runtime Foundation", "4.2 Simulation Endpoint", "4.3 Mission Draft Contract",
  "4.4 Draft Persistence Design", "4.5 Draft Safe Apply", "4.6 Manual Activation QA",
  "4.7 Restore UI", "4.8 Promotion Contract", "4.9 Controlled Mission Preview",
  "4.10 Governed Persistence Design", "4.11 Human Validation Workflow", "4.12 Final QA Gate",
];
for (const b of blocks) info(`✓ ${b}`);

// ── I. Invariants finaux ──────────────────────────────────────────────────────

step("I", "Invariants finaux (résumé)");

info("no_real_mission_created · no_runtime_execution · no_cloneos_execution");
info("no_pierre_engine_call · no_ai_call · no_email_sent · no_document_generated");
info("no_clonevoice_activation · no_unflagged_db_write · no_sql_auto_apply");
info("no_env_auto_change · no_flag_auto_activation · no_go_live_proof_auto_change");
info("no_public_external_launch_validation · scale_80k_not_proven");
info("human_validation_required · promotion_not_applied · approval_not_applied");
info("localstorage_fallback_preserved · feature_flags_default_false · rls_design_only");

// ── J. Commandes ──────────────────────────────────────────────────────────────

step("J", "Commandes à lancer");

log("  npm run check:runtime-phase4-final-qa");
log("  npm run test:phase4-12");
log("  npm run test:pfinal02");
log("  npm test");
log("  npm run build");

// ── K. Rappels ────────────────────────────────────────────────────────────────

step("K", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Clôture, pas activation. Aucune route créée. Aucune activation runtime.");
info("Phase 4 closed = design/simulation/gated runtime — pas lancement public externe validé.");
info("Aucune mission réelle. Aucune exécution. Aucun appel Pierre. Aucun appel IA.");
info("CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Phase 4 cohérente, clôturable côté repo (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Clôture, pas activation · aucun write · lancement public externe non validé · scale 80k non prouvé.");
log("═".repeat(60) + "\n");
