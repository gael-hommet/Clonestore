// src/lib/pierre/v1/live-infrastructure-preflight.mjs
// PHASE 8.7.1 (hardened) — the dependency-injectable live-infrastructure preflight ENGINE. All external
// access goes through injected deps (httpGet, pgConnect, dnsResolveTxt, routeExists, env) so tests simulate
// every real outcome (wrong role, superuser, bypassrls, missing function, auth refused, missing migration,
// invalid key, wrong price, missing webhook, unverified domain, missing DMARC, unknown Yousign URL, public
// bucket, …) WITHOUT a real account. The CLI wires the real deps. Fail-closed; non-destructive (read-only
// GET/HEAD + read-only rolled-back catalog queries; no SET ROLE; no mutation). Never logs a value.

import {
  requireEnv, resolveValue, specByName, classifyEnv, redactError, classifyPgError,
  recognizeYousignUrl, ROLE_PERMISSION_MATRIX, FORBIDDEN_ROLE_ATTRS, FORBIDDEN_DIRECT_SELECT,
  EXPECTED_PIERRE_PRICE_AMOUNT, EXPECTED_PIERRE_CURRENCY, WEBHOOK_PATHS,
  STRIPE_REQUIRED_WEBHOOK_EVENTS, RESEND_REQUIRED_WEBHOOK_EVENTS,
  LEGACY_CHECK_MAP, evaluateOptIn, envFileOrder,
} from "./live-infrastructure-contract.mjs";

// derive the absolute webhook URL the provider must point at, from the public app URL.
function webhookUrl(publicUrl, domain) { return `${String(publicUrl).replace(/\/$/, "")}${WEBHOOK_PATHS[domain]}`; }
// the webhook route must be present in the BUILD (src-only is a blocker, not a pass).
function webhookRouteBlocker(deps, domain) {
  const s = deps.webhookRoute(domain);
  if (s === "build") return null;
  if (s === "src_only") return `${domain} webhook route present in src but NOT compiled into the build`;
  return `${domain} webhook route absent from the build`;
}

const SEVERITY = { READY_LIVE: 0, READY_SANDBOX: 1, NOT_IMPLEMENTED: 2, BLOCKED_NETWORK: 3, BLOCKED_PERMISSION: 4, BLOCKED_MISSING_ACCOUNT: 5, BLOCKED_CONFIGURATION: 6, BLOCKED_MISSING_SECRET: 7 };
const worst = (s) => (!s.length ? "BLOCKED_CONFIGURATION" : s.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a)));
const isReady = (s) => s === "READY_LIVE" || s === "READY_SANDBOX";

// ── env loader (explicit ordered files; process.env wins; injectable fs; never prints values) ──
const parseDotenv = (text) => {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.replace(/^export\s+/, "").match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
};
/** Load env files for an environment with the contract's priority; process.env ALWAYS wins. */
export function loadEnvironment(environment, deps = {}) {
  const cwd = deps.cwd || process.cwd();
  const processEnv = deps.processEnv || process.env;
  const readFile = deps.readFile; // (path) => string | null
  const fileExists = deps.fileExists; // (path) => boolean
  const join = deps.join || ((a, b) => `${a.replace(/[\\/]$/, "")}/${b}`);
  const merged = {};
  const loadedFiles = [];
  for (const f of envFileOrder(environment)) {
    const p = join(cwd, f);
    if (fileExists && !fileExists(p)) continue;
    let text = null;
    try { text = readFile ? readFile(p) : null; } catch { text = null; }
    if (text == null) continue;
    loadedFiles.push(f);
    const parsed = parseDotenv(text);
    for (const [k, v] of Object.entries(parsed)) if (processEnv[k] === undefined) merged[k] = v; // file fills only gaps vs process.env
  }
  const env = { ...merged };
  for (const [k, v] of Object.entries(processEnv)) if (v !== undefined) env[k] = v; // process.env overrides everything
  // source map: where the EFFECTIVE value came from (no values)
  const sourceMap = {};
  for (const k of Object.keys(env)) sourceMap[k] = processEnv[k] !== undefined ? "process" : "env_file";
  return { env, loadedFiles, sourceMap };
}

// ── probe helpers ──────────────────────────────────────────────────────────────────────────────
function chk(env, name, status, detail) {
  const spec = specByName(name);
  const presence = spec ? classifyEnv(spec, env, true) : (env[name] ? "PRESENT" : "MISSING");
  return { name, presence, status, ...(detail ? { detail } : {}) };
}
/** gate a set of required vars; returns the first blocking {status,reason} or null. */
function gateRequired(env, names) {
  for (const n of names) { const r = requireEnv(n, env); if (!r.ok) return { status: r.presence === "MISSING" ? "BLOCKED_MISSING_SECRET" : "BLOCKED_CONFIGURATION", reason: r.reason }; }
  return null;
}

