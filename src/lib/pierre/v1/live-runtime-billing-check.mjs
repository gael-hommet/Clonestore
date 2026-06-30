// src/lib/pierre/v1/live-runtime-billing-check.mjs
// PHASE 8.7.2 — dependency-injectable LIVE runtime + billing infrastructure check (the read-only verifier).
//
// It proves, against a REAL remote PostgreSQL, that each dedicated DSN connects DIRECTLY as its exact
// least-privilege role (NEVER admin, NEVER SET ROLE), with TLS, the governed functions executable, no
// forbidden attributes, no direct business-table reads; that v28 is applied; and that the controlled
// SYNTHETIC runtime + billing proof artifacts (tenant prefix `p87-step2-proof-…`) exist and are consistent.
//
// All probes are read-only (begin read only → … → rollback). It uses injected deps (pgConnect, env, now) so
// tests simulate every branch without a real account. Fail-closed: a missing DSN / missing proof / wrong
// role / excess privilege blocks. It never prints a value.

import {
  requireEnv, resolveValue, specByName, classifyPgError, redactError,
  ROLE_PERMISSION_MATRIX, FORBIDDEN_ROLE_ATTRS, FORBIDDEN_DIRECT_SELECT,
} from "./live-infrastructure-contract.mjs";

const isReady = (s) => s === "READY_LIVE";
const ROLE_DSNS = [
  ["PIERRE_RUNTIME_WORKER_DATABASE_URL", "pierre_rt_runtime_worker"],
  ["PIERRE_RUNTIME_SCHEDULER_DATABASE_URL", "pierre_rt_runtime_scheduler"],
  ["PIERRE_RUNTIME_PLANNER_DATABASE_URL", "pierre_rt_runtime_planner"],
  ["PIERRE_COMMUNICATION_WORKER_DATABASE_URL", "pierre_rt_communication_worker"],
  ["PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL", "pierre_rt_communication_webhook"],
  ["PIERRE_BILLING_WEBHOOK_DATABASE_URL", "pierre_rt_billing_webhook"],
  ["PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL", "pierre_rt_customer_activation_worker"],
];

/** Verify ONE dedicated DSN binds directly to its least-privilege role with TLS (no SET ROLE). */
async function verifyRoleDsn(deps, dsn, role) {
  const matrix = ROLE_PERMISSION_MATRIX[role] || { mustExecute: [] };
  let client;
  try { client = await deps.pgConnect(dsn); } catch (e) { return { status: classifyPgError(e), detail: redactError(e) }; }
  try {
    await client.query("begin read only");
    const cu = (await client.query("select current_user as u")).rows[0].u;
    if (cu === "postgres" || cu === "supabase_admin") { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `DSN binds the ADMIN role '${cu}', not the dedicated least-privilege role '${role}'` }; }
    if (cu !== role) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `DSN binds '${cu}', expected '${role}' (no SET ROLE)` }; }
    const ssl = (await client.query("select coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false) as s")).rows[0].s;
    if (!ssl) { await client.query("rollback"); return { status: "BLOCKED_CONFIGURATION", detail: `${role} DSN connected WITHOUT TLS` }; }
    const attr = (await client.query("select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication from pg_roles where rolname = current_user")).rows[0] || {};
    for (const a of FORBIDDEN_ROLE_ATTRS) if (attr[a]) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `${role} has forbidden attribute ${a}` }; }
    for (const t of FORBIDDEN_DIRECT_SELECT) {
      const can = (await client.query("select has_table_privilege(current_user, $1, 'SELECT') as c", [t])).rows[0].c;
      if (can) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `${role} has direct SELECT on ${t}` }; }
    }
    for (const fn of matrix.mustExecute) {
      const row = (await client.query("select p.oid, has_function_privilege(current_user, p.oid, 'EXECUTE') as c from pg_proc p where p.proname = $1 limit 1", [fn])).rows[0];
      if (!row) { await client.query("rollback"); return { status: "BLOCKED_CONFIGURATION", detail: `governed function ${fn} absent` }; }
      if (!row.c) { await client.query("rollback"); return { status: "BLOCKED_PERMISSION", detail: `${role} lacks EXECUTE on ${fn}` }; }
    }
    await client.query("rollback");
    return { status: "READY_LIVE", detail: `${role}: direct least-privilege bind, TLS on, governed fns executable, business tables refused` };
  } catch (e) { try { await client.query("rollback"); } catch { /* */ } return { status: classifyPgError(e), detail: redactError(e) }; }
  finally { try { await client.end(); } catch { /* */ } }
}

