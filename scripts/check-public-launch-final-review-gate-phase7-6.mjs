#!/usr/bin/env node
// scripts/check-public-launch-final-review-gate-phase7-6.mjs
// PHASE 7.6 — Public Launch Final Review Gate — Read-Only Check
//
// Lecture seule. Aucune écriture. Final review / decision gate agrégeant P7.1 → P7.5. Aucune
// preuve inventée. Gates internes prêts, preuves externes manquantes. Public launch reste
// BLOCKED. Phase 7 interne fermée ; prochaine étape = preuves externes réelles (pas un nouveau
// gate). go-live proofs non modifiés. Aucun runtime, aucun email réel, aucun env.
//
// Usage :
//   node scripts/check-public-launch-final-review-gate-phase7-6.mjs
//   npm run check:public-launch-final-review-gate

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
log(" PHASE 7.6 — Public Launch Final Review Gate — Check");
log("═".repeat(60));
log(" Lecture seule. Gates internes prêts, preuves externes manquantes. Public launch BLOCKED.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P7.6 + docs ─────────────────────────────────────────────────────

step("A", "Modules P7.6 + docs");

const modules = [
  ["Types", `${RI}/public-launch-final-review-gate-types.ts`],
  ["Module", `${RI}/public-launch-final-review-gate.ts`],
  ["UI copy", `${RI}/public-launch-final-review-gate-ui-copy.ts`],
  ["QA", `${RI}/public-launch-final-review-gate-qa.ts`],
  ["Doc P7.6", "docs/PHASE_7_6_PUBLIC_LAUNCH_FINAL_REVIEW_GATE.md"],
  ["Evidence template P7.6", "docs/templates/PHASE_7_6_PUBLIC_LAUNCH_FINAL_REVIEW_GATE_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P7.6 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P7.6 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/public-launch-final-review-gate.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P7.6 — token write DB détecté"); needsReview++; }
else ok("Modules P7.6 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P7.6 — appel réseau détecté"); needsReview++; }
else ok("Modules P7.6 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P7.6 — client base de données importé"); needsReview++; }
else ok("Modules P7.6 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P7.6 — import Pierre détecté"); needsReview++; }
else ok("Modules P7.6 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P7.6 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P7.6 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P7.6 — import Stripe détecté"); needsReview++; }
else ok("Modules P7.6 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P7.6 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P7.6 — aucun import OpenAI/Anthropic");

// ── C. Invariants littéraux ─────────────────────────────────────────────────────

step("C", "review_status + invariants littéraux");

if (mainSrc.includes('review_status: "blocked_missing_external_proofs"')) ok("review_status : blocked_missing_external_proofs");
else { warn("review_status blocked_missing_external_proofs absent"); needsReview++; }

const trueInvariants = [
  "phase_7_internal_gate_complete: true",
  "ready_for_external_proof_execution: true",
  "controlled_first_customer_sellable: true",
  "controlled_second_customer_preparation_ready: true",
  "public_launch_review_completed: true",
];
if (trueInvariants.every((t) => mainSrc.includes(t))) ok("Invariants internes true (5)");
else { warn("Invariants internes true incomplets"); needsReview++; }

const falseInvariants = [
  "public_launch_ready: false",
  "external_proofs_complete: false",
  "customer_evidence_complete: false",
  "multi_customer_evidence_ready: false",
  "reproducibility_verified: false",
  "stripe_live_verified: false",
  "supabase_prod_rls_verified: false",
  "domain_email_verified: false",
  "legal_final_review_verified: false",
  "support_readiness_verified: false",
  "production_monitoring_verified: false",
  "real_payment_verified: false",
  "first_customer_completed_verified: false",
  "second_customer_completed_verified: false",
  "scale_80k_proven: false",
  "runtime_execution_active: false",
  "real_email_sent: false",
  "official_document_generated: false",
  "go_live_proofs_modified: false",
  "env_modified: false",
  "ai_call_performed: false",
];
if (falseInvariants.every((t) => mainSrc.includes(t))) ok("Invariants no-live tous false (21)");
else { warn("Invariants no-live incomplets"); needsReview++; }

