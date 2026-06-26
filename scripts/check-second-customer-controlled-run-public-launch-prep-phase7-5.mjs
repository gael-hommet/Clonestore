#!/usr/bin/env node
// scripts/check-second-customer-controlled-run-public-launch-prep-phase7-5.mjs
// PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep — Read-Only Check
//
// Lecture seule. Aucune écriture. Runbook client 2 + préparation revue public launch. Client 2
// préparé mais NON démarré. Aucune preuve inventée. Comparaison multi-client à prouver. Public
// launch reste BLOCKED. go-live proofs non modifiés. Aucun runtime, aucun email réel, aucun env.
//
// Usage :
//   node scripts/check-second-customer-controlled-run-public-launch-prep-phase7-5.mjs
//   npm run check:second-customer-controlled-run-public-launch-prep

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
log(" PHASE 7.5 — Second Customer Controlled Run / Public Launch Prep — Check");
log("═".repeat(60));
log(" Lecture seule. Client 2 non démarré. Aucune preuve inventée. Public launch BLOCKED.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P7.5 + docs ─────────────────────────────────────────────────────

step("A", "Modules P7.5 + docs");

const modules = [
  ["Types", `${RI}/second-customer-controlled-run-public-launch-prep-types.ts`],
  ["Module", `${RI}/second-customer-controlled-run-public-launch-prep.ts`],
  ["UI copy", `${RI}/second-customer-controlled-run-public-launch-prep-ui-copy.ts`],
  ["QA", `${RI}/second-customer-controlled-run-public-launch-prep-qa.ts`],
  ["Doc P7.5", "docs/PHASE_7_5_SECOND_CUSTOMER_CONTROLLED_RUN_PUBLIC_LAUNCH_PREP.md"],
  ["Evidence template P7.5", "docs/templates/PHASE_7_5_SECOND_CUSTOMER_CONTROLLED_RUN_PUBLIC_LAUNCH_PREP_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P7.5 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P7.5 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/second-customer-controlled-run-public-launch-prep.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P7.5 — token write DB détecté"); needsReview++; }
else ok("Modules P7.5 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P7.5 — appel réseau détecté"); needsReview++; }
else ok("Modules P7.5 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P7.5 — client base de données importé"); needsReview++; }
else ok("Modules P7.5 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P7.5 — import Pierre détecté"); needsReview++; }
else ok("Modules P7.5 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P7.5 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P7.5 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P7.5 — import Stripe détecté"); needsReview++; }
else ok("Modules P7.5 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P7.5 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P7.5 — aucun import OpenAI/Anthropic");

// ── C. Statut + invariants littéraux ───────────────────────────────────────────

step("C", "run_status + invariants littéraux");

if (mainSrc.includes('run_status: "ready_to_prepare_second_customer"')) ok("run_status : ready_to_prepare_second_customer");
else { warn("run_status ready_to_prepare_second_customer absent"); needsReview++; }
if (mainSrc.includes("ready_to_prepare_second_customer: true")) ok("ready_to_prepare_second_customer true");
else { warn("ready_to_prepare_second_customer true absent"); needsReview++; }

const falseInvariants = [
  "second_customer_selected: false",
  "second_customer_started: false",
  "second_customer_completed: false",
  "second_customer_evidence_collected: false",
  "customer_comparison_completed: false",
  "reproducibility_verified: false",
  "multi_customer_evidence_ready: false",
  "public_launch_review_ready: false",
  "public_launch_ready: false",
  "scale_80k_proven: false",
  "stripe_live_verified: false",
  "supabase_prod_rls_verified: false",
  "domain_email_verified: false",
  "runtime_execution_active: false",
  "real_email_sent: false",
  "official_document_generated: false",
  "go_live_proofs_modified: false",
  "env_modified: false",
  "ai_call_performed: false",
];
if (falseInvariants.every((t) => mainSrc.includes(t))) ok("Invariants no-live tous false (19)");
else { warn("Invariants no-live incomplets"); needsReview++; }

// ── D. Contenus runbook + scénarios + comparaison + reproductibilité + review ──

step("D", "Qualification, runbook, scénarios, evidence, comparaison, reproductibilité, review");

