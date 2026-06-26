#!/usr/bin/env node
// scripts/check-first-customer-evidence-review-phase7-3.mjs
// PHASE 7.3 — First Customer Evidence Review — Read-Only Check
//
// Lecture seule. Aucune écriture. Review gate des preuves réelles du premier client. Aucune
// preuve inventée ni auto-validée. Public launch reste BLOCKED. go-live proofs restent manuels,
// jamais modifiés automatiquement. Aucun runtime, aucun email réel, aucun env.
//
// Usage :
//   node scripts/check-first-customer-evidence-review-phase7-3.mjs
//   npm run check:first-customer-evidence-review

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
log(" PHASE 7.3 — First Customer Evidence Review — Check");
log("═".repeat(60));
log(" Lecture seule. Aucune preuve inventée ni auto-validée. Public launch BLOCKED.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P7.3 + docs ─────────────────────────────────────────────────────

step("A", "Modules P7.3 + docs");

const modules = [
  ["Types", `${RI}/first-customer-evidence-review-types.ts`],
  ["Module", `${RI}/first-customer-evidence-review.ts`],
  ["UI copy", `${RI}/first-customer-evidence-review-ui-copy.ts`],
  ["QA", `${RI}/first-customer-evidence-review-qa.ts`],
  ["Doc P7.3", "docs/PHASE_7_3_FIRST_CUSTOMER_EVIDENCE_REVIEW.md"],
  ["Evidence template P7.3", "docs/templates/PHASE_7_3_FIRST_CUSTOMER_EVIDENCE_REVIEW_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P7.3 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P7.3 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/first-customer-evidence-review.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P7.3 — token write DB détecté"); needsReview++; }
else ok("Modules P7.3 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P7.3 — appel réseau détecté"); needsReview++; }
else ok("Modules P7.3 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P7.3 — client base de données importé"); needsReview++; }
else ok("Modules P7.3 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P7.3 — import Pierre détecté"); needsReview++; }
else ok("Modules P7.3 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P7.3 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P7.3 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P7.3 — import Stripe détecté"); needsReview++; }
else ok("Modules P7.3 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P7.3 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P7.3 — aucun import OpenAI/Anthropic");

// ── C. Statut + invariants littéraux ───────────────────────────────────────────

step("C", "review_status + invariants littéraux");

if (mainSrc.includes('review_status: "ready_to_review_when_evidence_exists"')) ok("review_status : ready_to_review_when_evidence_exists");
else { warn("review_status ready_to_review_when_evidence_exists absent"); needsReview++; }
if (mainSrc.includes("ready_to_review_first_customer_evidence: true")) ok("ready_to_review_first_customer_evidence true");
else { warn("ready_to_review_first_customer_evidence true absent"); needsReview++; }

const falseInvariants = [
  "first_customer_evidence_review_completed: false",
  "real_customer_verified: false",
  "real_payment_verified: false",
  "contract_signed_verified: false",
  "setup_completed_verified: false",
  "first_value_delivered_verified: false",
  "feedback_collected_verified: false",
  "evidence_complete_verified: false",
  "go_live_proof_update_allowed: false",
  "public_launch_ready: false",
  "scale_80k_proven: false",
  "runtime_execution_active: false",
  "real_email_sent: false",
  "official_document_generated: false",
  "go_live_proofs_modified: false",
  "env_modified: false",
  "ai_call_performed: false",
];
if (falseInvariants.every((t) => mainSrc.includes(t))) ok("Invariants no-live tous false (17)");
else { warn("Invariants no-live incomplets"); needsReview++; }

// ── D. Matrice + catégories + règles + critères + scores + gate ────────────────

step("D", "Matrice, catégories, règles, critères, scores, gate, decision matrix");

