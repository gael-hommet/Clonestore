#!/usr/bin/env node
// scripts/check-pierre-state-server-activation-decision-gate-phase6-3.mjs
// PHASE 6.3 — Pierre State/Server Activation Decision Gate — Read-Only Check
//
// Lecture seule. Aucune écriture. Decision gate. Aucune activation. Aucune route.
// Aucun SQL appliqué. Aucune exécution. Première vente contrôlée ≠ lancement public.
//
// Usage :
//   node scripts/check-pierre-state-server-activation-decision-gate-phase6-3.mjs
//   npm run check:pierre-state-server-activation-decision-gate

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
log(" PHASE 6.3 — Pierre State/Server Activation Decision Gate — Check");
log("═".repeat(60));
log(" Lecture seule. Decision gate. Aucune activation. Aucune exécution.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P6.3 + docs ─────────────────────────────────────────────────────

step("A", "Modules P6.3 + docs");

const modules = [
  ["Types", `${RI}/pierre-state-server-activation-decision-gate-types.ts`],
  ["Gate", `${RI}/pierre-state-server-activation-decision-gate.ts`],
  ["UI copy", `${RI}/pierre-state-server-activation-decision-gate-ui-copy.ts`],
  ["QA", `${RI}/pierre-state-server-activation-decision-gate-qa.ts`],
  ["Doc P6.3", "docs/PHASE_6_3_PIERRE_STATE_SERVER_ACTIVATION_DECISION_GATE.md"],
  ["Evidence template P6.3", "docs/templates/PHASE_6_3_PIERRE_STATE_SERVER_ACTIVATION_DECISION_GATE_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P6.3 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P6.3 (scan read-only)");

const codeLabels = ["Types", "Gate", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const gateSrc = read(`${RI}/pierre-state-server-activation-decision-gate.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P6.3 — token write DB détecté"); needsReview++; }
else ok("Modules P6.3 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P6.3 — appel réseau détecté"); needsReview++; }
else ok("Modules P6.3 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P6.3 — client base de données importé"); needsReview++; }
else ok("Modules P6.3 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P6.3 — import Pierre détecté"); needsReview++; }
else ok("Modules P6.3 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P6.3 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P6.3 — aucune référence route API littérale");
if (/from\s+["'](stripe|openai|@anthropic)/i.test(blob)) { warn("Modules P6.3 — import fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P6.3 — aucun import OpenAI/Anthropic/Stripe");

// ── C. Décision + invariants ───────────────────────────────────────────────────

step("C", "Décision + invariants no-activation");

if (gateSrc.includes('recommended_strategy: "local_first_controlled_sale"')) ok("recommended_strategy local_first_controlled_sale");
else { warn("recommended_strategy local_first_controlled_sale absent"); needsReview++; }
if (gateSrc.includes('"allow_with_limits"')) ok("Première vente allow_with_limits présente");
else { warn("allow_with_limits absent"); needsReview++; }
if (gateSrc.includes("activation_conditions") && gateSrc.includes("SQL manual evidence")) ok("Activation conditions présentes (SQL manual evidence)");
else { warn("Activation conditions incomplètes"); needsReview++; }
if (gateSrc.includes("no_go_conditions") || gateSrc.includes("NoGoConditions")) ok("No-go conditions présentes");
else { warn("No-go conditions absentes"); needsReview++; }
if (gateSrc.includes("can_be_self_approved: false")) ok("Approvals : can_be_self_approved false");
else { warn("Approvals self-approve non confirmé false"); needsReview++; }
if (gateSrc.includes("Rollback") || gateSrc.includes("rollback")) ok("Rollback présent");
else { warn("Rollback absent"); needsReview++; }
if (gateSrc.includes("decision_gate_created") && gateSrc.includes("no_runtime_execution_confirmed")) ok("Audit trace requirements présents");
else { warn("Audit trace requirements incomplets"); needsReview++; }
if (gateSrc.includes("server_persistence_activated: false") && gateSrc.includes("runtime_execution_activated: false")) ok("Aucune activation (invariants false)");
else { warn("Invariants activation non confirmés"); needsReview++; }

// ── D. Routes / SQL / flag ─────────────────────────────────────────────────────

step("D", "Routes interdites + SQL P5.4 + flag serveur");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}
const sqlFile = read("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
if (sqlFile.includes("DO NOT APPLY")) ok("SQL P5.4 contient « DO NOT APPLY »");
else { warn("SQL P5.4 manque « DO NOT APPLY »"); needsReview++; }
const policy = read(`${RI}/controlled-mission-server-persistence-policy.ts`);
if (/DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED\s*=\s*false/.test(policy)) ok("Flag serveur default false");
else { warn("Flag serveur default false absent"); needsReview++; }

// ── E. Package scripts ────────────────────────────────────────────────────────

step("E", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase6-3")) ok("test:phase6-3");
else { warn("MANQUANT : test:phase6-3"); needsReview++; }
if (pkg.includes("check:pierre-state-server-activation-decision-gate")) ok("check:pierre-state-server-activation-decision-gate");
else { warn("MANQUANT : check:pierre-state-server-activation-decision-gate"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI Decision Gate (page, decision-only)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("PIERRE_DECISION_GATE_MICROCOPY")) ok("« Decision Gate Pierre » câblé (constante)");
else { warn("Microcopy Decision Gate absente"); needsReview++; }
if (page.includes("PIERRE_DECISION_GATE_SALE_VS_LAUNCH")) ok("« Première vente contrôlée ≠ lancement public » câblé (constante)");
else { warn("Sale vs launch absent"); needsReview++; }
if (page.includes("PIERRE_DECISION_GATE_RUNTIME_INACTIVE")) ok("« runtime autonome reste inactif » câblé (constante)");
else { warn("Runtime inactive absent"); needsReview++; }
if (page.includes("buildPierreStateServerActivationDecisionGate")) ok("Decision gate câblé");
else { warn("Decision gate non câblé"); needsReview++; }
if (/Appliquer SQL|Activer serveur|Exécuter runtime|Envoyer email réel|Générer document officiel|Déclarer public launch|Déclarer fully sellable/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Appliquer SQL / Activer serveur / Exécuter runtime");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Decision gate. Aucune activation. Première vente contrôlée ≠ lancement public.");
info("Le runtime autonome reste inactif. La persistance serveur reste inactive.");
info("Aucune route. Aucun SQL appliqué. Flag serveur default false. Aucune exécution.");
info("Pierre NON déclaré fully sellable. public launch NON validé. scale 80k NON prouvé.");
info("Prochaine étape : P6.4 — Pierre Channels & Identity Final.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Decision Gate Pierre cohérent (lecture seule, decision-only).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Decision gate · aucune activation · première vente contrôlée ≠ lancement public · aucune exécution.");
log("═".repeat(60) + "\n");
