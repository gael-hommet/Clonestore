#!/usr/bin/env node
// scripts/check-first-live-customer-controlled-run-phase7-2.mjs
// PHASE 7.2 — First Live Customer Controlled Run — Read-Only Check
//
// Lecture seule. Aucune écriture. Runbook / evidence gate du premier vrai client Pierre.
// Aucune preuve client inventée. Public launch reste BLOCKED. go-live proofs manuels et
// vérifiables, jamais modifiés par ce module. Aucun runtime, aucun email réel, aucun env.
//
// Usage :
//   node scripts/check-first-live-customer-controlled-run-phase7-2.mjs
//   npm run check:first-live-customer-controlled-run

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
log(" PHASE 7.2 — First Live Customer Controlled Run — Check");
log("═".repeat(60));
log(" Lecture seule. Aucune preuve client inventée. Public launch BLOCKED.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P7.2 + docs ─────────────────────────────────────────────────────

step("A", "Modules P7.2 + docs");

const modules = [
  ["Types", `${RI}/first-live-customer-controlled-run-types.ts`],
  ["Module", `${RI}/first-live-customer-controlled-run.ts`],
  ["UI copy", `${RI}/first-live-customer-controlled-run-ui-copy.ts`],
  ["QA", `${RI}/first-live-customer-controlled-run-qa.ts`],
  ["Doc P7.2", "docs/PHASE_7_2_FIRST_LIVE_CUSTOMER_CONTROLLED_RUN.md"],
  ["Evidence template P7.2", "docs/templates/PHASE_7_2_FIRST_LIVE_CUSTOMER_CONTROLLED_RUN_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P7.2 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P7.2 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/first-live-customer-controlled-run.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P7.2 — token write DB détecté"); needsReview++; }
else ok("Modules P7.2 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P7.2 — appel réseau détecté"); needsReview++; }
else ok("Modules P7.2 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P7.2 — client base de données importé"); needsReview++; }
else ok("Modules P7.2 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P7.2 — import Pierre détecté"); needsReview++; }
else ok("Modules P7.2 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P7.2 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P7.2 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P7.2 — import Stripe détecté"); needsReview++; }
else ok("Modules P7.2 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P7.2 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P7.2 — aucun import OpenAI/Anthropic");

// ── C. Statut + invariants littéraux ───────────────────────────────────────────

step("C", "run_status + invariants littéraux");

if (mainSrc.includes('run_status: "ready_to_prepare_first_customer"')) ok("run_status : ready_to_prepare_first_customer");
else { warn("run_status ready_to_prepare_first_customer absent"); needsReview++; }
if (mainSrc.includes("ready_to_prepare_first_live_customer: true")) ok("ready_to_prepare_first_live_customer true");
else { warn("ready_to_prepare_first_live_customer true absent"); needsReview++; }

const falseInvariants = [
  "first_live_customer_completed: false",
  "real_customer_selected: false",
  "real_payment_verified: false",
  "contract_signed_verified: false",
  "setup_completed_verified: false",
  "first_value_delivered_verified: false",
  "feedback_collected_verified: false",
  "stripe_live_verified: false",
  "supabase_prod_rls_verified: false",
  "domain_email_verified: false",
  "runtime_execution_active: false",
  "real_email_sent: false",
  "official_document_generated: false",
  "public_launch_ready: false",
  "scale_80k_proven: false",
  "go_live_proofs_modified: false",
  "env_modified: false",
  "ai_call_performed: false",
];
if (falseInvariants.every((t) => mainSrc.includes(t))) ok("Invariants no-live tous false (18)");
else { warn("Invariants no-live incomplets"); needsReview++; }

// ── D. Contenu runbook + qualification + scénarios + evidence + no-go ──────────

step("D", "Qualification, conditions, runbook, scénarios, evidence, no-go, rollback");

