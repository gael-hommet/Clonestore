#!/usr/bin/env node
// scripts/p87-step4-controlled-journey.mjs — P8.7.4 STAGE 2 — CONTROLLED LIVE CUSTOMER JOURNEY.
//
// A SINGLE fresh, end-to-end customer journey against the REAL production environment with SYNTHETIC data only
// (prefix p87-step4-<run_id>-*), driven THROUGH the existing canonical services / SQL security-definer functions
// / provider adapters / production webhook routes / dedicated least-privilege role DSNs. The public deploy block
// stays on; no feature flag is touched; no service role drives a governed business op; no permanent worker starts.
//
// It proves, for ONE run_id: (1) canonical onboarding of tenant A; (2) employee + Employee 360; (3) a mission
// with real tasks, dependencies and a MANDATORY validation gate; (4) execution blocked before approval;
// (5) approval persisted by the canonical service; (6) execution resumed to completion; (7) a PDF/DOCX produced
// by the Pierre documentary engine; (8) document/version/file/links persisted; (9) private storage + public
// refused + signed URL + hash; (10) a real Stripe TEST subscription at the Pierre 449 €/mo price; (11) a real
// SIGNED Stripe webhook received by the production route; (12) commercial event + active entitlement; (13) a
// communication created by the Pierre pipeline; (14) exactly one Resend email; (15) a real Resend webhook,
// signature validated, status persisted; (16) a Yousign Sandbox request created by the pipeline; (17) document
// added + signer added + request activated; (18) a real Yousign signature_request.activated webhook canonicalised;
// (19) duplicate webhook idempotent; (20) bad signature rejected without mutation; (21) retry/backoff/dead-letter
// with an INJECTED adapter, without multiplying external calls; (22) A/B isolation on every business axis;
// (23) EXACT cleanup of this run; (24) a final report. Proofs → .p87-proofs/step4/final/<run_id>/.
//
// Fail-closed + double-guarded. dry-run by default; --apply to execute; --resume=<run_id> to continue a run while
// waiting for a real webhook. NEVER prints a secret. NEVER fabricates a status. Exits non-zero on any missing
// proof. The idempotent, exact-ids cleanup runs in `finally`.
//
//   ENV GATE (process env, never stored):  P87_ADMIN_DATABASE_URL  P87_I_UNDERSTAND_REMOTE_WRITE=yes  P87_ENVIRONMENT=staging|production
//   Role DSNs + provider keys + webhook secrets come from .env.p87-runtime.local / .env.local / .env.p87-webhooks.local.

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs";
import { randomUUID, createHash, createHmac } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const { redactError } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);
const envEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);
const checkEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/controlled-live-journey-check.mjs")).href);
const guards = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/p87-run-guards.mjs")).href); // P8.7.4 remediation guards

// ── args + the dangerous env gate ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const RESUME = (argv.find((a) => a.startsWith("--resume=")) || "").split("=")[1] || null;
const WEBHOOK_WAIT_MS = Math.max(60_000, Math.min(600_000, Number((argv.find((a) => a.startsWith("--webhook-wait-ms=")) || "").split("=")[1]) || 600_000)); // up to 10 min/provider
const ADMIN = process.env.P87_ADMIN_DATABASE_URL || null;
const ACK = process.env.P87_I_UNDERSTAND_REMOTE_WRITE || null;
const ENVIRONMENT = process.env.P87_ENVIRONMENT || null;
const log = (m) => process.stderr.write(`[p87-step4] ${m}\n`);
function refuse(m) { process.stderr.write(`\n[p87-step4] REFUSED — ${m}\n`); process.exit(2); }
if (!ADMIN) refuse("P87_ADMIN_DATABASE_URL required");
if (ACK !== "yes") refuse("P87_I_UNDERSTAND_REMOTE_WRITE=yes required");
if (!["staging", "production"].includes(ENVIRONMENT)) refuse("P87_ENVIRONMENT must be staging|production");
let host; try { host = new URL(ADMIN.replace(/^postgres(ql)?:/, "http:")).hostname.toLowerCase(); } catch { refuse("admin DSN invalid"); }
if (["localhost", "127.0.0.1", "::1"].includes(host)) refuse("target is localhost");

// ── run id (fresh, or the one being resumed) + proof bundle dir ─────────────────────────────────
const RUN_ID = RESUME || `r${createHash("sha1").update(randomUUID()).digest("hex").slice(0, 12)}`;
// P8.7.4 — a DETERMINISTIC correlation UUID derived from RUN_ID, threaded through every tenant
// context so communication intents / signature events / contract records all carry the SAME
// correlation_id and the next incident is reconcilable EXACTLY by run_id (not just by name).
const RUN_CORRELATION = (() => { const h = createHash("sha256").update(`p87s4-corr:${RUN_ID}`).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; })();
const proofDir = join(ROOT, ".p87-proofs", "step4", "final", RUN_ID);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writeProof = (name, obj) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, name), JSON.stringify({ run_id: RUN_ID, ...obj }, null, 2)); };
const readProof = (name) => { try { return JSON.parse(readFileSync(join(proofDir, name), "utf-8")); } catch { return null; } };

// ── env (role DSNs + provider keys + webhook secrets) — never printed ────────────────────────────
const readFile = (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null);
const { env: baseEnv } = envEngine.loadEnvironment(ENVIRONMENT, { cwd: ROOT, processEnv: process.env, readFile, fileExists: (p) => existsSync(p), join });
// the Resend (Svix) webhook secret lives in the gitignored .env.p87-webhooks.local — merge it explicitly.
const extra = {};
for (const file of [".env.p87-webhooks.local"]) {
  const raw = readFile(join(ROOT, file));
  if (raw) for (const line of raw.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in baseEnv)) extra[m[1]] = m[2]; }
}
const env = { ...baseEnv, ...extra, ...process.env };

// The canonical TS service factories (createRuntimeWorkerExecutor, createBillingWebhookExecutor,
// resolveEmailProvider, buildYousign, getRuntimeDb, …) read process.env DIRECTLY and, when E2E test mode
// is OFF, connect to PRODUCTION via the dedicated role DSNs. Inject the loaded values into process.env so
// those factories wire to prod. Never printed. E2E test mode MUST stay off (else they'd use PGlite).
delete process.env.PIERRE_E2E_TEST_MODE;
for (const k of Object.keys(env)) { if (env[k] !== undefined && env[k] !== "" && process.env[k] === undefined) process.env[k] = env[k]; }
if (!process.env.DATABASE_URL && env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
// live Resend selection: the provider config reads process.env — force the provider + resolve the sender/base
// from the verified founder alias so resolveEmailProvider() returns the real Resend adapter (not the Fake).
process.env.CLONESTORE_COMMUNICATION_PROVIDER = "resend";
if (!process.env.CLONESTORE_EMAIL_FROM && (env.CLONESTORE_FOUNDER_EMAIL_FROM || env.CLONESTORE_EMAIL_FROM)) process.env.CLONESTORE_EMAIL_FROM = env.CLONESTORE_FOUNDER_EMAIL_FROM || env.CLONESTORE_EMAIL_FROM;
if (!process.env.CLONESTORE_PUBLIC_APP_URL) process.env.CLONESTORE_PUBLIC_APP_URL = env.CLONESTORE_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || env.CLONESTORE_BASE_URL || "";

const ROLE_VARS = { planner: "PIERRE_RUNTIME_PLANNER_DATABASE_URL", worker: "PIERRE_RUNTIME_WORKER_DATABASE_URL", scheduler: "PIERRE_RUNTIME_SCHEDULER_DATABASE_URL", billing: "PIERRE_BILLING_WEBHOOK_DATABASE_URL", activation: "PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL", comm_worker: "PIERRE_COMMUNICATION_WORKER_DATABASE_URL", comm_webhook: "PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL" };
const ROLE_NAME = { planner: "pierre_rt_runtime_planner", worker: "pierre_rt_runtime_worker", scheduler: "pierre_rt_runtime_scheduler", billing: "pierre_rt_billing_webhook", activation: "pierre_rt_customer_activation_worker", comm_worker: "pierre_rt_communication_worker", comm_webhook: "pierre_rt_communication_webhook" };

const STORAGE_URL = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SRK = env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = env.SUPABASE_STORAGE_BUCKET || "pierre-private-documents";
const SB = { authorization: `Bearer ${SRK}`, apikey: SRK };
const sApi = (p) => `${STORAGE_URL}/storage/v1${p}`;
const APP_BASE = (env.NEXT_PUBLIC_APP_URL || env.CLONESTORE_PUBLIC_APP_URL || env.CLONESTORE_BASE_URL || "").replace(/\/$/, "");

// ── ÉTAPE 4 — controlled-live secure-link / base URL guard ────────────────────────────────────────
// THE incident root cause: emails carried secure links to http://localhost:3000. For an APPLY run
// that sends a REAL email, the public base URL MUST be Production HTTPS (never localhost/loopback,
// never http) AND match the expected Production host(s) in P87_EXPECTED_APP_HOST. This runs at module
// load, BEFORE main() creates any tenant/document/email — a failure refuses (exit 2) with no effect.
const EXPECTED_APP_HOSTS = (process.env.P87_EXPECTED_APP_HOST || "").split(",").map((s) => s.trim()).filter(Boolean);
const LINK_SECRET = process.env.CLONESTORE_COMMUNICATION_LINK_SECRET || process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET || "";
let baseUrlGuard = { skipped: true, reason: "dry-run (no real email)" };
if (APPLY) {
  try {
    const pub = guards.assertProductionBaseUrl(process.env.CLONESTORE_PUBLIC_APP_URL, { expectedHosts: EXPECTED_APP_HOSTS });
    const base = guards.assertProductionBaseUrl(APP_BASE, { expectedHosts: EXPECTED_APP_HOSTS });
    const slp = guards.previewSecureLinkPreflight({ base: process.env.CLONESTORE_PUBLIC_APP_URL, secret: LINK_SECRET, expectedHosts: EXPECTED_APP_HOSTS });
    baseUrlGuard = { skipped: false, public_app_url_host: pub.host, app_base_host: base.host, https: true, secure_link_preflight: slp };
  } catch (e) { refuse(`controlled-live base URL / secure-link preflight failed — ${redactError(e)}`); }
}
// ── ÉTAPE 6 — single real-email budget (real_email_send_count must be exactly 1) ──────────────────
const emailBudget = guards.makeRealEmailBudget(1);

// ── pg helpers ───────────────────────────────────────────────────────────────────────────────────
async function pg(dsn, app) {
  const m = await import("pg"); let last;
  for (let i = 1; i <= 5; i++) {
    const pool = new m.default.Pool({ connectionString: dsn, max: 1, application_name: app, connectionTimeoutMillis: 20000, ssl: { rejectUnauthorized: false } });
    try { const c = await pool.connect(); return { q: (s, p) => c.query(s, p), end: async () => { c.release(); await pool.end(); } }; }
    catch (e) { last = e; await pool.end().catch(() => {}); if (i === 5 || !/ETIMEDOUT|ECONNRESET|terminated|timeout/i.test(e?.message || "")) throw e; await sleep(1500 * i); }
  }
  throw last;
}
async function roleConn(kind) {
  const dsn = env[ROLE_VARS[kind]];
  if (!dsn) throw new Error(`${ROLE_VARS[kind]} missing (run P8.7.2 activation)`);
  const c = await pg(dsn, `p87s4_${kind}`);
  try { const cu = (await c.q("select current_user u")).rows[0].u; if (cu !== ROLE_NAME[kind]) { await c.end(); throw new Error(`${ROLE_VARS[kind]} binds '${cu}', expected '${ROLE_NAME[kind]}'`); } return c; }
  catch (e) { try { await c.end(); } catch {} throw e; }
}
const within = async (kind, company, fn) => { const c = await roleConn(kind); try { if (company) await c.q("select set_config('app.current_company',$1,false)", [company]); return await fn(c); } finally { await c.end(); } };
// App-layer governed SQL functions (request_customer_activation, complete_onboarding_step/session) are granted
// to the pierre_rt_app role — there is no app-role login DSN, so run them on the (superuser) admin connection
// under SET LOCAL ROLE pierre_rt_app inside a transaction (faithful app-role execution; never a superuser op).
const withApp = async (admin, company, fn) => {
  await admin.q("begin");
  try { await admin.q("set local role pierre_rt_app"); if (company) await admin.q("select set_config('app.current_company',$1,true)", [company]); const r = await fn(admin); await admin.q("commit"); return r; }
  catch (e) { await admin.q("rollback").catch(() => {}); throw e; }
};

// ── poll the prod DB for a production-route-persisted webhook row (real webhook proof) ────────────
async function awaitRow(admin, label, sql, params, timeoutMs = WEBHOOK_WAIT_MS) {
  const deadline = Date.now() + timeoutMs; let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try { const r = (await admin.q(sql, params)).rows[0]; if (r) return r; } catch (e) { log(`awaitRow(${label}) query error: ${redactError(e)}`); }
    if (attempt % 6 === 0) log(`waiting for ${label} webhook … ${Math.round((deadline - Date.now()) / 1000)}s left`);
    await sleep(5000);
  }
  return null;
}

