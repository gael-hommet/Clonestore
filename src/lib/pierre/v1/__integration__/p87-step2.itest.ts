// src/lib/pierre/v1/__integration__/p87-step2.itest.ts
// PHASE 8.7.2 — BEHAVIORAL tests (dependency injection) for the live runtime/billing verifier, the
// credential generator, and the activation guards. Every verdict branch is exercised with mock pg; the
// remote target is REQUIRED for readiness; secrets are CSPRNG/distinct/redacted; activation is fail-closed.
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { runRuntimeBillingCheck } from "../live-runtime-billing-check.mjs";
import { ROLE_DSN_VARS, SYSTEM_SECRET_VARS, buildCredentialBundle, buildRoleDsn, generateRolePassword, generateSystemSecret, renderEnvFragment } from "../p87-credentials.mjs";

// ── mock pg: role-bind queries (role DSNs) + proof queries (app DSN) ───────────────────────────
function resolver(sql: string, _p: readonly unknown[] | undefined, dsn: string, o: any) {
  // proof artifacts (app DSN)
  if (sql.includes("to_regclass")) return [{ t: o.v28 === false ? null : "pierre_rt_product_entitlements" }];
  if (sql.includes("mission_runs") && sql.includes("status='completed'")) return [{ n: o.completed ?? 1 }];
  if (sql.includes("mission_runs")) return [{ n: o.runs ?? 1, tenants: o.tenants ?? 2 }];
  if (sql.includes("commercial_events")) return [{ n: o.events ?? 1 }];
  if (sql.includes("product_entitlements")) return [{ n: o.ent ?? 1 }];
  // role-bind queries (role DSN)
  if (sql.includes("current_user as u")) return [{ u: o.currentUser ? o.currentUser(dsn) : dsn.split("/").pop() }];
  if (sql.includes("pg_stat_ssl")) return [{ s: o.ssl ?? true }];
  if (sql.includes("rolsuper")) return [{ rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false, ...(o.attrs || {}) }];
  if (sql.includes("has_table_privilege")) return [{ c: o.tableSel ?? false }];
  if (sql.includes("has_function_privilege")) return o.fnMissing ? [] : [{ oid: 1, c: o.fnExec ?? true }];
  return [];
}
const mkPg = (o: any = {}) => async (dsn: string) => {
  if (o.connectThrow) throw o.connectThrow;
  return { query: async (sql: string, p?: readonly unknown[]) => ({ rows: resolver(sql, p, dsn, o) }), end: async () => {} };
};
const RB: Record<string, string> = { DATABASE_URL: "postgres://u:p@h/appdb" };
for (const [v, role] of ROLE_DSN_VARS) RB[v] = `postgres://u:p@h/${role}`;
const run = (env: Record<string, string>, o: any = {}) => runRuntimeBillingCheck({ env, probe: true, pgConnect: o.pg || mkPg(), now: "2026-06-30T00:00:00Z" } as any);

