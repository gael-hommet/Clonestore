// PHASE 8.5 — the durable runtime core: a compiled plan becomes an immutable plan version + a mission
// RUN + typed STEP RUNS; a worker claims jobs, executes typed actions, and the DAG advances step by
// step until the run completes. Plan creation is idempotent; the worker drives readiness via the DB.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

const PLAN = { steps: [
  { step_key: "a", action_key: "mission.noop" },
  { step_key: "b", action_key: "mission.noop", depends_on: ["a"] },
  { step_key: "c", action_key: "mission.noop", depends_on: ["a", "b"] },
] };

describe("P8.5 runtime core (plan → run → steps → jobs → completion)", () => {
  it("compiles a plan, creates a run, and drives the DAG to completion", async () => {
    const mission = await seedMission(h, owner);
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: PLAN });
    expect(created.ok).toBe(true);
    const runId = created.mission_run_id!;

    // only the 0-dependency step is ready/queued at first
    expect((await stepStatuses(h, runId)).a).toBe("queued");
    expect((await stepStatuses(h, runId)).b).toBe("pending");

    // tick 1 → a succeeds, b becomes ready+queued
    const t1 = await runPierreRuntimeJobs(h.db, owner, { worker: "w1" });
    expect(t1.succeeded).toBe(1);
    expect((await stepStatuses(h, runId)).a).toBe("succeeded");
    expect((await stepStatuses(h, runId)).b).toBe("queued");
    expect((await stepStatuses(h, runId)).c).toBe("pending"); // c still waits on b

    // tick 2 → b succeeds, c becomes ready
    await runPierreRuntimeJobs(h.db, owner, { worker: "w1" });
    expect((await stepStatuses(h, runId)).c).toBe("queued");
    expect((await runState(h, runId)).status).toBe("running");

    // tick 3 → c succeeds, run completes
    await runPierreRuntimeJobs(h.db, owner, { worker: "w1" });
    const steps = await stepStatuses(h, runId);
    expect([steps.a, steps.b, steps.c]).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("plan creation is idempotent — the same plan yields the same run", async () => {
    const mission = await seedMission(h, owner);
    const r1 = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: PLAN });
    const r2 = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: PLAN });
    expect(r2.mission_run_id).toBe(r1.mission_run_id);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_mission_runs where company_id=$1`, [h.companyA])).rows[0].n).toBe(1);
  });

  it("a plan with a cycle is refused (no run created)", async () => {
    const mission = await seedMission(h, owner);
    const bad = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
      { step_key: "x", action_key: "mission.noop", depends_on: ["y"] },
      { step_key: "y", action_key: "mission.noop", depends_on: ["x"] },
    ] } });
    expect(bad.ok).toBe(false);
    expect(bad.blockers).toContain("cycle_detected");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_mission_runs where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);
  });

  it("a plan with an unknown action is refused", async () => {
    const mission = await seedMission(h, owner);
    const bad = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [{ step_key: "z", action_key: "database.query" }] } });
    expect(bad.ok).toBe(false);
    expect(bad.blockers.some((b) => b.startsWith("unknown_or_obsolete_action"))).toBe(true);
  });
});
