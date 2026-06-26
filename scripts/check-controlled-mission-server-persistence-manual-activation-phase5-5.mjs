#!/usr/bin/env node
// scripts/check-controlled-mission-server-persistence-manual-activation-phase5-5.mjs
// PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL appliqué. Aucun flag activé. Aucune route.
// Aucune exécution. QA manuelle uniquement. « ready » = préparation, jamais active.
//
// Usage :
//   node scripts/check-controlled-mission-server-persistence-manual-activation-phase5-5.mjs
//   npm run check:controlled-mission-server-persistence-manual-activation

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
log(" PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA — Check");
log("═".repeat(60));
log(" Lecture seule. QA manuelle uniquement. Aucune activation. Aucune exécution.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.5 + docs ─────────────────────────────────────────────────────

step("A", "Modules P5.5, runbook, evidence, SQL P5.4");

const modules = [
  ["Types", `${RI}/controlled-mission-server-persistence-manual-activation-types.ts`],
  ["QA", `${RI}/controlled-mission-server-persistence-manual-activation-qa.ts`],
  ["UI copy", `${RI}/controlled-mission-server-persistence-manual-activation-ui-copy.ts`],
  ["Doc P5.5", "docs/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_QA.md"],
  ["Runbook P5.5", "docs/runbooks/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_RUNBOOK.md"],
  ["Evidence template P5.5", "docs/templates/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_EVIDENCE.md"],
  ["SQL draft P5.4", "supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P5.5 (scan read-only) ───────────────────────────────
// La QA énumère les noms de checks (« no_execution »…) ; on scanne la forme d'appel.

step("B", "Invariants modules P5.5 (scan read-only)");

const codeLabels = ["Types", "QA", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.5 — token write DB détecté"); needsReview++; }
else ok("Modules P5.5 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P5.5 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.5 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.5 — client base de données détecté"); needsReview++; }
else ok("Modules P5.5 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.5 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.5 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.5 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P5.5 — aucune référence route API littérale");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.5 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.5 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. SQL P5.4 : DO NOT APPLY ────────────────────────────────────────────────

step("C", "SQL P5.4 (non appliqué)");

const sqlFile = read("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
if (sqlFile.includes("DO NOT APPLY")) ok("SQL contient « DO NOT APPLY »");
else { warn("SQL manque « DO NOT APPLY »"); needsReview++; }
if (sqlFile.includes("DESIGN DRAFT ONLY")) ok("SQL contient « DESIGN DRAFT ONLY »");
else { warn("SQL manque « DESIGN DRAFT ONLY »"); needsReview++; }

// ── D. Flag default false ─────────────────────────────────────────────────────

step("D", "Feature flag (default false)");

const policy = read(`${RI}/controlled-mission-server-persistence-policy.ts`);
if (/DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED\s*=\s*false/.test(policy)) ok("Flag serveur default false");
else { warn("Flag serveur default false absent"); needsReview++; }

// ── E. Routes interdites (absentes) ───────────────────────────────────────────

step("E", "Routes serveur interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/pierre/runtime/execute/route.ts",
  "src/app/api/cloneos/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── F. API contract disabled_design_only ──────────────────────────────────────

step("F", "API contract (disabled_design_only)");

const apiContract = read(`${RI}/controlled-mission-server-persistence-api-contract.ts`);
if (apiContract.includes('"disabled_design_only"')) ok("API contract : current_phase_status disabled_design_only");
else { warn("API contract : current_phase_status non disabled_design_only"); needsReview++; }

// ── G. Package scripts ────────────────────────────────────────────────────────

step("G", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase5-5")) ok("test:phase5-5");
else { warn("MANQUANT : test:phase5-5"); needsReview++; }
if (pkg.includes("check:controlled-mission-server-persistence-manual-activation")) ok("check:controlled-mission-server-persistence-manual-activation");
else { warn("MANQUANT : check:controlled-mission-server-persistence-manual-activation"); needsReview++; }

// ── H. UI (page) ──────────────────────────────────────────────────────────────

step("H", "UI activation manuelle (page, QA manuelle uniquement)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY")) ok("Microcopy QA manuelle câblée (constante)");
else { warn("Microcopy QA manuelle absente"); needsReview++; }
if (page.includes("buildControlledMissionServerPersistenceManualActivationQa")) ok("QA manuelle câblée");
else { warn("QA manuelle non câblée"); needsReview++; }
if (/Appliquer SQL|Activer flag|Créer route|Sauvegarder serveur|Persister serveur|Exécuter la mission|Lancer la mission/.test(page)) { warn("Action d'activation/exécution active détectée"); needsReview++; }
else ok("Aucune action Appliquer SQL / Activer flag / Créer route / Exécuter");

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("QA manuelle uniquement. Aucune activation. Ne pas appliquer le SQL.");
info("Flag serveur default false. Aucune route. Aucune donnée envoyée.");
info("Aucune mission serveur réelle. Aucune exécution. Aucun appel Pierre / IA.");
info("Aucun email/document/PDF. CloneVoice non actif.");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — QA manuelle d'activation serveur cohérente (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" QA manuelle · aucune activation · aucune application SQL · aucune exécution.");
log("═".repeat(60) + "\n");
