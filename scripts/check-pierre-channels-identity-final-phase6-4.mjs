#!/usr/bin/env node
// scripts/check-pierre-channels-identity-final-phase6-4.mjs
// PHASE 6.4 — Pierre Channels & Identity Final — Read-Only Check
//
// Lecture seule. Aucune écriture. Readiness identity. Aucun email réel. Aucun domaine
// connecté. Aucun DNS modifié. Aucune route send. Première vente contrôlée ≠ email prod.
//
// Usage :
//   node scripts/check-pierre-channels-identity-final-phase6-4.mjs
//   npm run check:pierre-channels-identity-final

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
log(" PHASE 6.4 — Pierre Channels & Identity Final — Check");
log("═".repeat(60));
log(" Lecture seule. Readiness identity. Aucun email réel. Aucun domaine connecté.");
log("═".repeat(60) + "\n");

const RI = "src/lib/clonestore/runtime-integration";

// ── A. Modules P6.4 + docs ─────────────────────────────────────────────────────

step("A", "Modules P6.4 + docs");

const modules = [
  ["Types", `${RI}/pierre-channels-identity-final-types.ts`],
  ["Module", `${RI}/pierre-channels-identity-final.ts`],
  ["UI copy", `${RI}/pierre-channels-identity-final-ui-copy.ts`],
  ["QA", `${RI}/pierre-channels-identity-final-qa.ts`],
  ["Doc P6.4", "docs/PHASE_6_4_PIERRE_CHANNELS_IDENTITY_FINAL.md"],
  ["Evidence template P6.4", "docs/templates/PHASE_6_4_PIERRE_CHANNELS_IDENTITY_FINAL_EVIDENCE.md"],
];
for (const [label, file] of modules) {
  if (has(file)) ok(`${label} — ${file}`);
  else { warn(`MANQUANT : ${label} — ${file}`); needsReview++; }
}

// ── B. Invariants modules P6.4 (scan read-only) ───────────────────────────────

step("B", "Invariants modules P6.4 (scan read-only)");

const codeLabels = ["Types", "Module", "UI copy"];
const blob = modules.filter(([l]) => codeLabels.includes(l)).map(([, f]) => read(f)).join("\n");
const mainSrc = read(`${RI}/pierre-channels-identity-final.ts`);

