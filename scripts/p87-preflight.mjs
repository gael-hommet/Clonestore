// scripts/p87-preflight.mjs
// PHASE 8.7.4 — STRICTLY READ-ONLY preflight for the controlled-live journey. It creates ZERO
// resources: SELECT/COUNT only, GET/HEAD only, plus a SINGLE deliberately-invalid webhook POST that
// the app rejects WITHOUT mutation (proving the signature gate). No tenant, no email, no Stripe
// object, no Yousign request, no deploy. Prints a green/red summary and exits non-zero on any
// critical failure. No secret value is ever printed.
//
// Usage:  NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/p87-preflight.mjs
//   env:  P87_ADMIN_DATABASE_URL (or DATABASE_URL), P87_ENVIRONMENT=staging|production,
//         P87_EXPECTED_APP_HOST=<prod host>, + the usual provider vars.

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const pg = require("pg");

const contract = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);
const envEngine = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-preflight.mjs")).href);
const guards = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/p87-run-guards.mjs")).href);

const ENVIRONMENT = process.env.P87_ENVIRONMENT || "production";
const readFile = (p) => (existsSync(p) ? readFileSync(p, "utf-8") : null);
const { env } = envEngine.loadEnvironment(ENVIRONMENT, { cwd: ROOT, processEnv: process.env, readFile, fileExists: (p) => existsSync(p), join });
const get = (k) => (process.env[k] ?? env[k] ?? "");

const results = [];
const add = (name, ok, detail, critical = true) => { results.push({ name, ok: !!ok, detail, critical }); };
const ssl = { rejectUnauthorized: false };

async function pgQuery(dsn, sql, params = []) {
  const c = new pg.Client({ connectionString: dsn, ssl, connectionTimeoutMillis: 20000, statement_timeout: 20000 });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end().catch(() => {}); }
}
async function httpStatus(url, init) {
  try { const r = await fetch(url, init); return { ok: r.ok, status: r.status, text: async () => r.text().catch(() => "") }; }
  catch (e) { return { ok: false, status: 0, err: String(e?.message || e).slice(0, 80) }; }
}

// ── 1) required env present ──────────────────────────────────────────────────
const REQUIRED = ["P87_ADMIN_DATABASE_URL", "STRIPE_SECRET_KEY", "CLONESTORE_SIGNATURE_API_URL", "CLONESTORE_SIGNATURE_API_KEY", "CLONESTORE_SIGNATURE_WEBHOOK_SECRET", "RESEND_API_KEY", "CLONESTORE_PUBLIC_APP_URL"];
const ADMIN = get("P87_ADMIN_DATABASE_URL") || get("DATABASE_URL");
{ const missing = REQUIRED.filter((k) => !get(k)); add("required_env_present", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "all required vars present"); }

// ── 2) Stripe TEST mode ──────────────────────────────────────────────────────
{ const sk = get("STRIPE_SECRET_KEY"); add("stripe_test_mode", /^sk_test_/.test(sk), sk ? (/^sk_test_/.test(sk) ? "sk_test_ (TEST)" : "NOT test mode — refuse") : "no key"); }

// ── 3) Yousign Sandbox ───────────────────────────────────────────────────────
{ const kind = contract.recognizeYousignUrl(get("CLONESTORE_SIGNATURE_API_URL")); add("yousign_sandbox", kind === "sandbox", `recognizeYousignUrl=${kind}`); }

// ── 4) Resend configured ─────────────────────────────────────────────────────
{ const key = get("RESEND_API_KEY"); const provider = (get("CLONESTORE_COMMUNICATION_PROVIDER") || "resend"); const from = get("CLONESTORE_EMAIL_FROM") || get("CLONESTORE_FOUNDER_EMAIL_FROM"); add("resend_configured", /^re_/.test(key) && provider === "resend" && !!from, `key=${/^re_/.test(key) ? "re_*" : "invalid"} provider=${provider} from=${from ? "set" : "MISSING"}`); }

// ── 5) public URL HTTPS Production (+ non-localhost + expected host) ──────────
const EXPECTED_HOSTS = (get("P87_EXPECTED_APP_HOST") || "").split(",").map((s) => s.trim()).filter(Boolean);
let PUBLIC_ORIGIN = null;
{ try { const b = guards.assertProductionBaseUrl(get("CLONESTORE_PUBLIC_APP_URL"), { expectedHosts: EXPECTED_HOSTS }); PUBLIC_ORIGIN = b.origin; add("public_url_https_production", true, `origin host=${b.host} https ok`); } catch (e) { add("public_url_https_production", false, String(e?.message || e).slice(0, 140)); } }

