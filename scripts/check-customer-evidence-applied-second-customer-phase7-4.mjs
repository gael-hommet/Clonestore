#!/usr/bin/env node
// scripts/check-customer-evidence-applied-second-customer-phase7-4.mjs
// PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer — Read-Only Check
//
// Lecture seule. Aucune écriture. Evidence application planning gate. Aucune preuve inventée ni
// auto-appliquée. Public launch reste BLOCKED. go-live proofs restent manuels, jamais modifiés
// automatiquement. Client 2 préparé mais non démarré. Aucun runtime, aucun email réel, aucun env.
//
// Usage :
//   node scripts/check-customer-evidence-applied-second-customer-phase7-4.mjs
//   npm run check:customer-evidence-applied-second-customer

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
log(" PHASE 7.4 — Customer Evidence Applied / Second Customer — Check");
log("═".repeat(60));
log(" Lecture seule. Aucune preuve inventée ni auto-appliquée. Public launch BLOCKED.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P7.4 + docs ─────────────────────────────────────────────────────

step("A", "Modules P7.4 + docs");

const modules = [
  ["Types", `${RI}/customer-evidence-applied-second-customer-types.ts`],
  ["Module", `${RI}/customer-evidence-applied-second-customer.ts`],
  ["UI copy", `${RI}/customer-evidence-applied-second-customer-ui-copy.ts`],
  ["QA", `${RI}/customer-evidence-applied-second-customer-qa.ts`],
  ["Doc P7.4", "docs/PHASE_7_4_CUSTOMER_EVIDENCE_APPLIED_SECOND_CUSTOMER.md"],
  ["Evidence template P7.4", "docs/templates/PHASE_7_4_CUSTOMER_EVIDENCE_APPLIED_SECOND_CUSTOMER_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P7.4 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P7.4 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/customer-evidence-applied-second-customer.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P7.4 — token write DB détecté"); needsReview++; }
else ok("Modules P7.4 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P7.4 — appel réseau détecté"); needsReview++; }
else ok("Modules P7.4 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P7.4 — client base de données importé"); needsReview++; }
else ok("Modules P7.4 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P7.4 — import Pierre détecté"); needsReview++; }
else ok("Modules P7.4 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P7.4 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P7.4 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P7.4 — import Stripe détecté"); needsReview++; }
else ok("Modules P7.4 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P7.4 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P7.4 — aucun import OpenAI/Anthropic");

// ── C. Statut + invariants littéraux ───────────────────────────────────────────

step("C", "application_status + invariants littéraux");

if (mainSrc.includes('application_status: "ready_to_apply_when_verified"')) ok("application_status : ready_to_apply_when_verified");
else { warn("application_status ready_to_apply_when_verified absent"); needsReview++; }
if (mainSrc.includes("ready_to_apply_customer_evidence_when_verified: true")) ok("ready_to_apply_customer_evidence_when_verified true");
else { warn("ready_to_apply true absent"); needsReview++; }