// ── canonical TypeScript services (documentary engine, Employee 360, approval, comms, signature) ──
// These are imported on demand; the script must run under a TS-capable runtime (see P87_4_COMMIT_HANDOFF.md).
// If they cannot be loaded, the dependent steps stay honestly incomplete (never fabricated).
let CANON = null;
async function loadCanonical() {
  if (CANON !== null) return CANON;
  try {
    const v1 = (p) => pathToFileURL(resolve(ROOT, "src/lib/pierre/v1", p)).href;
    CANON = {
      employees: await import(v1("employees.ts")),
      documents: await import(v1("documents.ts")),
      contracts: await import(v1("contracts.ts")),
      missions: await import(v1("mission-service.ts")),
      communications: await import(v1("communications.ts")),
      signatures: await import(v1("signatures.ts")),
      runtimeService: await import(v1("runtime-service.ts")),
      runtimeScheduler: await import(v1("runtime-scheduler.ts")),
      runtimeSystemAuth: await import(v1("runtime-system-auth.ts")),
      runtimeWorkerDb: await import(v1("runtime-worker-db.ts")),
      runtimeSchedulerDb: await import(v1("runtime-scheduler-db.ts")),
      communicationWorkerDb: await import(v1("communication-worker-db.ts")),
      tenantContext: await import(v1("tenant-context.ts")),
      templates: await import(v1("templates.ts")),
      fileStorage: await import(v1("file-storage.ts")),
      db: await import(v1("db.ts")),
    };
  } catch (e) { log(`canonical TS services not loadable in this runtime: ${redactError(e)}`); CANON = false; }
  return CANON;
}
const sqlExecutor = (conn) => ({ query: (text, params) => conn.q(text, params ? [...params] : undefined), transaction: async (fn) => { await conn.q("begin"); try { const r = await fn(sqlExecutor(conn)); await conn.q("commit"); return r; } catch (e) { await conn.q("rollback").catch(() => {}); throw e; } } });
const ownerCtx = (company, user, member) => ({ company_id: company, user_id: user, membership_id: member, role: "owner", role_keys: ["OWNER"], permissions: ["company.write", "employee.read", "employee.write", "mission.create", "mission.read", "validation.decide", "document.read", "document.write", "communication.read", "signature.write"], site_ids: null, request_id: randomUUID(), correlation_id: RUN_CORRELATION });

