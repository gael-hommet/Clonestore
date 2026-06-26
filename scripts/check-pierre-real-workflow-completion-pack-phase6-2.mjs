#!/usr/bin/env node
// scripts/check-pierre-real-workflow-completion-pack-phase6-2.mjs
// PHASE 6.2 — Pierre Real Workflow Completion Pack — Read-Only Check
//
// Lecture seule. Aucune écriture. Proof pack. Aucune exécution autonome. Aucun email
// réel. Aucun document officiel réel. N'active rien. Ne déclare pas Pierre vendable.
//
// Usage :
//   node scripts/check-pierre-real-workflow-completion-pack-phase6-2.mjs
//   npm run check:pierre-real-workflow-completion-pack

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
log(" PHASE 6.2 — Pierre Real Workflow Completion Pack — Check");
log("═".repeat(60));
log(" Lecture seule. Proof pack. Aucune exécution autonome. Pierre NON déclaré vendable.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P6.2 + docs ─────────────────────────────────────────────────────

step("A", "Modules P6.2 + docs");

const modules = [
  ["Types", `${RI}/pierre-real-workflow-completion-pack-types.ts`],
  ["Pack", `${RI}/pierre-real-workflow-completion-pack.ts`],
  ["UI copy", `${RI}/pierre-real-workflow-completion-pack-ui-copy.ts`],
  ["QA", `${RI}/pierre-real-workflow-completion-pack-qa.ts`],
  ["Doc P6.2", "docs/PHASE_6_2_PIERRE_REAL_WORKFLOW_COMPLETION_PACK.md"],
  ["Evidence template P6.2", "docs/templates/PHASE_6_2_PIERRE_REAL_WORKFLOW_COMPLETION_PACK_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P6.2 (scan read-only) ───────────────────────────────
// La QA énumère les noms de checks (« no_fetch_in_modules »…) → exclue du scan mot-à-mot.

step("B", "Invariants modules P6.2 (scan read-only)");

const codeLabels = ["Types", "Pack", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const packSrc = read(`${RI}/pierre-real-workflow-completion-pack.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P6.2 — token write DB détecté"); needsReview++; }
else ok("Modules P6.2 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P6.2 — appel réseau détecté"); needsReview++; }
else ok("Modules P6.2 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P6.2 — client base de données importé"); needsReview++; }
else ok("Modules P6.2 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P6.2 — import Pierre détecté"); needsReview++; }
else ok("Modules P6.2 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P6.2 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P6.2 — aucune référence route API littérale");
if (/from\s+["'](stripe|openai|@anthropic)/i.test(blob)) { warn("Modules P6.2 — import fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P6.2 — aucun import OpenAI/Anthropic/Stripe");

// ── C. 5 scénarios + invariants no-execution ──────────────────────────────────

step("C", "5 scénarios + invariants no-execution");

const scenarioIds = ["S1", "S2", "S3", "S4", "S5"];
const allScenariosPresent = scenarioIds.every((id) => packSrc.includes(`"${id}"`) || packSrc.includes(`id: "${id}"`));
if (allScenariosPresent) ok("5 scénarios présents (S1 → S5)");
else { warn("Scénarios manquants"); needsReview++; }
if (packSrc.includes("no_autonomous_execution_confirmed: true")) ok("no_autonomous_execution_confirmed: true");
else { warn("no_autonomous_execution_confirmed absent"); needsReview++; }
if (packSrc.includes("human_validations")) ok("human_validations présentes");
else { warn("human_validations absentes"); needsReview++; }
if (packSrc.includes("forbidden_outputs")) ok("forbidden_outputs présentes");
else { warn("forbidden_outputs absentes"); needsReview++; }
if (packSrc.includes("trace_events") || packSrc.includes("REQUIRED_TRACE_EVENTS")) ok("trace_events présents");
else { warn("trace_events absents"); needsReview++; }
if (packSrc.includes("sellable_value")) ok("sellable_value présent");
else { warn("sellable_value absent"); needsReview++; }
if (packSrc.includes("DSN") && packSrc.includes("Bulletin officiel")) ok("Scénario 3 bloque DSN / bulletin officiel");
else { warn("Scénario 3 ne bloque pas DSN / bulletin officiel"); needsReview++; }
if (packSrc.includes("Licenciement") && packSrc.includes("Sanction officielle")) ok("Scénario 5 bloque sanction / licenciement");
else { warn("Scénario 5 ne bloque pas sanction / licenciement"); needsReview++; }
if (packSrc.includes("email_sent: false") && packSrc.includes("official_document_generated: false")) ok("Aucun email réel / document officiel (invariants false)");
else { warn("Invariants email/document non confirmés"); needsReview++; }

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
if (pkg.includes("test:phase6-2")) ok("test:phase6-2");
else { warn("MANQUANT : test:phase6-2"); needsReview++; }
if (pkg.includes("check:pierre-real-workflow-completion-pack")) ok("check:pierre-real-workflow-completion-pack");
else { warn("MANQUANT : check:pierre-real-workflow-completion-pack"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI Pierre 5 scénarios (page, proof pack)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — 5 scénarios RH vendables")) ok("« Pierre — 5 scénarios RH vendables » présent");
else { warn("Titre 5 scénarios absent"); needsReview++; }
if (page.includes("PIERRE_WORKFLOW_PACK_MICROCOPY")) ok("« Aucune exécution autonome » câblée (constante)");
else { warn("Microcopy pack absente"); needsReview++; }
if (page.includes("PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE")) ok("« Pierre n'est pas encore public-launch complete » câblé (constante)");
else { warn("« public-launch complete » absent"); needsReview++; }
if (page.includes("buildPierreRealWorkflowCompletionPack")) ok("Pack câblé");
else { warn("Pack non câblé"); needsReview++; }
if (/Exécuter runtime|Envoyer email réel|Générer document officiel|Déclarer public launch|Activer serveur|Sanctionner automatiquement/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Exécuter runtime / Envoyer email réel / Générer document officiel");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Proof pack. Aucune exécution autonome. Actions sensibles bloquées / validation humaine.");
info("Aucun email réel. Aucun document officiel réel. Aucun appel Pierre / IA.");
info("Pierre NON déclaré fully sellable. public launch NON validé. scale 80k NON prouvé.");
info("Prochaine étape : P6.3 — Pierre State/Server Activation Decision Gate.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — 5 scénarios RH vendables cohérents (lecture seule, proof pack).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Proof pack · aucune exécution autonome · Pierre NON déclaré vendable · public launch NON validé.");
log("═".repeat(60) + "\n");
