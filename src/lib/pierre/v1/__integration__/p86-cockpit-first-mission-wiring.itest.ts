// src/lib/pierre/v1/__integration__/p86-cockpit-first-mission-wiring.itest.ts
// PHASE 8.6 — the "Lancer la première mission de Pierre" CTA calls the REAL route
// POST /api/pierre/v1/missions/first and then RELOADS the server snapshot. It never fabricates a client
// terminal/optimistic mission state. The panel is actually mounted in the cockpit page.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const panel = readFileSync(resolve(process.cwd(), "src/components/pierre/CockpitGovernedOverview.tsx"), "utf-8");
const page = readFileSync(resolve(process.cwd(), "src/app/agents/pierre/use/page.tsx"), "utf-8");

describe("P8.6 cockpit first-mission CTA wiring", () => {
  it("the CTA label is present", () => {
    expect(panel).toMatch(/Lancer la première mission de Pierre/);
  });
  it("the CTA calls the real POST /api/pierre/v1/missions/first route", () => {
    expect(panel).toMatch(/fetch\("\/api\/pierre\/v1\/missions\/first",\s*\{\s*method:\s*"POST"/);
  });
  it("after launch it RELOADS the server snapshot (no optimistic/client terminal state)", () => {
    expect(panel).toMatch(/await load\(\)/);
    expect(panel).not.toMatch(/status:\s*["']completed["']/);
    expect(panel).not.toMatch(/setView\([^)]*completed/);
  });
  it("the governed overview panel is mounted in the cockpit page", () => {
    expect(page).toMatch(/import CockpitGovernedOverview/);
    expect(page).toMatch(/<CockpitGovernedOverview\s*\/>/);
  });
});