// ── DB role probe: DIRECT connect (no SET ROLE), full least-privilege matrix ───────────────────
async function probeRoleDsn(deps, dsn, role) {
  const matrix = ROLE_PERMISSION_MATRIX[role] || { mustExecute: [] };
  let client;
  try { client = await deps.pgConnect(dsn); } catch (e) { return { status: classifyPgError(e), detail: redactError(e) }; }
  try {
    await client.query("begin read only");
    const cu = (await client.query("select current_user as u")).rows[0].u;
    if (cu !== role) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `DSN binds '${cu}', expected least-privilege role '${role}'` }; }
    const attr = (await client.query("select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication from pg_roles where rolname = current_user")).rows[0] || {};
    for (const a of FORBIDDEN_ROLE_ATTRS) if (attr[a]) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `${role} has forbidden attribute ${a}` }; }
    for (const t of FORBIDDEN_DIRECT_SELECT) {
      const can = (await client.query("select has_table_privilege(current_user, $1, 'SELECT') as c", [t])).rows[0].c;
      if (can) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `${role} has direct SELECT on ${t} (excess privilege)` }; }
    }
    for (const fn of matrix.mustExecute) {
      const row = (await client.query("select p.oid, has_function_privilege(current_user, p.oid, 'EXECUTE') as c from pg_proc p where p.proname = $1 limit 1", [fn])).rows[0];
      if (!row) { await client.query("rollback"); return { status: "BLOCKED_CONFIGURATION", detail: `governed function ${fn} absent` }; }
      if (!row.c) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `${role} lacks EXECUTE on ${fn}` }; }
    }
    await client.query("rollback");
    return { status: "READY_LIVE", detail: `${role}: least-privilege verified (no superuser/bypassrls/createrole; required functions executable; business tables refused)` };
  } catch (e) { try { await client.query("rollback"); } catch { /* */ } return { status: classifyPgError(e), detail: redactError(e) }; }
  finally { try { await client.end(); } catch { /* */ } }
}

// ── domains ──────────────────────────────────────────────────────────────────────────────────
async function evalDatabase(deps) {
  const env = deps.env;
  const names = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const checks = names.map((n) => chk(env, n));
  const gate = gateRequired(env, names); if (gate) return { status: gate.status, checks, blocker: gate.reason };
  if (!deps.probe) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "probe disabled" };
  // 1) DB connection + TLS + catalog
  let client;
  try { client = await deps.pgConnect(resolveValue(specByName("DATABASE_URL"), env)); }
  catch (e) { checks.push({ name: "db.connect", status: classifyPgError(e), detail: redactError(e) }); return { status: classifyPgError(e), checks, blocker: redactError(e) }; }
  let dbStatus;
  try {
    await client.query("begin read only");
    const meta = (await client.query("select current_database() as d, current_user as u, version() as v")).rows[0];
    const ssl = (await client.query("select coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as ssl")).rows[0].ssl;
    const v28 = (await client.query("select to_regclass('public.pierre_rt_product_entitlements') as t")).rows[0].t;
    const fns = (await client.query("select count(*)::int n from pg_proc where proname in ('pierre_rt_apply_commercial_event','pierre_rt_ingest_commercial_event','pierre_rt_create_internal_message')")).rows[0].n;
    const roles = (await client.query("select count(*)::int n from pg_roles where rolname like 'pierre_rt_%'")).rows[0].n;
    await client.query("rollback");
    if (!ssl) dbStatus = { status: "BLOCKED_CONFIGURATION", detail: "TLS not active on the DB connection (pg_stat_ssl.ssl=false)" };
    else if (!v28) dbStatus = { status: "BLOCKED_CONFIGURATION", detail: "v28 table absent (migrations not applied)" };
    else if (fns < 1) dbStatus = { status: "BLOCKED_CONFIGURATION", detail: "governed functions absent" };
    else if (roles < 6) dbStatus = { status: "BLOCKED_CONFIGURATION", detail: `only ${roles} pierre_rt_* roles present` };
    else dbStatus = { status: "READY_LIVE", detail: `db=${meta.d}; user=${meta.u}; TLS on; v28 present; ${roles} roles` };
  } catch (e) { try { await client.query("rollback"); } catch { /* */ } dbStatus = { status: classifyPgError(e), detail: redactError(e) }; }
  finally { try { await client.end(); } catch { /* */ } }
  checks.push({ name: "db.connect+tls+catalog", status: dbStatus.status, detail: dbStatus.detail });
  if (dbStatus.status !== "READY_LIVE") return { status: dbStatus.status, checks, blocker: dbStatus.detail };
  // 2) service-role authenticates (read-only Supabase REST root)
  const url = String(resolveValue(specByName("NEXT_PUBLIC_SUPABASE_URL"), env)).replace(/\/$/, "");
  const key = resolveValue(specByName("SUPABASE_SERVICE_ROLE_KEY"), env);
  let sr;
  try {
    // PostgREST root returns 200 for an authenticated service-role key. 404 is NOT treated as success.
    const r = await deps.httpGet(`${url}/rest/v1/`, { apikey: key, authorization: `Bearer ${key}` });
    if (r.status === 200) sr = { status: "READY_LIVE", detail: "service-role authenticated (read-only REST root, http 200)" };
    else if (r.status === 401 || r.status === 403) sr = { status: "BLOCKED_PERMISSION", detail: "service-role key rejected by Supabase" };
    else if (r.status === 404) sr = { status: "BLOCKED_CONFIGURATION", detail: "Supabase REST root unexpectedly 404 (project/URL misconfigured)" };
    else sr = { status: "BLOCKED_CONFIGURATION", detail: `Supabase REST http ${r.status}` };
  } catch (e) { sr = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "supabase.service_role", status: sr.status, detail: sr.detail });
  return { status: sr.status, checks, blocker: isReady(sr.status) ? null : sr.detail };
}

