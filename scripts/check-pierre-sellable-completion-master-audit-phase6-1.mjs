#!/usr/bin/env node
// scripts/check-pierre-sellable-completion-master-audit-phase6-1.mjs
// PHASE 6.1 — Pierre Sellable Completion Master Audit — Read-Only Check
//
// Lecture seule. Aucune écriture. Audit-only. Ne déclare pas Pierre vendable.
// N'active rien. Aucune route. Aucun SQL appliqué. Aucune exécution.
//
// Usage :
//   node scripts/check-pierre-sellable-completion-master-audit-phase6-1.mjs
//   npm run check:pierre-sellable-completion-master-audit

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
log(" PHASE 6.1 — Pierre Sellable Completion Master Audit — Check");
log("═".repeat(60));
log(" Lecture seule. Audit-only. Pierre NON déclaré vendable. Aucune activation.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P6.1 + docs ─────────────────────────────────────────────────────

step("A", "Modules P6.1 + docs");

const modules = [
  ["Types", `${RI}/pierre-sellable-completion-master-audit-types.ts`],
  ["Audit", `${RI}/pierre-sellable-completion-master-audit.ts`],
  ["UI copy", `${RI}/pierre-sellable-completion-master-audit-ui-copy.ts`],
  ["QA", `${RI}/pierre-sellable-completion-master-audit-qa.ts`],
  ["Doc P6.1", "docs/PHASE_6_1_PIERRE_SELLABLE_COMPLETION_MASTER_AUDIT.md"],
  ["Evidence template P6.1", "docs/templates/PHASE_6_1_PIERRE_SELLABLE_COMPLETION_MASTER_AUDIT_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P6.1 (scan read-only) ───────────────────────────────
// L'audit MENTIONNE Stripe/Supabase comme SUJETS d'audit (pas des appels) → on scanne
// les formes d'import de fournisseurs, pas les sous-chaînes. La QA énumère les noms de
// checks (« no_fetch_in_modules »…) → exclue du scan mot-à-mot.

step("B", "Invariants modules P6.1 (scan read-only)");

const codeLabels = ["Types", "Audit", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P6.1 — token write DB détecté"); needsReview++; }
else ok("Modules P6.1 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P6.1 — appel réseau détecté"); needsReview++; }
else ok("Modules P6.1 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P6.1 — client base de données importé"); needsReview++; }
else ok("Modules P6.1 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P6.1 — import Pierre détecté"); needsReview++; }
else ok("Modules P6.1 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P6.1 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P6.1 — aucune référence route API littérale");
// Fournisseurs : on cherche un IMPORT réel, pas une mention d'audit.
if (/from\s+["'](stripe|openai|@anthropic|@stripe)/i.test(blob)) { warn("Modules P6.1 — import fournisseur IA/paiement détecté"); needsReview++; }
else ok("Modules P6.1 — aucun import OpenAI/Anthropic/Stripe (mentions d'audit autorisées)");

// ── C. Routes interdites (absentes) ───────────────────────────────────────────

step("C", "Routes serveur interdites (doivent être absentes)");

const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/restore/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/execute/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
];
for (const r of forbiddenRoutes) {
  if (!has(r)) ok(`absente : ${r}`);
  else { warn(`Route interdite présente : ${r}`); needsReview++; }
}

// ── D. SQL P5.4 DO NOT APPLY + flag default false ─────────────────────────────

step("D", "SQL P5.4 (non appliqué) + flag serveur default false");

const sqlFile = read("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
if (sqlFile.includes("DO NOT APPLY")) ok("SQL P5.4 contient « DO NOT APPLY »");
else { warn("SQL P5.4 manque « DO NOT APPLY »"); needsReview++; }
const policy = read(`${RI}/controlled-mission-server-persistence-policy.ts`);
if (/DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED\s*=\s*false/.test(policy)) ok("Flag serveur default false");
else { warn("Flag serveur default false absent"); needsReview++; }

// ── E. Package scripts ────────────────────────────────────────────────────────

step("E", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase6-1")) ok("test:phase6-1");
else { warn("MANQUANT : test:phase6-1"); needsReview++; }
if (pkg.includes("check:pierre-sellable-completion-master-audit")) ok("check:pierre-sellable-completion-master-audit");
else { warn("MANQUANT : check:pierre-sellable-completion-master-audit"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI Pierre Sellable Audit (page, audit-only)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("PIERRE_SELLABLE_AUDIT_MICROCOPY")) ok("Microcopy « Audit Pierre vendable » câblée (constante)");
else { warn("Microcopy audit absente"); needsReview++; }
if (page.includes("PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE")) ok("« Pierre n'est pas encore public-launch complete » câblé (constante)");
else { warn("« Pierre n'est pas encore public-launch complete » absent"); needsReview++; }
if (page.includes("buildPierreSellableCompletionMasterAuditReport")) ok("Audit câblé");
else { warn("Audit non câblé"); needsReview++; }
if (/Déclarer vendable|Activer serveur|Exécuter runtime|Activer la persistance|Lancer en public|Envoyer email réel/.test(page)) { warn("Action interdite (déclarer/activer/exécuter) détectée"); needsReview++; }
else ok("Aucune action Déclarer vendable / Activer serveur / Exécuter runtime");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Audit-only. Pierre NON déclaré vendable. public launch NON validé. scale 80k NON prouvé.");
info("Aucune activation. Aucune route. Aucun SQL appliqué. Flag serveur default false.");
info("Aucune mission serveur réelle. Aucune exécution. Aucun appel Pierre / IA / email / document.");
info("Stripe/Supabase ne sont que des SUJETS d'audit, jamais des appels.");
info("Prochaine étape : P6.2 — Pierre Real Workflow Completion Pack.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Master Audit Pierre cohérent (lecture seule, audit-only).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Audit-only · Pierre NON déclaré vendable · aucune activation · aucune exécution.");
log("═".repeat(60) + "\n");
