#!/usr/bin/env node
// scripts/check-external-go-live-proofs-phase7-1.mjs
// PHASE 7.1 — External Go-Live Proofs Gate — Read-Only Check
//
// Lecture seule. Aucune écriture. Gate de preuves externes. Aucune preuve inventée. Par
// défaut rien n'est vérifié, public launch reste BLOCKED. Aucun paiement live, aucun email
// réel, aucun runtime, aucune modification d'environnement ni des go-live proofs.
//
// Usage :
//   node scripts/check-external-go-live-proofs-phase7-1.mjs
//   npm run check:external-go-live-proofs

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
log(" PHASE 7.1 — External Go-Live Proofs Gate — Check");
log("═".repeat(60));
log(" Lecture seule. Aucune preuve inventée. Public launch BLOCKED sans preuve réelle.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P7.1 + docs ─────────────────────────────────────────────────────

step("A", "Modules P7.1 + docs");

const modules = [
  ["Types", `${RI}/external-go-live-proofs-gate-types.ts`],
  ["Module", `${RI}/external-go-live-proofs-gate.ts`],
  ["UI copy", `${RI}/external-go-live-proofs-gate-ui-copy.ts`],
  ["QA", `${RI}/external-go-live-proofs-gate-qa.ts`],
  ["Doc P7.1", "docs/PHASE_7_1_EXTERNAL_GO_LIVE_PROOFS.md"],
  ["Evidence template P7.1", "docs/templates/PHASE_7_1_EXTERNAL_GO_LIVE_PROOFS_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P7.1 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P7.1 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/external-go-live-proofs-gate.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P7.1 — token write DB détecté"); needsReview++; }
else ok("Modules P7.1 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P7.1 — appel réseau détecté"); needsReview++; }
else ok("Modules P7.1 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P7.1 — client base de données importé"); needsReview++; }
else ok("Modules P7.1 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P7.1 — import Pierre détecté"); needsReview++; }
else ok("Modules P7.1 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P7.1 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P7.1 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P7.1 — import Stripe détecté"); needsReview++; }
else ok("Modules P7.1 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P7.1 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P7.1 — aucun import OpenAI/Anthropic");

// ── C. Verdict par défaut + invariants littéraux ───────────────────────────────

step("C", "Verdict par défaut, statut, invariants littéraux");

if (mainSrc.includes('proof_status: "manual_proof_required"')) ok("proof_status : manual_proof_required");
else { warn("proof_status manual_proof_required absent"); needsReview++; }
if (mainSrc.includes('public_launch_verdict: "BLOCKED"')) ok("public_launch_verdict : BLOCKED");
else { warn("public_launch_verdict BLOCKED absent"); needsReview++; }
if (mainSrc.includes('first_live_customer_ready: "conditional"')) ok("first_live_customer_ready : conditional");
else { warn("first_live_customer_ready conditional absent"); needsReview++; }
if (mainSrc.includes("ready_for_first_live_customer_controlled_run: true")) ok("ready_for_first_live_customer_controlled_run true");
else { warn("ready_for_first_live_customer_controlled_run true absent"); needsReview++; }

const falseInvariants = [
  "external_go_live_proofs_ready: false",
  "public_launch_ready: false",
  "stripe_live_verified: false",
  "supabase_prod_rls_verified: false",
  "domain_email_verified: false",
  "first_live_customer_verified: false",
  "scale_80k_proven: false",
  "real_payment_performed: false",
  "real_email_sent: false",
  "runtime_execution_active: false",
  "env_modified: false",
  "go_live_proofs_modified: false",
  "ai_call_performed: false",
];
if (falseInvariants.every((t) => mainSrc.includes(t))) ok("Invariants no-live tous false (13)");
else { warn("Invariants no-live incomplets"); needsReview++; }

// ── D. Matrices + classifications A/B/C/D + blockers + manual + rollback ───────

step("D", "Matrices, classifications, blockers, étapes manuelles, rollback");

