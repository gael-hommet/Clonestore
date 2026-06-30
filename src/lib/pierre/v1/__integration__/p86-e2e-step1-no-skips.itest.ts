// src/lib/pierre/v1/__integration__/p86-e2e-step1-no-skips.itest.ts
// PHASE 8.6 STEP 1 — the Step-1 E2E spec executes for real: no test.skip, no PLAYWRIGHT_RUN gate, no
// dependency on live Supabase accounts (TEST_EMAIL/TEST_PASSWORD).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const spec = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step1.spec.ts"), "utf-8");

// strip line comments so descriptive prose ("// no test.skip ...") can't trip the structural checks.
const code = spec.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

describe("P8.6 STEP 1 E2E spec has no skips / live gating", () => {
  it("contains no test.skip(...) call", () => { expect(code).not.toMatch(/test\.skip\(/); });
  it("does not gate on PLAYWRIGHT_RUN", () => { expect(code).not.toMatch(/PLAYWRIGHT_RUN/); });
  it("does not depend on live accounts", () => {
    expect(code).not.toMatch(/TEST_EMAIL/);
    expect(code).not.toMatch(/TEST_PASSWORD/);
  });
  it("declares exactly two tests", () => {
    const count = (spec.match(/\btest\(/g) ?? []).length;
    expect(count).toBe(2);
  });
});
