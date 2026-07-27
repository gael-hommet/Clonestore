import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";

// P22 Reprise 12 — GENERIC output→input threading in the authoritative runtime. A downstream step's
// input references an UPSTREAM step's OUTPUT via {$ref:{step,output}}; the runtime substitutes the real
// runtime-generated id before the handler runs. No hardcoded ids, no per-action wrappers. This is the
// enabler that lets mission-pack chains flow (campaign_id → action_plan, requirement_id → session, …).

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

async function drainJobs(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    const ready = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_jobs where company_id=$1 and status in ('queued','ready')`, [h.companyA])).rows[0].n;
    if (ready === 0) break;
  }
}

describe("P22 authoritative runtime — step output→input threading", () => {
  it("a runtime-generated campaign_id flows into a downstream action via {$ref} (real, not hardcoded)", async () => {
    const m = await seedMission(h, owner, "threading");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "campaign", action_key: "performance.campaign.create", input: { campaign_key: "thr", title: "Campagne", mode: "copilote" } },
      { step_key: "plan", action_key: "performance.action_plan.create", input: { title: "Plan issu de la campagne", campaign_id: { $ref: { step: "campaign", output: "campaign_id" } } }, depends_on: ["campaign"] },
    ] } });
    const runId = created.mission_run_id!;
    await drainJobs();
    expect((await runState(h, runId)).status).toBe("completed");
    // The action plan's campaign_id equals the REAL campaign id created at runtime by the upstream step.
    const camp = (await h.db.query<{ id: string }>(`select id from pierre_rt_performance_campaigns where company_id=$1 and campaign_key='thr'`, [h.companyA])).rows[0];
    const plan = (await h.db.query<{ campaign_id: string }>(`select campaign_id from pierre_rt_performance_action_plans where company_id=$1`, [h.companyA])).rows[0];
    expect(plan.campaign_id).toBe(camp.id);
  });

  it("multi-level threading: requirement_id → session AND (plan_id + requirement_id) → plan item", async () => {
    const m = await seedMission(h, owner, "threading2");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "policy", action_key: "hr.policy.create", input: { policy_key: "thr-pol", title: "Politique" } },
      { step_key: "req", action_key: "training.requirement.create", input: { requirement_key: "thr-req", title: "Exigence", source_type: "company_policy", source_ref: "thr-pol", mandatory: true }, depends_on: ["policy"] },
      { step_key: "validate", action_key: "training.requirement.validate_source", input: { requirement_key: "thr-req" }, depends_on: ["req"] },
      { step_key: "session", action_key: "training.session.create", input: { title: "Session", requirement_id: { $ref: { step: "req", output: "requirement_id" } } }, depends_on: ["validate"] },
      { step_key: "plan", action_key: "training.plan.create", input: { plan_key: "thr-plan", title: "Plan formation" }, depends_on: ["validate"] },
      { step_key: "item", action_key: "training.plan.item.add", input: { plan_id: { $ref: { step: "plan", output: "plan_id" } }, requirement_id: { $ref: { step: "req", output: "requirement_id" } }, session_id: { $ref: { step: "session", output: "session_id" } } }, depends_on: ["plan", "session"] },
    ] } });
    const runId = created.mission_run_id!;
    await drainJobs();
    expect((await runState(h, runId)).status).toBe("completed");
    const req = (await h.db.query<{ id: string }>(`select id from pierre_rt_training_requirements where company_id=$1 and requirement_key='thr-req'`, [h.companyA])).rows[0];
    const session = (await h.db.query<{ id: string }>(`select id from pierre_rt_training_sessions where company_id=$1`, [h.companyA])).rows[0];
    const item = (await h.db.query<{ plan_id: string; requirement_id: string; session_id: string }>(`select plan_id, requirement_id, session_id from pierre_rt_training_plan_items where company_id=$1`, [h.companyA])).rows[0];
    // Every id on the plan item was threaded from a real upstream runtime output.
    expect(session).toBeTruthy();
    expect(item.requirement_id).toBe(req.id);
    expect(item.session_id).toBe(session.id);
  });

  it("a {$ref} to a non-existent output field is a governed BLOCK (never a silent pass)", async () => {
    const m = await seedMission(h, owner, "threading3");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "campaign", action_key: "performance.campaign.create", input: { campaign_key: "thr3", title: "C", mode: "copilote" } },
      { step_key: "plan", action_key: "performance.action_plan.create", input: { title: "Plan", campaign_id: { $ref: { step: "campaign", output: "does_not_exist" } } }, depends_on: ["campaign"] },
    ] } });
    const runId = created.mission_run_id!;
    await drainJobs();
    // campaign succeeded; plan is BLOCKED because its ref could not resolve; the run does not complete.
    expect((await stepStatuses(h, runId)).campaign).toBe("succeeded");
    expect((await stepStatuses(h, runId)).plan).not.toBe("succeeded");
    expect((await runState(h, runId)).status).not.toBe("completed");
  });

  it("the compiler REFUSES a {$ref} to a step that is not upstream (ref_not_upstream)", async () => {
    const m = await seedMission(h, owner, "threading4");
    // 'plan' references 'campaign' but does NOT depend on it → must be refused at compile (ref_not_upstream).
    const r = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "campaign", action_key: "performance.campaign.create", input: { campaign_key: "thr4", title: "C", mode: "copilote" } },
      { step_key: "plan", action_key: "performance.action_plan.create", input: { title: "Plan", campaign_id: { $ref: { step: "campaign", output: "campaign_id" } } } },
    ] } }) as unknown as { ok: boolean; blockers?: string[] };
    expect(r.ok).toBe(false);
    expect((r.blockers ?? []).some((b) => b.startsWith("ref_not_upstream"))).toBe(true);
    // No run was persisted.
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_mission_runs where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);
  });
});
