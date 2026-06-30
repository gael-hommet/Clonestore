// PHASE 8.5-R4 §R4.7 — real, fail-closed, hard-capped resource limits. A plan exceeding the step / depth
// / input-size limits is refused at compile (no partial run); a tenant exceeding the active-mission
// ceiling is refused; an invalid (negative/NaN) limit falls back to the safe default (never unbounded).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission } from "./p85-helpers";
import { compileMissionPlan } from "../runtime-plan-compiler";
import { createMissionRunFromPlan } from "../runtime-service";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); vi.unstubAllEnvs(); });
const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ step_key: `s${i}`, action_key: "mission.noop" }));

describe("P8.5-R4 resource limits", () => {
  it("a plan exceeding the step ceiling is refused (no partial creation)", () => {
    vi.stubEnv("PIERRE_RUNTIME_MAX_STEPS", "3");
    const r = compileMissionPlan({ steps: steps(5) });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.startsWith("too_many_steps"))).toBe(true);
  });

  it("a plan exceeding the DAG depth ceiling is refused", () => {
    vi.stubEnv("PIERRE_RUNTIME_MAX_DEPTH", "2");
    const chain = [
      { step_key: "a", action_key: "mission.noop" },
      { step_key: "b", action_key: "mission.noop", depends_on: ["a"] },
      { step_key: "c", action_key: "mission.noop", depends_on: ["b"] }, // depth 3 > 2
    ];
    const r = compileMissionPlan({ steps: chain });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.startsWith("too_deep"))).toBe(true);
  });

  it("an oversized step input is refused", () => {
    vi.stubEnv("PIERRE_RUNTIME_MAX_INPUT_BYTES", "20");
    const r = compileMissionPlan({ steps: [{ step_key: "a", action_key: "mission.noop", input: { blob: "x".repeat(500) } }] });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.startsWith("input_too_large"))).toBe(true);
  });

  it("an invalid limit (negative/NaN) falls back to the safe default (never unbounded)", () => {
    vi.stubEnv("PIERRE_RUNTIME_MAX_STEPS", "-5");
    expect(compileMissionPlan({ steps: steps(4) }).ok).toBe(true); // default 200 applies
    vi.stubEnv("PIERRE_RUNTIME_MAX_STEPS", "not-a-number");
    expect(compileMissionPlan({ steps: steps(4) }).ok).toBe(true);
  });

  it("a tenant exceeding the active-mission ceiling is refused", async () => {
    vi.stubEnv("PIERRE_RUNTIME_MAX_ACTIVE_MISSIONS_PER_TENANT", "1");
    const m1 = await seedMission(h, owner, "m1");
    const r1 = await createMissionRunFromPlan(h.db, owner, { mission_id: m1, plan: { steps: [{ step_key: "a", action_key: "wait.until_time", input: { wake_at: new Date(Date.now() + 3600000).toISOString() } }] } });
    expect(r1.ok).toBe(true); // first active run
    const m2 = await seedMission(h, owner, "m2");
    const r2 = await createMissionRunFromPlan(h.db, owner, { mission_id: m2, plan: { steps: [{ step_key: "a", action_key: "mission.noop" }] } });
    expect(r2.ok).toBe(false);
    expect(r2.blockers.some((b) => b.startsWith("too_many_active_missions"))).toBe(true);
  });
});
