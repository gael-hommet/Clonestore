// src/lib/pierre/v1/__integration__/p87-live-infrastructure-preflight.itest.ts
// PHASE 8.7.1 (final proof) — BEHAVIORAL tests via dependency injection. Every verdict is exercised by
// injecting mock pg / http / dns / webhook-route deps and asserting the REAL fail-closed outcome — never a
// string scan. Adds: external webhook registration (Stripe/Resend/Yousign), route-in-build, exact opt-in
// values, Supabase service-role auth codes, storage signed-URL non-inference, and a role-matrix anti-drift
// check against the migrations.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import {
  LIVE_INFRA_CONTRACT, LEGACY_CHECK_MAP, ALL_DOMAINS, classifyEnv, redactSecret, redactError,
  classifyPgError, recognizeYousignUrl, requireEnv, specByName, evaluateOptIn, OPT_IN_SPECS,
  ROLE_PERMISSION_MATRIX, STRIPE_REQUIRED_WEBHOOK_EVENTS, EXPECTED_PIERRE_PRICE_AMOUNT as CONTRACT_PRICE,
} from "../live-infrastructure-contract.mjs";
import { runPreflight, loadEnvironment } from "../live-infrastructure-preflight.mjs";
import { EXPECTED_PIERRE_PRICE_AMOUNT as BILLING_PRICE } from "../../../billing/stripe-activation";

const CLI = resolve(process.cwd(), "scripts/check-p87-live-infrastructure-preflight.mjs");
const cliSrc = readFileSync(CLI, "utf-8");
const URL_OK = "https://app.acme.test";

// ── mock pg ────────────────────────────────────────────────────────────────────────────────────
function pgResolver(sql: string, _p: readonly unknown[] | undefined, dsn: string, o: any) {
  if (sql.includes("current_database()")) return [{ d: "app", u: "pierre_rt_app", v: "PostgreSQL 16.1" }];
  if (sql.includes("pg_stat_ssl")) return [{ ssl: o.ssl ?? true }];
  if (sql.includes("to_regclass")) return [{ t: o.v28 === false ? null : "pierre_rt_product_entitlements" }];
  if (sql.includes("proname in")) return [{ n: o.fns ?? 3 }];
  if (sql.includes("rolname like")) return [{ n: o.roles ?? 8 }];
  if (sql.includes("current_user as u")) return [{ u: o.currentUser ? o.currentUser(dsn) : dsn.split("/").pop() }];
  if (sql.includes("rolsuper")) return [{ rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false, ...(o.attrs || {}) }];
  if (sql.includes("has_table_privilege")) return [{ c: o.tableSel ?? false }];
  if (sql.includes("has_function_privilege")) return o.fnMissing ? [] : [{ oid: 1, c: o.fnExec ?? true }];
  return [];
}
const mkPg = (o: any = {}) => async (dsn: string) => {
  if (o.connectThrow) throw o.connectThrow;
  return { query: async (sql: string, params?: readonly unknown[]) => ({ rows: pgResolver(sql, params, dsn, o) }), end: async () => {} };
};
// ── mock http (webhook endpoints incl.) ──────────────────────────────────────────────────────
const okBody = {
  stripePrice: { unit_amount: 44900, currency: "eur", active: true, recurring: { interval: "month", interval_count: 1 }, product: { active: true } },
  stripeWebhooks: { data: [{ url: `${URL_OK}/api/webhooks/stripe`, status: "enabled", enabled_events: STRIPE_REQUIRED_WEBHOOK_EVENTS }] },
  resendDomains: { data: [{ name: "acme.test", status: "verified", records: [] }] },
  resendWebhooks: { data: [{ endpoint: `${URL_OK}/api/webhooks/pierre/communications`, events: ["email.delivered", "email.bounced", "email.complained"] }] },
  yousignWebhooks: { data: [{ url: `${URL_OK}/api/webhooks/pierre/signature` }] },
  bucket: { public: false },
};
function mkHttp(over: any = {}) {
  return async (url: string) => {
    if (url.includes("/rest/v1/")) return over.supabase ?? { ok: true, status: 200, body: {} };
    if (url.includes("/v1/webhook_endpoints")) return over.stripeWebhook ?? { ok: true, status: 200, body: okBody.stripeWebhooks };
    if (url.includes("/v1/prices")) return over.stripe ?? { ok: true, status: 200, body: okBody.stripePrice };
    if (url.includes("api.resend.com/webhooks")) return over.resendWebhook ?? { ok: true, status: 200, body: okBody.resendWebhooks };
    if (url.includes("api.resend.com/domains")) return over.resend ?? { ok: true, status: 200, body: okBody.resendDomains };
    if (url.includes("yousign") && url.includes("/webhooks")) return over.yousignWebhook ?? { ok: true, status: 200, body: okBody.yousignWebhooks };
    if (url.includes("yousign")) return over.yousign ?? { ok: true, status: 200, body: { data: [] } };
    if (url.includes("/storage/v1/bucket/")) return over.bucket ?? { ok: true, status: 200, body: okBody.bucket };
    return { ok: false, status: 0, body: null };
  };
}
const mkDns = (present = true) => async (_h: string) => (present ? [["v=DMARC1; p=none"]] : []);
const base = (env: Record<string, string>, o: any = {}) => runPreflight({
  env, probe: true, pgConnect: o.pg || mkPg(), httpGet: o.http || mkHttp(), dnsResolveTxt: o.dns || mkDns(true),
  webhookRoute: o.webhookRoute || (() => "build"), now: "2026-06-30T00:00:00Z",
} as any);