const categories = ["customer_identity", "contract_cgv", "payment_or_controlled_activation", "access_activation", "setup_completion", "scenario_selection", "controlled_mission_creation", "first_output_delivery", "human_validation", "customer_feedback", "incident_log", "post_run_decision"];
if (categories.every((c) => mainSrc.includes(`"${c}"`))) ok("Evidence matrix : 12 catégories");
else { warn("Evidence matrix incomplète"); needsReview++; }
if (/status: "missing"/.test(mainSrc) && /verified: false/.test(mainSrc)) ok("Matrice : status missing + verified false");
else { warn("Matrice status/verified absents"); needsReview++; }
if (/buildRequiredEvidenceCategories/.test(mainSrc) && /Client réel identifié/.test(mainSrc)) ok("Required categories (client réel)");
else { warn("Required categories absentes"); needsReview++; }
if (/Preuve datée/.test(mainSrc) && /Preuve vérifiable/.test(mainSrc) && /Aucune preuve ne peut être auto-validée/.test(mainSrc)) ok("Verification rules (datée/vérifiable/no auto-validation)");
else { warn("Verification rules absentes"); needsReview++; }
if (/buildSuccessCriteria/.test(mainSrc) && /buildFailureCriteria/.test(mainSrc) && /buildPartialSuccessCriteria/.test(mainSrc)) ok("Success / failure / partial criteria présents");
else { warn("Criteria absents"); needsReview++; }
if (/current_score: 0/.test(mainSrc)) ok("Quality scores : current_score 0");
else { warn("Quality scores 0 absent"); needsReview++; }
if (/final_public_launch_decision: "blocked"/.test(mainSrc) && /one_customer_success_is_not_public_launch: true/.test(mainSrc)) ok("Public launch gate : bloqué, un client ne suffit pas");
else { warn("Public launch gate absent"); needsReview++; }
if (/requires_stripe_live_proof: true/.test(mainSrc) && /requires_supabase_prod_rls_proof: true/.test(mainSrc) && /requires_domain_email_proof: true/.test(mainSrc) && /requires_legal_review: true/.test(mainSrc)) ok("Public launch gate : preuves externes requises");
else { warn("Public launch gate preuves externes absentes"); needsReview++; }
if (/update_recommended: false/.test(mainSrc) && /never_auto_update: true/.test(mainSrc) && /update_allowed_only_after_manual_review: true/.test(mainSrc)) ok("Go-live recommendation : update false, manuel uniquement, jamais auto");
else { warn("Go-live recommendation absente"); needsReview++; }
if (/recommended: "request_more_evidence"/.test(mainSrc)) ok("Continuation : request_more_evidence");
else { warn("Continuation request_more_evidence absent"); needsReview++; }
if (/buildPostRunDecisionMatrix/.test(mainSrc) && /public_launch_ready: false/.test(mainSrc)) ok("Decision matrix : public launch false");
else { warn("Decision matrix absente"); needsReview++; }
if (/Customer Evidence Applied/.test(mainSrc)) ok("Prochaine phase : Customer Evidence Applied / Second Controlled Customer");
else { warn("Prochaine phase Customer Evidence Applied absente"); needsReview++; }

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
if (pkg.includes("test:phase7-3")) ok("test:phase7-3");
else { warn("MANQUANT : test:phase7-3"); needsReview++; }
if (pkg.includes("check:first-customer-evidence-review")) ok("check:first-customer-evidence-review");
else { warn("MANQUANT : check:first-customer-evidence-review"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI First Customer Evidence Review (page, lecture seule)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — First Customer Evidence Review")) ok("« Pierre — First Customer Evidence Review » présent");
else { warn("Titre Evidence Review absent"); needsReview++; }
if (page.includes("FCER_MICROCOPY")) ok("« preuves réelles uniquement » câblé (constante)");
else { warn("Microcopy preuves réelles absente"); needsReview++; }
if (page.includes("FCER_NO_AUTO_VALIDATION")) ok("« ne valide aucune preuve sans élément réel » câblé (constante)");
else { warn("No auto-validation absent"); needsReview++; }
if (page.includes("FCER_NOT_PUBLIC")) ok("« ne suffit pas à déclarer le lancement public » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("buildFirstCustomerEvidenceReviewReport")) ok("Evidence Review câblé");
else { warn("Evidence Review non câblé"); needsReview++; }
if (/Marquer evidence complete|Déclarer public launch|Modifier go-live proofs|Déclarer paiement vérifié|Déclarer client success|Activer runtime/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Marquer evidence complete / Déclarer public launch / Modifier go-live proofs");

// ── H. Microcopy module UI copy (constantes) ──────────────────────────────────

step("H", "Microcopy module UI copy");

const uiCopy = read(`${RI}/first-customer-evidence-review-ui-copy.ts`);
if (uiCopy.includes("Evidence Review · preuves réelles uniquement")) ok("« Evidence Review · preuves réelles uniquement »");
else { warn("Microcopy preuves réelles absente"); needsReview++; }
if (uiCopy.includes("ne valide aucune preuve sans élément réel")) ok("« ne valide aucune preuve sans élément réel »");
else { warn("Microcopy no auto-validation absente"); needsReview++; }
if (uiCopy.includes("ne suffit pas à déclarer le lancement public")) ok("« ne suffit pas à déclarer le lancement public »");
else { warn("Microcopy not public absente"); needsReview++; }
if (uiCopy.includes("Customer Evidence Applied")) ok("« Customer Evidence Applied »");
else { warn("Microcopy Evidence Applied absente"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Review gate des preuves réelles. Aucune preuve inventée ni auto-validée. Public launch BLOCKED.");
info("Un premier client réussi ne suffit pas à déclarer le lancement public.");
info("go-live proofs restent manuels et vérifiables, jamais modifiés par ce module.");
info("scale 80k NON prouvé. Prochaine étape : Customer Evidence Applied / Second Controlled Customer.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Audit des preuves du premier client cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Preuves réelles uniquement · aucune auto-validation · public launch bloqué · go-live proofs manuels.");
log("═".repeat(60) + "\n");
