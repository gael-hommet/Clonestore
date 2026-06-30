#!/usr/bin/env node
// scripts/p87-runtime-billing-proof.mjs
// PHASE 8.7.2 — synthetic runtime + billing PROOF generator, driven THROUGH the dedicated least-privilege role
// DSNs (current_user = exact role, TLS on, NEVER admin for a governed call, NEVER SET ROLE). It creates >=2
// synthetic tenants named `p87-step2-proof-<uuid>` and, for each, produces exactly the artifacts the read-only
// live check (`npm run check:p87-runtime-billing-live`) verifies:
//   • a COMPLETED mission run            — planner DSN compiles the run, worker DSN claims→starts→completes it
//   • an ACTIVE product entitlement      — activation-worker DSN calls pierre_rt_apply_entitlement_event
//   • a resolved COMMERCIAL event        — billing-webhook DSN ingests then applies (company resolved + stamped)
//
// It writes ONLY synthetic rows (prefix `p87-step2-proof-`). No email, no signature, no payment, no provider.
// The admin DSN is used SOLELY to seed the synthetic raw rows that have no governed entry point (companies /
// members / missions); every GOVERNED operation goes through its dedicated role DSN, which is asserted to bind
// `current_user` = the exact role before any call. Fail-closed + double-guarded like the activator. Never prints
// a secret. All governed function signatures below were discovered from the migration source (v22/v24/v27/v28).

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { randomUUID, createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const { redactError } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);
const envEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);

const APPLY = process.argv.includes("--apply");
const ADMIN = process.env.P87_ADMIN_DATABASE_URL || null;
const TARGET = process.env.P87_CONFIRM_TARGET || null;
const ACK = process.env.P87_I_UNDERSTAND_REMOTE_WRITE || null;
const ENVIRONMENT = process.env.P87_ENVIRONMENT || null;
const TENANTS = Math.max(2, Number(process.env.P87_PROOF_TENANTS || 2));

function refuse(reason) { process.stderr.write(`\n[p87-proof] REFUSED — ${reason}\n`); process.exit(2); }
if (!ADMIN) refuse("P87_ADMIN_DATABASE_URL is required (admin DSN — used ONLY to seed synthetic raw rows).");
if (!TARGET) refuse("P87_CONFIRM_TARGET is required (type the exact project ref/target you intend to write to).");
if (ACK !== "yes") refuse("P87_I_UNDERSTAND_REMOTE_WRITE=yes is required (acknowledge this WRITES synthetic rows).");
if (!["staging", "production"].includes(ENVIRONMENT)) refuse("P87_ENVIRONMENT must be 'staging' or 'production'.");
let adminHost;
try { adminHost = new URL(ADMIN.replace(/^postgres(ql)?:/, "http:")).hostname.toLowerCase(); } catch { refuse("P87_ADMIN_DATABASE_URL is not a valid postgres DSN."); }
if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(adminHost)) refuse("the target is localhost — P8.7.2 requires a REAL remote target.");

// load the dedicated role DSNs (highest-priority file is .env.p87-runtime.local, written by the activator).
const { env } = envEngine.loadEnvironment(ENVIRONMENT, {
  cwd: ROOT, processEnv: process.env,
  readFile: (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null), fileExists: (p) => existsSync(p), join,
});

const ROLE_VARS = {
  planner: "PIERRE_RUNTIME_PLANNER_DATABASE_URL",
  worker: "PIERRE_RUNTIME_WORKER_DATABASE_URL",
  billing: "PIERRE_BILLING_WEBHOOK_DATABASE_URL",
  activation: "PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL",
};
const ROLE_NAME = {
  planner: "pierre_rt_runtime_planner",
  worker: "pierre_rt_runtime_worker",
  billing: "pierre_rt_billing_webhook",
  activation: "pierre_rt_customer_activation_worker",
};

