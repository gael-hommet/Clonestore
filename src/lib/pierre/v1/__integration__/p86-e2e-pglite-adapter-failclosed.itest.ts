// src/lib/pierre/v1/__integration__/p86-e2e-pglite-adapter-failclosed.itest.ts
// PHASE 8.6 — the in-process PGlite test runtime DB is reachable ONLY under PIERRE_E2E_TEST_MODE=1 +
// non-production, and is FAIL-CLOSED in production (refuses to load). When enabled it is the genuine
// governed schema (v1→v28 migrations + specialized roles + the product-access tables), shared by the
// product-gate path — not a mock or an entitlement bypass.

import { describe, it, expect, beforeEach, afterEach } from "vitest";

const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = { MODE: process.env.PIERRE_E2E_TEST_MODE, NE: process.env.NODE_ENV, DB: process.env.DATABASE_URL }; });
afterEach(() => {
  const set = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; };
  set("PIERRE_E2E_TEST_MODE", saved.MODE); set("NODE_ENV", saved.NE); set("DATABASE_URL", saved.DB);
});

describe("P8.6 PGlite test runtime adapter — gating + fail-closed", () => {
  it("isE2ETestRuntime() requires the flag AND non-production", async () => {
    const db = await import("../db");
    env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1";
    expect(db.isE2ETestRuntime()).toBe(true);
    delete env.PIERRE_E2E_TEST_MODE;
    expect(db.isE2ETestRuntime()).toBe(false);
    env.PIERRE_E2E_TEST_MODE = "1"; env.NODE_ENV = "production";
    expect(db.isE2ETestRuntime()).toBe(false);
  });

  it("the test runtime DB refuses to load in production", async () => {
    const { getTestRuntimeDb } = await import("../test-runtime-db");
    env.NODE_ENV = "production";
    await expect(getTestRuntimeDb()).rejects.toThrow(/forbidden in production/);
  });

  it("production without DATABASE_URL stays fail-closed (no silent PGlite fallback)", async () => {
    const db = await import("../db");
    env.NODE_ENV = "production"; delete env.DATABASE_URL; delete env.PIERRE_E2E_TEST_MODE;
    // getRuntimeDb returns the pg-backed executor lazily; the pool throws when no URL is configured.
    await expect(db.getRuntimeDb().then((x) => x.query("select 1"))).rejects.toThrow();
  });

  it("when enabled, it is the genuine governed schema: v1→v28 tables + roles + product-access tables", async () => {
    env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1";
    const { getTestRuntimeDb } = await import("../test-runtime-db");
    const db = await getTestRuntimeDb();
    // core + v28 tables exist
    for (const t of ["pierre_rt_companies", "pierre_rt_members", "pierre_rt_product_entitlements", "pierre_rt_customer_activations", "pierre_rt_onboarding_sessions", "pierre_rt_company_access_events"]) {
      const r = await db.query<{ reg: string | null }>(`select to_regclass($1) as reg`, [t]);
      expect(r.rows[0].reg, `${t} present`).toBeTruthy();
    }
    // specialized roles exist
    const roles = await db.query<{ rolname: string }>(`select rolname from pg_roles where rolname in ('pierre_rt_app','pierre_rt_billing_webhook','pierre_rt_customer_activation_worker')`);
    expect(roles.rows.length).toBe(3);
    // the SAME instance is shared (cached) — a second call returns a usable executor over the same data
    const company = (await import("../sql")).newUuid();
    await db.query(`insert into pierre_rt_companies (id, name, status) values ($1,'Adapter Co','active')`, [company]);
    const db2 = await getTestRuntimeDb();
    const back = await db2.query<{ n: number }>(`select count(*)::int as n from pierre_rt_companies where id=$1`, [company]);
    expect(back.rows[0].n).toBe(1);
  });
});
