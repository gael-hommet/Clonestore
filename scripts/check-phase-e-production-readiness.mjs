#!/usr/bin/env node
// BLOC FINAL §10 — porte de readiness PRODUCTION unique. Agrège : code local (schéma +
// rôle webhook, exécutés réellement sur PGlite), variables d'environnement, et la
// vérification de la base production si une URL est fournie. Produit un verdict typé
// PhaseEProductionReadiness ({ status: "ready" | "blocked", blockers, warnings }).
import { spawnSync } from "child_process";
import { checkStripeEnv, checkEmailEnv, checkAnalyticsEnv, ownerGateEnv } from "./founder-env-checks.mjs";

const node = process.execPath;
function runScript(file) {
  const r = spawnSync(node, [file], { encoding: "utf-8" });
  return r.status === 0;
}

const components = [];
const addEnv = (key, res) => components.push({ key, ok: res.ok, blockers: res.blockers, warnings: res.warnings });

// 1) Code local — comportement réel sur PGlite (schéma + rôle journal Stripe).
components.push({ key: "local-schema", ok: runScript("scripts/check-phase-e-migrations.mjs"),
  blockers: [], warnings: [] });
if (!components.at(-1).ok) components.at(-1).blockers.push("schéma Founder Access non applicable (défaut CODE)");
components.push({ key: "webhook-role", ok: runScript("scripts/check-phase-e-stripe-webhook-role.mjs"),
  blockers: [], warnings: [] });
if (!components.at(-1).ok) components.at(-1).blockers.push("rôle journal Stripe incorrect (défaut CODE)");

// 2) Variables d'environnement (preuves externes).
addEnv("stripe-env", checkStripeEnv());
addEnv("email-env", checkEmailEnv());
addEnv("analytics-env", checkAnalyticsEnv());
addEnv("owner-gate-env", ownerGateEnv());

// 3) Base production : vérifiée uniquement si une URL est fournie (sinon blocker externe).
const dbUrl = process.env.DATABASE_URL ?? process.env.CLONESTORE_FOUNDER_DATABASE_URL;
let prodDb;
if (!dbUrl) {
  prodDb = { key: "production-db", ok: false, blockers: ["DATABASE_URL non fournie : base production NON vérifiée"], warnings: [] };
} else {
  const ok = spawnSync(node, ["scripts/verify-founder-access-production-db.mjs"], { encoding: "utf-8", env: process.env }).status === 0;
  prodDb = { key: "production-db", ok, blockers: ok ? [] : ["verify-founder-access-production-db a échoué"], warnings: [] };
}
components.push(prodDb);

// 4) Verdict agrégé typé.
const blockers = components.flatMap((c) => c.blockers.map((b) => `[${c.key}] ${b}`));
const warnings = components.flatMap((c) => c.warnings.map((w) => `[${c.key}] ${w}`));
const verdict = { status: blockers.length === 0 ? "ready" : "blocked", blockers, warnings,
  components: components.map((c) => ({ key: c.key, ok: c.ok })) };

console.log("\n=== Phase E — Production Readiness ===");
for (const c of components) console.log(`  ${c.ok ? "✓" : "✗"} ${c.key}`);
if (warnings.length) { console.log("\nWarnings :"); for (const w of warnings) console.log(`  ! ${w}`); }
if (blockers.length) { console.log("\nBLOCKED_EXTERNAL / blockers :"); for (const b of blockers) console.log(`  ✗ ${b}`); }
console.log("\nVERDICT " + JSON.stringify({ status: verdict.status, blockers: verdict.blockers.length, warnings: verdict.warnings.length }));
console.log(verdict.status === "ready"
  ? "[readiness] READY — tous les contrôles locaux + externes verts."
  : "[readiness] BLOCKED — code local OK ; preuves externes en attente de configuration opérateur.");
// Code local cassé = exit 2 (défaut) ; uniquement des blockers externes = exit 1 (attente config) ; ready = 0.
const codeBroken = components.some((c) => ["local-schema", "webhook-role"].includes(c.key) && !c.ok);
process.exit(verdict.status === "ready" ? 0 : codeBroken ? 2 : 1);