async function evalRuntime(deps) {
  const env = deps.env;
  const dsns = [
    ["PIERRE_RUNTIME_WORKER_DATABASE_URL", "pierre_rt_runtime_worker"],
    ["PIERRE_RUNTIME_SCHEDULER_DATABASE_URL", "pierre_rt_runtime_scheduler"],
    ["PIERRE_RUNTIME_PLANNER_DATABASE_URL", "pierre_rt_runtime_planner"],
    ["PIERRE_COMMUNICATION_WORKER_DATABASE_URL", "pierre_rt_communication_worker"],
    ["PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL", "pierre_rt_communication_webhook"],
  ];
  const checks = [chk(env, "PIERRE_RUNTIME_SYSTEM_SECRET"), ...dsns.map(([n]) => chk(env, n))];
  const statuses = [];
  const sysSecret = requireEnv("PIERRE_RUNTIME_SYSTEM_SECRET", env);
  if (!sysSecret.ok) statuses.push(sysSecret.presence === "MISSING" ? "BLOCKED_MISSING_SECRET" : "BLOCKED_CONFIGURATION");
  for (const [n, role] of dsns) {
    const r = requireEnv(n, env);
    if (!r.ok) { statuses.push(r.presence === "MISSING" ? "BLOCKED_MISSING_SECRET" : "BLOCKED_CONFIGURATION"); continue; }
    if (!deps.probe) { statuses.push("BLOCKED_CONFIGURATION"); continue; }
    const pr = await probeRoleDsn(deps, resolveValue(specByName(n), env), role);
    checks.push({ name: `role:${role}`, status: pr.status, detail: pr.detail });
    statuses.push(pr.status);
  }
  const status = worst(statuses);
  return { status, checks, blocker: isReady(status) ? null : "runtime role DSN(s)/system-secret missing or unverified" };
}