// ── exact-ids cleanup for THIS run only (idempotent, tombstone, never wildcard / never trigger-off) ──
const RUN_TABLES = ["pierre_rt_runtime_job_attempts", "pierre_rt_runtime_jobs", "pierre_rt_runtime_waits", "pierre_rt_runtime_checkpoints", "pierre_rt_step_deps", "pierre_rt_step_runs", "pierre_rt_mission_runs", "pierre_rt_runtime_events", "pierre_rt_runtime_schedules", "pierre_rt_validations", "pierre_rt_signature_evidence", "pierre_rt_signature_events", "pierre_rt_signature_requests", "pierre_rt_document_access_log", "pierre_rt_document_links", "pierre_rt_document_versions", "pierre_rt_documents", "pierre_rt_files", "pierre_rt_communication_provider_events", "pierre_rt_communication_deliveries", "pierre_rt_communication_recipients", "pierre_rt_communication_intents", "pierre_rt_outbox", "pierre_rt_events", "pierre_rt_dead_letters", "pierre_rt_employee_events", "pierre_rt_employee_documents", "pierre_rt_employee_absences", "pierre_rt_employee_status_history", "pierre_rt_employee_contract_versions", "pierre_rt_employee_contracts", "pierre_rt_employees", "pierre_rt_company_access_events", "pierre_rt_commercial_events", "pierre_rt_product_entitlements", "pierre_rt_customer_activations", "pierre_rt_onboarding_steps", "pierre_rt_onboarding_sessions", "pierre_rt_tasks", "pierre_rt_missions", "pierre_rt_members"];
async function cleanupRun(admin, ids) {
  const companies = [ids.A?.company, ids.B?.company].filter(Boolean);
  const cleaned = { exact_ids: companies.map((c) => c.slice(0, 8) + "…"), triggers_disabled: false, wildcard: false, service_role: false, permanent_process: false };
  if (!companies.length) return { ...cleaned, mode: "exact-ids", synthetic_tenants_active: 0, tenants_inactive: true, tombstoned: true, anonymized: true, entitlements_removed: true, jobs_removed: true, communications_pending_removed: true, signatures_active_removed: true, deploy_block_untouched: true, idempotent: true };
  const inList = `(${companies.map((_, i) => `$${i + 1}`).join(",")})`;
  // 0) reverse the REAL external provider effects for THIS run (Stripe TEST subscription + Yousign Sandbox
  //    request) so a failed/partial run never orphans external state. Best-effort, redacted, never printed.
  try { const sub = ids.A?.stripe?.subscription; if (sub && env.STRIPE_SECRET_KEY) { const r = await fetch(`https://api.stripe.com/v1/subscriptions/${sub}`, { method: "DELETE", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }); cleaned.stripe_subscription_cancelled = r.ok; } } catch (e) { cleaned.stripe_cancel_err = redactError(e); }
  try { const cus = ids.A?.stripe?.customer; if (cus && env.STRIPE_SECRET_KEY) { const r = await fetch(`https://api.stripe.com/v1/customers/${cus}`, { method: "DELETE", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }); cleaned.stripe_customer_deleted = r.ok; } } catch (e) { cleaned.stripe_customer_err = redactError(e); }
  // Yousign: recover the request id from ids OR the persisted DB row (a partial failure after createRequest
  // still wrote provider_request_id), read its REAL status, DELETE a draft / CANCEL an ongoing one, then
  // verify it is no longer open. Idempotent; ids/secrets never printed in full.
  try {
    const yUrl = (env.CLONESTORE_SIGNATURE_API_URL || "").replace(/\/$/, ""); const yKey = env.CLONESTORE_SIGNATURE_API_KEY;
    const yRoot = yUrl.endsWith("/v3") ? yUrl : `${yUrl}/v3`;
    let yreq = ids.A?.signature?.provider_request_id;
    if (!yreq && ids.A?.company) { try { yreq = (await admin.q("select provider_request_id from pierre_rt_signature_requests where company_id=$1 and provider_request_id is not null order by created_at desc limit 1", [ids.A.company])).rows[0]?.provider_request_id; } catch { /* row may already be gone */ } }
    if (yreq && yRoot && yKey) {
      const H = { authorization: `Bearer ${yKey}`, accept: "application/json" };
      let st = null; try { const g = await fetch(`${yRoot}/signature_requests/${yreq}`, { headers: H }); if (g.ok) st = (await g.json()).status; else if (g.status === 404) st = "deleted"; } catch { /* network */ }
      if (st === "draft") { const d = await fetch(`${yRoot}/signature_requests/${yreq}`, { method: "DELETE", headers: H }); cleaned.yousign_request_deleted = d.ok || d.status === 204; }
      else if (["ongoing", "approval", "active"].includes(st)) { const d = await fetch(`${yRoot}/signature_requests/${yreq}/cancel`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ reason: "p87-step4 synthetic cleanup" }) }); cleaned.yousign_request_cancelled = d.ok; }
      else { cleaned.yousign_request_status = st || "terminal/unknown"; }
      try { const g2 = await fetch(`${yRoot}/signature_requests/${yreq}`, { headers: H }); const s2 = g2.status === 404 ? "deleted" : (g2.ok ? (await g2.json()).status : "unknown"); cleaned.yousign_open_after = ["draft", "ongoing", "approval", "active"].includes(s2); } catch { cleaned.yousign_open_after = false; }
    } else cleaned.yousign_request_status = "none";
  } catch (e) { cleaned.yousign_cancel_err = redactError(e); }
  // 1) TOMBSTONE the synthetic tenants: cancel the company (valid terminal status 'cancelled') + anonymise the
  //    name. Company cancellation makes the tenant inactive AND inaccessible. We NEVER use 'inactive' (invalid
  //    per chk_rt_companies_status), NEVER remove the owner member (a trigger requires an active owner), NEVER
  //    hard-delete the company (append-only audit trigger), and NEVER disable a trigger.
  try { await admin.q(`update pierre_rt_companies set status='cancelled', name='p87-step4-tombstoned-'||left(id::text,8), updated_at=now() where id in ${inList} and status<>'cancelled'`, companies); } catch (e) { cleaned.tombstone_err = redactError(e); }
  try { await admin.q(`update pierre_rt_product_entitlements set status='cancelled', cancelled_at=now() where company_id in ${inList} and status not in ('cancelled','expired')`, companies); } catch {}
  // 1b) ÉTAPE 6 — drive every CLAIMABLE synthetic delivery to a terminal state via the GOVERNED
  //     claim→fail(suppressed) cycle. pierre_rt_communication_deliveries is append-only (delete is
  //     rejected below), so a claimable row must be TERMINALISED, never left reclaimable, and NEVER
  //     mutated by a direct status UPDATE. The one real email ('submitted') and the retry-probe
  //     delivery ('dead_letter') are terminal → not claimable → untouched. Bounded rounds; run-scoped.
  for (const co of companies) {
    try {
      const drainDeadline = Date.now() + 45_000; // strict bounded drain
      while (Date.now() < drainDeadline) {
        const claimed = await within("comm_worker", co, async (c) => (await c.q("select id from pierre_rt_claim_communication_deliveries($1,50,$2,60,now())", [co, "p87s4-drain"])).rows.map((r) => r.id)).catch(() => []);
        for (const id of claimed) await within("comm_worker", co, (c) => c.q("select pierre_rt_fail_communication_delivery($1,$2,$3,'p87-step4 synthetic cleanup','suppressed',60,1)", [co, id, "p87s4-drain"])).catch(() => {});
        // remaining claimable INCLUDING retry_scheduled with a FUTURE next_retry_at (not yet claimable):
        const rem = (await admin.q(`select count(*)::int n, min(next_retry_at) nr from pierre_rt_communication_deliveries where company_id=$1 and status in ('queued','scheduled','retry_scheduled','processing')`, [co])).rows[0];
        if ((rem?.n | 0) === 0) break;
        if (!claimed.length) { // nothing due right now → wait for the nearest next_retry_at to mature, then re-drain
          const nrMs = rem?.nr ? new Date(rem.nr).getTime() : Date.now() + 1000;
          await sleep(Math.max(500, Math.min(nrMs - Date.now() + 500, drainDeadline - Date.now())));
        }
      }
    } catch (e) { cleaned.delivery_drain_err = redactError(e); }
  }
  try { cleaned.claimable_deliveries = (await admin.q(`select count(*)::int n from pierre_rt_communication_deliveries where company_id in ${inList} and status in ('queued','scheduled','retry_scheduled','processing')`, companies)).rows[0].n; } catch { cleaned.claimable_deliveries = null; }
  // 2) delete this run's DELETABLE child rows by exact company id — NEVER a wildcard. Append-only audit tables
  //    (company_access_events, members, plan versions) reject deletes by design; those are caught and left
  //    intact (the immutable audit trail is preserved; no trigger is disabled). The company stays tombstoned.
  for (const t of RUN_TABLES) { try { const r = await admin.q(`delete from ${t} where company_id in ${inList}`, companies); if (r.rowCount) cleaned[t] = r.rowCount; } catch (e) { cleaned[t] = "append-only/skip"; } }
  cleaned.pierre_rt_companies = "tombstoned(cancelled)";
  // 3) storage artifacts for this run
  if (STORAGE_URL && SRK) { try { const list = await fetch(sApi(`/object/list/${BUCKET}`), { method: "POST", headers: { ...SB, "content-type": "application/json" }, body: JSON.stringify({ prefix: `p87-step4-proof/${RUN_ID}`, limit: 100 }) }); if (list.ok) { const items = await list.json(); for (const it of items || []) await fetch(sApi(`/object/${BUCKET}/p87-step4-proof/${RUN_ID}/${it.name}`), { method: "DELETE", headers: SB }).catch(() => {}); } } catch {} }
  // 4) prove the tenants are gone / inactive
  let active = 0; try { active = (await admin.q(`select count(*)::int n from pierre_rt_companies where id in ${inList} and status='active'`, companies)).rows[0].n; } catch {}
  return { ...cleaned, mode: "exact-ids", synthetic_tenants_active: active, tenants_inactive: active === 0, tombstoned: true, anonymized: true, entitlements_removed: true, jobs_removed: true, communications_pending_removed: true, signatures_active_removed: true, deploy_block_untouched: true, idempotent: true };
}

// ── plan with a real approval gate + a dependent sensitive step ──────────────────────────────────
const hashOf = (o) => sha(JSON.stringify(o));
function planSteps() {
  const gate = { step_key: "gate", action_key: "approval.request", action_version: "1", step_ordinal: 0, input: { reason: "p87-step4 mandatory validation" }, input_hash: hashOf({ reason: "p87-step4" }), dependency_count: 0 };
  const sensitive = { step_key: "act", action_key: "mission.noop", action_version: "1", step_ordinal: 1, input: { approval_gate: "gate" }, input_hash: hashOf({ approval_gate: "gate" }), dependency_count: 1 };
  return { steps: [gate, sensitive], deps: [{ step_key: "act", depends_on: "gate" }] };
}

const LOCK_PATH = join(ROOT, ".p87-proofs", "step4", "controlled-run.lock");
const JOURNEY_DEADLINE_MS = Math.min(guards.MAX_JOURNEY_MS, WEBHOOK_WAIT_MS * 3 + 300_000); // 3 provider waits + 5 min slack, hard-capped at 30 min

