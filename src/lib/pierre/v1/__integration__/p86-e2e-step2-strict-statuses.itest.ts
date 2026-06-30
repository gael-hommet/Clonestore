// src/lib/pierre/v1/__integration__/p86-e2e-step2-strict-statuses.itest.ts
// PHASE 8.6 STEP 2 — the Step-2 E2E spec asserts EXACT statuses for every API call. The only bounded
// assertion permitted is a single page-navigation reachability check (.toBeLessThan(400)). No permissive
// multi-status lists, no toContain(...status), no .toBeLessThan(500), no swallowed errors.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");

describe("P8.6 STEP 2 E2E spec — strict statuses, no swallowed errors", () => {
  it("no permissive multi-status assertion", () => {
    expect(spec).not.toMatch(/toContain\([^)]*status/i);
    expect(spec).not.toMatch(/\[\s*200\s*,\s*40\d/);      // e.g. [200, 403, 409]
    expect(spec).not.toMatch(/\[\s*40\d\s*,/);            // e.g. [403, 409]
  });
  it("never uses the lax .toBeLessThan(500) bound", () => {
    expect(spec).not.toMatch(/toBeLessThan\(\s*500\s*\)/);
  });
  it("no swallowed errors", () => {
    expect(spec).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/);
    expect(spec).not.toMatch(/catch\s*\{\s*\}/);
  });
  it("every .status() assertion is exact toBe(...), except the single page-nav reachability bound", () => {
    const lines = spec.match(/\.status\(\)[^\n]*/g) ?? [];
    expect(lines.length).toBeGreaterThan(0);
    let boundedNav = 0;
    for (const line of lines) {
      expect(line).not.toMatch(/toContain/);
      if (/toBeLessThan\(\s*400\s*\)/.test(line)) { boundedNav++; continue; }
      // anything else asserting a status must be an exact equality
      expect(line, line).toMatch(/toBe\(\s*\d{3}\s*\)/);
    }
    // exactly one bounded page-navigation reachability check is allowed
    expect(boundedNav).toBe(1);
  });
});
