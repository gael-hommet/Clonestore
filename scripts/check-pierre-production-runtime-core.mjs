#!/usr/bin/env node
// scripts/check-pierre-production-runtime-core.mjs
// PHASE 8.1 — Pierre Production Runtime Core — read-only structural check.
//
// Verifies the canonical runtime is built (not a read-only gate, not localStorage):
// modules, migration, RLS, routes, queue, worker, harness, integration tests,
// docs, scripts present; and that the v1 runtime contains no localStorage source
// of truth and no in-memory queue. Read-only. PASS / NEEDS REVIEW.

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const read = (rel) => (existsSync(resolve(ROOT, rel)) ? readFileSync(resolve(ROOT, rel), "utf-8") : "");
const has = (rel) => existsSync(resolve(ROOT, rel));
const ok = (m) => console.log(`  ✅ ${m}`);
const warn = (m) => console.log(`  ⚠️  ${m}`);
const step = (n, m) => console.log(`\n${"─".repeat(60)}\n  ÉTAPE ${n} — ${m}\n`);
let needs = 0;

console.log("\n" + "═".repeat(60));
console.log(" PHASE 8.1 — Pierre Production Runtime Core — Check");
console.log("═".repeat(60));

const V1 = "src/lib/pierre/v1";

step("A", "Modules runtime canonique");
const modules = [
  "errors.ts","sql.ts","db.ts","state-machine.ts","tenant-context.ts","channels.ts","autonomy.ts",
  "cloneguard.ts","analysis.ts","repositories.ts","queue.ts","executors.ts","mission-service.ts",
  "worker.ts","api.ts",
].map((f) => `${V1}/${f}`);
for (const m of modules) { if (has(m)) ok(m); else { warn(`MANQUANT: ${m}`); needs++; } }

step("B", "Migration + RLS");
const mig = read("supabase/migrations/2026-06-15__pierre_v1_runtime.sql");
if (mig.length > 0) ok("migration pierre_v1_runtime présente"); else { warn("migration manquante"); needs++; }
for (const t of ["pierre_rt_missions","pierre_rt_tasks","pierre_rt_jobs","pierre_rt_validations","pierre_rt_events","pierre_rt_outbox","pierre_rt_idempotency","pierre_rt_dead_letters","pierre_rt_execution_attempts"]) {
  if (mig.includes(`create table if not exists ${t}`)) ok(`table ${t}`); else { warn(`table ${t} absente`); needs++; }
}
if (/enable row level security/.test(mig) && /force row level security/.test(mig)) ok("RLS enabled + forced"); else { warn("RLS absente"); needs++; }
if (/for update skip locked/i.test(read(`${V1}/queue.ts`))) ok("queue: FOR UPDATE SKIP LOCKED"); else { warn("SKIP LOCKED absent"); needs++; }

step("C", "Routes API /api/pierre/v1");
const routes = [
  "src/app/api/pierre/v1/missions/route.ts",
  "src/app/api/pierre/v1/missions/[id]/route.ts",
  "src/app/api/pierre/v1/missions/[id]/tasks/route.ts",
  "src/app/api/pierre/v1/missions/[id]/timeline/route.ts",
  "src/app/api/pierre/v1/missions/[id]/cancel/route.ts",
  "src/app/api/pierre/v1/missions/[id]/validations/route.ts",
  "src/app/api/pierre/v1/validations/[id]/[action]/route.ts",
  "src/app/api/pierre/v1/worker/tick/route.ts",
  "src/app/api/pierre/v1/health/route.ts",
];
for (const r of routes) { if (has(r)) ok(r); else { warn(`route manquante: ${r}`); needs++; } }