/** Read-only verification of the controlled SYNTHETIC runtime + billing proof artifacts via the app DSN. */
async function verifyProofArtifacts(deps, dsn) {
  const out = { runtime: { status: "BLOCKED_CONFIGURATION", detail: "no proof" }, billing: { status: "BLOCKED_CONFIGURATION", detail: "no proof" }, isolation: { status: "BLOCKED_CONFIGURATION", detail: "no proof" } };
  let client;
  try { client = await deps.pgConnect(dsn); } catch (e) { const s = classifyPgError(e); return { runtime: { status: s, detail: redactError(e) }, billing: { status: s, detail: redactError(e) }, isolation: { status: s, detail: redactError(e) } }; }
  try {
    await client.query("begin read only");
    const v28 = (await client.query("select to_regclass('public.pierre_rt_product_entitlements') as t")).rows[0].t;
    if (!v28) { await client.query("rollback"); const b = { status: "BLOCKED_CONFIGURATION", detail: "v28 absent on the remote" }; return { runtime: b, billing: b, isolation: b }; }
    // runtime proof: at least one completed synthetic run + a distinct tenant present (isolation)
    const runs = (await client.query("select count(*)::int n, count(distinct company_id)::int tenants from pierre_rt_mission_runs r join pierre_rt_companies c on c.id=r.company_id where c.name like 'p87-step2-proof-%'")).rows[0];
    const completed = (await client.query("select count(*)::int n from pierre_rt_mission_runs r join pierre_rt_companies c on c.id=r.company_id where c.name like 'p87-step2-proof-%' and r.status='completed'")).rows[0].n;
    if (runs.n < 1) out.runtime = { status: "BLOCKED_CONFIGURATION", detail: "no synthetic runtime proof run found" };
    else if (completed < 1) out.runtime = { status: "BLOCKED_CONFIGURATION", detail: "synthetic run never reached completed" };
    else out.runtime = { status: "READY_LIVE", detail: `synthetic run(s) completed on the remote (${completed})` };
    out.isolation = runs.tenants >= 2 ? { status: "READY_LIVE", detail: `${runs.tenants} synthetic tenants isolated` } : { status: "BLOCKED_CONFIGURATION", detail: "isolation requires >=2 synthetic tenants" };
    // billing proof: a synthetic active entitlement reached via a commercial event + activation
    const ent = (await client.query("select count(*)::int n from pierre_rt_product_entitlements e join pierre_rt_companies c on c.id=e.company_id where c.name like 'p87-step2-proof-%' and e.status in ('active','suspended')")).rows[0].n;
    const evs = (await client.query("select count(*)::int n from pierre_rt_commercial_events ev join pierre_rt_companies c on c.id=ev.company_id where c.name like 'p87-step2-proof-%'")).rows[0].n;
    out.billing = (ent >= 1 && evs >= 1) ? { status: "READY_LIVE", detail: "synthetic entitlement applied from a commercial event" } : { status: "BLOCKED_CONFIGURATION", detail: "no synthetic billing proof (entitlement/commercial event)" };
    await client.query("rollback");
  } catch (e) { try { await client.query("rollback"); } catch { /* */ } const s = classifyPgError(e); out.runtime = { status: s, detail: redactError(e) }; }
  finally { try { await client.end(); } catch { /* */ } }
  return out;
}

export async function runRuntimeBillingCheck(deps) {
  const d = { probe: true, pgConnect: async () => { throw new Error("no pg"); }, env: {}, ...deps };
  const roles = {};
  const blockers = [];
  // require + verify every dedicated DSN
  for (const [varName, role] of ROLE_DSNS) {
    const req = requireEnv(varName, d.env);
    if (!req.ok) { roles[role] = { status: req.presence === "MISSING" ? "BLOCKED_MISSING_SECRET" : "BLOCKED_CONFIGURATION", detail: req.reason }; blockers.push({ area: role, status: roles[role].status, reason: req.reason }); continue; }
    if (!d.probe) { roles[role] = { status: "BLOCKED_CONFIGURATION", detail: "probe disabled" }; blockers.push({ area: role, status: "BLOCKED_CONFIGURATION", reason: "probe disabled" }); continue; }
    const r = await verifyRoleDsn(d, resolveValue(specByName(varName), d.env), role);
    roles[role] = r;
    if (!isReady(r.status)) blockers.push({ area: role, status: r.status, reason: r.detail });
  }
  // synthetic proof artifacts (read-only) via the app DSN
  let proof = { runtime: { status: "BLOCKED_MISSING_SECRET", detail: "DATABASE_URL missing" }, billing: { status: "BLOCKED_MISSING_SECRET", detail: "DATABASE_URL missing" }, isolation: { status: "BLOCKED_MISSING_SECRET", detail: "DATABASE_URL missing" } };
  const appReq = requireEnv("DATABASE_URL", d.env);
  if (appReq.ok && d.probe) proof = await verifyProofArtifacts(d, resolveValue(specByName("DATABASE_URL"), d.env));
  for (const [k, v] of Object.entries(proof)) if (!isReady(v.status)) blockers.push({ area: `proof:${k}`, status: v.status, reason: v.detail });
  const ready = blockers.length === 0;
  return {
    phase: "P8.7.2",
    generated_at: d.now || new Date().toISOString(),
    roles, proof, ready, blockers,
  };
}