const ts = process.env.P87_TS || `t${createHash("sha1").update(TARGET + "proof").digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p87-proofs", "step2", ts);
mkdirSync(proofDir, { recursive: true });
const log = (m) => process.stderr.write(`[p87-proof] ${m}\n`);
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function pg(dsn, appName) {
  const m = await import("pg");
  // Supabase direct is IPv6-only + intermittent on this host → retry transient connect failures with backoff.
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const pool = new m.default.Pool({ connectionString: dsn, max: 1, application_name: appName, connectionTimeoutMillis: 20000, ssl: { rejectUnauthorized: false } });
    try { const client = await pool.connect(); return { q: (s, p) => client.query(s, p), end: async () => { client.release(); await pool.end(); } }; }
    catch (e) {
      lastErr = e; await pool.end().catch(() => {});
      const transient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|timeout|terminated/i.test(e?.message || "") || /ETIMEDOUT|ECONNRESET/.test(e?.code || "");
      if (!transient || attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

// open a dedicated role connection and ASSERT current_user = the exact role (fail-closed: never admin, no SET ROLE) + TLS.
async function roleConn(kind) {
  const varName = ROLE_VARS[kind];
  const dsn = env[varName];
  if (!dsn) throw new Error(`${varName} is missing — run scripts/p87-activate-remote.mjs --apply first (it writes .env.p87-runtime.local)`);
  const c = await pg(dsn, `p87_proof_${kind}`);
  try {
    const cu = (await c.q("select current_user u")).rows[0].u;
    if (cu === "postgres" || cu === "supabase_admin") { await c.end(); throw new Error(`${varName} binds the ADMIN role '${cu}', not '${ROLE_NAME[kind]}'`); }
    if (cu !== ROLE_NAME[kind]) { await c.end(); throw new Error(`${varName} binds '${cu}', expected '${ROLE_NAME[kind]}' (no SET ROLE)`); }
    const ssl = (await c.q("select coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false) s")).rows[0].s;
    if (!ssl) { await c.end(); throw new Error(`${ROLE_NAME[kind]} connected WITHOUT TLS`); }
    return c;
  } catch (e) { try { await c.end(); } catch { /* */ } throw e; }
}

// a trivial compiled plan with a single no-op step — the run finalizes itself once the step succeeds (proven by
// the P8.6 governed smoke). This is NOT a fabricated terminal state: the worker drives the real governed runtime.
const PLAN_STEPS = JSON.stringify([{ step_key: "s1", action_key: "mission.noop", step_ordinal: 0, input: {}, input_hash: "x", dependency_count: 0 }]);

async function proveTenant(admin, idx) {
  const company = randomUUID(), owner = randomUUID(), mission = randomUUID();
  const name = `p87-step2-proof-${company}`;
  const subRef = `sub_p87_${company}`;

  // 1) synthetic SETUP via admin (no governed entry point exists for arbitrary synthetic seeding) — synthetic only.
  await admin.q("insert into pierre_rt_companies (id,name,status) values ($1,$2,'active')", [company, name]);
  await admin.q("insert into pierre_rt_members (id,company_id,user_id,role,status) values ($1,$2,$3,'owner','active')", [randomUUID(), company, owner]);
  await admin.q(
    "insert into pierre_rt_missions (id,company_id,requester_user_id,instruction,status,correlation_id,request_id,idempotency_key) values ($1,$2,$3,'p87 synthetic proof','planned',$4,$5,$6)",
    [mission, company, owner, randomUUID(), randomUUID(), "m:" + mission]);

  // 2) BILLING + ENTITLEMENT proof through dedicated DSNs.
  //    activation worker creates the ACTIVE entitlement (source_reference = subRef) …
  const act = await roleConn("activation");
  let entStatus;
  try { entStatus = (await act.q("select pierre_rt_apply_entitlement_event($1,'pierre','commercial.payment_confirmed','stripe_subscription',$2,null) r", [company, subRef])).rows[0].r; }
  finally { await act.end(); }
  //    billing webhook INGESTS a commercial event then APPLIES it (resolves the company via the persisted
  //    entitlement reference and stamps company_id on the event).
  const bill = await roleConn("billing");
  let ingest, applied;
  try {
    const evtId = `evt_p87_${company}`;
    ingest = (await bill.q("select pierre_rt_ingest_commercial_event('stripe',$1,'commercial.subscription_active',$2,$3,$4,null,'pierre',now()) r", [evtId, sha("payload-" + company), "cus_" + company, subRef])).rows[0].r;
    // the least-privilege billing role has NO direct SELECT on the business tables (RLS hides the row), so the
    // orchestrator obtains the persisted event id via the admin setup connection; the GOVERNED apply still runs
    // through the billing DSN (apply_commercial_event is SECURITY DEFINER and reads the event internally).
    const evRow = (await admin.q("select id from pierre_rt_commercial_events where provider='stripe' and provider_event_id=$1", [evtId])).rows[0];
    if (!evRow) throw new Error("ingested commercial event not found via admin lookup");
    applied = (await bill.q("select pierre_rt_apply_commercial_event($1) r", [evRow.id])).rows[0].r;
  } finally { await bill.end(); }

  // 3) RUNTIME proof through dedicated DSNs. planner compiles the run; worker claims → starts → completes it.
  const plan = await roleConn("planner");
  let runId;
  try {
    await plan.q("select set_config('app.current_company',$1,false)", [company]);
    runId = (await plan.q(
      "select created_mission_run_id run from pierre_rt_create_compiled_mission_run($1,$2,'1',$3,'{}','{}',$4::jsonb,'[]'::jsonb,$5,null,'normal')",
      [company, mission, "fp-p87-" + mission, PLAN_STEPS, owner])).rows[0].run;
  } finally { await plan.end(); }
  if (!runId) throw new Error("planner did not return a created mission run id");

  const wrk = await roleConn("worker");
  try {
    await wrk.q("select set_config('app.current_company',$1,false)", [company]);
    const job = (await wrk.q("select * from pierre_rt_runtime_claim($1,5,'p87-proof-w',60,now())", [company])).rows[0];
    if (!job) throw new Error("worker claimed no runtime job for the synthetic run");
    await wrk.q("select pierre_rt_runtime_start_step($1,$2,'p87-proof-w',$3)", [company, job.id, job.fencing_token]);
    await wrk.q("select pierre_rt_runtime_complete_job($1,$2,'p87-proof-w',$3,'succeeded',null,'{}')", [company, job.id, job.fencing_token]);
  } finally { await wrk.end(); }

  // read back the resulting run status (synthetic verification only; the authoritative verdict is the
  // separate read-only `check:p87-runtime-billing-live`).
  const runStatus = (await admin.q("select status from pierre_rt_mission_runs where id=$1", [runId])).rows[0]?.status;
  return { tenant: idx + 1, company_redacted: name.slice(0, 24) + "…", entitlement: entStatus, ingest, applied, run_status: runStatus };
}

async function main() {
  log(`mode: ${APPLY ? "APPLY (writes synthetic proof)" : "DRY RUN (no writes)"} · environment: ${ENVIRONMENT} · target(confirmed): ${TARGET} · tenants: ${TENANTS}`);
  if (!APPLY) {
    log(`DRY RUN — would create ${TENANTS} synthetic tenants p87-step2-proof-* (each: active entitlement + resolved commercial event + completed run) via the dedicated role DSNs. No writes. Re-run with --apply.`);
    process.exit(0);
  }
  const admin = await pg(ADMIN, "p87_proof_setup");
  const acu = (await admin.q("select current_user u")).rows[0].u;
  log(`synthetic-setup connection as '${acu === "postgres" ? "admin" : acu}' (used ONLY for synthetic raw seeding; governed calls go through the role DSNs).`);
  const results = [];
  try {
    for (let i = 0; i < TENANTS; i++) {
      try { const r = await proveTenant(admin, i); results.push(r); log(`tenant ${i + 1}/${TENANTS}: entitlement=${r.entitlement} ingest=${r.ingest} applied=${r.applied} run=${r.run_status}`); }
      catch (e) { throw new Error(`tenant ${i + 1} proof failed: ${redactError(e)}`); }
    }
  } finally { await admin.end(); }
  const ok = results.length >= 2 && results.every((r) => r.run_status === "completed" && r.entitlement === "active" && r.ingest === "received");
  writeFileSync(join(proofDir, "runtime-billing-proof.json"), JSON.stringify({ phase: "P8.7.2", kind: "synthetic_proof", environment: ENVIRONMENT, tenants: results.length, results, ok }, null, 2));
  log(`proof artifacts written for ${results.length} synthetic tenants → ${proofDir} (ok=${ok}).`);
  log("Next: npm run check:p87-runtime-billing-live   (read-only, strict — the authoritative verdict).");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { process.stderr.write(`[p87-proof] ERROR: ${redactError(e)}\n`); process.exit(1); });
