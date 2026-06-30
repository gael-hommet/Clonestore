// src/lib/pierre/v1/__integration__/p86-cockpit-no-private-mocks.itest.ts
// PHASE 8.6 — the governed cockpit data layer (snapshot service + route + the overview panel) carries NO
// mocked business truth: no localStorage/sessionStorage, no mock/demo/fixture/placeholder/sample data, no
// Math.random, no hardcoded counters, and no silent fallback that turns a failure into an empty/zero. The
// snapshot reads ONLY real pierre_rt_* tables; the panel renders ONLY from the server snapshot.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const snapshot = readFileSync(resolve(process.cwd(), "src/lib/pierre/v1/cockpit-snapshot.ts"), "utf-8");
const route = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/cockpit/snapshot/route.ts"), "utf-8");
const panel = readFileSync(resolve(process.cwd(), "src/components/pierre/CockpitGovernedOverview.tsx"), "utf-8");
const strip = (s: string) => s.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

describe("P8.6 cockpit governed layer — no mocked business truth", () => {
  for (const [name, raw] of [["snapshot-service", snapshot], ["snapshot-route", route], ["overview-panel", panel]] as const) {
    const code = strip(raw);
    it(`${name}: no localStorage/sessionStorage business truth`, () => {
      expect(code).not.toMatch(/localStorage/);
      expect(code).not.toMatch(/sessionStorage/);
    });
    it(`${name}: no mock/demo/fixture/placeholder/sample/hardcoded data, no Math.random`, () => {
      expect(code).not.toMatch(/\bmock\b/i);
      expect(code).not.toMatch(/\bdemo\b/i);
      expect(code).not.toMatch(/\bfixture\b/i);
      expect(code).not.toMatch(/\bplaceholder\b/i);
      expect(code).not.toMatch(/\bsample\b/i);
      expect(code).not.toMatch(/Math\.random/);
    });
    it(`${name}: no silent fallback turning an error into [] or 0`, () => {
      expect(code).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*return\s*(\[\]|0|\{\s*\})\s*;?\s*\}/);
      expect(code).not.toMatch(/\?\?\s*\[\]\s*;?\s*\/\/\s*fallback/i);
    });
  }

  it("the snapshot service reads REAL governed tables (not constants)", () => {
    expect(snapshot).toMatch(/from pierre_rt_companies/);
    expect(snapshot).toMatch(/pierre_rt_mission_runs/);
    expect(snapshot).toMatch(/pierre_rt_validations/);
    expect(snapshot).toMatch(/pierre_rt_members/);
    expect(snapshot).toMatch(/getEntitlement/);
    expect(snapshot).toMatch(/getOnboardingSession/);
  });

  it("the panel renders ONLY from the server snapshot endpoint", () => {
    expect(panel).toMatch(/\/api\/pierre\/v1\/cockpit\/snapshot/);
  });
});
