#!/usr/bin/env node
// scripts/check-controlled-mission-server-persistence-final-gate-phase5-7.mjs
// PHASE 5.7 — Controlled Mission Server Persistence Readiness Final Gate — Read-Only Check
//
// Lecture seule. Aucune écriture. Aucune activation. Aucun GET/POST serveur. Aucune
// route. Aucun SQL appliqué. Aucune exécution. Final Gate design-only.
//
// Usage :
//   node scripts/check-controlled-mission-server-persistence-final-gate-phase5-7.mjs
//   npm run check:controlled-mission-server-persistence-final-gate

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
log(" PHASE 5.7 — Controlled Mission Server Persistence Final Gate — Check");
log("═".repeat(60));
log(" Lecture seule. Final Gate design-only. Aucune activation. Aucune exécution.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P5.7 + docs ─────────────────────────────────────────────────────

step("A", "Modules P5.7 + docs");

const modules = [
  ["Types", `${RI}/controlled-mission-server-persistence-final-gate-types.ts`],
  ["Final gate", `${RI}/controlled-mission-server-persistence-final-gate.ts`],
  ["UI copy", `${RI}/controlled-mission-server-persistence-final-gate-ui-copy.ts`],
  ["QA", `${RI}/controlled-mission-server-persistence-final-gate-qa.ts`],
  ["Doc P5.7", "docs/PHASE_5_7_CONTROLLED_MISSION_SERVER_PERSISTENCE_READINESS_FINAL_GATE.md"],
  ["Evidence template P5.7", "docs/templates/PHASE_5_7_CONTROLLED_MISSION_SERVER_PERSISTENCE_FINAL_GATE_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P5.7 (scan read-only) ───────────────────────────────
// La QA énumère les noms de checks (« no_fetch_in_modules »…) → exclue du scan mot-à-mot.

step("B", "Invariants modules P5.7 (scan read-only)");

const codeLabels = ["Types", "Final gate", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P5.7 — token write DB détecté"); needsReview++; }
else ok("Modules P5.7 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P5.7 — appel réseau détecté"); needsReview++; }
else ok("Modules P5.7 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P5.7 — client base de données détecté"); needsReview++; }
else ok("Modules P5.7 — aucun client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P5.7 — import Pierre détecté"); needsReview++; }
else ok("Modules P5.7 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P5.7 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P5.7 — aucune référence route API littérale");
const providerTokens = ["open" + "ai", "anthro" + "pic", "str" + "ipe"];
if (providerTokens.some((t) => blob.toLowerCase().includes(t))) { warn("Modules P5.7 — fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P5.7 — aucun appel OpenAI/Anthropic/Stripe");

// ── C. Routes interdites (absentes) ───────────────────────────────────────────

step("C", "Routes serveur interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/restore/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/pierre/runtime/execute/route.ts",
  "src/app/api/cloneos/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── D. SQL P5.4 DO NOT APPLY + flag default false ─────────────────────────────

step("D", "SQL P5.4 (non appliqué) + flag default false");

const sqlFile = read("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
if (sqlFile.includes("DO NOT APPLY")) ok("SQL P5.4 contient « DO NOT APPLY »");
else { warn("SQL P5.4 manque « DO NOT APPLY »"); needsReview++; }
const policy = read(`${RI}/controlled-mission-server-persistence-policy.ts`);
if (/DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED\s*=\s*false/.test(policy)) ok("Flag serveur default false");
else { warn("Flag serveur default false absent"); needsReview++; }

// ── E. Check scripts P5.1 → P5.6 existants ────────────────────────────────────

step("E", "Check scripts P5.1 → P5.6 existants");

const priorChecks = [
  "scripts/check-controlled-mission-safe-apply-phase5-1.mjs",
  "scripts/check-controlled-mission-local-review-phase5-2.mjs",
  "scripts/check-controlled-mission-preflight-phase5-3.mjs",
  "scripts/check-controlled-mission-server-persistence-phase5-4.mjs",
  "scripts/check-controlled-mission-server-persistence-manual-activation-phase5-5.mjs",
  "scripts/check-controlled-mission-server-restore-ui-phase5-6.mjs",
];
for (const c of priorChecks) {
  if (has(c)) ok(`présent : ${c}`);
  else { warn(`MANQUANT : ${c}`); needsReview++; }
}

// ── F. Package scripts ────────────────────────────────────────────────────────

step("F", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase5-7")) ok("test:phase5-7");
else { warn("MANQUANT : test:phase5-7"); needsReview++; }
if (pkg.includes("check:controlled-mission-server-persistence-final-gate")) ok("check:controlled-mission-server-persistence-final-gate");
else { warn("MANQUANT : check:controlled-mission-server-persistence-final-gate"); needsReview++; }

// ── G. UI (page) ──────────────────────────────────────────────────────────────

step("G", "UI Final Gate (page, design-only)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("CONTROLLED_MISSION_FINAL_GATE_MICROCOPY")) ok("Microcopy « Final Gate design-only » câblée (constante)");
else { warn("Microcopy Final Gate absente"); needsReview++; }
if (page.includes("buildControlledMissionServerPersistenceFinalGateReport")) ok("Final Gate câblé");
else { warn("Final Gate non câblé"); needsReview++; }
if (/Appliquer SQL|Activer la persistance|Activer le serveur|Persister serveur|Restaurer depuis serveur|Exécuter la mission|Lancer la mission/.test(page)) { warn("Action activation/exécution active détectée"); needsReview++; }
else ok("Aucune action Appliquer SQL / Activer / Persister / Restaurer / Exécuter");

// ── H. Rappels ────────────────────────────────────────────────────────────────

step("H", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Final Gate design-only. Aucune activation. Aucune production. Aucune exécution.");
info("Persistance serveur inactive. Restauration serveur inactive. localStorage source active.");
info("SQL non appliqué. Flag serveur default false. Aucune route. Aucun GET/POST serveur.");
info("Aucune mission serveur réelle. Aucun appel Pierre / IA. Aucun email/document/PDF.");
info("Jamais « production ready ». Jamais « execution ready ».");
info("scale 80k non prouvé. lancement public externe non validé.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Final Gate P5 cohérent (lecture seule, design-only).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Final Gate design-only · aucune activation · persistance serveur inactive · aucune exécution.");
log("═".repeat(60) + "\n");