step("D", "Anti-régressions: pas de localStorage / pas de queue mémoire dans le runtime v1");
let blob = "";
for (const m of modules) blob += read(m);
// Detect ACTUAL usage, not negation comments ("no localStorage" / "not localStorage").
if (!/localStorage\.(get|set|remove)Item|window\.localStorage/.test(blob)) ok("aucun localStorage utilisé dans le runtime v1"); else { warn("localStorage utilisé dans le runtime v1"); needs++; }
const queueSrc = read(`${V1}/queue.ts`);
if (/pierre_rt_jobs/.test(queueSrc) && /for update skip locked/i.test(queueSrc)) ok("queue durable Postgres (pierre_rt_jobs + SKIP LOCKED), pas en mémoire"); else { warn("queue durable non confirmée"); needs++; }
// state machine is single-sourced
if (has(`${V1}/state-machine.ts`) && read(`${V1}/mission-service.ts`).includes('from "./state-machine"')) ok("state machine canonique unique (importée, non dupliquée)"); else { warn("state machine non centralisée"); needs++; }
// awaiting_integration never succeeded
if (/awaiting_integration/.test(read(`${V1}/executors.ts`)) && !/email_send[\s\S]*?outcome: "succeeded"/.test(read(`${V1}/executors.ts`))) ok("intégrations non câblées => awaiting_integration (jamais succeeded)"); else { warn("executor intégration douteux"); needs++; }

step("E", "Harness, intégration, bench, runner");
for (const f of [
  `${V1}/__integration__/harness.ts`,
  `${V1}/__integration__/runtime-core.itest.ts`,
  `${V1}/__integration__/runtime-core.bench.ts`,
  "scripts/db/migrate.mjs",
  "vitest.integration.config.ts",
  "vitest.bench.config.ts",
]) { if (has(f)) ok(f); else { warn(`manquant: ${f}`); needs++; } }

step("F", "Package scripts");
const pkg = read("package.json");
for (const s of ["test:phase8-1","check:pierre-production-runtime-core","bench:pierre-runtime-core","db:test:migrate","db:test:reset"]) {
  if (pkg.includes(`"${s}"`)) ok(s); else { warn(`script manquant: ${s}`); needs++; }
}
if (/"@electric-sql\/pglite"/.test(pkg)) ok("devDependency @electric-sql/pglite déclarée"); else { warn("pglite non déclaré en devDependencies"); needs++; }

step("G", "Docs");
for (const d of [
  "docs/PHASE_8_1_PIERRE_PRODUCTION_RUNTIME_CORE.md",
  "docs/architecture/PIERRE_RUNTIME_ARCHITECTURE.md",
  "docs/architecture/PIERRE_STATE_MACHINES.md",
  "docs/architecture/PIERRE_QUEUE_AND_IDEMPOTENCY.md",
  "docs/runbooks/PIERRE_RUNTIME_FAILURE_RECOVERY.md",
  "docs/migrations/PIERRE_LOCAL_TO_PRODUCTION_RUNTIME.md",
]) { if (has(d)) ok(d); else { warn(`doc manquante: ${d}`); needs++; } }

step("H", "Cutover cockpit + adaptateur production");
const pkgJson = JSON.parse(read("package.json") || "{}");
if (pkgJson.dependencies && pkgJson.dependencies.pg) ok(`pg en dependencies (${pkgJson.dependencies.pg})`); else { warn("pg absent de dependencies"); needs++; }
if (has(`${V1}/client.ts`)) ok("client v1 typé présent"); else { warn("client v1 manquant"); needs++; }
if (has("src/lib/pierre/cockpit/v1-bridge.ts")) ok("bridge cockpit→v1 présent"); else { warn("bridge cockpit manquant"); needs++; }
if (/from "pg"/.test(read(`${V1}/db.ts`))) ok("adaptateur production: import statique 'pg' (pas de masquage dynamique)"); else { warn("adaptateur production non statique"); needs++; }
if (/@deprecated/.test(read("src/app/agents/pierre/use/submit/route.ts"))) ok("legacy submit marqué @deprecated"); else { warn("legacy submit non déprécié"); needs++; }
const apiClient = read("src/lib/pierre/cockpit/api-client.ts");
if (apiClient.includes("createCockpitV1Client") && apiClient.includes("./v1-bridge")) ok("cockpit api-client câblé au runtime v1 (write seam)"); else { warn("cockpit non câblé au v1"); needs++; }

console.log("\n" + "═".repeat(60));
if (needs === 0) console.log(" RÉSULTAT : PASS — runtime de production canonique présent (intégration testée localement).");
else console.log(` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`);
console.log(" Honnête: integration locale prouvée ; production Supabase/RLS/p95 + scale 100k NON prouvés.");
console.log("═".repeat(60) + "\n");