const falseInvariants = [
  "evidence_applied: false",
  "real_evidence_available: false",
  "go_live_contribution_applied: false",
  "first_customer_success_declared: false",
  "second_customer_selected: false",
  "second_customer_started: false",
  "second_customer_completed: false",
  "multi_customer_evidence_ready: false",
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

// ── D. Matrices + contenus ─────────────────────────────────────────────────────

step("D", "Matrices, applied/unapplied, contribution, client 2, safety gate, runbook");

if (/buildReviewedEvidenceApplicationMatrix/.test(mainSrc) && /application_decision: "not_applied"/.test(mainSrc) && /applied: false/.test(mainSrc)) ok("Application matrix (not_applied, applied false)");
else { warn("Application matrix absente"); needsReview++; }
if (/buildAppliedEvidenceCategories[\s\S]{0,120}return \[\];/.test(mainSrc)) ok("Applied categories : vide");
else { warn("Applied categories non vide / absente"); needsReview++; }
if (/buildUnappliedEvidenceCategories/.test(mainSrc) && /no_verified_real_evidence_yet/.test(mainSrc) && /cannot_auto_apply/.test(mainSrc)) ok("Unapplied categories (raisons)");
else { warn("Unapplied categories absentes"); needsReview++; }
if (/currently_eligible: false/.test(mainSrc) && /auto_update_allowed: false/.test(mainSrc) && /applied_to_go_live_proofs: false/.test(mainSrc)) ok("Go-live contribution (currently_eligible/auto_update false)");
else { warn("Go-live contribution absente"); needsReview++; }
if (/recommended_decision: "request_more_evidence"/.test(mainSrc)) ok("Continuation : request_more_evidence");
else { warn("Continuation request_more_evidence absent"); needsReview++; }
if (/buildSecondCustomerPreparationMatrix/.test(mainSrc) && /ready: false/.test(mainSrc) && /keep_runtime_disabled/.test(mainSrc)) ok("Second customer prep (ready false, runtime disabled)");
else { warn("Second customer prep absente"); needsReview++; }
if (/Client simple/.test(mainSrc) && /Cas S1 ou S2 recommandé/.test(mainSrc)) ok("Selection criteria (client simple, S1/S2)");
else { warn("Selection criteria absents"); needsReview++; }
if (/current_verified_customer_count: 0/.test(mainSrc) && /evidence_base_ready: false/.test(mainSrc)) ok("Multi-client base (count 0, non prête)");
else { warn("Multi-client base absente"); needsReview++; }
if (/buildCustomer1VsCustomer2ComparisonPlan/.test(mainSrc)) ok("Comparison plan présent");
else { warn("Comparison plan absent"); needsReview++; }
if (/final_decision: "blocked"/.test(mainSrc) && /first_customer_success_not_enough: true/.test(mainSrc) && /second_customer_success_not_enough_alone: true/.test(mainSrc)) ok("Public launch safety gate (bloqué, 1 et 2 clients ne suffisent pas)");
else { warn("Public launch safety gate absent"); needsReview++; }
if (/Aucune auto-application/.test(mainSrc)) ok("Evidence application rules (aucune auto-application)");
else { warn("Application rules absentes"); needsReview++; }
if (/Ne pas déclarer public launch/.test(mainSrc)) ok("Operator checklist (ne pas déclarer public launch)");
else { warn("Operator checklist absente"); needsReview++; }
if (/buildSecondCustomerRunbook/.test(mainSrc) && /can_start_now: false/.test(mainSrc)) ok("Second customer runbook (can_start_now false)");
else { warn("Second customer runbook absent"); needsReview++; }
if (/Second Customer Controlled Run/.test(mainSrc)) ok("Prochaine phase : Second Customer Controlled Run / Public Launch Review Prep");
else { warn("Prochaine phase Second Customer Run absente"); needsReview++; }

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
if (pkg.includes("test:phase7-4")) ok("test:phase7-4");
else { warn("MANQUANT : test:phase7-4"); needsReview++; }
if (pkg.includes("check:customer-evidence-applied-second-customer")) ok("check:customer-evidence-applied-second-customer");
else { warn("MANQUANT : check:customer-evidence-applied-second-customer"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI Customer Evidence Applied (page, lecture seule)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — Customer Evidence Applied")) ok("« Pierre — Customer Evidence Applied » présent");
else { warn("Titre Customer Evidence Applied absent"); needsReview++; }
if (page.includes("CEA_MICROCOPY")) ok("« application contrôlée » câblé (constante)");
else { warn("Microcopy application contrôlée absente"); needsReview++; }
if (page.includes("CEA_NO_APPLY_WITHOUT_REAL")) ok("« Aucune preuve n'est appliquée sans vérification réelle » câblé (constante)");
else { warn("No apply without real absent"); needsReview++; }
if (page.includes("CEA_NOT_PUBLIC")) ok("« ne suffisent pas à déclarer le lancement public » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("buildCustomerEvidenceAppliedSecondCustomerReport")) ok("Evidence Applied câblé");
else { warn("Evidence Applied non câblé"); needsReview++; }
if (/Appliquer preuve|Modifier go-live proofs|Déclarer public launch|Déclarer customer success|Démarrer client 2|Activer runtime/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Appliquer preuve / Modifier go-live proofs / Démarrer client 2");

// ── H. Microcopy module UI copy (constantes) ──────────────────────────────────

step("H", "Microcopy module UI copy");

const uiCopy = read(`${RI}/customer-evidence-applied-second-customer-ui-copy.ts`);
if (uiCopy.includes("Evidence Applied · application contrôlée")) ok("« Evidence Applied · application contrôlée »");
else { warn("Microcopy application contrôlée absente"); needsReview++; }
if (uiCopy.includes("Aucune preuve n'est appliquée sans vérification réelle")) ok("« Aucune preuve n'est appliquée sans vérification réelle »");
else { warn("Microcopy no apply without real absente"); needsReview++; }
if (uiCopy.includes("ne suffisent pas à déclarer le lancement public")) ok("« ne suffisent pas à déclarer le lancement public »");
else { warn("Microcopy not public absente"); needsReview++; }
if (uiCopy.includes("Second Customer Controlled Run")) ok("« Second Customer Controlled Run »");
else { warn("Microcopy Second Customer Run absente"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Evidence application gate. Aucune preuve inventée ni auto-appliquée. Public launch BLOCKED.");
info("Un ou deux clients ne suffisent pas à déclarer le lancement public.");
info("go-live proofs restent manuels et vérifiables, jamais modifiés par ce module. Client 2 non démarré.");
info("scale 80k NON prouvé. Prochaine étape : Second Customer Controlled Run / Public Launch Review Prep.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Application contrôlée des preuves + préparation client 2 cohérente (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Aucune application sans preuve réelle · public launch bloqué · go-live proofs manuels · client 2 non démarré.");
log("═".repeat(60) + "\n");