if (/buildSecondCustomerQualificationMatrix/.test(mainSrc) && /Client simple/.test(mainSrc) && /Pas de paie officielle/.test(mainSrc)) ok("Qualification matrix (client simple, pas paie)");
else { warn("Qualification matrix absente"); needsReview++; }
if (/Aucune promesse de lancement public/.test(mainSrc)) ok("Pre-sale : aucune promesse public launch");
else { warn("Pre-sale no public launch absent"); needsReview++; }
if (/buildSecondCustomerActivationRunbook/.test(mainSrc) && /can_start_now: false/.test(mainSrc)) ok("Activation runbook (can_start_now false)");
else { warn("Activation runbook absent"); needsReview++; }
if (/Différences avec le client 1/.test(mainSrc)) ok("Setup : différences avec client 1");
else { warn("Setup différences client 1 absent"); needsReview++; }
const scenarios = ['"S1"', '"S2"', '"S3"', '"S4"', '"S5"'];
if (scenarios.every((sc) => mainSrc.includes(sc))) ok("Scenario matrix : S1 → S5");
else { warn("Scenario matrix incomplète"); needsReview++; }
if (/runtime_execution_allowed: false/.test(mainSrc) && /human_validation_required: true/.test(mainSrc) && /real_email_allowed: false/.test(mainSrc)) ok("Scénarios : validation humaine, runtime/email interdits");
else { warn("Scénarios invariants absents"); needsReview++; }
if (/buildSecondCustomerEvidencePlan/.test(mainSrc) && /collected: false/.test(mainSrc)) ok("Evidence plan (collected false)");
else { warn("Evidence plan absent"); needsReview++; }
if (/comparison_status: "not_compared"/.test(mainSrc) && /customer_1_value: null/.test(mainSrc) && /customer_2_value: null/.test(mainSrc)) ok("Comparison matrix (valeurs null, not_compared)");
else { warn("Comparison matrix absente"); needsReview++; }
if (/buildReproducibilityAssessment/.test(mainSrc) && /current_score: 0/.test(mainSrc)) ok("Reproductibilité (scores 0)");
else { warn("Reproductibilité absente"); needsReview++; }
if (/verified_customer_count: 0/.test(mainSrc) && /evidence_ready: false/.test(mainSrc)) ok("Multi-client readiness (count 0, non prête)");
else { warn("Multi-client readiness absente"); needsReview++; }
if (/review_ready: false/.test(mainSrc) && /all_inputs_verified: false/.test(mainSrc) && /final_public_launch_decision: "blocked"/.test(mainSrc)) ok("Public launch review prep (non prête, bloqué)");
else { warn("Public launch review prep absente"); needsReview++; }
if (/Stripe live non vérifié/.test(mainSrc) && /Supabase prod \/ RLS non vérifié/.test(mainSrc) && /Evidence multi-client non prête/.test(mainSrc) && /Scale 80k non prouvé/.test(mainSrc)) ok("Blocker matrix (Stripe/Supabase/multi-client/scale)");
else { warn("Blocker matrix incomplète"); needsReview++; }
if (/buildPublicLaunchReviewInputs/.test(mainSrc) && /verified: false/.test(mainSrc) && /evidence_link: null/.test(mainSrc)) ok("Review inputs (verified false, evidence_link null)");
else { warn("Review inputs absents"); needsReview++; }
if (/Ne pas déclarer public launch/.test(mainSrc)) ok("Operator checklist (ne pas déclarer public launch)");
else { warn("Operator checklist absente"); needsReview++; }
if (/buildSecondCustomerRollbackPlan/.test(mainSrc) && /Suspendre le client 2/.test(mainSrc)) ok("Rollback (suspendre client 2)");
else { warn("Rollback absent"); needsReview++; }
if (/Public Launch Final Review Gate/.test(mainSrc)) ok("Prochaine phase : Public Launch Final Review Gate");
else { warn("Prochaine phase Public Launch Final Review absente"); needsReview++; }

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
if (pkg.includes("test:phase7-5")) ok("test:phase7-5");
else { warn("MANQUANT : test:phase7-5"); needsReview++; }
if (pkg.includes("check:second-customer-controlled-run-public-launch-prep")) ok("check:second-customer-controlled-run-public-launch-prep");
else { warn("MANQUANT : check:second-customer-controlled-run-public-launch-prep"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI Second Customer Controlled Run (page, lecture seule)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — Second Customer Controlled Run")) ok("« Pierre — Second Customer Controlled Run » présent");
else { warn("Titre Second Customer absent"); needsReview++; }
if (page.includes("SC2_MICROCOPY")) ok("« run contrôlé » câblé (constante)");
else { warn("Microcopy run contrôlé absente"); needsReview++; }
if (page.includes("SC2_NOT_STARTED")) ok("« il ne le démarre pas » câblé (constante)");
else { warn("Not started absent"); needsReview++; }
if (page.includes("SC2_NOT_PUBLIC")) ok("« lancement public reste bloqué » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("buildSecondCustomerControlledRunPublicLaunchPrepReport")) ok("Runbook client 2 câblé");
else { warn("Runbook client 2 non câblé"); needsReview++; }
if (/Démarrer client 2|Déclarer reproductibilité|Déclarer public launch|Marquer evidence collectée|Modifier go-live proofs|Activer runtime/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Démarrer client 2 / Déclarer reproductibilité / Déclarer public launch");

// ── H. Microcopy module UI copy (constantes) ──────────────────────────────────

step("H", "Microcopy module UI copy");

const uiCopy = read(`${RI}/second-customer-controlled-run-public-launch-prep-ui-copy.ts`);
if (uiCopy.includes("Deuxième client · run contrôlé")) ok("« Deuxième client · run contrôlé »");
else { warn("Microcopy run contrôlé absente"); needsReview++; }
if (uiCopy.includes("il ne le démarre pas")) ok("« il ne le démarre pas »");
else { warn("Microcopy not started absente"); needsReview++; }
if (uiCopy.includes("Le lancement public reste bloqué")) ok("« Le lancement public reste bloqué »");
else { warn("Microcopy not public absente"); needsReview++; }
if (uiCopy.includes("Public Launch Final Review Gate")) ok("« Public Launch Final Review Gate »");
else { warn("Microcopy Public Launch Review absente"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Runbook client 2. Client 2 non démarré. Aucune preuve inventée. Public launch BLOCKED.");
info("La comparaison multi-client reste à prouver, la reproductibilité non déclarée.");
info("go-live proofs restent manuels, jamais modifiés par ce module.");
info("scale 80k NON prouvé. Prochaine étape : Public Launch Final Review Gate.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Runbook client 2 + préparation revue public launch cohérents (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Client 2 non démarré · multi-client à prouver · public launch bloqué · go-live proofs manuels.");
log("═".repeat(60) + "\n");