if (/buildCustomerQualificationMatrix/.test(mainSrc) && /PME simple/.test(mainSrc)) ok("Qualification matrix présente (PME simple)");
else { warn("Qualification matrix absente"); needsReview++; }
if (/Aucune promesse de lancement public/.test(mainSrc)) ok("Pre-sale : aucune promesse public launch");
else { warn("Pre-sale no public launch absent"); needsReview++; }
if (/Actions sensibles validées humainement/.test(mainSrc) && /Paie officielle exclue/.test(mainSrc)) ok("Legal limits : validation humaine + paie exclue");
else { warn("Legal limits absents"); needsReview++; }
if (/buildActivationRunbook/.test(mainSrc) && /can_be_marked_done_now: false/.test(mainSrc)) ok("Activation runbook (steps non marquables now)");
else { warn("Activation runbook absent"); needsReview++; }
if (/buildSetupRunbook/.test(mainSrc) && /Approbateurs/.test(mainSrc)) ok("Setup runbook (entreprise/approbateurs)");
else { warn("Setup runbook absent"); needsReview++; }
const scenarios = ['"S1"', '"S2"', '"S3"', '"S4"', '"S5"'];
if (scenarios.every((sc) => mainSrc.includes(sc))) ok("First mission runbook : S1 → S5");
else { warn("First mission runbook incomplet"); needsReview++; }
if (/runtime_execution_allowed: false/.test(mainSrc) && /real_email_allowed: false/.test(mainSrc) && /human_validation_required: true/.test(mainSrc)) ok("Scénarios : validation humaine, runtime/email interdits");
else { warn("Scénarios invariants absents"); needsReview++; }
if (/buildEvidenceCollectionPlan/.test(mainSrc) && /collected: false/.test(mainSrc)) ok("Evidence collection plan (collected false)");
else { warn("Evidence plan absent"); needsReview++; }
if (/buildNoGoConditions/.test(mainSrc) && /autonomie totale/.test(mainSrc)) ok("No-go conditions (autonomie totale)");
else { warn("No-go conditions absentes"); needsReview++; }
if (/buildFirstCustomerRollbackPlan/.test(mainSrc) && /Suspendre l'accès/.test(mainSrc) && /Ne pas update go-live proof/.test(mainSrc)) ok("Rollback (suspendre accès, pas d'update go-live)");
else { warn("Rollback absent"); needsReview++; }
if (/manual_only: true/.test(mainSrc) && /never_via_this_module: true/.test(mainSrc)) ok("Go-live proof policy : manuel uniquement, jamais via ce module");
else { warn("Go-live proof policy absente"); needsReview++; }
if (/public_launch_ready_after_run: false/.test(mainSrc)) ok("Public launch impact : reste false");
else { warn("Public launch impact false absent"); needsReview++; }
if (/First Customer Evidence Review/.test(mainSrc)) ok("Prochaine phase : First Customer Evidence Review");
else { warn("Prochaine phase Evidence Review absente"); needsReview++; }

// ── E. Routes / SQL / flag ─────────────────────────────────────────────────────

step("E", "Routes interdites + SQL P5.4 + flag serveur");

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

// ── F. Package scripts ────────────────────────────────────────────────────────

step("F", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase7-2")) ok("test:phase7-2");
else { warn("MANQUANT : test:phase7-2"); needsReview++; }
if (pkg.includes("check:first-live-customer-controlled-run")) ok("check:first-live-customer-controlled-run");
else { warn("MANQUANT : check:first-live-customer-controlled-run"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI First Live Customer Run (page, lecture seule)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — First Live Customer Run")) ok("« Pierre — First Live Customer Run » présent");
else { warn("Titre First Live Customer absent"); needsReview++; }
if (page.includes("FLC_MICROCOPY")) ok("« run contrôlé » câblé (constante)");
else { warn("Microcopy run contrôlé absente"); needsReview++; }
if (page.includes("FLC_NOT_PUBLIC")) ok("« ne déclare pas le lancement public » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("FLC_NO_INVENTED")) ok("« Aucune preuve client n'est inventée » câblé (constante)");
else { warn("No invented absent"); needsReview++; }
if (page.includes("buildFirstLiveCustomerControlledRunReport")) ok("Runbook premier client câblé");
else { warn("Runbook premier client non câblé"); needsReview++; }
if (/Marquer client réel validé|Déclarer paiement vérifié|Déclarer public launch|Activer runtime|Envoyer email réel|Modifier go-live proofs/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Marquer client validé / Déclarer paiement / Modifier go-live proofs");

// ── H. Microcopy module UI copy (constantes) ──────────────────────────────────

step("H", "Microcopy module UI copy");

const uiCopy = read(`${RI}/first-live-customer-controlled-run-ui-copy.ts`);
if (uiCopy.includes("Premier client réel · run contrôlé")) ok("« Premier client réel · run contrôlé »");
else { warn("Microcopy run contrôlé absente"); needsReview++; }
if (uiCopy.includes("il ne déclare pas le lancement public")) ok("« il ne déclare pas le lancement public »");
else { warn("Microcopy not public absente"); needsReview++; }
if (uiCopy.includes("Aucune preuve client n'est inventée")) ok("« Aucune preuve client n'est inventée »");
else { warn("Microcopy aucune preuve inventée absente"); needsReview++; }
if (uiCopy.includes("First Customer Evidence Review")) ok("« First Customer Evidence Review »");
else { warn("Microcopy Evidence Review absente"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Runbook premier client. Aucune preuve client inventée. Public launch BLOCKED.");
info("Ne jamais déclarer public launch ni paiement vérifié sans preuve réelle.");
info("go-live proofs restent manuels et vérifiables, jamais modifiés par ce module.");
info("scale 80k NON prouvé. Prochaine étape : First Customer Evidence Review.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Runbook premier client réel cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Premier client préparé mais non inventé · public launch bloqué · go-live proofs manuels.");
log("═".repeat(60) + "\n");
