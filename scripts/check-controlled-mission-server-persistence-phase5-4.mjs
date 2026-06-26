#!/usr/bin/env node
// scripts/check-controlled-mission-server-persistence-phase5-4.mjs
// PHASE 5.4 — Controlled Mission Governed Server Persistence Draft — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucun SQL appliqué. Aucun POST. Aucun Supabase.
// Aucune route controlled-missions/execute active. Aucune exécution. Design-only.
// « ready » = candidate future persistance serveur, jamais active.
//
// Usage :
//   node scripts/check-controlled-mission-server-persistence-phase5-4.mjs
//   npm run check:controlled-mission-server-persistence

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
log(" PHASE 5.4 — Controlled Mission Server Persistence Draft — Check");
log("═".repeat(60));
log(" Lecture seule. Design serveur uniquement. Aucune persistance. Aucune exécution.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.4 ───────────────────────────────────────────────────────────

step("A", "Modules P5.4");

const modules = [
  ["Types", `${RI}/controlled-mission-server-persistence-types.ts`],
  ["Contract", `${RI}/controlled-mission-server-persistence-contract.ts`],
  ["SQL draft", `${RI}/controlled-mission-server-persistence-sql-draft.ts`],
  ["Policy / flag", `${RI}/controlled-mission-server-persistence-policy.ts`],
  ["API contract", `${RI}/controlled-mission-server-persistence-api-contract.ts`],
  ["UI copy", `${RI}/controlled-mission-server-persistence-ui-copy.ts`],
  ["QA", `${RI}/controlled-mission-server-persistence-qa.ts`],
  ["SQL file", "supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql"],
  ["Doc P5.4", "docs/PHASE_5_4_CONTROLLED_MISSION_GOVERNED_SERVER_PERSISTENCE_DRAFT.md"],
  ["Evidence template", "docs/templates/PHASE_5_4_CONTROLLED_MISSION_SERVER_PERSISTENCE_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules (scan read-only) ────────────────────────────────────
// L'API contract documente volontairement le chemin de la route FUTURE — il est
// exclu du scan « référence route API », mais reste scanné pour réseau/DB/Pierre.

step("B", "Invariants modules (scan read-only)");

const pureModuleLabels = ["Types", "Contract", "SQL draft", "Policy / flag", "UI copy", "QA"];
const allCodeLabels = [...pureModuleLabels, "API contract"];

const blobNoApi = modules.filter(([l]) => pureModuleLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const blobAll = modules.filter(([l]) => allCodeLabels.includes(l)).map(([, f]) => read(f)).join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
const netToken = "fe" + "tch(";
if (writeTokens.some((t) => blobAll.includes(t))) { warn("Modules P5.4 — token write DB détecté"); needsReview++; }
else ok("Modules P5.4 — aucun token write DB");
if (blobAll.includes(netToken) || blobAll.includes("fe" + "tch ")) { warn("Modules P5.4 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.4 — aucun appel réseau");
if (/createClient\s*\(/.test(blobAll) || /from\s+["']@su/.test(blobAll + "pabase")) { warn("Modules P5.4 — client base de données détecté"); needsReview++; }
else ok("Modules P5.4 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blobAll)) { warn("Modules P5.4 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.4 — aucun import Pierre moteur");
if (/\/api\//.test(blobNoApi)) { warn("Modules P5.4 (hors API contract) — référence route API détectée"); needsReview++; }
else ok("Modules P5.4 (hors API contract) — aucune référence route API");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blobAll.toLowerCase().includes(t))) { warn("Modules P5.4 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.4 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. Routes interdites (absentes) ───────────────────────────────────────────

step("C", "Routes serveur interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/runtime/execute/route.ts",
  "src/app/api/pierre/runtime/execute/route.ts",
  "src/app/api/cloneos/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── D. SQL draft : marqueurs & contraintes ────────────────────────────────────

step("D", "SQL draft (marqueurs & contraintes no-execution)");

const sqlFile = read("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const sqlMarkers = ["DESIGN DRAFT ONLY", "DO NOT APPLY", "STILL NO EXECUTION", "SERVER PERSISTENCE FLAG MUST REMAIN OFF"];
for (const m of sqlMarkers) {
  if (sqlFile.includes(m)) ok(`SQL contient « ${m} »`);
  else { warn(`SQL manque « ${m} »`); needsReview++; }
}
if (/enable row level security/i.test(sqlFile)) ok("SQL active RLS");
else { warn("SQL n'active pas RLS"); needsReview++; }
if (/execution_enabled\s*=\s*false/.test(sqlFile)) ok("SQL contient CHECK execution_enabled = false");
else { warn("SQL manque CHECK execution_enabled = false"); needsReview++; }

// ── E. Package scripts ────────────────────────────────────────────────────────

step("E", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase5-4")) ok("test:phase5-4");
else { warn("MANQUANT : test:phase5-4"); needsReview++; }
if (pkg.includes("check:controlled-mission-server-persistence")) ok("check:controlled-mission-server-persistence");
else { warn("MANQUANT : check:controlled-mission-server-persistence"); needsReview++; }

// ── F. Flag default false ─────────────────────────────────────────────────────

step("F", "Feature flag (default false)");

const policy = read(`${RI}/controlled-mission-server-persistence-policy.ts`);
if (/DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED\s*=\s*false/.test(policy)) ok("Flag serveur default false");
else { warn("Flag serveur default false absent"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI persistance serveur (page, design-only)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY")) ok("Microcopy design-only câblée (constante)");
else { warn("Microcopy design-only absente"); needsReview++; }
if (page.includes("buildControlledMissionServerPersistenceReadiness")) ok("Readiness serveur câblée");
else { warn("Readiness serveur non câblée"); needsReview++; }
if (page.includes("CONTROLLED_MISSION_SERVER_PERSISTENCE_PANEL_GUARDRAIL")) ok("Guardrail panneau serveur présent");
else { warn("Guardrail panneau serveur absent"); needsReview++; }
if (/Sauvegarder serveur|Publier serveur|Créer mission serveur|Persister serveur|Exécuter la mission|Lancer la mission/.test(page)) { warn("Action serveur/exécution active détectée"); needsReview++; }
else ok("Aucune action Sauvegarder / Publier / Créer mission serveur / Exécuter");

// ── H. API contract disabled_design_only ──────────────────────────────────────

step("H", "API contract (disabled_design_only)");

const apiContract = read(`${RI}/controlled-mission-server-persistence-api-contract.ts`);
if (apiContract.includes('"disabled_design_only"')) ok("API contract : current_phase_status disabled_design_only");
else { warn("API contract : current_phase_status non disabled_design_only"); needsReview++; }
if (apiContract.includes("route_file_created: false")) ok("API contract : route_file_created false");
else { warn("API contract : route_file_created non false"); needsReview++; }

// ── I. Rappels ────────────────────────────────────────────────────────────────

step("I", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Design serveur uniquement. Aucune persistance. Aucune donnée envoyée.");
info("« ready » = candidate pour future persistance serveur, JAMAIS active.");
info("Aucune route controlled-missions/execute. Aucune mission serveur réelle.");
info("Aucun appel Pierre / IA. Aucun email/document/PDF. CloneVoice non actif.");
info("Flag serveur default false. scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — design de persistance serveur cohérent (lecture seule).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Design serveur · « ready » = candidate future · aucune persistance · aucune exécution.");
log("═".repeat(60) + "\n");
