#!/usr/bin/env node
// scripts/check-pierre-customer-activation-e2e-final-phase6-5.mjs
// PHASE 6.5 — Pierre Customer Activation E2E Final — Read-Only Check
//
// Lecture seule. Aucune écriture. Proof path. Aucun paiement live. Aucune exécution
// autonome. Aucun email réel. Stripe live / production à prouver avant public launch.
//
// Usage :
//   node scripts/check-pierre-customer-activation-e2e-final-phase6-5.mjs
//   npm run check:pierre-customer-activation-e2e-final

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
log(" PHASE 6.5 — Pierre Customer Activation E2E Final — Check");
log("═".repeat(60));
log(" Lecture seule. Proof path. Aucun paiement live. Aucune exécution autonome.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P6.5 + docs ─────────────────────────────────────────────────────

step("A", "Modules P6.5 + docs");

const modules = [
  ["Types", `${RI}/pierre-customer-activation-e2e-final-types.ts`],
  ["Module", `${RI}/pierre-customer-activation-e2e-final.ts`],
  ["UI copy", `${RI}/pierre-customer-activation-e2e-final-ui-copy.ts`],
  ["QA", `${RI}/pierre-customer-activation-e2e-final-qa.ts`],
  ["Doc P6.5", "docs/PHASE_6_5_PIERRE_CUSTOMER_ACTIVATION_E2E_FINAL.md"],
  ["Evidence template P6.5", "docs/templates/PHASE_6_5_PIERRE_CUSTOMER_ACTIVATION_E2E_FINAL_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P6.5 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P6.5 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/pierre-customer-activation-e2e-final.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P6.5 — token write DB détecté"); needsReview++; }
else ok("Modules P6.5 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P6.5 — appel réseau détecté"); needsReview++; }
else ok("Modules P6.5 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P6.5 — client base de données importé"); needsReview++; }
else ok("Modules P6.5 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P6.5 — import Pierre détecté"); needsReview++; }
else ok("Modules P6.5 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P6.5 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P6.5 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P6.5 — import Stripe détecté"); needsReview++; }
else ok("Modules P6.5 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P6.5 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P6.5 — aucun import OpenAI/Anthropic");

// ── C. Parcours + invariants ───────────────────────────────────────────────────

step("C", "Parcours, accès, scénarios, no-execution");

const journeyKeys = ["cj_discover", "cj_demo", "cj_checkout", "cj_success", "cj_signup", "cj_profile", "cj_setup", "cj_use", "cj_first_mission", "cj_first_output"];
if (journeyKeys.every((k) => mainSrc.includes(k))) ok("Customer journey : 10 étapes (discover → first output)");
else { warn("Customer journey incomplète"); needsReview++; }
if (mainSrc.includes("449€/mois")) ok("Checkout : 449€/mois");
else { warn("449€/mois absent"); needsReview++; }
if (mainSrc.includes("Configurer Pierre")) ok("Success : configurer Pierre");
else { warn("Configurer Pierre absent"); needsReview++; }
const accessStates = ["unpaid", "paid_active", "trialing", "cancelled", "internal_demo", "first_controlled_sale_customer"];
if (accessStates.every((s) => mainSrc.includes(`"${s}"`))) ok("Access matrix : unpaid/paid/trialing/cancelled/internal_demo/first_controlled_sale");
else { warn("Access matrix incomplète"); needsReview++; }
if (mainSrc.includes("can_execute_runtime: false")) ok("Access : execute_runtime false");
else { warn("execute_runtime false absent"); needsReview++; }
const scenarioKeys = ['"S1"', '"S2"', '"S3"', '"S4"', '"S5"'];
if (scenarioKeys.every((k) => mainSrc.includes(k))) ok("Scenario entry points : S1 → S5");
else { warn("Scenario entry points incomplets"); needsReview++; }
if (mainSrc.includes("stop before execution")) ok("First mission flow : stop before execution");
else { warn("stop before execution absent"); needsReview++; }
if (mainSrc.includes("no_runtime_execution_confirmed")) ok("Traceability : no_runtime_execution_confirmed");
else { warn("no_runtime_execution_confirmed absent"); needsReview++; }
if (mainSrc.includes("Pierre prépare, l'humain valide")) ok("Limite : Pierre prépare, l'humain valide");
else { warn("Limite prepare/validate absente"); needsReview++; }
if (mainSrc.includes("stripe_live_payment_performed: false") && mainSrc.includes("runtime_execution_active: false") && mainSrc.includes("real_email_sent: false")) ok("Aucun paiement live / runtime / email réel (invariants false)");
else { warn("Invariants no-live non confirmés"); needsReview++; }

// ── D. Routes / SQL / flag ─────────────────────────────────────────────────────

step("D", "Routes interdites + SQL P5.4 + flag serveur");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/email/send/route.ts",
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
if (pkg.includes("test:phase6-5")) ok("test:phase6-5");
else { warn("MANQUANT : test:phase6-5"); needsReview++; }
if (pkg.includes("check:pierre-customer-activation-e2e-final")) ok("check:pierre-customer-activation-e2e-final");
else { warn("MANQUANT : check:pierre-customer-activation-e2e-final"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI Activation client E2E (page, proof path)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — Activation client E2E")) ok("« Pierre — Activation client E2E » présent");
else { warn("Titre activation absent"); needsReview++; }
if (page.includes("PIERRE_ACTIVATION_MICROCOPY")) ok("« parcours client contrôlé » câblé (constante)");
else { warn("Microcopy activation absente"); needsReview++; }
if (page.includes("PIERRE_ACTIVATION_FIRST_VALUE")) ok("« pas le lancement public » câblé (constante)");
else { warn("First value absent"); needsReview++; }
if (page.includes("PIERRE_ACTIVATION_NO_AUTONOMOUS")) ok("« Aucune exécution autonome » câblé (constante)");
else { warn("No autonomous absent"); needsReview++; }
if (page.includes("buildPierreCustomerActivationE2EFinalReport")) ok("Activation E2E câblée");
else { warn("Activation E2E non câblée"); needsReview++; }
if (/Déclarer paiement live|Activer Stripe live|Activer Supabase prod|Exécuter runtime|Envoyer email réel|Générer document officiel|Déclarer public launch/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Déclarer paiement live / Activer Stripe live / Exécuter runtime");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Proof path. Aucun paiement live. Aucune exécution autonome. Aucun email réel.");
info("Stripe live / production à prouver avant public launch.");
info("Pierre NON fully sellable. public launch NON validé. scale 80k NON prouvé.");
info("Prochaine étape : P6.6 — Pierre Sellable Gate 100%.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Parcours client E2E Pierre cohérent (lecture seule, proof path).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Proof path · aucun paiement live · aucune exécution autonome · première vente ≠ public launch.");
log("═".repeat(60) + "\n");
