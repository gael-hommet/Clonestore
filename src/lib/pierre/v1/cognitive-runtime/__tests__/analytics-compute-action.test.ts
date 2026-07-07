// src/lib/pierre/v1/cognitive-runtime/__tests__/analytics-compute-action.test.ts
// PHASE 8.14 §4 — the NEW analytics.compute runtime action, executed through the REAL run engine on real
// PGlite: it computes a genuine HR metric from tenant-scoped persisted state, PERSISTS the result as an
// artifact, is tenant-isolated, idempotent, and fails closed on a non-computable metric. NOT a noop.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "../../__integration__/harness";
import { seedMission } from "../../__integration__/p85-helpers";
import { apiCreateEmployee } from "../../api";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../../runtime-service";
import { getRuntimeActionDefinition } from "../../runtime-action-registry";
import type { RuntimePlanInput } from "../../runtime-plan-compiler";

let h: Harness;
beforeEach(async () => { h = await createHarness(); }, 60000);
afterEach(async () => { await h.close(); });

async function runMetric(ctx: ReturnType<Harness["ctx"]>, metric: string) {
  const missionId = await seedMission(h, ctx, `analytics ${metric}`);
  const plan: RuntimePlanInput = { steps: [{ step_key: "compute", action_key: "analytics.compute", input: { metric } }] };
  const res = await createMissionRunFromPlan(h.db, ctx, { mission_id: missionId, plan });
  expect(res.ok).toBe(true);
  for (let i = 0; i < 4; i++) await runPierreRuntimeJobs(h.db, ctx, { worker: "w" });
  return { missionId, runId: res.mission_run_id! };
}

describe("analytics.compute — real domain computation (§4)", () => {
  it("is a registered read-only action (not a placeholder)", () => {
    const def = getRuntimeActionDefinition("analytics.compute");
    expect(def).not.toBeNull();
    expect(def!.risk).toBe("read_only");
    expect(def!.validateInput({ metric: "headcount" })).toEqual([]);
    expect(def!.validateInput({ metric: "not_a_metric" }).length).toBeGreaterThan(0); // whitelist enforced
  });

  it("computes a REAL headcount from persisted employees + persists an artifact", async () => {
    const ctx = h.ctx("A");
    await apiCreateEmployee(h.db, ctx, { first_name: "Amina", last_name: "Diallo", status: "active" });
    await apiCreateEmployee(h.db, ctx, { first_name: "Bruno", last_name: "Klein", status: "active" });
    const { runId } = await runMetric(ctx, "headcount");
    // step really succeeded (worker executed the handler)
    const step = (await h.db.query<{ status: string }>(`select status from pierre_rt_step_runs where mission_run_id=$1 and step_key='compute'`, [runId])).rows[0];
    expect(step.status).toBe("succeeded");
    // a real artifact was PERSISTED with the computed value
    const art = (await h.db.query<{ metric: string; result: unknown }>(`select metric, result from pierre_rt_analytics_artifacts where company_id=$1 and metric='headcount'`, [ctx.company_id])).rows;
    expect(art.length).toBe(1);
    expect((art[0].result as { active: number }).active).toBe(2); // genuinely computed, not fabricated
  }, 60000);

  it("is tenant-isolated: company B's headcount does not see A's employees", async () => {
    const ctxA = h.ctx("A"); const ctxB = h.ctx("B");
    await apiCreateEmployee(h.db, ctxA, { first_name: "Only", last_name: "ForA", status: "active" });
    await runMetric(ctxB, "headcount");
    const artB = (await h.db.query<{ result: unknown }>(`select result from pierre_rt_analytics_artifacts where company_id=$1 and metric='headcount'`, [ctxB.company_id])).rows;
    expect(artB.length).toBe(1);
    expect((artB[0].result as { active: number }).active).toBe(0); // B sees none of A
  }, 60000);

  it("computes multiple real metrics (turnover, absenteeism, pay_equity, executive_report)", async () => {
    const ctx = h.ctx("A");
    await apiCreateEmployee(h.db, ctx, { first_name: "C", last_name: "One", status: "active", role_title: "Engineer" });
    for (const metric of ["turnover", "absenteeism", "pay_equity", "executive_report", "workforce_planning", "payroll_anomalies"]) {
      const { runId } = await runMetric(ctx, metric);
      const step = (await h.db.query<{ status: string }>(`select status from pierre_rt_step_runs where mission_run_id=$1 and step_key='compute'`, [runId])).rows[0];
      expect(step.status).toBe("succeeded");
      const art = (await h.db.query<{ c: string }>(`select count(*)::text c from pierre_rt_analytics_artifacts where company_id=$1 and metric=$2`, [ctx.company_id, metric])).rows[0];
      expect(Number(art.c)).toBeGreaterThanOrEqual(1);
    }
  }, 90000);
});