const writeTokens = [".ins" + "ert(", ".upd" + "ate(", ".del" + "ete(", ".ups" + "ert("];
if (writeTokens.some((t) => blob.includes(t))) { warn("Modules P6.4 — token write DB détecté"); needsReview++; }
else ok("Modules P6.4 — aucun token write DB");
if (blob.includes("fe" + "tch(")) { warn("Modules P6.4 — appel réseau détecté"); needsReview++; }
else ok("Modules P6.4 — aucun appel réseau");
if (/createClient\s*\(/.test(blob) || /from\s+["']@su/.test(blob + "pabase")) { warn("Modules P6.4 — client base de données importé"); needsReview++; }
else ok("Modules P6.4 — aucun import client base de données");
if (/from\s+["']@\/lib\/pierre/.test(blob)) { warn("Modules P6.4 — import Pierre détecté"); needsReview++; }
else ok("Modules P6.4 — aucun import Pierre moteur");
if (/\/api\//.test(blob)) { warn("Modules P6.4 — référence route API littérale détectée"); needsReview++; }
else ok("Modules P6.4 — aucune référence route API littérale");
if (/from\s+["'](resend|sendgrid|@sendgrid|postmark|nodemailer|@react-email)/i.test(blob)) { warn("Modules P6.4 — import provider email détecté"); needsReview++; }
else ok("Modules P6.4 — aucun import provider email");
if (/from\s+["'](openai|@anthropic|stripe)/i.test(blob)) { warn("Modules P6.4 — import OpenAI/Anthropic/Stripe détecté"); needsReview++; }
else ok("Modules P6.4 — aucun import OpenAI/Anthropic/Stripe");

// ── C. Identité + canaux + invariants ──────────────────────────────────────────

step("C", "Identité, canaux, draft-only, no real send");

if (mainSrc.includes('employee_name: "Pierre"') && mainSrc.includes("Employé IA RH CloneStore")) ok("Display identity (Pierre — Employé IA RH CloneStore)");
else { warn("Display identity incomplète"); needsReview++; }
const channelKeys = ["dashboard", "demo", "email_outbound", "email_inbound", "customer_domain", "voice", "file_upload", "integrations"];
if (channelKeys.every((k) => mainSrc.includes(k))) ok("Channel matrix complète (dashboard/demo/outbound/inbound/domain/voice/file/integrations)");
else { warn("Channel matrix incomplète"); needsReview++; }
if (mainSrc.includes('"draft_only"')) ok("Email outbound draft_only");
else { warn("Email outbound draft_only absent"); needsReview++; }
if (mainSrc.includes('"future_public_launch"')) ok("Customer domain future_public_launch");
else { warn("Customer domain future_public_launch absent"); needsReview++; }
if (mainSrc.includes("SPF/DKIM/DMARC")) ok("Domaine futur mentionne SPF/DKIM/DMARC");
else { warn("SPF/DKIM/DMARC absent"); needsReview++; }
if (mainSrc.includes("requires_human_validation: true") && mainSrc.includes("can_be_sent_now: false")) ok("Templates : validation humaine + can_be_sent_now false");
else { warn("Templates : invariants manquants"); needsReview++; }
if (mainSrc.includes("can_send_real_message: false")) ok("Permissions : real send false");
else { warn("Permissions : real send non confirmé false"); needsReview++; }
if (mainSrc.includes("verified: false")) ok("Domain readiness : verified false");
else { warn("Domain readiness : verified non false"); needsReview++; }
if (mainSrc.includes("real_email_sent: false") && mainSrc.includes("domain_connected: false") && mainSrc.includes("dns_modified: false")) ok("Aucun email réel / domaine connecté / DNS modifié (invariants false)");
else { warn("Invariants email/domain/DNS non confirmés"); needsReview++; }

// ── D. Routes / SQL / flag ─────────────────────────────────────────────────────

step("D", "Routes interdites + SQL P5.4 + flag serveur");

// Note : src/app/api/pierre/email/send/route.ts est une route MOTEUR Pierre PRÉEXISTANTE
// (hors scope P6.4, non touchée). On vérifie uniquement qu'aucune NOUVELLE route d'envoi
// n'est créée par P6.4.
const forbiddenRoutes = [
  "src/app/api/clonestore/runtime/controlled-missions/route.ts",
  "src/app/api/clonestore/runtime/execute/route.ts",
  "src/app/api/clonestore/runtime/controlled-missions/email/route.ts",
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

// ── E. Package scripts ────────────────────────────────────────────────────────

step("E", "Package scripts");

const pkg = read("package.json");
if (pkg.includes("test:phase6-4")) ok("test:phase6-4");
else { warn("MANQUANT : test:phase6-4"); needsReview++; }
if (pkg.includes("check:pierre-channels-identity-final")) ok("check:pierre-channels-identity-final");
else { warn("MANQUANT : check:pierre-channels-identity-final"); needsReview++; }

// ── F. UI (page) ──────────────────────────────────────────────────────────────

step("F", "UI Identité & canaux (page, readiness)");

const page = read("src/app/profile/messages/page.tsx");
if (page.includes("PIERRE_IDENTITY_TITLE")) ok("« Pierre — Identité & canaux » câblé (constante)");
else { warn("Titre identité absent"); needsReview++; }
if (page.includes("PIERRE_IDENTITY_MICROCOPY")) ok("« Aucun email réel » câblé (constante)");
else { warn("Microcopy identité absente"); needsReview++; }
if (page.includes("PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED")) ok("« Le domaine client n'est pas connecté » câblé (constante)");
else { warn("Domaine non connecté absent"); needsReview++; }
if (page.includes("PIERRE_IDENTITY_SALE_VS_EMAIL")) ok("« Première vente contrôlée ≠ email production » câblé (constante)");
else { warn("Sale vs email absent"); needsReview++; }
if (page.includes("buildPierreChannelsIdentityFinalReport")) ok("Identité & canaux câblés");
else { warn("Identité & canaux non câblés"); needsReview++; }
if (/Envoyer email réel|Connecter domaine|Vérifier DNS|Activer SMTP|Créer route send|Déclarer email live|Déclarer public launch/.test(page)) { warn("Action interdite active détectée"); needsReview++; }
else ok("Aucune action Envoyer email réel / Connecter domaine / Vérifier DNS");

// ── G. Rappels ────────────────────────────────────────────────────────────────

step("G", "Rappels importants");

info("Ce script ne fait AUCUNE écriture.");
info("Readiness identity. Aucun email réel. Aucun domaine connecté. Aucun DNS modifié.");
info("Aucune route send. Aucun appel provider/IA. Brouillons uniquement.");
info("Première vente contrôlée ≠ email production. Pierre NON fully sellable.");
info("public launch NON validé. scale 80k NON prouvé.");
info("Prochaine étape : P6.5 — Pierre Customer Activation E2E Final.");

log("\n" + "═".repeat(60));
if (needsReview === 0) log(" RÉSULTAT : PASS — Identité & canaux Pierre cohérents (lecture seule, readiness).");
else log(` RÉSULTAT : NEEDS REVIEW — ${needsReview} point(s) à vérifier.`);
log(" Readiness identity · aucun email réel · aucun domaine connecté · brouillons uniquement.");
log("═".repeat(60) + "\n");
