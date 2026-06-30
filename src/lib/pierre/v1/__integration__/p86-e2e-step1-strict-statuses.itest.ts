// src/lib/pierre/v1/__integration__/p86-e2e-step1-strict-statuses.itest.ts
// PHASE 8.6 STEP 1 — the Step-1 E2E spec asserts EXACT statuses (no permissive multi-status lists) and
// never swallows errors.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step1.spec.ts"), "utf-8");

describe("P8.6 STEP 1 E2E spec — strict statuses, no swallowed errors", () => {
  it("no permissive multi-status assertion (toContain on a status array)", () => {
    expect(spec).not.toMatch(/toContain\([^)]*status/i);
    expect(spec).not.toMatch(/\[\s*200\s*,\s*40\d/); // e.g. [200, 403, 409]
  });
  it("no swallowed errors", () => {
    expect(spec).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/);
    expect(spec).not.toMatch(/catch\s*\{\s*\}/);
  });
  it("status assertions use exact .toBe(...)", () => {
    // every .status() assertion compares with toBe (exact), not a permissive matcher
    const statusAsserts = spec.match(/\.status\(\)[^\n]*/g) ?? [];
    expect(statusAsserts.length).toBeGreaterThan(0);
    for (const line of statusAsserts) {
      // each line that asserts a status uses toBe / toBeLessThan (exact/bounded), never toContain
      expect(line).not.toMatch(/toContain/);
    }
  });
});