async function evalBilling(deps) {
  const env = deps.env;
  const names = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PRICE_ID", "PIERRE_HANDOFF_TOKEN_SECRET", "PIERRE_BILLING_WEBHOOK_DATABASE_URL", "PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL"];
  const checks = names.map((n) => chk(env, n));
  const gate = gateRequired(env, names); if (gate) return { status: gate.status, checks, blocker: gate.reason };
  const routeBlock = webhookRouteBlocker(deps, "billing"); if (routeBlock) return { status: "BLOCKED_CONFIGURATION", checks, blocker: routeBlock };
  const publicUrl = resolveValue(specByName("NEXT_PUBLIC_APP_URL"), env) || resolveValue(specByName("CLONESTORE_PUBLIC_APP_URL"), env);
  if (!publicUrl || !/^https:\/\//.test(String(publicUrl))) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "no HTTPS public URL to derive the Stripe webhook URL" };
  const sk = resolveValue(specByName("STRIPE_SECRET_KEY"), env); const pk = resolveValue(specByName("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"), env);
  if (/^sk_live_/.test(sk) !== /^pk_live_/.test(pk)) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "Stripe secret/publishable key modes inconsistent (one live, one test)" };
  if (!deps.probe) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "probe disabled" };
  // real, read-only price read
  let price;
  try {
    const r = await deps.httpGet(`https://api.stripe.com/v1/prices/${encodeURIComponent(resolveValue(specByName("NEXT_PUBLIC_STRIPE_PRICE_ID"), env))}?expand[]=product`, { authorization: `Bearer ${sk}` });
    if (r.status === 401 || r.status === 403) price = { status: "BLOCKED_PERMISSION", detail: "Stripe rejected the key" };
    else if (r.status === 404) price = { status: "BLOCKED_MISSING_ACCOUNT", detail: "configured price not found" };
    else if (!r.ok) price = { status: "BLOCKED_CONFIGURATION", detail: `Stripe http ${r.status}` };
    else {
      const b = r.body || {};
      const monthly = b.recurring && b.recurring.interval === "month" && (b.recurring.interval_count ?? 1) === 1;
      if (b.unit_amount !== EXPECTED_PIERRE_PRICE_AMOUNT || b.currency !== EXPECTED_PIERRE_CURRENCY) price = { status: "BLOCKED_CONFIGURATION", detail: `price mismatch (expected ${EXPECTED_PIERRE_PRICE_AMOUNT} ${EXPECTED_PIERRE_CURRENCY})` };
      else if (b.active !== true || !(b.product && b.product.active === true)) price = { status: "BLOCKED_CONFIGURATION", detail: "price/product not active" };
      else if (!monthly) price = { status: "BLOCKED_CONFIGURATION", detail: "price is not a monthly recurring subscription" };
      else price = { status: /^sk_live_/.test(sk) ? "READY_LIVE" : "READY_SANDBOX", detail: `price ${EXPECTED_PIERRE_PRICE_AMOUNT} ${EXPECTED_PIERRE_CURRENCY} monthly active; product active` };
    }
  } catch (e) { price = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "stripe.price", status: price.status, detail: price.detail });
  const statuses = [price.status];
  for (const [n, role] of [["PIERRE_BILLING_WEBHOOK_DATABASE_URL", "pierre_rt_billing_webhook"], ["PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL", "pierre_rt_customer_activation_worker"]]) {
    const pr = await probeRoleDsn(deps, resolveValue(specByName(n), env), role); checks.push({ name: `role:${role}`, status: pr.status, detail: pr.detail }); statuses.push(pr.status);
  }
  // a registered, enabled Stripe webhook endpoint pointing at the exact URL + covering the required events
  const expectedUrl = webhookUrl(publicUrl, "billing");
  let wh;
  try {
    const r = await deps.httpGet("https://api.stripe.com/v1/webhook_endpoints?limit=100", { authorization: `Bearer ${sk}` });
    if (r.status === 401 || r.status === 403) wh = { status: "BLOCKED_PERMISSION", detail: "Stripe rejected the key (webhook read)" };
    else if (!r.ok) wh = { status: "BLOCKED_CONFIGURATION", detail: `Stripe webhook read http ${r.status}` };
    else {
      const eps = Array.isArray(r.body?.data) ? r.body.data : [];
      const ep = eps.find((e) => String(e.url).replace(/\/$/, "") === expectedUrl && e.status === "enabled");
      if (!ep) wh = { status: "BLOCKED_CONFIGURATION", detail: `no enabled Stripe webhook endpoint at ${expectedUrl}` };
      else {
        const subscribed = new Set(ep.enabled_events || []);
        const covered = subscribed.has("*") || STRIPE_REQUIRED_WEBHOOK_EVENTS.every((ev) => subscribed.has(ev));
        wh = covered ? { status: "READY_LIVE", detail: "webhook endpoint registered + required events subscribed" } : { status: "BLOCKED_CONFIGURATION", detail: "Stripe webhook endpoint missing required events" };
      }
    }
  } catch (e) { wh = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "stripe.webhook", status: wh.status, detail: wh.detail });
  statuses.push(wh.status === "READY_LIVE" ? price.status : wh.status); // webhook ok → don't downgrade live/sandbox; else block
  const status = worst(statuses);
  return { status, checks, blocker: isReady(status) ? null : (price.detail || "billing dependencies unverified") };
}

