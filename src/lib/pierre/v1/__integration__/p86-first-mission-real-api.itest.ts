// src/lib/pierre/v1/__integration__/p86-first-mission-real-api.itest.ts
// PHASE 8.6 STEP 2 — the first-mission route is the REAL P8.5 path: product-gated WRITE_COSTLY, creates a
// governed run via createMissionRunFromPlan under the planner role, and NEVER marks the mission completed
// in the route (completion happens only through the real worker after a real validation).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/missions/first/route.ts"), "utf-8");
const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

describe("P8.6 first-mission route is the real P8.5 path", () => {
  it("is gated WRITE_COSTLY via withProductAccess", () => {
    expect(code).toMatch(/withProductAccess\(\s*req\s*,\s*["']write_costly["']/);
  });
  it("uses the real planner + createMissionRunFromPlan (no second runtime)", () => {
    expect(code).toMatch(/createMissionRunFromPlan/);
    expect(code).toMatch(/withRuntimePlannerTransaction/);
    expect(code).toMatch(/runPlanner:\s*withRuntimePlannerTransaction/);
  });
  it("never marks the mission/run completed in the route, and swallows nothing", () => {
    expect(code).not.toMatch(/status\s*=\s*['"]completed['"]/);
    expect(code).not.toMatch(/update\s+pierre_rt_mission_runs/i);
    expect(code).not.toMatch(/\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/);
  });
  it("returns the initial run handle, not a terminal result", () => {
    expect(code).toMatch(/mission_id/);
    expect(code).toMatch(/run_id:\s*created\.mission_run_id/);
  });
});
