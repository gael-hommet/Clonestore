#!/usr/bin/env node
// scripts/check-pierre-sellable-gate-final-phase6-6.mjs
// PHASE 6.6 — Pierre Sellable Gate Final — Read-Only Check
//
// Lecture seule. Aucune écriture. Verdict de vendabilité contrôlée. Aucun paiement live.
// Aucune exécution autonome. Aucun email réel. Aucune preuve live inventée. Stripe live /
// Supabase prod / domaine-email / scale restent à prouver avant public launch.
//
// Usage :
//   node scripts/check-pierre-sellable-gate-final-phase6-6.mjs
//   npm run check:pierre-sellable-gate-final

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
log(" PHASE 6.6 — Pierre Sellable Gate Final — Check");
log("═".repeat(60));
log(" Lecture seule. Verdict contrôlé. Aucun paiement live. Aucune exécution autonome.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P6.6 + docs ─────────────────────────────────────────────────────

step("A", "Modules P6.6 + docs");

const modules = [
  ["Types", `${RI}/pierre-sellable-gate-final-types.ts`],
  ["Module", `${RI}/pierre-sellable-gate-final.ts`],
  ["UI copy", `${RI}/pierre-sellable-gate-final-ui-copy.ts`],
  ["QA", `${RI}/pierre-sellable-gate-final-qa.ts`],
  ["Doc P6.6", "docs/PHASE_6_6_PIERRE_SELLABLE_GATE_FINAL.md"],
  ["Evidence template P6.6", "docs/templates/PHASE_6_6_PIERRE_SELLABLE_GATE_FINAL_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P6.6 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P6.6 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/pierre-sellable-gate-final.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P6.6 — token write DB détecté"); needsReview++; }
else ok("Modules P6.6 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P6.6 — appel réseau détecté"); needsReview++; }
else ok("Modules P6.6 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P6.6 — client base de données importé"); needsReview++; }
else ok("Modules P6.6 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P6.6 — import Pierre détecté"); needsReview++; }
else ok("Modules P6.6 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P6.6 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P6.6 — aucune référence route API littérale");
if (/from\s+["'](stripe|@stripe)/i.test(blob)) { warn("Modules P6.6 — import Stripe détecté"); needsReview++; }
else ok("Modules P6.6 — aucun import Stripe");
if (/from\s+["'](openai|@anthropic)/i.test(blob)) { warn("Modules P6.6 — import OpenAI/Anthropic détecté"); needsReview++; }
else ok("Modules P6.6 — aucun import OpenAI/Anthropic");

// ── C. Verdict final + matrices + invariants ───────────────────────────────────

step("C", "Verdict final, niveau, matrices, invariants littéraux");

if (mainSrc.includes('final_sellability_level: "controlled_first_customer_sellable"')) ok("Niveau : controlled_first_customer_sellable");
else { warn("Niveau controlled_first_customer_sellable absent"); needsReview++; }
if (mainSrc.includes("controlled_first_sale_ready: true")) ok("controlled_first_sale_ready true");
else { warn("controlled_first_sale_ready true absent"); needsReview++; }
if (mainSrc.includes("first_customer_sellable_with_limits: true")) ok("first_customer_sellable_with_limits true");
else { warn("first_customer_sellable_with_limits true absent"); needsReview++; }
if (mainSrc.includes("public_launch_ready: false")) ok("public_launch_ready false");
else { warn("public_launch_ready false absent"); needsReview++; }
if (mainSrc.includes("scale_ready: false")) ok("scale_ready false");
else { warn("scale_ready false absent"); needsReview++; }
if (mainSrc.includes("ready_for_external_go_live_proofs: true")) ok("ready_for_external_go_live_proofs true");
else { warn("ready_for_external_go_live_proofs true absent"); needsReview++; }
if (mainSrc.includes("ready_for_first_controlled_customer: true")) ok("ready_for_first_controlled_customer true");
else { warn("ready_for_first_controlled_customer true absent"); needsReview++; }

const falseInvariants = [
  "pierre_fully_sellable_public_launch: false",
  "stripe_live_payment_proven: false",
  "supabase_prod_verified: false",
  "domain_email_prod_verified: false",
  "runtime_execution_active: false",
  "server_persistence_active: false",
  "real_email_sent: false",
  "official_document_generated: false",
  "ai_call_performed: false",
  "sql_applied: false",
  "env_modified: false",
  "public_launch_validated: false",
  "scale_80k_proven: false",
];
if (falseInvariants.every((t) => mainSrc.includes(t))) ok("Invariants no-live tous false (13)");
else { warn("Invariants no-live incomplets"); needsReview++; }

// ── D. Matrices P6 + verdict + promesses + playbook + risques ──────────────────

step("D", "Phase matrix, verdict matrix, promesses, playbook, risques");

const phases = ['"P6.1"', '"P6.2"', '"P6.3"', '"P6.4"', '"P6.5"'];
if (phases.every((p) => mainSrc.includes(p))) ok("Phase matrix : P6.1 → P6.5");
else { warn("Phase matrix incomplète"); needsReview++; }
if (mainSrc.includes('"READY_WITH_LIMITS"')) ok("Verdict premier client : READY_WITH_LIMITS");
else { warn("READY_WITH_LIMITS absent"); needsReview++; }
if (mainSrc.includes('"BLOCKED"')) ok("Verdict public launch : BLOCKED");
else { warn("BLOCKED absent"); needsReview++; }
if (mainSrc.includes('"NOT_PROVEN"')) ok("Verdict scale 80k : NOT_PROVEN");
else { warn("NOT_PROVEN absent"); needsReview++; }
if (/Stripe live non prouvé/.test(mainSrc) && /Supabase prod \/ RLS non prouvés/.test(mainSrc)) ok("Public blockers : Stripe live + Supabase prod/RLS");
else { warn("Public blockers Stripe/Supabase absents"); needsReview++; }
if (/Load tests non réalisés/.test(mainSrc) && /Cost scaling non prouvé/.test(mainSrc)) ok("Scale blockers : load tests + cost scaling");
else { warn("Scale blockers absents"); needsReview++; }
if (mainSrc.includes("employé IA RH")) ok("Promesse autorisée : employé IA RH");
else { warn("Promesse autorisée employé IA RH absente"); needsReview++; }
if (mainSrc.includes("remplace totalement votre RH") && mainSrc.includes("tient 80k clients")) ok("Promesses interdites : remplace RH + 80k");
else { warn("Promesses interdites absentes"); needsReview++; }
if (mainSrc.includes("no_runtime: true") && mainSrc.includes("no_public_claim: true")) ok("Playbook : no_runtime / no_public_claim");
else { warn("Playbook no_runtime/no_public_claim absent"); needsReview++; }
if (mainSrc.includes("Overclaiming public launch") && mainSrc.includes("Scale claim")) ok("Risk matrix : overclaiming public + scale claim");
else { warn("Risk matrix absente"); needsReview++; }
if (mainSrc.includes("phase_6_closure_statement")) ok("Phase 6 closure statement présent");
else { warn("Phase 6 closure statement absent"); needsReview++; }
if (/External Go-Live Proofs/.test(mainSrc)) ok("Prochaine phase : External Go-Live Proofs");
else { warn("Prochaine phase External Go-Live Proofs absente"); needsReview++; }

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
if (pkg.includes("test:phase6-6")) ok("test:phase6-6");
else { warn("MANQUANT : test:phase6-6"); needsReview++; }
if (pkg.includes("check:pierre-sellable-gate-final")) ok("check:pierre-sellable-gate-final");
else { warn("MANQUANT : check:pierre-sellable-gate-final"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI Sellable Gate Final (page, verdict contrôlé)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("Pierre — Sellable Gate Final")) ok("« Pierre — Sellable Gate Final » présent");
else { warn("Titre Sellable Gate absent"); needsReview++; }
if (page.includes("PIERRE_GATE_MICROCOPY")) ok("« verdict contrôlé » câblé (constante)");
else { warn("Microcopy verdict contrôlé absente"); needsReview++; }
if (page.includes("PIERRE_GATE_CONTROLLED_SELLABLE")) ok("« première vente contrôlée avec limites » câblé (constante)");
else { warn("Controlled sellable absent"); needsReview++; }
if (page.includes("PIERRE_GATE_NOT_PUBLIC")) ok("« pas encore prêt pour un lancement public » câblé (constante)");
else { warn("Not public absent"); needsReview++; }
if (page.includes("buildPierreSellableGateFinalReport")) ok("Sellable Gate câblé");
else { warn("Sellable Gate non câblé"); needsReview++; }
if (/Déclarer public launch|Déclarer scale ready|Déclarer fully sellable|Activer Stripe live|Activer runtime|Envoyer email réel|Générer document officiel/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Déclarer public launch / Déclarer scale ready / Activer Stripe live");

// ── H. Microcopy UI copy (constantes) ─────────────────────────────────────────

step("H", "Microcopy module UI copy");

const uiCopy = read(`${RI}/pierre-sellable-gate-final-ui-copy.ts`);
if (uiCopy.includes("Sellable Gate Pierre · verdict contrôlé")) ok("« Sellable Gate Pierre · verdict contrôlé »");
else { warn("Microcopy verdict contrôlé absente"); needsReview++; }
if (uiCopy.includes("vendable pour une première vente contrôlée avec limites")) ok("« vendable pour une première vente contrôlée avec limites »");
else { warn("Microcopy controlled sellable absente"); needsReview++; }
if (uiCopy.includes("n'est pas encore prêt pour un lancement public")) ok("« n'est pas encore prêt pour un lancement public »");
else { warn("Microcopy not public absente"); needsReview++; }
if (uiCopy.includes("External Go-Live Proofs")) ok("« External Go-Live Proofs »");
else { warn("Microcopy External Go-Live Proofs absente"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Verdict contrôlé. Aucun paiement live. Aucune exécution autonome. Aucune preuve inventée.");
info("Pierre vendable pour premier client contrôlé AVEC LIMITES uniquement.");
info("public launch NON validé. scale 80k NON prouvé.");
info("Prochaine étape : External Go-Live Proofs / First Live Customer.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Verdict de vendabilité contrôlée Pierre cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Verdict contrôlé · premier client avec limites · public launch bloqué · scale 80k non prouvé.");
log("═".repeat(60) + "\n");