async function evalCommunications(deps) {
  const env = deps.env;
  const provider = resolveValue(specByName("CLONESTORE_COMMUNICATION_PROVIDER"), env);
  if (provider && provider !== "resend") return { status: "NOT_IMPLEMENTED", checks: [chk(env, "CLONESTORE_COMMUNICATION_PROVIDER")], blocker: `provider '${provider}' has no live adapter (only resend)` };
  const names = ["CLONESTORE_COMMUNICATION_PROVIDER", "RESEND_API_KEY", "CLONESTORE_EMAIL_FROM", "CLONESTORE_EMAIL_WEBHOOK_SECRET", "CLONESTORE_PUBLIC_APP_URL", "CLONESTORE_COMMUNICATION_LINK_SECRET", "PIERRE_COMMUNICATION_SYSTEM_SECRET"];
  const checks = names.map((n) => chk(env, n));
  const gate = gateRequired(env, names); if (gate) return { status: gate.status, checks, blocker: gate.reason };
  const routeBlock = webhookRouteBlocker(deps, "communications"); if (routeBlock) return { status: "BLOCKED_CONFIGURATION", checks, blocker: routeBlock };
  if (!deps.probe) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "probe disabled" };
  const key = resolveValue(specByName("RESEND_API_KEY"), env);
  const from = String(resolveValue(specByName("CLONESTORE_EMAIL_FROM"), env));
  const fromDomain = from.includes("@") ? from.split("@")[1].replace(/[>\s]/g, "").toLowerCase() : null;
  if (!fromDomain) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "sender has no domain" };
  let dom;
  try {
    const r = await deps.httpGet("https://api.resend.com/domains", { authorization: `Bearer ${key}` });
    if (r.status === 401 || r.status === 403) dom = { status: "BLOCKED_PERMISSION", detail: "Resend rejected the key" };
    else if (!r.ok) dom = { status: "BLOCKED_CONFIGURATION", detail: `Resend http ${r.status}` };
    else {
      const list = Array.isArray(r.body?.data) ? r.body.data : [];
      const match = list.find((d) => String(d.name).toLowerCase() === fromDomain);
      if (!match) dom = { status: "BLOCKED_MISSING_ACCOUNT", detail: "sender domain not registered in Resend" };
      else if (match.status !== "verified") dom = { status: "BLOCKED_CONFIGURATION", detail: `sender domain status='${match.status}'` };
      else {
        // Resend marks a domain 'verified' ONLY after its SPF/DKIM DNS records pass — that status is the
        // authoritative gate. If the API ALSO exposes per-record statuses, any SPF/DKIM record that is not
        // verified BLOCKS (no fail-open on an absent/missing record: we never infer from absence).
        const records = Array.isArray(match.records) ? match.records : [];
        const unverified = records.filter((x) => /SPF|DKIM/i.test(String(x.record || x.type || "")) && !["verified", "valid"].includes(String(x.status || "").toLowerCase()));
        if (unverified.length) dom = { status: "BLOCKED_CONFIGURATION", detail: "an SPF/DKIM record is present but not verified" };
        else dom = { status: "READY_LIVE", detail: "sender domain verified (Resend verifies SPF/DKIM before 'verified')" };
      }
    }
  } catch (e) { dom = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "resend.domain", status: dom.status, detail: dom.detail });
  if (!isReady(dom.status)) return { status: dom.status, checks, blocker: dom.detail };
  // DMARC via DNS TXT (non-destructive)
  let dmarc;
  try {
    const txt = await deps.dnsResolveTxt(`_dmarc.${fromDomain}`);
    const flat = (Array.isArray(txt) ? txt : []).map((r) => (Array.isArray(r) ? r.join("") : String(r))).join(" ");
    dmarc = /v=DMARC1/i.test(flat) ? { status: "READY_LIVE", detail: "DMARC present" } : { status: "BLOCKED_CONFIGURATION", detail: `no DMARC at _dmarc.${fromDomain}` };
  } catch (e) { dmarc = { status: "BLOCKED_CONFIGURATION", detail: `DMARC lookup failed: ${redactError(e)}` }; }
  checks.push({ name: "dns.dmarc", status: dmarc.status, detail: dmarc.detail });
  if (!isReady(dmarc.status)) return { status: dmarc.status, checks, blocker: dmarc.detail };
  // webhook registration: verify a Resend webhook points at the exact URL + covers the required events.
  const publicUrl = resolveValue(specByName("CLONESTORE_PUBLIC_APP_URL"), env) || resolveValue(specByName("NEXT_PUBLIC_APP_URL"), env);
  const expectedUrl = webhookUrl(publicUrl, "communications");
  let wh;
  try {
    const r = await deps.httpGet("https://api.resend.com/webhooks", { authorization: `Bearer ${key}` });
    if (r.status === 401 || r.status === 403) wh = { status: "BLOCKED_PERMISSION", detail: "Resend rejected the key (webhook read)" };
    else if (r.status === 404 || r.status === 405) wh = { status: "NOT_IMPLEMENTED", detail: "Resend API exposes no webhook-list endpoint; webhook registration must be confirmed by an operator (P8.7.2)" };
    else if (!r.ok) wh = { status: "BLOCKED_CONFIGURATION", detail: `Resend webhook read http ${r.status}` };
    else {
      const list = Array.isArray(r.body?.data) ? r.body.data : (Array.isArray(r.body) ? r.body : []);
      const hook = list.find((h) => String(h.endpoint || h.url || "").replace(/\/$/, "") === expectedUrl);
      if (!hook) wh = { status: "BLOCKED_CONFIGURATION", detail: `no Resend webhook at ${expectedUrl}` };
      else {
        const evs = new Set(hook.events || hook.event_types || []);
        const covered = evs.size === 0 ? false : RESEND_REQUIRED_WEBHOOK_EVENTS.every((ev) => evs.has(ev));
        wh = covered ? { status: "READY_LIVE", detail: "Resend webhook registered + required events covered" } : { status: "BLOCKED_CONFIGURATION", detail: "Resend webhook missing required events" };
      }
    }
  } catch (e) { wh = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "resend.webhook", status: wh.status, detail: wh.detail });
  return { status: wh.status, checks, blocker: isReady(wh.status) ? null : wh.detail };
}

