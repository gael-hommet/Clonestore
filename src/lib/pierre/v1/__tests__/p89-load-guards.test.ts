// PHASE 8.9 — tests for the load-harness anti-Production guards (fail-closed).
import { describe, it, expect } from "vitest";
import {
  isProductionTarget, isLocalTarget, assertSyntheticBenchEnv, syntheticTenantId,
  assertSyntheticTenant, percentile, stats, SYNTHETIC_TENANT_PREFIX,
} from "../p89-load-guards.mjs";

describe("P8.9 load guards — anti-Production", () => {
  it("detects production targets (clonestore.pro + managed DB hosts)", () => {
    expect(isProductionTarget("https://clonestore.pro")).toBe(true);
    expect(isProductionTarget("https://www.clonestore.pro")).toBe(true);
    expect(isProductionTarget("postgres://u:p@db.abc.pooler.supabase.com:5432/x")).toBe(true);
    expect(isProductionTarget("postgres://u:p@ep-x.neon.tech/db")).toBe(true);
    expect(isProductionTarget("postgres://u:p@localhost:5432/x")).toBe(false);
  });

  it("detects local targets", () => {
    expect(isLocalTarget("postgres://u:p@localhost:5432/x")).toBe(true);
    expect(isLocalTarget("postgres://u:p@127.0.0.1:5432/x")).toBe(true);
    expect(isLocalTarget("https://clonestore.pro")).toBe(false);
  });

  it("refuses any mode other than dry-run|local", () => {
    expect(() => assertSyntheticBenchEnv({ mode: "production" })).toThrow();
    expect(() => assertSyntheticBenchEnv({ mode: "remote" })).toThrow();
    expect(() => assertSyntheticBenchEnv({ mode: undefined })).toThrow();
  });

  it("refuses a Production DB target even in local mode", () => {
    expect(() => assertSyntheticBenchEnv({ mode: "local", env: { P89_DATABASE_URL: "postgres://u:p@db.pooler.supabase.com/x" } })).toThrow(/Production target/i);
    expect(() => assertSyntheticBenchEnv({ mode: "local", env: { P89_TARGET_URL: "https://clonestore.pro" } })).toThrow();
  });

  it("refuses real-provider live smoke during load", () => {
    expect(() => assertSyntheticBenchEnv({ mode: "local", env: { CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED: "true" } })).toThrow();
    expect(() => assertSyntheticBenchEnv({ mode: "local", env: { CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED: "true" } })).toThrow();
  });

  it("refuses explicit HTTP load against the app", () => {
    expect(() => assertSyntheticBenchEnv({ mode: "local", env: { CLONESTORE_PUBLIC_APP_URL: "https://clonestore.pro", P89_ALLOW_APP_HTTP: "1" } })).toThrow(/never issue HTTP load/i);
  });

  it("accepts a clean dry-run and local synthetic env", () => {
    expect(assertSyntheticBenchEnv({ mode: "dry-run", env: {} }).ok).toBe(true);
    const r = assertSyntheticBenchEnv({ mode: "local", env: { P89_DATABASE_URL: "postgres://u:p@localhost:5432/x" } });
    expect(r.engine).toBe("pglite-synthetic");
    expect(r.providers).toBe("simulated");
  });

  it("synthetic tenant ids are prefixed + deterministic; assertSyntheticTenant fails-closed", () => {
    const a = syntheticTenantId("run1", 3), b = syntheticTenantId("run1", 3);
    expect(a).toBe(b);
    expect(a.startsWith(SYNTHETIC_TENANT_PREFIX)).toBe(true);
    expect(assertSyntheticTenant(a)).toBe(true);
    expect(() => assertSyntheticTenant("real-company-123")).toThrow();
    expect(() => assertSyntheticTenant("")).toThrow();
  });

  it("percentile/stats are correct", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    const s = stats([10, 20, 30, 40]); expect(s.n).toBe(4); expect(s.max).toBe(40);
    expect(stats([]).n).toBe(0);
  });
});
