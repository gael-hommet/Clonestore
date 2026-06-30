// src/lib/pierre/v1/__integration__/p86-e2e-six-tests-discovered.itest.ts
// PHASE 8.6 STEP 2 — the P8.6 Playwright config discovers exactly the SIX real customer-lifecycle E2E
// (2 from Step 1 + 4 from Step 2), single-worker, no retries, self-booting (no manual server / live infra).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const step1 = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step1.spec.ts"), "utf-8");
const step2 = readFileSync(resolve(process.cwd(), "e2e/p86-customer-lifecycle-step2.spec.ts"), "utf-8");
const config = readFileSync(resolve(process.cwd(), "playwright.p86.config.ts"), "utf-8");

const strip = (s: string) => s.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const count = (s: string) => (strip(s).match(/\btest\(/g) ?? []).length;

describe("P8.6 — six real E2E discovered by the P8.6 config", () => {
  it("step 1 declares 2 tests and step 2 declares 4 → six total", () => {
    expect(count(step1)).toBe(2);
    expect(count(step2)).toBe(4);
    expect(count(step1) + count(step2)).toBe(6);
  });
  it("the config matches BOTH step spec files", () => {
    expect(config).toMatch(/testMatch:\s*\/p86-customer-lifecycle-step\[12\]\\.spec\\.ts\//);
  });
  it("runs single-worker, no retries (deterministic shared test DB)", () => {
    expect(config).toMatch(/workers:\s*1/);
    expect(config).toMatch(/retries:\s*0/);
  });
  it("is self-booting on the in-process test runtime — no manual server or live infra", () => {
    expect(config).toMatch(/webServer/);
    expect(config).toMatch(/PIERRE_E2E_TEST_MODE:\s*["']1["']/);
    expect(config).toMatch(/npx next dev/);
    expect(config).not.toMatch(/reuseExistingServer:\s*true/);
  });
});