async function evalSignature(deps) {
  const env = deps.env;
  const provider = resolveValue(specByName("CLONESTORE_SIGNATURE_PROVIDER"), env);
  const checks = ["CLONESTORE_SIGNATURE_PROVIDER", "CLONESTORE_SIGNATURE_API_URL", "CLONESTORE_SIGNATURE_API_KEY", "CLONESTORE_SIGNATURE_WEBHOOK_SECRET"].map((n) => chk(env, n));
  if (provider && provider !== "yousign" && provider !== "fake") return { status: "NOT_IMPLEMENTED", checks, blocker: `provider '${provider}' has no live adapter (only yousign)` };
  if (!provider || provider === "fake") return { status: "BLOCKED_CONFIGURATION", checks, blocker: "no live signature provider selected" };
  const gate = gateRequired(env, ["CLONESTORE_SIGNATURE_API_URL", "CLONESTORE_SIGNATURE_API_KEY", "CLONESTORE_SIGNATURE_WEBHOOK_SECRET"]); if (gate) return { status: gate.status, checks, blocker: gate.reason };
  const apiUrl = resolveValue(specByName("CLONESTORE_SIGNATURE_API_URL"), env);
  const yk = recognizeYousignUrl(apiUrl);
  if (!yk) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "signature API URL is not an official Yousign base (sandbox/live)" };
  const routeBlock = webhookRouteBlocker(deps, "signature"); if (routeBlock) return { status: "BLOCKED_CONFIGURATION", checks, blocker: routeBlock };
  const publicUrl = resolveValue(specByName("NEXT_PUBLIC_APP_URL"), env) || resolveValue(specByName("CLONESTORE_PUBLIC_APP_URL"), env);
  if (!publicUrl || !/^https:\/\//.test(String(publicUrl))) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "no HTTPS public URL for the signature callback/webhook" };
  if (!deps.probe) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "probe disabled" };
  const apiKey = resolveValue(specByName("CLONESTORE_SIGNATURE_API_KEY"), env);
  const apiBase = apiUrl.replace(/\/$/, "");
  let auth;
  try {
    const r = await deps.httpGet(`${apiBase}/signature_requests?limit=1`, { authorization: `Bearer ${apiKey}` });
    if (r.status === 401 || r.status === 403) auth = { status: "BLOCKED_PERMISSION", detail: "Yousign rejected the key" };
    else if (r.status === 404) auth = { status: "BLOCKED_MISSING_ACCOUNT", detail: "Yousign account/endpoint not found" };
    else if (!r.ok) auth = { status: "BLOCKED_CONFIGURATION", detail: `Yousign http ${r.status}` };
    else auth = { status: yk === "sandbox" ? "READY_SANDBOX" : "READY_LIVE", detail: `authenticated read-only (${yk})` };
  } catch (e) { auth = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "yousign.auth", status: auth.status, detail: auth.detail });
  if (!isReady(auth.status)) return { status: auth.status, checks, blocker: auth.detail };
  // webhook/callback registration: verify the expected URL is registered (read-only). If the API exposes
  // no webhook listing, the proof is NOT_IMPLEMENTED → blocked + documented for P8.7.2 (never inferred).
  const expectedUrl = webhookUrl(publicUrl, "signature");
  let wh;
  try {
    const r = await deps.httpGet(`${apiBase}/webhooks`, { authorization: `Bearer ${apiKey}` });
    if (r.status === 401 || r.status === 403) wh = { status: "BLOCKED_PERMISSION", detail: "Yousign rejected the key (webhook read)" };
    else if (r.status === 404 || r.status === 405) wh = { status: "NOT_IMPLEMENTED", detail: "Yousign webhook listing not available here; registration must be confirmed by an operator (P8.7.2)" };
    else if (!r.ok) wh = { status: "BLOCKED_CONFIGURATION", detail: `Yousign webhook read http ${r.status}` };
    else {
      const list = Array.isArray(r.body?.data) ? r.body.data : (Array.isArray(r.body) ? r.body : []);
      const hook = list.find((h) => String(h.url || h.endpoint || "").replace(/\/$/, "") === expectedUrl);
      wh = hook ? { status: auth.status, detail: "webhook registered at the expected URL" } : { status: "BLOCKED_CONFIGURATION", detail: `no Yousign webhook at ${expectedUrl}` };
    }
  } catch (e) { wh = { status: "BLOCKED_NETWORK", detail: redactError(e) }; }
  checks.push({ name: "yousign.webhook", status: wh.status, detail: wh.detail });
  return { status: wh.status, checks, blocker: isReady(wh.status) ? null : wh.detail };
}

