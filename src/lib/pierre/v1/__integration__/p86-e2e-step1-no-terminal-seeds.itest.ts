// src/lib/pierre/v1/__integration__/p86-e2e-step1-no-terminal-seeds.itest.ts
// PHASE 8.6 STEP 1 — the E2E control plane never fabricates a terminal state directly: it has NO direct
// INSERT/UPDATE into company/membership/entitlement/onboarding/mission tables — every terminal state is
// produced by the real governed services. seed only allocates a minimal identity.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(process.cwd(), "src/lib/pierre/v1/e2e-control-plane.ts"), "utf-8");

describe("P8.6 STEP 1 control plane — no terminal seeding", () => {
  it("performs NO direct write (insert/update/delete) to client truth tables", () => {
    // reads (select) are allowed for assertions; writes must go through governed services only.
    expect(src).not.toMatch(/insert\s+into\s+pierre_rt_/i);
    expect(src).not.toMatch(/update\s+pierre_rt_/i);
    expect(src).not.toMatch(/delete\s+from\s+pierre_rt_/i);
  });
  it("drives terminal states only through the real governed services", () => {
    // the real services / governed functions are used, not hand-written terminal rows
    expect(src).toMatch(/runCustomerActivationTick/);            // provisioning via the worker
    expect(src).toMatch(/ingestCommercialEvent|markActivationProvisioning/); // commercial path
    expect(src).toMatch(/applyCommercialEvent/);                  // entitlement transitions
  });
  it("seed only allocates an identity (no company/membership/entitlement)", () => {
    const seed = src.slice(src.indexOf("export function e2eSeedUser"), src.indexOf("export", src.indexOf("export function e2eSeedUser") + 1));
    expect(seed).toMatch(/return\s*\{\s*user_id/);
    expect(seed).not.toMatch(/insert|company|membership|entitlement|provision/i);
  });
});
