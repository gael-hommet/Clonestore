// src/lib/pierre/v1/__integration__/p86-e2e-runtime-control-plane.itest.ts
// PHASE 8.6 STEP 2 — the runtime/scheduler E2E control-plane routes are secret-gated + production-refused
// and drive the REAL P8.5 worker/scheduler (no direct terminal writes).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = { M: env.PIERRE_E2E_TEST_MODE, S: env.PIERRE_E2E_SECRET, N: env.NODE_ENV }; });
afterEach(() => { const s = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; }; s("PIERRE_E2E_TEST_MODE", saved.M); s("PIERRE_E2E_SECRET", saved.S); s("NODE_ENV", saved.N); });
const post = (secret?: string, body: unknown = { company_id: "c" }) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-pierre-e2e-secret": secret } : {}) }, body: JSON.stringify(body) });

describe("P8.6 runtime/scheduler control-plane — fail-closed", () => {
  it("runtime-tick + scheduler-tick refuse without secret and in production", async () => {
    env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "s12345678";
    const rt = await import("@/app/api/internal/e2e/runtime-tick/route");
    const sc = await import("@/app/api/internal/e2e/scheduler-tick/route");
    expect((await rt.POST(post("wrong"))).status).toBe(403);
    expect((await sc.POST(post("wrong"))).status).toBe(403);
    env.NODE_ENV = "production";
    expect((await rt.POST(post("s12345678"))).status).toBe(404);
    expect((await sc.POST(post("s12345678"))).status).toBe(404);
  });
});

describe("P8.6 runtime/scheduler ops use the real services, no direct terminal writes", () => {
  const src = readFileSync(resolve(process.cwd(), "src/lib/pierre/v1/e2e-control-plane.ts"), "utf-8");
  it("e2eRuntimeTick uses the real worker under the worker role", () => {
    expect(src).toMatch(/createRuntimeWorkerExecutor/);
    expect(src).toMatch(/runPierreRuntimeJobs/);
    expect(src).toMatch(/withRuntimeWorkerTransaction/);
  });
  it("e2eSchedulerTick uses the real scheduler", () => {
    expect(src).toMatch(/createRuntimeSchedulerExecutor/);
    expect(src).toMatch(/runPierreRuntimeScheduler/);
  });
  it("performs no direct write to runtime/business tables", () => {
    expect(src).not.toMatch(/update\s+pierre_rt_(mission_runs|step_runs|runtime_jobs|validations|product_entitlements)/i);
    expect(src).not.toMatch(/insert\s+into\s+pierre_rt_/i);
  });
});