describe("P8.7.2 — live runtime/billing check (all branches)", () => {
  it("all 7 roles least-privilege + synthetic proof present → ready", async () => {
    const r = await run(RB); expect(r.ready).toBe(true);
    for (const [, role] of ROLE_DSN_VARS) expect(r.roles[role].status).toBe("READY_LIVE");
    expect(r.proof.runtime.status).toBe("READY_LIVE"); expect(r.proof.billing.status).toBe("READY_LIVE"); expect(r.proof.isolation.status).toBe("READY_LIVE");
  });
  it("a DSN binding the ADMIN role → BLOCKED_PERMISSION, not ready", async () => { const r = await run(RB, { pg: mkPg({ currentUser: () => "postgres" }) }); expect(r.ready).toBe(false); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_PERMISSION"); });
  it("DSN connected WITHOUT TLS → BLOCKED_CONFIGURATION", async () => { const r = await run(RB, { pg: mkPg({ ssl: false }) }); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_CONFIGURATION"); });
  it("superuser → BLOCKED_PERMISSION", async () => { const r = await run(RB, { pg: mkPg({ attrs: { rolsuper: true } }) }); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_PERMISSION"); });
  it("bypassrls → BLOCKED_PERMISSION", async () => { const r = await run(RB, { pg: mkPg({ attrs: { rolbypassrls: true } }) }); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_PERMISSION"); });
  it("direct business-table SELECT → BLOCKED_PERMISSION", async () => { const r = await run(RB, { pg: mkPg({ tableSel: true }) }); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_PERMISSION"); });
  it("required governed function absent → BLOCKED_CONFIGURATION", async () => { const r = await run(RB, { pg: mkPg({ fnMissing: true }) }); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_CONFIGURATION"); });
  it("lacks EXECUTE on required function → BLOCKED_PERMISSION", async () => { const r = await run(RB, { pg: mkPg({ fnExec: false }) }); expect(r.roles.pierre_rt_runtime_worker.status).toBe("BLOCKED_PERMISSION"); });
  it("a dedicated DSN missing → BLOCKED_MISSING_SECRET (remote target REQUIRED)", async () => { const { PIERRE_BILLING_WEBHOOK_DATABASE_URL, ...rest } = RB; const r = await run(rest); expect(r.ready).toBe(false); expect(r.roles.pierre_rt_billing_webhook.status).toBe("BLOCKED_MISSING_SECRET"); });
  it("no synthetic runtime proof → runtime proof blocked", async () => { const r = await run(RB, { pg: mkPg({ runs: 0, completed: 0 }) }); expect(r.proof.runtime.status).toBe("BLOCKED_CONFIGURATION"); expect(r.ready).toBe(false); });
  it("only one synthetic tenant → isolation blocked", async () => { const r = await run(RB, { pg: mkPg({ tenants: 1 }) }); expect(r.proof.isolation.status).toBe("BLOCKED_CONFIGURATION"); });
  it("no synthetic billing proof → billing proof blocked", async () => { const r = await run(RB, { pg: mkPg({ ent: 0, events: 0 }) }); expect(r.proof.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("v28 absent on the remote → proof blocked", async () => { const r = await run(RB, { pg: mkPg({ v28: false }) }); expect(r.proof.runtime.status).toBe("BLOCKED_CONFIGURATION"); });
  it("no DSNs at all → every role + proof blocked, not ready", async () => { const r = await run({}); expect(r.ready).toBe(false); for (const [, role] of ROLE_DSN_VARS) expect(r.roles[role].status).toBe("BLOCKED_MISSING_SECRET"); });
});

describe("P8.7.2 — credential generation (CSPRNG, distinct, redacted)", () => {
  it("bundle has 7 distinct DSNs + 4 distinct system secrets, all distinct values", () => {
    const { values, manifest } = buildCredentialBundle("postgresql://postgres:adminpw@db.example.co:5432/postgres", { environment: "staging" });
    const vals = Object.values(values);
    expect(Object.keys(values).length).toBe(ROLE_DSN_VARS.length + SYSTEM_SECRET_VARS.length);
    expect(new Set(vals).size).toBe(vals.length); // all distinct
    for (const [v, role] of ROLE_DSN_VARS) { expect(values[v]).toContain(`${role}:`); expect(values[v]).toMatch(/sslmode=no-verify/); }
    // manifest carries NO values, only REDACTED status
    expect(manifest.entries.every((e) => e.status === "REDACTED")).toBe(true);
    const mj = JSON.stringify(manifest); for (const val of vals) expect(mj).not.toContain(val.slice(10, 40));
  });
  it("passwords/secrets are CSPRNG + distinct across calls; DSN embeds role+TLS", () => {
    expect(generateRolePassword()).not.toBe(generateRolePassword());
    expect(generateSystemSecret().length).toBeGreaterThanOrEqual(40);
    const dsn = buildRoleDsn("postgresql://postgres:x@db.example.co:5432/postgres", "pierre_rt_runtime_worker", "p4ss-w0rd");
    expect(dsn).toContain("pierre_rt_runtime_worker:");
    expect(dsn).toContain("@db.example.co:5432/postgres");
    expect(dsn).toMatch(/sslmode=no-verify/);
  });
  it("renderEnvFragment emits KEY=VALUE lines (gitignored install only)", () => {
    expect(renderEnvFragment({ A: "1", B: "2" })).toBe("A=1\nB=2\n");
  });
});

describe("P8.7.2 — activation is fail-closed (subprocess)", () => {
  const SCRIPT = resolve(process.cwd(), "scripts/p87-activate-remote.mjs");
  function activate(env: Record<string, string>, args: string[] = []) {
    const base: Record<string, string> = {}; for (const [k, v] of Object.entries(process.env)) if (v !== undefined) base[k] = v;
    for (const k of Object.keys(base)) if (/^P87_/.test(k)) delete base[k];
    const r = spawnSync("node", [SCRIPT, ...args], { encoding: "utf-8", env: { ...base, ...env } as NodeJS.ProcessEnv });
    return { status: r.status, out: r.stdout + r.stderr };
  }
  it("refuses without P87_ADMIN_DATABASE_URL", () => { const r = activate({}); expect(r.status).toBe(2); expect(r.out).toMatch(/REFUSED.*P87_ADMIN_DATABASE_URL/); });
  it("refuses without the explicit acknowledgement", () => { const r = activate({ P87_ADMIN_DATABASE_URL: "postgresql://postgres:x@db.example.co/postgres", P87_CONFIRM_TARGET: "demo", P87_ENVIRONMENT: "staging" }); expect(r.status).toBe(2); expect(r.out).toMatch(/REFUSED.*P87_I_UNDERSTAND_REMOTE_WRITE/); });
  it("refuses a localhost target", () => { const r = activate({ P87_ADMIN_DATABASE_URL: "postgresql://postgres:x@localhost:5432/postgres", P87_CONFIRM_TARGET: "demo", P87_I_UNDERSTAND_REMOTE_WRITE: "yes", P87_ENVIRONMENT: "staging" }); expect(r.status).toBe(2); expect(r.out).toMatch(/REFUSED.*localhost/); });
  it("never echoes a secret in its refusal output", () => { const r = activate({ P87_ADMIN_DATABASE_URL: "postgresql://postgres:SECRETcanary123@localhost/postgres", P87_CONFIRM_TARGET: "demo", P87_I_UNDERSTAND_REMOTE_WRITE: "yes", P87_ENVIRONMENT: "staging" }); expect(r.out).not.toContain("SECRETcanary123"); });
});
