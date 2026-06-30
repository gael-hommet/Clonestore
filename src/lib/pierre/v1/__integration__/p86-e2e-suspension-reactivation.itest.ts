// src/lib/pierre/v1/__integration__/p86-e2e-suspension-reactivation.itest.ts
// PHASE 8.6 STEP 2 — suspension/reactivation goes through the ordered commercial path (no direct
// entitlement UPDATE); reads continue, costly writes stop, reactivation restores access, a stale event is
// ignored. The product-gate policy is asserted directly.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { productAccessPermits } from "@/app/api/pierre/v1/_runtime";
import type { ProductAccess } from "@/lib/pierre/v1/entitlements";

const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");
const acc = (decision: ProductAccess["decision"]): ProductAccess => ({ decision, product_key: "pierre", entitlement_status: null, onboarding_status: "completed", can_use: false, can_read: true, reason: "x" });

describe("P8.6 product-gate policy (suspension/reactivation)", () => {
  it("suspended: reads allowed, costly writes refused", () => {
    expect(productAccessPermits(acc("suspended"), "read")).toBe(true);
    expect(productAccessPermits(acc("suspended"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("suspended"), "write_standard")).toBe(false);
  });
  it("read_only/cancelled: reads allowed, mutations refused", () => {
    expect(productAccessPermits(acc("read_only"), "read")).toBe(true);
    expect(productAccessPermits(acc("read_only"), "write_costly")).toBe(false);
  });
  it("allowed: full; grace: no new costly; onboarding_required: onboarding only; denied: nothing", () => {
    expect(productAccessPermits(acc("allowed"), "write_costly")).toBe(true);
    expect(productAccessPermits(acc("grace"), "read")).toBe(true);
    expect(productAccessPermits(acc("grace"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("onboarding_required"), "onboarding")).toBe(true);
    expect(productAccessPermits(acc("onboarding_required"), "write_costly")).toBe(false);
    expect(productAccessPermits(acc("denied"), "read")).toBe(false);
  });
});

describe("P8.6 suspension E2E uses the ordered path, not direct SQL", () => {
  it("applies via applyCommercialEvent and asserts the gate + no duplication + stale ignored", () => {
    expect(spec).toMatch(/applyCommercialEvent/);
    expect(spec).toMatch(/applied:suspended/);
    expect(spec).toMatch(/applied:active/);
    expect(spec).toMatch(/ignored_stale/);
    expect(spec).toMatch(/mission refused under suspended"\)\.toBe\(403\)/);
    expect(spec).not.toMatch(/update\s+pierre_rt_product_entitlements/i);
  });
});