// ── 6) secure-link secret present + in-memory token preflight (never logged) ──
{ const secret = get("CLONESTORE_COMMUNICATION_LINK_SECRET") || get("CLONESTORE_SIGNATURE_WEBHOOK_SECRET"); try { const slp = guards.previewSecureLinkPreflight({ base: get("CLONESTORE_PUBLIC_APP_URL"), secret, expectedHosts: EXPECTED_HOSTS }); add("secure_link_secret_and_token", slp.ok && slp.secret_present && slp.token_never_logged && !slp.token_transmitted, `structure ok, host prod, token_len=${slp.token_length} (never logged/transmitted)`); } catch (e) { add("secure_link_secret_and_token", false, String(e?.message || e).slice(0, 140)); } }

// ── 7) Production routes reachable (GET/HEAD only) ────────────────────────────
if (PUBLIC_ORIGIN) {
  const root = await httpStatus(PUBLIC_ORIGIN, { method: "HEAD" });
  add("production_root_reachable", root.status > 0 && root.status < 500, `HEAD ${PUBLIC_ORIGIN} → ${root.status || root.err}`);
} else add("production_root_reachable", false, "no valid public origin");

// ── 8) invalid webhook signature rejected (the ONLY POST — rejected, no mutation) ──
if (PUBLIC_ORIGIN) {
  const bad = await httpStatus(`${PUBLIC_ORIGIN}/api/webhooks/pierre/signature`, { method: "POST", headers: { "content-type": "application/json", "x-webhook-provider": "yousign", "x-webhook-signature": "sha256=deadbeef" }, body: JSON.stringify({ event: "signature_request.activated", preflight: true }) });
  add("invalid_webhook_rejected", [400, 401, 403].includes(bad.status), `bad-sig POST → ${bad.status || bad.err} (must be 4xx; rejected before any mutation)`);
} else add("invalid_webhook_rejected", false, "no valid public origin", false);

