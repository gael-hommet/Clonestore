// src/lib/pierre/v1/__integration__/p86-e2e-step2-no-terminal-seeds.itest.ts
// PHASE 8.6 STEP 2 — the Step-2 E2E never fabricates a terminal state: the spec drives every business
// outcome (provisioning, missions, validations, suspension, ownership) through the real governed client
// routes + control-plane ticks, and the control plane itself writes nothing directly to client truth tables.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");
const cp = readFileSync(resolve(process.cwd(), "src/lib/pierre/v1/e2e-control-plane.ts"), "utf-8");

describe("P8.6 STEP 2 — no terminal seeding", () => {
  it("the spec issues no direct SQL against client truth tables", () => {
    expect(spec).not.toMatch(/insert\s+into\s+pierre_rt_/i);
    expect(spec).not.toMatch(/update\s+pierre_rt_/i);
    expect(spec).not.toMatch(/delete\s+from\s+pierre_rt_/i);
  });
  it("the control plane writes nothing directly to client truth tables", () => {
    expect(cp).not.toMatch(/insert\s+into\s+pierre_rt_/i);
    expect(cp).not.toMatch(/update\s+pierre_rt_/i);
    expect(cp).not.toMatch(/delete\s+from\s+pierre_rt_/i);
  });
  it("terminal outcomes are produced by real routes + governed ticks only", () => {
    // missions/validations via real client routes; entitlements via the ordered commercial path; runs via
    // the real worker/scheduler. No hand-written terminal rows.
    expect(spec).toMatch(/\/api\/pierre\/v1\/missions\/first/);
    expect(spec).toMatch(/\/api\/pierre\/v1\/validations\/.*\/approve/);
    expect(spec).toMatch(/runtimeTick/);
    expect(spec).toMatch(/schedulerTick/);
    expect(spec).toMatch(/applyCommercialEvent/);
    expect(spec).toMatch(/transfer-ownership/);
  });
});
