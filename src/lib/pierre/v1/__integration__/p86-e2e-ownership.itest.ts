// src/lib/pierre/v1/__integration__/p86-e2e-ownership.itest.ts
// PHASE 8.6 STEP 2 — ownership transfer + last-owner protection run through the governed routes
// (transfer-ownership / suspend / leave), never via direct SQL. The E2E asserts exact statuses for every
// API call: transfer 200, non-owner 403, transfer-to-suspended 409, last-owner-leave 409, transfer-back 200,
// and that an active owner always remains.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");
const transfer = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/members/[id]/transfer-ownership/route.ts"), "utf-8");
const leave = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/members/leave/route.ts"), "utf-8");

describe("P8.6 ownership routes are governed (no client authority)", () => {
  it("transfer-ownership is product-gated (ADMIN) through the governed api", () => {
    // PHASE 8.6 — ownership changes are ADMIN-gated via withProductAccess (was a bare withTenant).
    expect(transfer).toMatch(/withProductAccess\(req,\s*"admin"/);
    expect(transfer).toMatch(/apiTransferOwnership/);
  });
  it("leave goes through the governed api + tenant context (self-service exit, ungated)", () => {
    expect(leave).toMatch(/withTenant/);
    expect(leave).toMatch(/apiLeaveCompany/);
  });
});

describe("P8.6 ownership E2E asserts the exact statuses + last-owner invariant", () => {
  it("transfer A→B 200, A-not-owner 403, transfer-to-suspended 409, last-owner-leave 409, transfer-back 200", () => {
    expect(spec).toMatch(/transfer A→B"\)\.toBe\(200\)/);
    expect(spec).toMatch(/A not owner"\)\.toBe\(403\)/);
    expect(spec).toMatch(/transfer to suspended target → conflict"\)\.toBe\(409\)/);
    expect(spec).toMatch(/last owner cannot leave"\)\.toBe\(409\)/);
    expect(spec).toMatch(/transfer B→A"\)\.toBe\(200\)/);
  });
  it("an active owner always remains (count === 1 at the end)", () => {
    expect(spec).toMatch(/active_owner_counts/);
    expect(spec).toMatch(/active_owners\)\.toBe\(1\)/);
  });
  it("ownership transitions never poke the members table directly via the control plane", () => {
    expect(spec).not.toMatch(/update\s+pierre_rt_members/i);
    expect(spec).not.toMatch(/insert\s+into\s+pierre_rt_members/i);
  });
});