// ── D. Agrégation + matrices + verdict + décision + clôture ────────────────────

step("D", "Phase 7 matrix, verdict, matrices externes/client/legal/tech, décision, clôture");

const phases = ['"P7.1"', '"P7.2"', '"P7.3"', '"P7.4"', '"P7.5"'];
if (phases.every((p) => mainSrc.includes(p))) ok("Phase 7 completion matrix : P7.1 → P7.5");
else { warn("Phase 7 completion matrix incomplète"); needsReview++; }
if (/real_world_proof_complete: false/.test(mainSrc)) ok("Phase 7 matrix : real_world_proof_complete false");
else { warn("real_world_proof_complete false absent"); needsReview++; }
if (/verdict: "READY_WITH_LIMITS"/.test(mainSrc) && /verdict: "PREPARATION_READY"/.test(mainSrc) && /verdict: "BLOCKED"/.test(mainSrc) && /verdict: "NOT_PROVEN"/.test(mainSrc)) ok("Sellability verdict : READY_WITH_LIMITS / PREPARATION_READY / BLOCKED / NOT_PROVEN");
else { warn("Sellability verdict incomplet"); needsReview++; }
if (/buildExternalProofFinalMatrix/.test(mainSrc) && /Stripe live payment/.test(mainSrc) && /evidence_link: null/.test(mainSrc) && /blocking_public_launch: true/.test(mainSrc)) ok("External proof matrix (Stripe live, links null, bloquant)");
else { warn("External proof matrix absente"); needsReview++; }
if (/buildCustomerEvidenceFinalMatrix/.test(mainSrc) && /evidence_available: false/.test(mainSrc)) ok("Customer evidence matrix (evidence_available false)");
else { warn("Customer evidence matrix absente"); needsReview++; }
if (/buildLegalCommercialFinalMatrix/.test(mainSrc) && /manual_review_required: true/.test(mainSrc)) ok("Legal matrix (manual_review_required)");
else { warn("Legal matrix absente"); needsReview++; }
if (/buildTechnicalOperationsFinalMatrix/.test(mainSrc) && /owner/.test(mainSrc)) ok("Technical/operations matrix (owner)");
else { warn("Technical matrix absente"); needsReview++; }
if (/buildPublicLaunchScorecard/.test(mainSrc) && /current_score: 0/.test(mainSrc)) ok("Scorecard (current_score 0)");
else { warn("Scorecard absente"); needsReview++; }
if (/Stripe live non vérifié/.test(mainSrc) && /Supabase prod \/ RLS non vérifié/.test(mainSrc) && /Comparaison multi-client absente/.test(mainSrc) && /Scale 80k non prouvé/.test(mainSrc)) ok("Blocking conditions (Stripe/Supabase/multi-client/scale)");
else { warn("Blocking conditions incomplètes"); needsReview++; }
if (/premier client contrôlé avec limites/.test(mainSrc)) ok("Allowed claims (premier client contrôlé)");
else { warn("Allowed claims absentes"); needsReview++; }
if (/Public launch ready\./.test(mainSrc) && /Paie officielle automatisée\./.test(mainSrc)) ok("Forbidden claims (public launch ready, paie automatisée)");
else { warn("Forbidden claims absentes"); needsReview++; }
if (/Configurer Stripe live/.test(mainSrc) && /Vérifier Supabase production/.test(mainSrc) && /Sélectionner le premier client réel/.test(mainSrc)) ok("Immediate actions (Stripe live, Supabase, premier client réel)");
else { warn("Immediate actions absentes"); needsReview++; }
if (/demo-only/.test(mainSrc)) ok("Rollback (demo-only)");
else { warn("Rollback demo-only absent"); needsReview++; }
if (/decision: "BLOCKED"/.test(mainSrc) && /controlled_first_customer_allowed: true/.test(mainSrc) && /public_marketing_launch_allowed: false/.test(mainSrc) && /manual_controlled_sales_allowed: true/.test(mainSrc)) ok("Final decision (BLOCKED, first customer allowed, marketing false)");
else { warn("Final decision absente"); needsReview++; }
if (/phase_7_internal_work_complete: true/.test(mainSrc) && /phase_7_external_execution_complete: false/.test(mainSrc) && /no_more_read_only_gate_required_before_real_execution: true/.test(mainSrc) && /next_step_must_be_real_external_proof_execution: true/.test(mainSrc)) ok("Phase 7 closure (interne complet, externe non, no more read-only gate, next real proof)");
else { warn("Phase 7 closure absente"); needsReview++; }
if (/Real External Proof Execution/.test(mainSrc)) ok("Prochaine étape : Real External Proof Execution");
else { warn("Prochaine étape Real External Proof absente"); needsReview++; }

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
if (pkg.includes("test:phase7-6")) ok("test:phase7-6");
else { warn("MANQUANT : test:phase7-6"); needsReview++; }
if (pkg.includes("check:public-launch-final-review-gate")) ok("check:public-launch-final-review-gate");
else { warn("MANQUANT : check:public-launch-final-review-gate"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI Public Launch Final Review (page, lecture seule)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — Public Launch Final Review")) ok("« Pierre — Public Launch Final Review » présent");
else { warn("Titre Public Launch Final Review absent"); needsReview++; }
if (page.includes("PLF_MICROCOPY")) ok("« preuves réelles obligatoires » câblé (constante)");
else { warn("Microcopy preuves réelles absente"); needsReview++; }
if (page.includes("PLF_INTERNAL_VS_EXTERNAL")) ok("« preuves externes ne le sont pas » câblé (constante)");
else { warn("Internal vs external absent"); needsReview++; }
if (page.includes("PLF_NOT_PUBLIC")) ok("« lancement public reste bloqué » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("PLF_NEXT_REAL")) ok("« pas un nouveau gate » câblé (constante)");
else { warn("Next real absent"); needsReview++; }
if (page.includes("buildPublicLaunchFinalReviewGateReport")) ok("Final review câblé");
else { warn("Final review non câblé"); needsReview++; }
if (/Déclarer public launch|Marquer preuve vérifiée|Modifier go-live proofs|Activer Stripe live|Activer runtime|Envoyer email|Déclarer scale ready/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Déclarer public launch / Marquer preuve vérifiée / Activer Stripe live");

// ── H. Microcopy module UI copy (constantes) ──────────────────────────────────

step("H", "Microcopy module UI copy");

const uiCopy = read(`${RI}/public-launch-final-review-gate-ui-copy.ts`);
if (uiCopy.includes("Final Review · preuves réelles obligatoires")) ok("« Final Review · preuves réelles obligatoires »");
else { warn("Microcopy preuves réelles absente"); needsReview++; }
if (uiCopy.includes("les preuves externes ne le sont pas")) ok("« les preuves externes ne le sont pas »");
else { warn("Microcopy internal vs external absente"); needsReview++; }
if (uiCopy.includes("Le lancement public reste bloqué")) ok("« Le lancement public reste bloqué »");
else { warn("Microcopy not public absente"); needsReview++; }
if (uiCopy.includes("pas un nouveau gate")) ok("« pas un nouveau gate »");
else { warn("Microcopy pas un nouveau gate absente"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Final review gate. Gates internes complets, preuves externes manquantes. Public launch BLOCKED.");
info("Phase 7 interne fermée. Aucun autre gate read-only nécessaire.");
info("La prochaine étape doit produire des preuves réelles, pas un nouveau gate.");
info("Premier client contrôlé reste autorisé avec limites. scale 80k NON prouvé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Verdict final Phase 7 cohérent (lecture seule, public launch bloqué).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Gates internes complets · preuves externes manquantes · public launch bloqué · prochaine étape preuves réelles.");
log("═".repeat(60) + "\n");
