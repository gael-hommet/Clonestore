// src/lib/pierre/v1/__integration__/p86-e2e-multi-tenant.itest.ts
// PHASE 8.6 STEP 2 — tenant switching is server-authoritative: the switch route derives the user from the
// session and persists the active-company preference; cross-tenant access is refused. The E2E proves
// switch A→B + cross-tenant 403 without trusting a client company_id as authority.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const switchSrc = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/company/switch/route.ts"), "utf-8");
const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");

describe("P8.6 multi-tenant switching", () => {
  it("switch derives the user from the session (withUser), not the body", () => {
    expect(switchSrc).toMatch(/withUser/);
    expect(switchSrc).toMatch(/apiSwitchCompany\(db,\s*identity\.user_id/);
  });
  it("the E2E proves switch persistence + DOM isolation + cross-tenant 403", () => {
    expect(spec).toMatch(/company\/switch/);
    expect(spec).toMatch(/not\.toContain\("E2E Company A"\)/);
    expect(spec).toMatch(/cross-tenant refused"\)\.toBe\(403\)/);
  });
  it("the E2E never trusts a client company_id as authority (cross-tenant uses a non-member company)", () => {
    // the forbidden company is created by a DIFFERENT user and accessed via the header → 403.
    expect(spec).toMatch(/companyC/);
    expect(spec).toMatch(/H\(companyC\)/);
  });
});