const DB = { DATABASE_URL: "postgres://u:p@h/db", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anonkeyvalue", SUPABASE_SERVICE_ROLE_KEY: "svcrolekeyvalue" };
const RT = { PIERRE_RUNTIME_SYSTEM_SECRET: "sysS", PIERRE_RUNTIME_WORKER_DATABASE_URL: "postgres://u:p@h/pierre_rt_runtime_worker", PIERRE_RUNTIME_SCHEDULER_DATABASE_URL: "postgres://u:p@h/pierre_rt_runtime_scheduler", PIERRE_RUNTIME_PLANNER_DATABASE_URL: "postgres://u:p@h/pierre_rt_runtime_planner", PIERRE_COMMUNICATION_WORKER_DATABASE_URL: "postgres://u:p@h/pierre_rt_communication_worker", PIERRE_COMMUNICATION_WEBHOOK_DATABASE_URL: "postgres://u:p@h/pierre_rt_communication_webhook" };
const BILL = { STRIPE_SECRET_KEY: "sk_test_0123456789abcdef", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_0123456789abcdef", STRIPE_WEBHOOK_SECRET: "whsec_0123456789", NEXT_PUBLIC_STRIPE_PRICE_ID: "price_0123456789", PIERRE_HANDOFF_TOKEN_SECRET: "handoffS", PIERRE_BILLING_WEBHOOK_DATABASE_URL: "postgres://u:p@h/pierre_rt_billing_webhook", PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL: "postgres://u:p@h/pierre_rt_customer_activation_worker", NEXT_PUBLIC_APP_URL: URL_OK };
const COMM = { CLONESTORE_COMMUNICATION_PROVIDER: "resend", RESEND_API_KEY: "re_0123456789", CLONESTORE_EMAIL_FROM: "hr@acme.test", CLONESTORE_EMAIL_WEBHOOK_SECRET: "whsec_x0", CLONESTORE_PUBLIC_APP_URL: URL_OK, CLONESTORE_COMMUNICATION_LINK_SECRET: "linkS", PIERRE_COMMUNICATION_SYSTEM_SECRET: "commS" };
const SIG = { CLONESTORE_SIGNATURE_PROVIDER: "yousign", CLONESTORE_SIGNATURE_API_URL: "https://api-sandbox.yousign.app/v3", CLONESTORE_SIGNATURE_API_KEY: "ysKeyValue", CLONESTORE_SIGNATURE_WEBHOOK_SECRET: "ysWhsec", NEXT_PUBLIC_APP_URL: URL_OK };
const STG = { FILE_STORAGE_PROVIDER: "supabase", SUPABASE_STORAGE_BUCKET: "pierre-docs", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svcKey" };

describe("P8.7.1 — single source + contract", () => {
  it("price defined once, matches stripe-activation.ts", () => { expect(CONTRACT_PRICE).toBe(44900); expect(CONTRACT_PRICE).toBe(BILLING_PRICE); });
  it("CLI is thin (imports engine, no domain logic)", () => { expect(cliSrc).toMatch(/live-infrastructure-preflight\.mjs/); expect(cliSrc).not.toMatch(/function evalDatabase|ROLE_PERMISSION_MATRIX\s*=/); });
  it("covers all seven domains", () => { const ds = new Set(LIVE_INFRA_CONTRACT.map((s) => s.domain)); for (const d of ALL_DOMAINS) expect(ds.has(d)).toBe(true); });
});

describe("P8.7.1 — requireEnv / redaction / pg-error classification", () => {
  it("MISSING + INVALID_FORMAT both block; valid passes", () => {
    expect(requireEnv("PIERRE_HANDOFF_TOKEN_SECRET", {}).ok).toBe(false);
    expect(requireEnv("PIERRE_HANDOFF_TOKEN_SECRET", { PIERRE_HANDOFF_TOKEN_SECRET: "changeme" }).presence).toBe("INVALID_FORMAT");
    expect(requireEnv("PIERRE_HANDOFF_TOKEN_SECRET", { PIERRE_HANDOFF_TOKEN_SECRET: "real" }).ok).toBe(true);
  });
  it("redaction never echoes; pg errors classify precisely", () => {
    expect(redactSecret("sk_live_x")).toBe("REDACTED");
    expect(redactError(new Error("postgres://u:pw@h/db"))).not.toContain("pw");
    // query-string DSN password + JWT-shaped Supabase key are also redacted
    expect(redactError(new Error("postgres://h/db?password=QXAZcanary&sslmode=require failed"))).not.toContain("QXAZcanary");
    expect(redactError(new Error("apikey=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.SIGcanary rejected"))).not.toContain("SIGcanary");
    expect(classifyPgError({ code: "28P01" })).toBe("BLOCKED_PERMISSION");
    expect(classifyPgError({ code: "42501" })).toBe("BLOCKED_PERMISSION");
    expect(classifyPgError({ code: "3D000" })).toBe("BLOCKED_CONFIGURATION");
    expect(classifyPgError({ code: "ECONNREFUSED" })).toBe("BLOCKED_NETWORK");
  });
});

describe("P8.7.1 — env loading priority (incl. staging)", () => {
  const files: Record<string, string> = { "/p/.env": "A=base\nB=base\nC=base", "/p/.env.local": "B=local\nC=local", "/p/.env.staging": "C=staging\nD=staging", "/p/.env.staging.local": "D=stagingLocal" };
  const deps = { cwd: "/p", processEnv: { A: "fromProcess" } as Record<string, string>, readFile: (p: string) => files[p] ?? null, fileExists: (p: string) => p in files, join: (a: string, b: string) => `${a}/${b}` };
  it("loads the staging set + exact priority order", () => {
    const { env, loadedFiles, sourceMap } = loadEnvironment("staging", deps);
    expect(loadedFiles).toEqual([".env", ".env.local", ".env.staging", ".env.staging.local"]);
    expect(env.A).toBe("fromProcess"); expect(env.B).toBe("local"); expect(env.C).toBe("staging"); expect(env.D).toBe("stagingLocal");
    expect(sourceMap.A).toBe("process"); expect(sourceMap.D).toBe("env_file");
  });
});

describe("P8.7.1 — DATABASE", () => {
  it("valid + TLS + v28 + roles + service-role 200 → READY_LIVE", async () => { expect((await base(DB)).domains.database.status).toBe("READY_LIVE"); });
  it("TLS off → BLOCKED_CONFIGURATION", async () => { expect((await base(DB, { pg: mkPg({ ssl: false }) })).domains.database.status).toBe("BLOCKED_CONFIGURATION"); });
  it("migration v28 absent → BLOCKED_CONFIGURATION", async () => { expect((await base(DB, { pg: mkPg({ v28: false }) })).domains.database.status).toBe("BLOCKED_CONFIGURATION"); });
  it("service-role 200 ok, 401 perm, 403 perm, 404 config, network", async () => {
    expect((await base(DB, { http: mkHttp({ supabase: { ok: true, status: 200, body: {} } }) })).domains.database.status).toBe("READY_LIVE");
    expect((await base(DB, { http: mkHttp({ supabase: { ok: false, status: 401, body: null } }) })).domains.database.status).toBe("BLOCKED_PERMISSION");
    expect((await base(DB, { http: mkHttp({ supabase: { ok: false, status: 403, body: null } }) })).domains.database.status).toBe("BLOCKED_PERMISSION");
    expect((await base(DB, { http: mkHttp({ supabase: { ok: false, status: 404, body: null } }) })).domains.database.status).toBe("BLOCKED_CONFIGURATION");
  });
  it("DB auth refused (28P01) → BLOCKED_PERMISSION; network → BLOCKED_NETWORK", async () => {
    expect((await base(DB, { pg: mkPg({ connectThrow: { code: "28P01", message: "auth failed" } }) })).domains.database.status).toBe("BLOCKED_PERMISSION");
    expect((await base(DB, { pg: mkPg({ connectThrow: { code: "ECONNREFUSED", message: "refused" } }) })).domains.database.status).toBe("BLOCKED_NETWORK");
  });
  it("present-but-invalid key cannot be READY", async () => { expect((await base({ ...DB, SUPABASE_SERVICE_ROLE_KEY: "<set-me>" })).domains.database.status).toBe("BLOCKED_CONFIGURATION"); });
});

describe("P8.7.1 — RUNTIME role matrix", () => {
  it("all roles least-privilege → READY_LIVE", async () => { expect((await base(RT)).domains.runtime.status).toBe("READY_LIVE"); });
  it("wrong role → BLOCKED_PERMISSION", async () => { expect((await base(RT, { pg: mkPg({ currentUser: () => "postgres" }) })).domains.runtime.status).toBe("BLOCKED_PERMISSION"); });
  it("superuser → BLOCKED_PERMISSION", async () => { expect((await base(RT, { pg: mkPg({ attrs: { rolsuper: true } }) })).domains.runtime.status).toBe("BLOCKED_PERMISSION"); });
  it("bypassrls → BLOCKED_PERMISSION", async () => { expect((await base(RT, { pg: mkPg({ attrs: { rolbypassrls: true } }) })).domains.runtime.status).toBe("BLOCKED_PERMISSION"); });
  it("direct business-table SELECT → BLOCKED_PERMISSION", async () => { expect((await base(RT, { pg: mkPg({ tableSel: true }) })).domains.runtime.status).toBe("BLOCKED_PERMISSION"); });
  it("required function absent → BLOCKED_CONFIGURATION", async () => { expect((await base(RT, { pg: mkPg({ fnMissing: true }) })).domains.runtime.status).toBe("BLOCKED_CONFIGURATION"); });
  it("lacks EXECUTE on required function → BLOCKED_PERMISSION", async () => { expect((await base(RT, { pg: mkPg({ fnExec: false }) })).domains.runtime.status).toBe("BLOCKED_PERMISSION"); });
  it("system secret missing → BLOCKED_MISSING_SECRET", async () => { const { PIERRE_RUNTIME_SYSTEM_SECRET, ...rest } = RT; expect((await base(rest as any)).domains.runtime.status).toBe("BLOCKED_MISSING_SECRET"); });
});

describe("P8.7.1 — BILLING (price + webhook registration + roles)", () => {
  it("price + roles + registered webhook → READY_SANDBOX", async () => { expect((await base(BILL)).domains.billing.status).toBe("READY_SANDBOX"); });
  it("wrong price amount → BLOCKED_CONFIGURATION", async () => { expect((await base(BILL, { http: mkHttp({ stripe: { ok: true, status: 200, body: { ...okBody.stripePrice, unit_amount: 9900 } } }) })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("price not monthly → BLOCKED_CONFIGURATION", async () => { expect((await base(BILL, { http: mkHttp({ stripe: { ok: true, status: 200, body: { ...okBody.stripePrice, recurring: { interval: "year", interval_count: 1 } } } }) })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("webhook route present in src but not in build → BLOCKED_CONFIGURATION", async () => { expect((await base(BILL, { webhookRoute: (d: string) => (d === "billing" ? "src_only" : "build") })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("no registered Stripe webhook endpoint → BLOCKED_CONFIGURATION", async () => { expect((await base(BILL, { http: mkHttp({ stripeWebhook: { ok: true, status: 200, body: { data: [] } } }) })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("Stripe webhook at the WRONG url → BLOCKED_CONFIGURATION", async () => { expect((await base(BILL, { http: mkHttp({ stripeWebhook: { ok: true, status: 200, body: { data: [{ url: "https://evil.test/api/webhooks/stripe", status: "enabled", enabled_events: STRIPE_REQUIRED_WEBHOOK_EVENTS }] } } }) })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("Stripe webhook missing required events → BLOCKED_CONFIGURATION", async () => { expect((await base(BILL, { http: mkHttp({ stripeWebhook: { ok: true, status: 200, body: { data: [{ url: `${URL_OK}/api/webhooks/stripe`, status: "enabled", enabled_events: ["checkout.session.completed"] }] } } }) })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
  it("inconsistent key modes → BLOCKED_CONFIGURATION", async () => { expect((await base({ ...BILL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_0123456789" })).domains.billing.status).toBe("BLOCKED_CONFIGURATION"); });
});

describe("P8.7.1 — COMMUNICATIONS (domain + DMARC + webhook)", () => {
  it("verified domain + DMARC + registered webhook → READY_LIVE", async () => { expect((await base(COMM)).domains.communications.status).toBe("READY_LIVE"); });
  it("domain not verified → BLOCKED_CONFIGURATION", async () => { expect((await base(COMM, { http: mkHttp({ resend: { ok: true, status: 200, body: { data: [{ name: "acme.test", status: "pending", records: [] }] } } }) })).domains.communications.status).toBe("BLOCKED_CONFIGURATION"); });
  it("domain 'verified' but an exposed SPF record is not verified → BLOCKED_CONFIGURATION (no fail-open)", async () => { expect((await base(COMM, { http: mkHttp({ resend: { ok: true, status: 200, body: { data: [{ name: "acme.test", status: "verified", records: [{ record: "SPF", status: "pending" }, { record: "DKIM", status: "verified" }] }] } } }) })).domains.communications.status).toBe("BLOCKED_CONFIGURATION"); });
  it("DMARC absent → BLOCKED_CONFIGURATION", async () => { expect((await base(COMM, { dns: mkDns(false) })).domains.communications.status).toBe("BLOCKED_CONFIGURATION"); });
  it("Resend webhook listing unavailable (404) → NOT_IMPLEMENTED (not READY)", async () => { const r = await base(COMM, { http: mkHttp({ resendWebhook: { ok: false, status: 404, body: null } }) }); expect(r.domains.communications.status).toBe("NOT_IMPLEMENTED"); });
  it("Resend webhook at wrong url → BLOCKED_CONFIGURATION", async () => { expect((await base(COMM, { http: mkHttp({ resendWebhook: { ok: true, status: 200, body: { data: [{ endpoint: "https://evil.test/x", events: ["email.delivered"] }] } } }) })).domains.communications.status).toBe("BLOCKED_CONFIGURATION"); });
  it("missing communications webhook route in build → BLOCKED_CONFIGURATION", async () => { expect((await base(COMM, { webhookRoute: (d: string) => (d === "communications" ? "absent" : "build") })).domains.communications.status).toBe("BLOCKED_CONFIGURATION"); });
});

describe("P8.7.1 — SIGNATURE (official URL + webhook)", () => {
  it("official sandbox URL + auth + registered webhook → READY_SANDBOX", async () => { expect((await base(SIG)).domains.signature.status).toBe("READY_SANDBOX"); });
  it("arbitrary HTTPS URL → BLOCKED_CONFIGURATION", async () => { expect((await base({ ...SIG, CLONESTORE_SIGNATURE_API_URL: "https://evil.example/v3" })).domains.signature.status).toBe("BLOCKED_CONFIGURATION"); });
  it("Yousign key rejected → BLOCKED_PERMISSION", async () => { expect((await base(SIG, { http: mkHttp({ yousign: { ok: false, status: 403, body: null } }) })).domains.signature.status).toBe("BLOCKED_PERMISSION"); });
  it("Yousign webhook listing unavailable (404) → NOT_IMPLEMENTED", async () => { expect((await base(SIG, { http: mkHttp({ yousignWebhook: { ok: false, status: 404, body: null } }) })).domains.signature.status).toBe("NOT_IMPLEMENTED"); });
  it("Yousign webhook not registered → BLOCKED_CONFIGURATION", async () => { expect((await base(SIG, { http: mkHttp({ yousignWebhook: { ok: true, status: 200, body: { data: [] } } }) })).domains.signature.status).toBe("BLOCKED_CONFIGURATION"); });
});

describe("P8.7.1 — STORAGE (signed-URL never inferred)", () => {
  it("private bucket readable but signed-URL not proven → BLOCKED_CONFIGURATION (never READY)", async () => {
    const r = await base(STG);
    expect(r.domains.storage.status).toBe("BLOCKED_CONFIGURATION");
    expect((r.domains.storage.checks as Array<any>).find((c) => c.name === "storage.signed_url").status).toBe("BLOCKED_CONFIGURATION");
    expect((r.domains.storage.checks as Array<any>).find((c) => c.name === "storage.bucket").status).toBe("READY_LIVE");
  });
  it("public bucket → BLOCKED_CONFIGURATION", async () => { expect((await base({ ...STG, SUPABASE_STORAGE_PUBLIC: "true" })).domains.storage.status).toBe("BLOCKED_CONFIGURATION"); });
  it("service key rejected → BLOCKED_PERMISSION", async () => { expect((await base(STG, { http: mkHttp({ bucket: { ok: false, status: 401, body: null } }) })).domains.storage.status).toBe("BLOCKED_PERMISSION"); });
});

describe("P8.7.1 — opt-in exact values", () => {
  it("=true/=1/valid-email accepted; false/0/no/placeholder/bad-email rejected", () => {
    expect(evaluateOptIn("CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED", { CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED: "true" }).ok).toBe(true);
    expect(evaluateOptIn("CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED", { CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED: "false" }).ok).toBe(false);
    expect(evaluateOptIn("CLONESTORE_COMMUNICATION_TEST_CONSENT", { CLONESTORE_COMMUNICATION_TEST_CONSENT: "no" }).ok).toBe(false);
    expect(evaluateOptIn("PIERRE_RUNTIME_INFRA_SMOKE", { PIERRE_RUNTIME_INFRA_SMOKE: "0" }).ok).toBe(false);
    expect(evaluateOptIn("PIERRE_RUNTIME_INFRA_SMOKE", { PIERRE_RUNTIME_INFRA_SMOKE: "1" }).ok).toBe(true);
    expect(evaluateOptIn("CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL", { CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL: "not-an-email" }).ok).toBe(false);
    expect(evaluateOptIn("CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL", { CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL: "signer@acme.test" }).ok).toBe(true);
  });
  it("legacy check: signature domain READY but opt-in '=false' → BLOCKED_CONFIGURATION", async () => {
    const r = await base({ ...SIG, CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED: "false", CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL: "signer@acme.test" });
    expect(r.domains.signature.status).toBe("READY_SANDBOX");
    expect(r.legacy_checks["check:p83-b3-live-signature"].status).toBe("BLOCKED_CONFIGURATION");
  });
  it("legacy check: domain READY + valid opt-ins → mirrors the domain status (not blocked by opt-ins)", async () => {
    const r = await base({ ...SIG, CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED: "true", CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL: "signer@acme.test" });
    expect(r.legacy_checks["check:p83-b3-live-signature"].status).toBe("READY_SANDBOX");
  });
});

describe("P8.7.1 — role matrix anti-drift vs migrations", () => {
  // normalise BOTH literal grants and dynamic array-loop grants, then assert the matrix is backed by SQL.
  const migDir = resolve(process.cwd(), "supabase/migrations");
  const sql = readdirSync(migDir).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).map((f) => readFileSync(resolve(migDir, f), "utf-8")).join("\n");
  const fnName = (raw: string) => raw.replace(/^['"\s]+|['"\s]+$/g, "").replace(/\(.*$/, "").trim();
  // 1) named function arrays
  const arrays: Record<string, string[]> = {};
  for (const m of sql.matchAll(/(\w+)\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/g)) {
    arrays[m[1]] = m[2].split(",").map((x) => fnName(x)).filter(Boolean);
  }
  const grantsByRole: Record<string, Set<string>> = {};
  const add = (role: string, fn: string) => { (grantsByRole[role] ??= new Set()).add(fn); };
  // 2) array-loop grants: foreach fn in array X loop ... grant execute on function %s to ROLE
  for (const m of sql.matchAll(/foreach\s+fn\s+in\s+array\s+(\w+)\s+loop\s+execute\s+format\('grant execute on function %s to (pierre_rt_\w+)'/g)) {
    for (const fn of arrays[m[1]] || []) add(m[2], fn);
  }
  // 3) literal/dynamic direct grants
  for (const m of sql.matchAll(/grant\s+execute\s+on\s+function\s+([a-z_][a-z0-9_]*)\s*(?:\([^)]*\))?\s+to\s+(pierre_rt_[a-z_]+)/gi)) {
    add(m[2], fnName(m[1]));
  }
  it("every critical role is in the matrix", () => {
    for (const role of ["pierre_rt_runtime_worker", "pierre_rt_runtime_scheduler", "pierre_rt_runtime_planner", "pierre_rt_communication_worker", "pierre_rt_communication_webhook", "pierre_rt_billing_webhook", "pierre_rt_customer_activation_worker"]) {
      expect(ROLE_PERMISSION_MATRIX[role], `${role} missing from matrix`).toBeTruthy();
    }
  });
  it("every matrix mustExecute function has a real grant to its role in the migrations", () => {
    for (const [role, spec] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      for (const fn of (spec as any).mustExecute) {
        expect(grantsByRole[role]?.has(fn), `migrations do not grant EXECUTE on ${fn} to ${role}`).toBe(true);
      }
    }
  });
});

describe("P8.7.1 — CLI report/strict + secret-free output (subprocess)", () => {
  function cli(extraEnv: Record<string, string>, args: string[]): { status: number | null; out: string; err: string; parsed: any } {
    const b: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) b[k] = v;
    for (const k of Object.keys(b)) if (/^(STRIPE_|RESEND_|CLONESTORE_|PIERRE_|SUPABASE_|NEXT_PUBLIC_|FILE_STORAGE_|DATABASE_URL|SUPABASE_DB_URL|EMAIL_PROVIDER|CRON_SECRET)/.test(k)) delete b[k];
    b.NODE_ENV = "test";
    const r = spawnSync("node", [CLI, ...args], { encoding: "utf-8", env: { ...b, ...extraEnv } as NodeJS.ProcessEnv });
    return { status: r.status, out: r.stdout, err: r.stderr, parsed: JSON.parse(r.stdout) };
  }
  it("report exits 0 with blockers; strict exits non-zero; both emit JSON; no SKIPPED_EXTERNAL", () => {
    const rep = cli({}, ["--no-probe"]); expect(rep.status).toBe(0); expect(rep.parsed.phase).toBe("P8.7.1"); expect(rep.out).not.toContain("SKIPPED_EXTERNAL");
    const strict = cli({}, ["--no-probe", "--strict"]); expect(strict.status).not.toBe(0); expect(strict.parsed.ready_for_p87_2).toBe(false);
  });
  it("an injected secret never appears in stdout or stderr", () => {
    const r = cli({ STRIPE_SECRET_KEY: "sk_live_LEAKCANARY0123456789abc" }, ["--no-probe"]);
    expect(r.out).not.toContain("LEAKCANARY0123456789abc"); expect(r.err).not.toContain("LEAKCANARY0123456789abc");
  });
});