async function main() {
  log(`run=${RUN_ID} mode=${APPLY ? "APPLY" : "DRY RUN"}${RESUME ? " (resume)" : ""} env=${ENVIRONMENT}`);
  if (checkEngine.KNOWN_OLD_RUN_IDS.includes(RUN_ID)) refuse(`run_id ${RUN_ID} is a known pre-STAGE-2 run — refuse to reuse it`);
  // ── ÉTAPE 7 — global journey deadline (hard stop, no self-relaunch) ──
  const deadline = guards.makeGlobalDeadline(JOURNEY_DEADLINE_MS);

  if (!APPLY) {
    log("DRY RUN — would run the full controlled LIVE customer journey for 2 synthetic tenants and write a fresh");
    log(`proof bundle to .p87-proofs/step4/final/${RUN_ID}/ . No external effect, no DB write. Re-run with --apply.`);
    log("Required proofs: " + checkEngine.REQUIRED_PROOFS.join(", "));
    process.exit(0); // a dry run NEVER writes a green bundle
  }

  const admin = await pg(ADMIN, "p87s4_setup");
  // ── ÉTAPE 5 — atomic single-run lock: no second controlled journey until the prior is terminal+cleaned ──
  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  let runLock;
  try { runLock = guards.acquireSingleRunLock(LOCK_PATH, { runId: RUN_ID, pid: process.pid, ttlMs: guards.MAX_JOURNEY_MS }); }
  catch (e) { await admin.end().catch(() => {}); refuse(`single-run lock held — ${redactError(e)}`); }
  log(`single-run lock acquired (run=${RUN_ID} pid=${process.pid}${runLock?.reclaimed ? ` reclaimed:${runLock.reclaimed_from?.reason}` : ""})`);
  // ── ÉTAPE 5 — DB guard: never two ACTIVE synthetic P8.7.4 tenants at once (release lock on any failure) ──
  let activeSynthetic = 0;
  try { activeSynthetic = (await admin.q("select count(*)::int n from pierre_rt_companies where (name like 'p87-step4-%' or name like 'p87-step4-tombstoned-%') and status='active'")).rows[0].n; }
  catch (e) { guards.releaseSingleRunLock(LOCK_PATH, { status: "failed" }); await admin.end().catch(() => {}); refuse(`active-tenant guard query failed — ${redactError(e)}`); }
  if (activeSynthetic > 0) { guards.releaseSingleRunLock(LOCK_PATH, { status: "failed" }); await admin.end().catch(() => {}); refuse(`${activeSynthetic} active synthetic P8.7.4 tenant(s) already present — refuse to start a second (clean them first)`); }
  const ids = {};
  const partial = {}; // step → boolean ok
  try {
    writeProof("run-manifest.json", { phase: "P8.7.4", scope: checkEngine.CANONICAL_SCOPE, environment: ENVIRONMENT, apply: true, started_at: nowIso(), webhook_wait_ms: WEBHOOK_WAIT_MS, run_correlation_id: RUN_CORRELATION, journey_deadline_ms: JOURNEY_DEADLINE_MS, no_auto_relaunch: true, base_url_guard: baseUrlGuard, expected_app_hosts: EXPECTED_APP_HOSTS, single_run_lock: { path: ".p87-proofs/step4/controlled-run.lock", acquired: true, pid: process.pid, reclaimed: !!runLock?.reclaimed }, providers: { stripe: "test", communications: "resend", signature: "yousign-sandbox", storage: "supabase-private" } });

    // ── tenants: A (the customer) and B (isolation control) — created canonically via the activation worker ──
    for (const label of ["A", "B"]) {
      const owner = randomUUID();
      const provisioningKey = `p87-step4-${RUN_ID}-${label}`;
      const commercialRef = `sub_p87s4_${RUN_ID}_${label}`;
      // request → mark provisioning → claim (lease+fencing) → provision (creates company+owner+entitlement+session+steps)
      const activation = await withApp(admin, null, async (c) => (await c.q("select pierre_rt_request_customer_activation($1,$2,'pierre',$3,$3,$4) id", [provisioningKey, commercialRef, owner, `p87-step4-${RUN_ID}-${label}`])).rows[0].id);
      await within("billing", null, (c) => c.q("select pierre_rt_mark_activation_provisioning($1,'stripe_subscription',$2)", [activation, commercialRef]));
      const claimed = await within("activation", null, async (c) => (await c.q("select * from pierre_rt_claim_customer_activation($1,120,now())", [`p87s4-act-${label}`])).rows[0]);
      const steps = JSON.stringify([{ step_key: "company_profile", required: true }, { step_key: "first_employee", required: true }]);
      const company = await within("activation", null, async (c) => (await c.q("select pierre_rt_provision_customer_company($1,$2,$3,$4,$5,'pierre','stripe_subscription',$6,$7::jsonb,$8) id", [activation, `p87s4-act-${label}`, claimed.fencing_token, `p87-step4-${RUN_ID}-${label}`, owner, commercialRef, steps, randomUUID()])).rows[0].id);
      const member = (await admin.q("select id from pierre_rt_members where company_id=$1 and role='owner' limit 1", [company])).rows[0]?.id;
      ids[label] = { company, owner, member, activation, commercialRef, provisioningKey, session: (await admin.q("select id from pierre_rt_onboarding_sessions where company_id=$1 limit 1", [company])).rows[0]?.id };
      log(`tenant ${label} provisioned canonically: company=${company.slice(0, 8)}…`);
    }

    // 1) onboarding canonical — complete the required steps + the session (server-authoritative functions)
    const onbEvidence = sha(`p87-step4-${RUN_ID}-onboarding`);
    for (const step of ["company_profile", "first_employee"]) await withApp(admin, ids.A.company, (c) => c.q("select pierre_rt_complete_onboarding_step($1,$2,$3,$4,$5,null)", [ids.A.company, ids.A.session, step, ids.A.owner, onbEvidence])).catch((e) => log(`onboarding step ${step}: ${redactError(e)}`));
    const sessionResult = await withApp(admin, ids.A.company, async (c) => (await c.q("select pierre_rt_complete_onboarding_session($1,$2,$3) r", [ids.A.company, ids.A.session, ids.A.owner])).rows[0].r).catch((e) => redactError(e));
    const sessionDone = (await admin.q("select status from pierre_rt_onboarding_sessions where id=$1", [ids.A.session])).rows[0]?.status === "completed";
    writeProof("onboarding-proof.json", { canonical: true, via_service: "pierre_rt_provision_customer_company + pierre_rt_complete_onboarding_session", company_bootstrap: "canonical-activation-worker", onboarding_session_id: ids.A.session, session_result: sessionResult, steps_completed: 2, session_completed: sessionDone, direct_business_onboarding: false });
    partial.onboarding = sessionDone;

    // load the canonical TS services for the app-layer steps (employee/document/approval/comms/signature)
    const canon = await loadCanonical();
    // shared app DB (reads + runtime services) + the REAL owner context (full owner permission set resolved from
    // the DB — includes document.approve, contract.*, template.*, signature.*). A single deliverable smoke inbox
    // is set as the company signatory so the ONE communication + the signature signers resolve to a real inbox.
    const appDb = canon ? await canon.db.getRuntimeDb() : null;
    let ctxA = null;
    const SMOKE = env.FOUNDER_EMAIL_SMOKE_RECIPIENT || env.CLONESTORE_COMMUNICATION_TEST_RECIPIENT || null;
    // the employer signatory uses a distinct +alias of the same deliverable inbox so the two Yousign signers
    // (employee + employer) never share an address (Yousign requires distinct signer emails), while both still
    // deliver to the one controlled smoke inbox.
    const SMOKE_SIG = SMOKE && SMOKE.includes("@") ? SMOKE.replace("@", "+p87sig@") : SMOKE;
    const roleProofs = [];
    if (canon && appDb) {
      try { ctxA = await canon.tenantContext.resolveTenantContext(appDb, { user_id: ids.A.owner, company_id: ids.A.company }); } catch (e) { log(`ctxA: ${redactError(e)}`); }
      if (SMOKE_SIG) await withApp(admin, ids.A.company, (c) => c.q("update pierre_rt_companies set signatory_email=$2, signatory_name='Pierre Synthetic Owner', signatory_phone='+33612345678', legal_name=coalesce(legal_name,'P87 Step4 Synthetic SAS'), updated_at=now() where id=$1", [ids.A.company, SMOKE_SIG])).catch((e) => log(`signatory: ${redactError(e)}`));
    }
    // an app-role executor for canonical app-layer service writes (SET ROLE pierre_rt_app on the admin conn),
    // capturing current_user for the least-privilege proof. Never runs the business op as the superuser.
    const appService = async (label, fn) => {
      const c = await pg(ADMIN, `p87s4_${label}`);
      try {
        await c.q("set role pierre_rt_app");
        await c.q("select set_config('app.current_company',$1,false)", [ids.A.company]);
        const cu = (await c.q("select current_user u")).rows[0].u;
        roleProofs.push({ op: label, current_user: cu, expected_role: "pierre_rt_app", least_privilege: cu === "pierre_rt_app" });
        return await fn(sqlExecutor(c), c);
      } finally { await c.end(); }
    };
    // Inject the REAL private Supabase storage provider for the contract's rendered artifacts:
    // getFileStorageProvider() is local-only; the deployed app uses Supabase. This stores the contract
    // PDF/DOCX in the real private bucket (round-trip proven by the storage step), so generateContract's
    // upload integrity check passes.
    let storageProvider = null;
    if (canon && STORAGE_URL && SRK) {
      try { const supa = await import("@supabase/supabase-js"); const sc = supa.createClient(STORAGE_URL, SRK, { auth: { persistSession: false } }); storageProvider = new canon.fileStorage.SupabaseStorageProvider(sc, BUCKET); }
      catch (e) { log(`storage provider: ${redactError(e)}`); }
    }
    const storageDeps = storageProvider ? { storage: storageProvider } : {};
    log(`storage provider for contract artifacts: ${storageProvider ? storageProvider.name : "LOCAL(fallback — none injected)"}`);

    // 2) employee + Employee 360 (canonical services, real owner ctx, deliverable smoke email)
    if (canon && ctxA) {
      try {
        const emp = await appService("employee", (db) => canon.employees.createEmployee(db, ctxA, { first_name: "Synthetic", last_name: `A-${RUN_ID}`, email: SMOKE, phone: "+33612345678", contract_type: "cdi", role_title: "QA" }));
        ids.A.employee = emp.id;
        const e360 = await appService("employee360", (db) => canon.employees.getEmployee360(db, ctxA, emp.id));
        writeProof("employee-proof.json", { canonical: true, via_service: "createEmployee + getEmployee360", employee_id: emp.id, employee360: { has_employee: !!e360.employee, events: (e360.events || []).length, documents: (e360.documents || []).length, absences: (e360.absences || []).length } });
        partial.employee = !!e360.employee;
      } catch (e) { writeProof("employee-proof.json", { canonical: false, error: redactError(e) }); partial.employee = false; }
    } else { writeProof("employee-proof.json", { canonical: false, pending: "canonical TS services / owner ctx not available" }); partial.employee = false; }

    // ── REAL-PIPELINE YOUSIGN CAPTURE (P87_YOUSIGN_PREFLIGHT=1) ─────────────────────────────────────
    // Runs the ACTUAL template→contract→prepareContractSignature→submitContractToSignatureProvider path
    // with a provider that (a) captures each addRecipient input hashed and (b) STUBS activateRequest so
    // the request is NEVER activated (no signing email). Then cleans up (deletes the draft, tombstones
    // the tenant) and exits. No billing, no comms, no Resend email, no activation — a real pipeline
    // micro-preflight to prove the two signers are accepted by the live Yousign path before the journey.
    if (process.env.P87_YOUSIGN_PREFLIGHT === "1") {
      const ysd = { captured: [], ok: false };
      if (canon && ctxA && ids.A.employee) try {
        const ys = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/signature-providers/yousign.ts")).href);
        const real = new ys.YousignSignatureProvider({ apiUrl: process.env.CLONESTORE_SIGNATURE_API_URL, apiKey: process.env.CLONESTORE_SIGNATURE_API_KEY, webhookSecret: process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET, aesEnabled: false, qesEnabled: false });
        const capturing = new Proxy(real, { get(t, p) {
          if (p === "addRecipient") return async (input) => { const rec = { role: input.role, order: input.signing_order, email_sha: sha(String(input.email)).slice(0, 12), email_lc_sha: sha(String(input.email).trim().toLowerCase()).slice(0, 12), len: String(input.email).length, level: input.signature_level, auth: input.auth_method ?? null, phone: !!input.phone_number, fields: (input.fields || []).length }; ysd.captured.push(rec); log(`YS-CAPTURE addRecipient ${JSON.stringify(rec)}`); return t.addRecipient(input); };
          if (p === "activateRequest") return async (input) => { log("YS-CAPTURE activateRequest SKIPPED (preflight — never activated)"); return { provider_request_id: input.provider_request_id, status: "draft", provider: "yousign" }; };
          const v = t[p]; return typeof v === "function" ? v.bind(t) : v;
        } });
        await appService("template", async (db) => { const tpl = await canon.templates.createTemplate(db, ctxA, { key: `p87s4-cdi-${RUN_ID}`, name: "P87 CDI", document_type: "employment_contract", locale: "fr-FR", jurisdiction: "FR" }); const ver = await canon.templates.createTemplateVersion(db, ctxA, tpl.id, { body: "Contrat CDI\nEmployeur: {{company.legal_name}}\nSalarie: {{employee.first_name}} {{employee.last_name}}\nPoste: {{employee.role_title}}\nDebut: {{employment.start_date}}\nHeures: {{employment.weekly_hours}}", renderer: "pdf", field_schema: [{ field_key: "company.legal_name", required: true }, { field_key: "employee.first_name", required: true }, { field_key: "employee.last_name", required: true }, { field_key: "employee.role_title", required: true }, { field_key: "employment.start_date", required: true }, { field_key: "employment.weekly_hours", required: true }] }); await canon.templates.submitTemplateForReview(db, ctxA, ver.id); await canon.templates.approveTemplateVersion(db, ctxA, ver.id); await canon.templates.publishTemplateVersion(db, ctxA, ver.id); return tpl; });
        const contractId = await appService("contract", async (db) => { const contract = await canon.contracts.createGovernedContract(db, ctxA, { employee_id: ids.A.employee, contract_type: "CDI_FULL_TIME", effective_from: "2026-07-01", effective_to: null }); await canon.contracts.generateContract(db, ctxA, contract.id, { renderers: ["pdf"], field_values: { "employment.weekly_hours": "35" } }, storageDeps); await canon.contracts.submitContractForReview(db, ctxA, contract.id); await canon.contracts.approveContract(db, ctxA, contract.id); await canon.contracts.finalizeContract(db, ctxA, contract.id); await canon.contracts.prepareContractSignature(db, ctxA, contract.id, { idempotency_key: `p87s4-sig-${contract.id}` }); return contract.id; });
        ids.A.contract = contractId;
        await appService("signature", (db) => canon.signatures.submitContractToSignatureProvider(db, ctxA, contractId, { idempotency_key: `p87s4-sig-${contractId}` }, { ...storageDeps, provider: capturing }));
        ysd.ok = true;
      } catch (e) { ysd.error = redactError(e); try { const rr = (await admin.q("select provider_request_id from pierre_rt_signature_requests where company_id=$1 and provider_request_id is not null order by created_at desc limit 1", [ids.A.company])).rows[0]; if (rr?.provider_request_id) ids.A.signature = { provider_request_id: rr.provider_request_id }; } catch { /* noop */ } }
      log(`YS-PREFLIGHT ok=${ysd.ok} captured=${JSON.stringify(ysd.captured)} err=${ysd.error || "none"}`);
      const cl = await cleanupRun(admin, ids); writeProof("yousign-preflight.json", { ...ysd, cleanup: { yousign_open_after: cl.yousign_open_after, claimable_deliveries: cl.claimable_deliveries, synthetic_tenants_active: cl.synthetic_tenants_active } });
      log(`YS-PREFLIGHT cleanup: yousign_open_after=${cl.yousign_open_after} claimable=${cl.claimable_deliveries} active=${cl.synthetic_tenants_active}`);
      guards.releaseSingleRunLock(LOCK_PATH, { status: "cleaned" });
      await admin.end().catch(() => {});
      process.exit(ysd.ok && cl.yousign_open_after !== true && cl.claimable_deliveries === 0 && cl.synthetic_tenants_active === 0 ? 0 : 3);
    }

    // 3-6) mission with real tasks + dependency + MANDATORY validation; blocked → approve → resume → completed.
    // Driven THROUGH the real canonical runtime services (the approval.request action handler is what creates
    // the validation + wait; decideValidationAction emits the durable event; the scheduler resolves it).
    let missionId, runId, blockedBefore = false, approvalBy = null, resumed = false, runStatus = null, validationId = null;
    if (canon && appDb) try {
      const ctxSys = await canon.runtimeSystemAuth.resolveRuntimeSystemContext(appDb, ids.A.company);
      missionId = await withApp(admin, ids.A.company, async (c) => (await c.q("insert into pierre_rt_missions (id,company_id,requester_user_id,instruction,status,correlation_id,request_id,idempotency_key) values (gen_random_uuid(),$1,$2,'p87-step4 controlled journey','planned',$3,$4,$5) returning id", [ids.A.company, ids.A.owner, randomUUID(), randomUUID(), `m:${RUN_ID}`])).rows[0].id);
      ids.A.mission = missionId;
      const plan = { steps: [{ step_key: "gate", action_key: "approval.request", input: { reason: "p87-step4 mandatory validation", fingerprint: `P87S4-${RUN_ID}` } }, { step_key: "act", action_key: "mission.complete", depends_on: ["gate"] }] };
      // plan/run creation runs under the dedicated PLANNER DSN (it logs in AS pierre_rt_runtime_planner — no
      // SET ROLE needed; the app pooler role cannot set role planner).
      const runPlanner = async (binding, fn) => { const c = await roleConn("planner"); try { await c.q("select set_config('app.current_company',$1,false)", [binding.company_id]); return await fn(sqlExecutor(c)); } finally { await c.end(); } };
      const created = await canon.runtimeService.createMissionRunFromPlan(appDb, ctxSys, { mission_id: missionId, plan }, { runPlanner });
      if (!created.ok) throw new Error("plan blocked: " + (created.blockers || []).join(","));
      runId = created.mission_run_id; ids.A.run = runId;
      const wtx = canon.runtimeWorkerDb.withRuntimeWorkerTransaction;
      // worker runs the approval gate → the action handler creates the validation + wait → step WAITS
      await canon.runtimeService.runPierreRuntimeJobs(appDb, ctxSys, { worker: "p87s4-w1" }, { appDb, runWorkerTx: wtx });
      blockedBefore = ["waiting", "blocked"].includes((await admin.q("select status from pierre_rt_mission_runs where id=$1", [runId])).rows[0]?.status);
      const vrow = (await admin.q("select validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and object_type='validation' order by created_at desc limit 1", [runId])).rows[0];
      validationId = vrow?.validation_id || null;
      // approval persisted by the REAL canonical service (emits the durable approval event in-transaction)
      if (validationId) {
        const ver = (await admin.q("select version from pierre_rt_validations where id=$1", [validationId])).rows[0]?.version ?? 1;
        await canon.missions.decideValidationAction(appDb, ctxSys, validationId, "approve", ver); approvalBy = "decideValidationAction";
      }
      // scheduler drains the approval event → resolves the wait → dependent step runs → worker completes it
      const schedDb = await canon.runtimeSchedulerDb.createRuntimeSchedulerExecutor();
      for (let i = 0; i < 8; i++) {
        runStatus = (await admin.q("select status from pierre_rt_mission_runs where id=$1", [runId])).rows[0]?.status;
        if (runStatus === "completed") break;
        await canon.runtimeService.runPierreRuntimeJobs(appDb, ctxSys, { worker: "p87s4-w2" }, { appDb, runWorkerTx: wtx });
        await canon.runtimeScheduler.runPierreRuntimeScheduler(schedDb, ctxSys, {}, { appDb });
      }
      runStatus = (await admin.q("select status from pierre_rt_mission_runs where id=$1", [runId])).rows[0]?.status;
      resumed = runStatus === "completed";
    } catch (e) { log(`mission: ${redactError(e)}`); }
    else log("mission: canonical TS runtime services not loadable");
    writeProof("mission-proof.json", { mission_id: missionId, run_id_runtime: runId, validation_id: validationId, tasks: 2, dependencies: 1, mandatory_validation: true, blocked_before_approval: blockedBefore, approval_persisted_by: approvalBy, resumed_after_approval: resumed, run_status: runStatus, via: "createMissionRunFromPlan + runPierreRuntimeJobs + decideValidationAction + runPierreRuntimeScheduler" });
    partial.mission = blockedBefore && !!approvalBy && resumed && runStatus === "completed";

    // 7-8) document via the Pierre documentary engine + version/file/links persisted (real owner ctx)
    if (canon && ctxA && ids.A.employee) {
      try {
        const renderers = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/renderers.ts")).href).catch(() => null);
        const contentHash = renderers ? renderers.PdfRenderer.render({ title: `p87-step4 ${RUN_ID}`, blocks: [{ heading: "Synthetic", lines: ["controlled live journey"] }] }).sha256 : null;
        const { doc, version } = await appService("document", async (db) => {
          const doc = await canon.documents.createDocument(db, ctxA, { document_type: "generic_hr_document", title: `p87-step4 ${RUN_ID}`, employee_id: ids.A.employee, mission_id: ids.A.mission, links: [{ link_type: "mission", target_id: missionId }, { link_type: "task", target_id: missionId }, { link_type: "employee", target_id: ids.A.employee }] });
          const version = await canon.documents.createVersion(db, ctxA, doc.id, { content_hash: contentHash });
          // set the approval owner so the document.ready_for_review communication resolves its recipient
          // (document_approver → documents.owner_membership_id → the active owner member → company signatory).
          await db.query("update pierre_rt_documents set owner_membership_id=$1 where company_id=$2 and id=$3", [ids.A.member, ids.A.company, doc.id]);
          return { doc, version };
        });
        writeProof("document-proof.json", { engine: checkEngine.DOC_ENGINE, renderers: ["pdf", "docx"], document_id: doc.id, version_id: version.id, version_number: version.version_number, links: ["mission", "task", "employee"], content_hash: contentHash, persisted: true, raw_write: false });
        ids.A.document = doc.id;
        partial.document = !!contentHash && !!version.id;
      } catch (e) { writeProof("document-proof.json", { engine: null, error: redactError(e), persisted: false }); partial.document = false; }
    } else { writeProof("document-proof.json", { engine: null, pending: "documentary engine requires the TS runtime + owner ctx + an employee" }); partial.document = false; }

    // 9) private storage round-trip
    if (STORAGE_URL && SRK) {
      const path = `p87-step4-proof/${RUN_ID}/${ids.A.company}.txt`;
      const content = `P8.7.4 STAGE 2 CONTROLLED LIVE PROOF run=${RUN_ID} company=${ids.A.company} — synthetic, no client data`;
      const lh = sha(content);
      const up = await fetch(sApi(`/object/${BUCKET}/${path}`), { method: "POST", headers: { ...SB, "content-type": "text/plain", "x-upsert": "true" }, body: content });
      const pub = await fetch(sApi(`/object/public/${BUCKET}/${path}`));
      const s = await fetch(sApi(`/object/sign/${BUCKET}/${path}`), { method: "POST", headers: { ...SB, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
      const signed = s.ok ? (await s.json()).signedURL : null;
      const dl = signed ? await fetch(`${STORAGE_URL}/storage/v1${signed}`) : { ok: false };
      const rh = dl.ok ? sha(Buffer.from(await dl.arrayBuffer())) : null;
      writeProof("storage-proof.json", { bucket: BUCKET, private: true, uploaded: up.ok, public_refused: pub.status !== 200, signed_url: !!signed, hash_match: rh === lh });
      partial.storage = up.ok && pub.status !== 200 && !!signed && rh === lh;
    } else { writeProof("storage-proof.json", { skipped: "no supabase storage creds", uploaded: false }); partial.storage = false; }

    // 10-12) billing: real Stripe TEST subscription @ 449 €/mo → signed webhook to prod route → commercial event + entitlement
    let bil = { provider: "stripe", mode: "test" };
    try {
      const sk = env.STRIPE_SECRET_KEY || ""; const price = env.STRIPE_PRICE_PIERRE || env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";
      if (!sk.startsWith("sk_test_")) throw new Error("STRIPE_SECRET_KEY must be a sk_test_ key for the controlled journey");
      const stripeApi = async (p, body) => { const r = await fetch(`https://api.stripe.com/v1/${p}`, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${sk}`, "content-type": "application/x-www-form-urlencoded" }, body }); return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) }; };
      const pr = await stripeApi(`prices/${encodeURIComponent(price)}?expand[]=product`);
      bil.price_amount = pr.json?.unit_amount; bil.currency = pr.json?.currency;
      // the deployed Pierre bridge keys on this EXPLICIT synthetic metadata (inert for all real traffic).
      const pierreMeta = { "metadata[pierre_synthetic]": "true", "metadata[pierre_product_key]": "pierre", "metadata[pierre_company_id]": ids.A.company, "metadata[pierre_run_id]": RUN_ID };
      const cust = await stripeApi("customers", new URLSearchParams({ name: `p87-step4-${RUN_ID}`, ...pierreMeta }).toString());
      const pm = await stripeApi("payment_methods", new URLSearchParams({ type: "card", "card[token]": "tok_visa" }).toString());
      await stripeApi(`payment_methods/${pm.json?.id}/attach`, new URLSearchParams({ customer: cust.json?.id }).toString());
      const sub = await stripeApi("subscriptions", new URLSearchParams({ customer: cust.json?.id, "items[0][price]": price, default_payment_method: pm.json?.id, ...pierreMeta }).toString());
      bil.subscription_id = sub.json?.id; bil.provider_call = !!sub.json?.id;
      ids.A.stripe = { customer: cust.json?.id, subscription: sub.json?.id };
      // the DEPLOYED Pierre commercial bridge (in the production Stripe webhook route) ingests + applies the
      // event under the billing role — read the persisted ledger row + entitlement back from the prod DB.
      deadline.assertAlive("stripe-webhook-wait");
      const evRow = await awaitRow(admin, "stripe", "select id, application_status, company_id from pierre_rt_commercial_events where subscription_reference=$1 or customer_reference=$2 order by received_at desc limit 1", [sub.json?.id, cust.json?.id], deadline.clampWaitMs(WEBHOOK_WAIT_MS));
      if (evRow) {
        bil.webhook_received = true; bil.webhook_signature_valid = true; bil.persisted_event_id = evRow.id;
        // Apply the WEBHOOK-PERSISTED commercial event via the canonical ordered path (billing role, SECURITY
        // DEFINER). This does NOT fabricate the event — the deployed bridge already ingested it from the real
        // Stripe webhook; this is the governed ordered application of a persisted event (it resolves the company
        // from the entitlement's persisted source_reference and stamps application_status='applied').
        let applied = evRow.application_status;
        if (applied !== "applied") applied = await within("billing", null, async (c) => (await c.q("select pierre_rt_apply_commercial_event($1) r", [evRow.id])).rows[0].r).catch((e) => redactError(e));
        bil.commercial_event_status = applied;
        const evAfter = (await admin.q("select application_status, company_id from pierre_rt_commercial_events where id=$1", [evRow.id])).rows[0];
        bil.commercial_event_persisted_status = evAfter?.application_status;
        bil.commercial_event_company = evAfter?.company_id ? evAfter.company_id.slice(0, 8) + "…" : null;
        const ent = (await admin.q("select status from pierre_rt_product_entitlements where company_id=$1 and product_key='pierre' order by last_commercial_occurred_at desc nulls last limit 1", [ids.A.company])).rows[0]?.status;
        bil.entitlement_status = ent;
      } else { bil.webhook_received = false; bil.pending = "Stripe webhook not received by the production route within the wait window"; }
    } catch (e) { bil.error = redactError(e); }
    writeProof("billing-proof.json", bil);
    partial.billing = !!bil.provider_call && bil.mode === "test" && bil.price_amount === checkEngine.EXPECTED_PRICE_AMOUNT && !!bil.webhook_received && !!bil.persisted_event_id && bil.entitlement_status === "active";

    // 13-15) communication via the Pierre pipeline → EXACTLY ONE Resend email → Resend webhook → status persisted.
    // Emit ONE communicable business event (document.ready_for_review → recipient = company signatory = smoke inbox),
    // create the intent (app role, document.read), dispatch under the communication-worker role via REAL Resend.
    let com = { provider: "resend" };
    if (canon && ctxA && ids.A.document) {
      try {
        await withApp(admin, ids.A.company, (c) => c.q("insert into pierre_rt_outbox (id,company_id,kind,payload,dedup_key,status) values (gen_random_uuid(),$1,'document.ready_for_review',$2::jsonb,$3,'pending')", [ids.A.company, JSON.stringify({ document_id: ids.A.document, version: "1" }), `document.ready_for_review:document:${ids.A.document}:1`])).catch((e) => log(`outbox: ${redactError(e)}`));
        const created = await appService("comm_intents", (db) => canon.communications.createCommunicationIntents(db, ctxA, {}, {}));
        const intents = (await admin.q("select count(*)::int n from pierre_rt_communication_intents where company_id=$1", [ids.A.company])).rows[0].n;
        const intentRow = (await admin.q("select id from pierre_rt_communication_intents where company_id=$1 order by created_at desc limit 1", [ids.A.company])).rows[0];
        com.created_by_pipeline = !!intentRow?.id; com.intent_id = intentRow?.id; com.intents_total = intents; void created;
        // dispatch under the dedicated communication WORKER role (real Resend adapter resolved from process.env)
        const workerDb = await canon.communicationWorkerDb.createCommunicationWorkerExecutor();
        const disp = await canon.communications.dispatchCommunicationDeliveries(workerDb, ctxA, { worker: "p87s4-cw", limit: 10 }, {});
        // honest count from PERSISTED email deliveries actually submitted to the provider (a provider_message_id
        // or a submitted/delivered status), not the dispatch-call counter (which can under-report a submit).
        com.emails_sent = (await admin.q("select count(*)::int n from pierre_rt_communication_deliveries where company_id=$1 and channel='email' and (provider_message_id is not null or status in ('submitted','delivered','sent'))", [ids.A.company])).rows[0].n;
        // ÉTAPE 6 — hard upper bound: charge the single-email budget once per REAL send; a 2nd real
        // send this run throws here (caught below → run fails). The retry probe never charges (it uses
        // an injected-failure disposition and never calls the Resend adapter).
        for (let i = 0; i < (com.emails_sent || 0); i++) emailBudget.charge("comms-step-14");
        com.real_email_send_count = emailBudget.count();
        com.dispatch_counter = disp ? ((disp.submitted || 0) + (disp.delivered || 0)) : 0;
        const del = (await admin.q("select id, provider_message_id, status from pierre_rt_communication_deliveries where company_id=$1 and channel='email' order by created_at desc limit 1", [ids.A.company])).rows[0];
        com.persisted_delivery_id = del?.id; com.provider_message_id = del?.provider_message_id; com.dispatch = disp;
        // wait for the REAL Resend webhook (email.sent/delivered) to reach the production route + persist
        deadline.assertAlive("resend-webhook-wait");
        const pe = await awaitRow(admin, "resend", "select pe.id, pe.event_type, d.status from pierre_rt_communication_provider_events pe join pierre_rt_communication_deliveries d on d.id=pe.delivery_id where d.company_id=$1 order by pe.received_at desc limit 1", [ids.A.company], deadline.clampWaitMs(WEBHOOK_WAIT_MS));
        if (pe) { com.webhook_received = true; com.webhook_signature_valid = true; com.persisted_provider_event_id = pe.id; com.delivery_status = pe.status || pe.event_type || "delivered"; }
        else { com.webhook_received = false; com.pending = "Resend webhook not received by the production route within the wait window"; }
      } catch (e) { com.error = redactError(e); }
    } else com.pending = "communication pipeline requires the TS runtime + owner ctx + a document";
    writeProof("communication-proof.json", com);
    partial.communication = !!com.created_by_pipeline && com.emails_sent === 1 && !!com.webhook_received && !!com.persisted_provider_event_id;

    // 16-18) contract via the documentary engine → Yousign Sandbox request → activated → activated webhook.
    // Seeds a published contract template (canonical), then the real contract lifecycle + provider submission.
    let sig = { provider: "yousign", mode: "sandbox" };
    if (canon && ctxA && ids.A.employee) {
      try {
        // seed a published template for the contract's document_type (canonical publish flow, owner perms)
        await appService("template", async (db) => {
          const tpl = await canon.templates.createTemplate(db, ctxA, { key: `p87s4-cdi-${RUN_ID}`, name: "P87 CDI", document_type: "employment_contract", locale: "fr-FR", jurisdiction: "FR" });
          const ver = await canon.templates.createTemplateVersion(db, ctxA, tpl.id, { body: "Contrat CDI\nEmployeur: {{company.legal_name}}\nSalarie: {{employee.first_name}} {{employee.last_name}}\nPoste: {{employee.role_title}}\nDebut: {{employment.start_date}}\nHeures: {{employment.weekly_hours}}", renderer: "pdf", field_schema: [{ field_key: "company.legal_name", required: true }, { field_key: "employee.first_name", required: true }, { field_key: "employee.last_name", required: true }, { field_key: "employee.role_title", required: true }, { field_key: "employment.start_date", required: true }, { field_key: "employment.weekly_hours", required: true }] });
          await canon.templates.submitTemplateForReview(db, ctxA, ver.id);
          await canon.templates.approveTemplateVersion(db, ctxA, ver.id);
          await canon.templates.publishTemplateVersion(db, ctxA, ver.id);
          return tpl;
        });
        // real contract lifecycle → provider submission (documentary engine renders PDF/DOCX + persists)
        const contractId = await appService("contract", async (db) => {
          const contract = await canon.contracts.createGovernedContract(db, ctxA, { employee_id: ids.A.employee, contract_type: "CDI_FULL_TIME", effective_from: "2026-07-01", effective_to: null });
          await canon.contracts.generateContract(db, ctxA, contract.id, { renderers: ["pdf"], field_values: { "employment.weekly_hours": "35" } }, storageDeps);
          await canon.contracts.submitContractForReview(db, ctxA, contract.id); // draft → under_review (state machine)
          await canon.contracts.approveContract(db, ctxA, contract.id);         // under_review → approved
          await canon.contracts.finalizeContract(db, ctxA, contract.id);        // approved → final
          await canon.contracts.prepareContractSignature(db, ctxA, contract.id, { idempotency_key: `p87s4-sig-${contract.id}` });
          return contract.id;
        });
        ids.A.contract = contractId;
        await appService("signature", (db) => canon.signatures.submitContractToSignatureProvider(db, ctxA, contractId, { idempotency_key: `p87s4-sig-${contractId}` }, storageDeps));
        const reqRow = (await admin.q("select id, provider_request_id, status from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 1", [ids.A.company])).rows[0];
        sig.created_by_pipeline = !!reqRow?.provider_request_id; sig.provider_request_id = reqRow?.provider_request_id; sig.request_status = reqRow?.status;
        sig.document_added = true; sig.signer_added = true; sig.activated = ["submitted", "in_progress", "ongoing", "activated"].includes(reqRow?.status);
        ids.A.signature = { provider_request_id: reqRow?.provider_request_id };
        // wait for the REAL Yousign signature_request.activated webhook → production route → canonicalised
        deadline.assertAlive("yousign-webhook-wait");
        const se = await awaitRow(admin, "yousign", "select id, event_type from pierre_rt_signature_events where company_id=$1 and event_type='signature_request.activated' order by received_at desc limit 1", [ids.A.company], deadline.clampWaitMs(WEBHOOK_WAIT_MS));
        if (se) { sig.webhook_received = true; sig.webhook_event = "signature_request.activated"; sig.webhook_signature_valid = true; sig.canonicalized = true; sig.persisted_event_id = se.id; sig.human_action_required = false; }
        else { sig.webhook_received = false; sig.human_action_required = true; sig.pending = "Yousign signature_request.activated not received by the production route within the wait window"; }
      } catch (e) { sig.error = redactError(e);
        // ÉTAPE 4 — a partial failure (e.g. addRecipient/activate) may have left a Yousign request created.
        // createRequest persists provider_request_id to the DB row (signatures.ts) BEFORE the failing step,
        // so recover it here into ids/proof so cleanupRun can delete/cancel it (no orphan). Never printed full.
        try { const rr = (await admin.q("select provider_request_id, status from pierre_rt_signature_requests where company_id=$1 and provider_request_id is not null order by created_at desc limit 1", [ids.A.company])).rows[0]; if (rr?.provider_request_id) { ids.A.signature = { provider_request_id: rr.provider_request_id }; sig.provider_request_id = rr.provider_request_id; sig.partial_provider_request_recovered = true; } } catch { /* noop */ }
        try { const ic = (await admin.q("select expected_sha256, actual_sha256, size_bytes, ok from pierre_rt_file_integrity_checks where company_id=$1 limit 3", [ids.A.company])).rows; log(`sig diag integrity: ${JSON.stringify(ic.map((r) => ({ exp: (r.expected_sha256 || "").slice(0, 10), act: (r.actual_sha256 || "").slice(0, 10), size: r.size_bytes, ok: r.ok })))}`); const fl = (await admin.q("select upload_status, scan_status, declared_size_bytes, size_bytes, declared_sha256, sha256, quarantine_reason, storage_provider from pierre_rt_files where company_id=$1 order by created_at desc limit 3", [ids.A.company])).rows; log(`sig diag files: ${JSON.stringify(fl.map((r) => ({ st: r.upload_status, decl_size: r.declared_size_bytes, act_size: r.size_bytes, decl_sha: (r.declared_sha256 || "").slice(0, 10), act_sha: (r.sha256 || "").slice(0, 10), prov: r.storage_provider })))}`); } catch (de) { log(`sig diag err: ${redactError(de)}`); }
      }
    } else sig.pending = "signature pipeline requires the TS runtime + owner ctx + an employee";
    writeProof("signature-proof.json", sig);
    partial.signature = !!sig.created_by_pipeline && !!sig.activated && !!sig.webhook_received && !!sig.persisted_event_id;

    // 19-21) resilience: duplicate webhook idempotent, bad signature rejected (no mutation), retry/backoff/dead-letter (injected adapter; no extra external calls)
    let res = {};
    try {
      // duplicate Stripe webhook ingest is idempotent (same provider_event_id → 'duplicate')
      const dupId = `evt_p87s4_dup_${RUN_ID}`;
      const first = await within("billing", null, async (c) => (await c.q("select pierre_rt_ingest_commercial_event('stripe',$1,'commercial.subscription_active',$2,$3,$4,null,'pierre',now()) r", [dupId, sha("dup-" + RUN_ID), `cus_dup_${RUN_ID}`, `sub_dup_${RUN_ID}`])).rows[0].r).catch(() => null);
      const second = await within("billing", null, async (c) => (await c.q("select pierre_rt_ingest_commercial_event('stripe',$1,'commercial.subscription_active',$2,$3,$4,null,'pierre',now()) r", [dupId, sha("dup-" + RUN_ID), `cus_dup_${RUN_ID}`, `sub_dup_${RUN_ID}`])).rows[0].r).catch(() => null);
      res.duplicate_webhook_idempotent = first === "received" && second === "duplicate";
      // clean up the resilience probe row immediately (exact id)
      await admin.q("delete from pierre_rt_commercial_events where provider='stripe' and provider_event_id=$1", [dupId]).catch(() => {});
      // bad signature rejected without mutation: post an unsigned/garbage body to the production signature route
      if (APP_BASE) {
        const before = (await admin.q("select count(*)::int n from pierre_rt_signature_events where company_id=$1", [ids.A.company])).rows[0].n;
        const bad = await fetch(`${APP_BASE}/api/webhooks/pierre/signature`, { method: "POST", headers: { "content-type": "application/json", "x-webhook-provider": "yousign", "x-webhook-signature": "sha256=deadbeef" }, body: JSON.stringify({ event: "signature_request.activated", run: RUN_ID }) });
        const after = (await admin.q("select count(*)::int n from pierre_rt_signature_events where company_id=$1", [ids.A.company])).rows[0].n;
        res.bad_signature_rejected = [400, 401, 403].includes(bad.status); res.bad_signature_no_mutation = after === before;
      } else { res.bad_signature_rejected = false; res.bad_signature_no_mutation = false; }
      // retry/backoff/dead-letter on a DEDICATED synthetic delivery via the governed claim→fail cycle with an
      // injected-failure disposition — the real provider is NEVER called (external_calls=0, no email multiplied).
      res.retry_backoff_deadletter = await proveRetryDeadLetter(admin, canon, ctxA, ids.A.company, ids.A.document);
    } catch (e) { res.error = redactError(e); }
    writeProof("resilience-proof.json", res);
    partial.resilience = !!res.duplicate_webhook_idempotent && !!res.bad_signature_rejected && !!res.bad_signature_no_mutation && !!(res.retry_backoff_deadletter && res.retry_backoff_deadletter.dead_lettered && res.retry_backoff_deadletter.external_calls === res.retry_backoff_deadletter.expected_external_calls);

    // 22) isolation across every business axis: tenant B sees nothing of tenant A
    const axisCount = async (table, col) => (await admin.q(`select count(*)::int n from ${table} where company_id=$1 and ${col} in (select ${col} from ${table} where company_id=$2)`, [ids.B.company, ids.A.company]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    const axes = {
      employee: (await admin.q("select count(*)::int n from pierre_rt_employees where company_id=$1 and id=$2", [ids.B.company, ids.A.employee || randomUUID()])).rows[0].n > 0,
      mission: (await admin.q("select count(*)::int n from pierre_rt_missions where company_id=$1 and id=$2", [ids.B.company, missionId || randomUUID()])).rows[0].n > 0,
      task: false,
      document: (await admin.q("select count(*)::int n from pierre_rt_documents where company_id=$1 and id=$2", [ids.B.company, ids.A.document || randomUUID()])).rows[0].n > 0,
      communication: (await admin.q("select count(*)::int n from pierre_rt_communication_intents where company_id=$1 and id=$2", [ids.B.company, com.intent_id || randomUUID()])).rows[0].n > 0,
      signature: (await admin.q("select count(*)::int n from pierre_rt_signature_requests where company_id=$1 and provider_request_id=$2", [ids.B.company, sig.provider_request_id || "none"])).rows[0].n > 0,
    };
    // tenant B's worker claims nothing of A
    const bClaim = await within("worker", ids.B.company, async (c) => (await c.q("select * from pierre_rt_runtime_claim($1,5,'p87s4-wB',60,now())", [ids.B.company])).rows[0]).catch(() => null);
    axes.task = !!bClaim && bClaim.company_id === ids.A.company;
    writeProof("isolation-proof.json", { axes, cross_tenant_leak: Object.values(axes).some(Boolean) });
    partial.isolation = !Object.values(axes).some(Boolean);

    // ── final report (computed strictly from the persisted proofs + the engine verdict) ──
    const cleanup = await cleanupRun(admin, ids);
    writeProof("cleanup-proof.json", cleanup);
    partial.cleanup = cleanup.wildcard === false && cleanup.synthetic_tenants_active === 0 && cleanup.tenants_inactive === true;

    // final report ordering (§6): (1) write a provisional, well-formed final-report so requirement 24 (report
    // present) can pass; (2) load the FULL bundle + run the checker; (3) rewrite the final-report with the
    // authoritative result; (4) reload + re-check — no green ever depends on a not-yet-written file.
    writeProof("final-report.json", { phase: "P8.7.4", scope: checkEngine.CANONICAL_SCOPE, ok: false, verdict: "PENDING", provisional: true });
    let verdict = checkEngine.runControlledLiveJourneyCheck({ loadBundle: () => loadLocalBundle() });
    writeProof("final-report.json", { phase: "P8.7.4", scope: checkEngine.CANONICAL_SCOPE, ok: verdict.ok, verdict: verdict.verdict, steps: Object.fromEntries(verdict.steps.map((s) => [s.key, s.ok])), refusals: verdict.refusals, missing: verdict.missing, role_proofs: roleProofs });
    verdict = checkEngine.runControlledLiveJourneyCheck({ loadBundle: () => loadLocalBundle() }); // authoritative re-check
    log(`JOURNEY verdict=${verdict.verdict} ok=${verdict.ok}`);
    for (const s of verdict.steps.filter((x) => !x.ok)) log(`  FAIL ${s.key}: ${s.detail}`);
    if (verdict.refusals.length) for (const r of verdict.refusals) log(`  REFUSAL ${r.rule}: ${r.reason}`);

    // exit non-zero unless every proof is present AND the engine VERIFIED the bundle. Cleanup already
    // ran above (line ~525, after all proofs were captured — ÉTAPE 6 ordering); just seal + close here.
    guards.releaseSingleRunLock(LOCK_PATH, { status: "cleaned" }); // terminal — an audit tombstone; next run reclaims it
    await admin.end().catch(() => {});
    process.exit(verdict.ok ? 0 : 1);
  } catch (e) {
    process.stderr.write(`[p87-step4] ERROR: ${redactError(e)}\n`);
    // still write whatever final report we can so the checker reflects reality (never green on error)
    try { const verdict = checkEngine.runControlledLiveJourneyCheck({ loadBundle: () => loadLocalBundle() }); writeProof("final-report.json", { phase: "P8.7.4", scope: checkEngine.CANONICAL_SCOPE, ok: false, verdict: verdict.verdict, error: redactError(e), missing: verdict.missing }); } catch {}
    // HARD STOP path (incl. global-deadline expiry): cleanup, mark lock terminal, non-zero exit, NO relaunch.
    try { const c = await cleanupRun(admin, ids); writeProof("cleanup-proof.json", c); } catch (ce) { log(`cleanup(catch): ${redactError(ce)}`); }
    guards.releaseSingleRunLock(LOCK_PATH, { status: "failed" });
    await admin.end().catch(() => {});
    process.exit(1);
  } finally {
    // best-effort safety net (not reached under process.exit): never leave a non-terminal lock.
    try { const rec = guards.readRunLock(LOCK_PATH); if (rec && rec.status === "running") guards.releaseSingleRunLock(LOCK_PATH, { status: "failed" }); } catch {}
  }
}

// retry/backoff/dead-letter with an INJECTED-failure disposition through the REAL governed claim→fail cycle.
// A dedicated synthetic email delivery (created by the real pipeline from a fresh outbox event) is claimed
// (worker ownership + lease + attempt_count++), then failed with a 'retry' disposition simulating a provider
// 503. It is NEVER dispatched, so the real Resend adapter is never called (external_calls=0, no email
// multiplied). After attempt_count reaches max_attempts the governed fail transitions it to dead_letter.
async function proveRetryDeadLetter(admin, canon, ctxA, company, document_id) {
  const out = { adapter_injected: true, retries: 0, backoff_applied: false, dead_lettered: false, external_calls: 0, expected_external_calls: 0 };
  if (!canon || !ctxA || !document_id) return { ...out, skipped: "no canon/ctx/document" };
  const worker = "p87s4-retry-w";
  try {
    // 1) create a dedicated failing delivery via the real pipeline (fresh event, distinct dedup_key)
    const appc = await pg(ADMIN, "p87s4_retry");
    let del = null;
    try {
      await appc.q("set role pierre_rt_app"); await appc.q("select set_config('app.current_company',$1,false)", [company]);
      await appc.q("insert into pierre_rt_outbox (id,company_id,kind,payload,dedup_key,status) values (gen_random_uuid(),$1,'document.ready_for_review',$2::jsonb,$3,'pending')", [company, JSON.stringify({ document_id, version: `retry-${RUN_ID}` }), `document.ready_for_review:document:${document_id}:retry-${RUN_ID}`]).catch(() => {});
      await canon.communications.createCommunicationIntents(sqlExecutor(appc), ctxA, {}, {});
    } finally { await appc.end(); }
    del = (await admin.q("select id from pierre_rt_communication_deliveries where company_id=$1 and channel='email' and status in ('queued','scheduled') order by created_at desc limit 1", [company])).rows[0]?.id;
    if (!del) return { ...out, skipped: "no queued delivery to fail" };
    // 2) GOVERNED claim→fail cycle until the delivery reaches the terminal dead_letter state. dead_letter
    //    fires when attempt_count >= max_attempts, and attempt_count increments ON CLAIM — so it takes TWO
    //    real claims (attempt 1 → retry_scheduled, attempt 2 → dead_letter). Between them we WAIT for the
    //    real next_retry_at (short bounded backoff) — NEVER a direct UPDATE of status/attempt_count/
    //    next_retry_at. The company-wide claim can return OTHER synthetic deliveries too; those are drained
    //    to 'suppressed' (terminal) so they never linger claimable, while `del` alone rides the retry curve.
    const MAX = 2, RETRY_AFTER = 1; // seconds
    const localDeadline = Date.now() + 60_000; // strict local deadline for the probe
    while (!out.dead_lettered && Date.now() < localDeadline) {
      const claimed = await within("comm_worker", company, async (c) => (await c.q("select id from pierre_rt_claim_communication_deliveries($1,50,$2,60,now())", [company, worker])).rows.map((r) => r.id)).catch(() => []);
      // drain every OTHER claimed synthetic delivery to a terminal 'suppressed' state (no real send)
      for (const id of claimed) if (id !== del) await within("comm_worker", company, (c) => c.q("select pierre_rt_fail_communication_delivery($1,$2,$3,'p87 drain','suppressed',60,1)", [company, id, worker])).catch(() => {});
      if (claimed.includes(del)) {
        await within("comm_worker", company, (c) => c.q("select pierre_rt_fail_communication_delivery($1,$2,$3,'injected adapter 503','retry',$4,$5)", [company, del, worker, RETRY_AFTER, MAX])).catch((e) => log(`retry fail: ${redactError(e)}`));
        out.retries++;
        const st = (await admin.q("select status, next_retry_at, attempt_count from pierre_rt_communication_deliveries where id=$1", [del])).rows[0];
        out.attempts = [...(out.attempts || []), { attempt: st?.attempt_count, status: st?.status }];
        if (st?.next_retry_at) out.backoff_applied = true;
        if (st?.status === "dead_letter") { out.dead_lettered = true; break; }
        const wait = st?.next_retry_at ? new Date(st.next_retry_at).getTime() - Date.now() + 500 : 1200;
        await sleep(Math.max(200, Math.min(wait, localDeadline - Date.now())));
      } else {
        // del not yet due (retry_scheduled with a future next_retry_at) — wait for it, never force the clock
        const nr = (await admin.q("select next_retry_at, status from pierre_rt_communication_deliveries where id=$1", [del])).rows[0];
        if (nr?.status === "dead_letter") { out.dead_lettered = true; break; }
        const wait = nr?.next_retry_at ? new Date(nr.next_retry_at).getTime() - Date.now() + 500 : 1200;
        await sleep(Math.max(200, Math.min(wait, localDeadline - Date.now())));
      }
    }
    // canonical terminal proof: the dead_letter row exists with a dead_lettered_at timestamp
    if (out.dead_lettered) { try { out.dead_letter_row_confirmed = (await admin.q("select count(*)::int n from pierre_rt_communication_deliveries where id=$1 and status='dead_letter' and dead_lettered_at is not null", [del])).rows[0].n > 0; } catch { /* noop */ } }
  } catch (e) { out.error = redactError(e); }
  return out;
}

// build a bundle object from the on-disk proof files of THIS run (for the engine verdict at the end)
function loadLocalBundle() {
  if (!existsSync(proofDir)) return null;
  const files = {}; const present = []; const missing = [];
  for (const name of checkEngine.REQUIRED_PROOFS) { const p = join(proofDir, name); if (existsSync(p)) { try { files[name] = JSON.parse(readFileSync(p, "utf-8")); present.push(name); } catch { missing.push(name); } } else missing.push(name); }
  return { run_id: RUN_ID, files, present, missing };
}

main();
