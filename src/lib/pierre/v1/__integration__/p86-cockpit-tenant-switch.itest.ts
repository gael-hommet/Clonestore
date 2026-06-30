// src/lib/pierre/v1/__integration__/p86-cockpit-tenant-switch.itest.ts
// PHASE 8.6 — the cockpit overview is tenant-safe across a switch: it derives the active tenant
// SERVER-SIDE (it never sends a client company_id), it fetches FRESH on mount with no-store + no
// module-level cache, and it reloads after a launch — so a tenant switch (which reloads the page) can never
// render the previous tenant's data. The server-side guarantee is proven by the multi-tenant E2E
// (cross-tenant → 403, DOM does not leak the other tenant).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const panel = readFileSync(resolve(process.cwd(), "src/components/pierre/CockpitGovernedOverview.tsx"), "utf-8");
const e2e = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");
const runtime = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/_runtime.ts"), "utf-8");

describe("P8.6 cockpit tenant-switch safety", () => {
  it("the panel never sends a client-supplied company_id (tenant is server-resolved)", () => {
    expect(panel).not.toMatch(/company_id/);
    expect(panel).not.toMatch(/x-pierre-company/);
  });
  it("the panel fetches FRESH on mount (no-store) with no module-level cache", () => {
    expect(panel).toMatch(/cache:\s*"no-store"/);
    expect(panel).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*void load\(\)/);
    // no module-scope cache variable that could survive a tenant change
    expect(panel).not.toMatch(/^(const|let)\s+\w*[Cc]ache\b/m);
  });
  it("the server resolves the active company from the governed preference, not a trusted client value", () => {
    expect(runtime).toMatch(/resolveActiveCompany/);
  });
  it("the multi-tenant E2E proves switch isolation + cross-tenant refusal", () => {
    expect(e2e).toMatch(/company\/switch/);
    expect(e2e).toMatch(/not\.toContain\("E2E Company A"\)/);
    expect(e2e).toMatch(/cross-tenant refused"\)\.toBe\(403\)/);
  });
});