async function evalStorage(deps) {
  const env = deps.env;
  const provider = resolveValue(specByName("FILE_STORAGE_PROVIDER"), env);
  const checks = ["FILE_STORAGE_PROVIDER", "SUPABASE_STORAGE_BUCKET", "SUPABASE_STORAGE_PUBLIC", "SUPABASE_SERVICE_ROLE_KEY"].map((n) => chk(env, n));
  if (provider && provider !== "supabase") return { status: "NOT_IMPLEMENTED", checks, blocker: `storage provider '${provider}' is not the production backend (supabase)` };
  const gate = gateRequired(env, ["FILE_STORAGE_PROVIDER", "SUPABASE_STORAGE_BUCKET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]); if (gate) return { status: gate.status, checks, blocker: gate.reason };
  if (String(resolveValue(specByName("SUPABASE_STORAGE_PUBLIC"), env) || "").toLowerCase() === "true") return { status: "BLOCKED_CONFIGURATION", checks, blocker: "SUPABASE_STORAGE_PUBLIC=true (bucket must be private)" };
  if (!deps.probe) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "probe disabled" };
  const url = String(resolveValue(specByName("NEXT_PUBLIC_SUPABASE_URL"), env)).replace(/\/$/, "");
  const key = resolveValue(specByName("SUPABASE_SERVICE_ROLE_KEY"), env);
  const bucket = resolveValue(specByName("SUPABASE_STORAGE_BUCKET"), env);
  try {
    const r = await deps.httpGet(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { authorization: `Bearer ${key}`, apikey: key });
    if (r.status === 401 || r.status === 403) { checks.push({ name: "storage.bucket", status: "BLOCKED_PERMISSION", detail: "service key rejected" }); return { status: "BLOCKED_PERMISSION", checks, blocker: "service key rejected" }; }
    if (r.status === 404) { checks.push({ name: "storage.bucket", status: "BLOCKED_MISSING_ACCOUNT", detail: "bucket not found" }); return { status: "BLOCKED_MISSING_ACCOUNT", checks, blocker: "bucket not found" }; }
    if (!r.ok) { checks.push({ name: "storage.bucket", status: "BLOCKED_CONFIGURATION", detail: `http ${r.status}` }); return { status: "BLOCKED_CONFIGURATION", checks, blocker: `storage http ${r.status}` }; }
    if (r.body && r.body.public === true) { checks.push({ name: "storage.bucket", status: "BLOCKED_CONFIGURATION", detail: "bucket is PUBLIC (must be private)" }); return { status: "BLOCKED_CONFIGURATION", checks, blocker: "bucket is public" }; }
    checks.push({ name: "storage.bucket", status: "READY_LIVE", detail: "private bucket metadata readable (service-role authenticated)" });
    // FAIL-CLOSED: signed-URL generation is a POST (create-signed-url); it CANNOT be proven by a read-only
    // GET/HEAD probe, and we never infer a capability. It stays BLOCKED until P8.7.2 performs the controlled
    // non-destructive proof: POST /storage/v1/object/sign/<bucket>/<reserved-nonexistent-path> and confirm a
    // NON-auth response (proving auth + signing permission are recognised) without creating any object.
    checks.push({ name: "storage.signed_url", status: "BLOCKED_CONFIGURATION", detail: "signed-URL generation not proven (requires a controlled non-destructive sign POST in P8.7.2); never inferred" });
    return { status: "BLOCKED_CONFIGURATION", checks, blocker: "signed-URL capability not proven without a write (deferred to P8.7.2 controlled proof)" };
  } catch (e) { checks.push({ name: "storage.bucket", status: "BLOCKED_NETWORK", detail: redactError(e) }); return { status: "BLOCKED_NETWORK", checks, blocker: redactError(e) }; }
}

function evalApplication(deps) {
  const env = deps.env;
  const names = ["NEXT_PUBLIC_APP_URL", "CLONESTORE_COMMUNICATION_LINK_SECRET", "PIERRE_COMMUNICATION_SYSTEM_SECRET", "PIERRE_RUNTIME_SYSTEM_SECRET", "PIERRE_HANDOFF_TOKEN_SECRET"];
  const checks = names.map((n) => chk(env, n));
  const gate = gateRequired(env, names); if (gate) return { status: gate.status, checks, blocker: gate.reason };
  const appUrl = resolveValue(specByName("NEXT_PUBLIC_APP_URL"), env);
  const commUrl = resolveValue(specByName("CLONESTORE_PUBLIC_APP_URL"), env);
  if (commUrl && String(commUrl).replace(/\/$/, "") !== String(appUrl).replace(/\/$/, "")) return { status: "BLOCKED_CONFIGURATION", checks, blocker: "public app URL inconsistent across NEXT_PUBLIC_APP_URL / CLONESTORE_PUBLIC_APP_URL" };
  return { status: "READY_LIVE", checks, blocker: null };
}

// ── orchestrator ───────────────────────────────────────────────────────────────────────────────
export async function runPreflight(deps) {
  const d = { probe: true, webhookRoute: () => "build", httpGet: async () => ({ ok: false, status: 0, body: null }), dnsResolveTxt: async () => [], pgConnect: async () => { throw new Error("no pg"); }, env: {}, ...deps };
  const [database, runtime, billing, communications, signature, storage] = await Promise.all([
    evalDatabase(d), evalRuntime(d), evalBilling(d), evalCommunications(d), evalSignature(d), evalStorage(d),
  ]);
  const application = evalApplication(d);
  const domains = { database, runtime, billing, communications, signature, storage, application };
  const blockers = [];
  for (const [name, dm] of Object.entries(domains)) if (!isReady(dm.status)) blockers.push({ domain: name, status: dm.status, reason: dm.blocker || dm.status });
  // legacy checks: domain status AND all opt-ins — a ready domain with a missing opt-in is BLOCKED_CONFIGURATION
  const legacy_checks = {};
  for (const [checkName, map] of Object.entries(LEGACY_CHECK_MAP)) {
    const dm = domains[map.domain];
    // opt-ins are evaluated against their EXACT specs (=true / =1 / valid email), not mere non-emptiness.
    const optResults = (map.optIns || []).map((v) => ({ v, ...evaluateOptIn(v, d.env) }));
    const optBad = optResults.filter((o) => !o.ok);
    let status = dm.status; let reason = dm.blocker || `${map.domain} ${dm.status}`;
    if (isReady(status) && optBad.length) { status = "BLOCKED_CONFIGURATION"; reason = `domain ${map.domain} ready but opt-in(s) invalid: ${optBad.map((o) => o.reason).join("; ")}`; }
    legacy_checks[checkName] = { status, reason, required_actions: [...(dm.blocker ? [`resolve ${map.domain}: ${dm.blocker}`] : []), ...optBad.map((o) => `opt-in: ${o.reason}`)] };
  }
  const ready_for_p87_2 = blockers.length === 0 && Object.values(legacy_checks).every((l) => isReady(l.status));
  return {
    phase: "P8.7.1",
    generated_at: deps.now || new Date().toISOString(),
    environment: deps.environment || "local",
    env_files_loaded: deps.env_files_loaded ?? 0,
    domains: Object.fromEntries(Object.entries(domains).map(([k, v]) => [k, { status: v.status, checks: v.checks }])),
    legacy_checks,
    ready_for_p87_2,
    blockers,
  };
}