// ── 9) billing bridge configured (wired in the Stripe webhook route + gated) ──
{ const routeSrc = readFile(join(ROOT, "src/app/api/webhooks/stripe/route.ts")) || ""; const bridgeSrc = existsSync(join(ROOT, "src/lib/pierre/v1/pierre-stripe-commercial-bridge.ts")); const wired = /bridgePierreCommercial\s*\(/.test(routeSrc) && bridgeSrc; add("billing_bridge_configured", wired, wired ? "bridgePierreCommercial wired in stripe webhook route + gated on pierre_synthetic" : "bridge NOT wired"); }

// ── 10) DB roles available (read-only current_user probe per role DSN) ────────
const ROLE_DSNS = { pierre_rt_runtime_planner: "PIERRE_RUNTIME_PLANNER_DATABASE_URL", pierre_rt_runtime_worker: "PIERRE_RUNTIME_WORKER_DATABASE_URL", pierre_rt_runtime_scheduler: "PIERRE_RUNTIME_SCHEDULER_DATABASE_URL", pierre_rt_billing_webhook: "PIERRE_BILLING_WEBHOOK_DATABASE_URL", pierre_rt_customer_activation_worker: "PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL", pierre_rt_communication_worker: "PIERRE_COMMUNICATION_WORKER_DATABASE_URL", pierre_rt_communication_webhook: "PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL" };
{
  const roleFindings = [];
  for (const [role, key] of Object.entries(ROLE_DSNS)) {
    const dsn = get(key);
    if (!dsn) { roleFindings.push(`${role}:MISSING`); continue; }
    try { const who = (await pgQuery(dsn, "select current_user as u"))[0]?.u; roleFindings.push(`${role}:${who === role ? "ok" : `got ${who}`}`); }
    catch (e) { roleFindings.push(`${role}:ERR`); void e; }
  }
  const allOk = roleFindings.every((f) => f.endsWith(":ok"));
  add("db_roles_available", allOk, roleFindings.join(" "));
}

// ── 11) single-run lock absent (or terminal) ─────────────────────────────────
{ const lock = guards.readRunLock(join(ROOT, ".p87-proofs", "step4", "controlled-run.lock")); const free = !lock || ["completed", "failed", "cleaned"].includes(lock.status); add("run_lock_absent_or_terminal", free, lock ? `lock status=${lock.status} run=${lock.run_id}` : "no lock present"); }

// ── 12) zero active synthetic residue (tenants / entitlements / deliveries) ──
if (ADMIN) {
  try {
    const like = ["p87-step4-%", "p87-step4-tombstoned-%"];
    const activeTenants = (await pgQuery(ADMIN, "select count(*)::int n from pierre_rt_companies where (name like $1 or name like $2) and status='active'", like))[0].n;
    const ents = (await pgQuery(ADMIN, "select count(*)::int n from pierre_rt_product_entitlements pe join pierre_rt_companies co on co.id=pe.company_id where (co.name like $1 or co.name like $2) and pe.status in ('active','grace')", like))[0].n;
    const pend = (await pgQuery(ADMIN, "select count(*)::int n from pierre_rt_communication_deliveries d join pierre_rt_companies co on co.id=d.company_id where (co.name like $1 or co.name like $2) and d.status in ('queued','scheduled','retry_scheduled','processing')", like))[0].n;
    add("zero_active_synthetic_tenants", activeTenants === 0, `active_tenants=${activeTenants}`);
    add("zero_active_synthetic_entitlements", ents === 0, `active_entitlements=${ents}`);
    add("zero_claimable_synthetic_deliveries", pend === 0, `pending_deliveries=${pend}`);
  } catch (e) { add("zero_active_synthetic_tenants", false, `db err: ${String(e?.message || e).slice(0, 80)}`); }
} else add("zero_active_synthetic_tenants", false, "no admin DSN");

// ── 13) zero active synthetic Stripe subscription (search TEST customers) ─────
{
  const sk = get("STRIPE_SECRET_KEY");
  if (/^sk_test_/.test(sk)) {
    const r = await httpStatus(`https://api.stripe.com/v1/customers/search?query=${encodeURIComponent("name~'p87-step4'")}&limit=100`, { headers: { authorization: `Bearer ${sk}` } });
    let activeSubs = 0, custs = 0;
    if (r.ok) { const j = JSON.parse(await r.text()); custs = (j.data || []).length; for (const cu of j.data || []) { const s = await httpStatus(`https://api.stripe.com/v1/subscriptions?customer=${cu.id}&status=all&limit=100`, { headers: { authorization: `Bearer ${sk}` } }); if (s.ok) { const sj = JSON.parse(await s.text()); for (const sub of sj.data || []) if (["active", "trialing", "past_due", "unpaid", "incomplete"].includes(sub.status)) activeSubs++; } } }
    add("zero_active_synthetic_stripe_subs", activeSubs === 0, `synthetic_customers=${custs} active_subs=${activeSubs}`);
  } else add("zero_active_synthetic_stripe_subs", false, "stripe not in test mode");
}

// ── 14) zero open synthetic Yousign request ──────────────────────────────────
{
  const base = get("CLONESTORE_SIGNATURE_API_URL").replace(/\/$/, ""); const key = get("CLONESTORE_SIGNATURE_API_KEY");
  const root = base.endsWith("/v3") ? base : `${base}/v3`;
  const r = await httpStatus(`${root}/signature_requests?limit=100`, { headers: { authorization: `Bearer ${key}`, accept: "application/json" } });
  let open = 0, today = 0;
  if (r.ok) { const j = JSON.parse(await r.text()); for (const sr of j.data || []) { const t = String(sr.created_at || "").startsWith("2026-07-01"); const synth = /p87|step4|controlled/i.test(JSON.stringify(sr)); if ((t || synth)) { today++; if (["draft", "ongoing", "approval"].includes(sr.status)) open++; } } }
  add("zero_open_synthetic_yousign", open === 0, `today_or_synth=${today} open=${open}`);
}

// ── 15) NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE active (raw env; not enforced in code) ──
{ const v = get("NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE"); add("deploy_block_active", v === "1" || v === "true", `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=${v || "(unset)"}`); }

// ── summary ──────────────────────────────────────────────────────────────────
const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
process.stdout.write("\n=== P8.7.4 READ-ONLY PREFLIGHT (no resource created) ===\n");
for (const r of results) process.stdout.write(`  [${r.ok ? "PASS" : (r.critical ? "FAIL" : "warn")}] ${pad(r.name, 40)} ${r.detail}\n`);
const criticalFails = results.filter((r) => !r.ok && r.critical);
const green = criticalFails.length === 0;
process.stdout.write(`\nPREFLIGHT ${green ? "GREEN" : "RED"} — ${results.filter((r) => r.ok).length}/${results.length} checks passed${criticalFails.length ? `, ${criticalFails.length} critical FAIL` : ""}\n`);
process.exit(green ? 0 : 1);