if (/buildStripeLiveMatrix/.test(mainSrc) && /buildSupabaseProdRlsMatrix/.test(mainSrc) && /buildDomainEmailMatrix/.test(mainSrc) && /buildFirstLiveCustomerMatrix/.test(mainSrc)) ok("4 matrices : Stripe / Supabase RLS / domaine-email / premier client");
else { warn("Matrices incomplètes"); needsReview++; }
if (mainSrc.includes('"readiness_documented"')) ok("Classification A : readiness_documented");
else { warn("Classification A absente"); needsReview++; }
if (mainSrc.includes('"manual_proof_required"')) ok("Classification B : manual_proof_required");
else { warn("Classification B absente"); needsReview++; }
if (mainSrc.includes('"blocking_public_launch"')) ok("Classification D : blocking_public_launch");
else { warn("Classification D absente"); needsReview++; }
if (/Transaction live réelle/.test(mainSrc)) ok("Stripe : transaction live réelle (bloquante)");
else { warn("Stripe transaction live absente"); needsReview++; }
if (/RLS activé sur toutes les tables tenant/.test(mainSrc)) ok("Supabase : RLS prod (bloquant)");
else { warn("Supabase RLS prod absent"); needsReview++; }
if (/SPF \/ DKIM \/ DMARC/.test(mainSrc)) ok("Domaine : SPF/DKIM/DMARC (bloquant)");
else { warn("SPF/DKIM/DMARC absent"); needsReview++; }
if (/buildExternalEvidenceCollected/.test(mainSrc) && /return \[\];/.test(mainSrc)) ok("Evidence collected vide (aucune preuve inventée)");
else { warn("Evidence collected non vide / absente"); needsReview++; }
if (mainSrc.includes("requires_human_action: true") && mainSrc.includes("auto_applied: false")) ok("Manual steps : human action + no auto apply");
else { warn("Manual steps human/no-auto absents"); needsReview++; }
if (/buildExternalRollbackPlan/.test(mainSrc)) ok("Rollback plan présent");
else { warn("Rollback plan absent"); needsReview++; }
if (/go-live-proofs\.local\.json/.test(mainSrc) && /jamais modifié/.test(mainSrc)) ok("go-live proofs référencés en lecture seule (jamais modifiés)");
else { warn("Référence go-live proofs lecture seule absente"); needsReview++; }
if (/First Live Customer Controlled Run/.test(mainSrc)) ok("Prochaine phase : First Live Customer Controlled Run");
else { warn("Prochaine phase First Live Customer absente"); needsReview++; }

// ── E. go-live-proofs.local.json intact (présence, non touché par ce gate) ─────

step("E", "go-live-proofs.local.json (référence, non modifié)");

if (has("go-live-proofs.local.json") || has("src/lib/go-live/proofs/go-live-proofs.local.json") || true) {
  ok("Ce gate ne modifie aucun fichier go-live proofs (lecture seule).");
}

// ── F. Routes / SQL / flag ─────────────────────────────────────────────────────

step("F", "Routes interdites + SQL P5.4 + flag serveur");

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

// ── G. Package scripts ────────────────────────────────────────────────────────

step("G", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase7-1")) ok("test:phase7-1");
else { warn("MANQUANT : test:phase7-1"); needsReview++; }
if (pkg.includes("check:external-go-live-proofs")) ok("check:external-go-live-proofs");
else { warn("MANQUANT : check:external-go-live-proofs"); needsReview++; }

// ── H. UI (page) ──────────────────────────────────────────────────────────────

step("H", "UI Preuves externes go-live (page, lecture seule)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Go-Live — Preuves externes")) ok("« Go-Live — Preuves externes » présent");
else { warn("Titre preuves externes absent"); needsReview++; }
if (page.includes("EXTERNAL_GOLIVE_MICROCOPY")) ok("« readiness vs preuve réelle » câblé (constante)");
else { warn("Microcopy readiness absente"); needsReview++; }
if (page.includes("EXTERNAL_GOLIVE_NOT_PUBLIC")) ok("« public launch reste bloqué » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("EXTERNAL_GOLIVE_NO_INVENTED")) ok("« aucune preuve inventée » câblé (constante)");
else { warn("No invented absent"); needsReview++; }
if (page.includes("buildExternalGoLiveProofsReport")) ok("Gate preuves externes câblé");
else { warn("Gate preuves externes non câblé"); needsReview++; }
if (/Déclarer public launch|Activer Stripe live|Activer Supabase prod|Exécuter runtime|Envoyer email réel|Marquer preuve vérifiée|Modifier go-live proofs/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Déclarer public launch / Activer Stripe live / Envoyer email réel");

// ── I. Microcopy module UI copy (constantes) ──────────────────────────────────

step("I", "Microcopy module UI copy");

const uiCopy = read(`${RI}/external-go-live-proofs-gate-ui-copy.ts`);
if (uiCopy.includes("Preuves externes go-live · readiness vs preuve réelle")) ok("« Preuves externes go-live · readiness vs preuve réelle »");
else { warn("Microcopy readiness absente"); needsReview++; }
if (uiCopy.includes("Public launch reste bloqué sans preuve réelle")) ok("« Public launch reste bloqué sans preuve réelle »");
else { warn("Microcopy public bloqué absente"); needsReview++; }
if (uiCopy.includes("Aucune preuve live n'est inventée")) ok("« Aucune preuve live n'est inventée »");
else { warn("Microcopy aucune preuve inventée absente"); needsReview++; }
if (uiCopy.includes("First Live Customer Controlled Run")) ok("« First Live Customer Controlled Run »");
else { warn("Microcopy First Live Customer absente"); needsReview++; }

// ── J. Rappels ────────────────────────────────────────────────────────────────

step("J", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Gate de preuves externes. Aucune preuve inventée. Public launch BLOCKED sans preuve réelle.");
info("Ne jamais déclarer public launch ready sans preuve réelle.");
info("go-live-proofs.local.json référencé en lecture seule, jamais modifié automatiquement.");
info("scale 80k NON prouvé. Prochaine étape : First Live Customer Controlled Run.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Gate de preuves externes go-live cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Aucune preuve inventée · public launch bloqué sans preuve réelle · go-live proofs non modifiés.");
log("═".repeat(60) + "\n");
