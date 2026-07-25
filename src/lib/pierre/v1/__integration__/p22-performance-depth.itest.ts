import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { createPerformanceObjective, createPerformanceActionItem, detectOverduePerformanceItems, computePerformanceCampaignProgress, buildPerformanceBrief } from "../performance";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 PERFORMANCE depth — real SQL. 80-employee annual campaign driven through the runtime: campaign →
// population → interviews → responses → summary (human-validated) → complete. Human-decision floor: NO
// interview completes without a validated summary; no auto score/promotion/sanction. Objectives/actions,
// overdue detection, three-mode SQL diff, tenant isolation, governed refusals.

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-000000000e01";
afterAll(async () => { await harness?.close(); });
function ctxFor(h: Harness, p: Record<string, unknown>): RuntimeActionContext {
  return { appDb: h.db as SqlExecutor, tenant: h.ctx("A") as TenantContext, companyId: h.companyA, missionId: MISSION, missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload: p, deps: {}, assertLease: async () => {}, checkpoint: async () => {} };
}
const run = (h: Harness, k: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[k](ctxFor(h, p));
async function seedMission(h: Harness, id: string) {
  await h.db.query(`insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key) values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`, [id, h.companyA, h.userA, "campagne annuelle 80 salariés", `perf-${id}`]);
}

describe("P22 performance depth — 80-employee annual campaign on real SQL", () => {
  let campaignId = ""; let firstParticipant = ""; let firstInterview = "";
  it("builds population, interviews, responses, and completes ONLY a human-validated interview", async () => {
    harness = await createHarness();
    const h = harness; await seedMission(h, MISSION);
    for (let i = 0; i < 80; i++) await createEmployee(h.db, h.ctx("A"), { first_name: `P${i}`, last_name: `N${i}` });

    const c = await run(h, "performance.campaign.create", { campaign_key: "annual-2026", title: "Entretiens annuels 2026", mode: "copilote", idempotency_key: "annual-2026" });
    expect(c.status).toBe("succeeded"); campaignId = String(c.output!.campaign_id);
    const pop = await run(h, "performance.campaign.population.build", { campaign_id: campaignId });
    expect(Number(pop.output!.population)).toBeGreaterThanOrEqual(80);

    firstParticipant = (await h.db.query<{ id: string }>(`select id from pierre_rt_performance_campaign_participants where company_id=$1 and campaign_id=$2 limit 1`, [h.companyA, campaignId])).rows[0].id;
    const iv = await run(h, "performance.interview.create", { campaign_id: campaignId, participant_id: firstParticipant });
    expect(iv.status).toBe("succeeded"); firstInterview = String(iv.output!.interview_id);

    // Cannot complete before a validated summary — human-decision floor.
    const early = await run(h, "performance.interview.complete", { interview_id: firstInterview });
    expect(early.status).toBe("blocked");

    await run(h, "performance.response.record", { interview_id: firstInterview, respondent_type: "manager", question_key: "q1", response: "solide" });
    await run(h, "performance.response.record", { interview_id: firstInterview, respondent_type: "employee", question_key: "q1", response: "d'accord" });
    const sum = await run(h, "performance.summary.generate", { interview_id: firstInterview });
    expect(sum.status).toBe("succeeded");
    await run(h, "performance.summary.validate", { interview_id: firstInterview });
    const done = await run(h, "performance.interview.complete", { interview_id: firstInterview });
    expect(done.status).toBe("succeeded");
    const ivStatus = (await h.db.query<{ status: string }>(`select status from pierre_rt_performance_interviews where company_id=$1 and id=$2`, [h.companyA, firstInterview])).rows[0].status;
    expect(ivStatus).toBe("completed");
  });

  it("creates objectives + action items and detects overdue items deterministically", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    const empId = (await h.db.query<{ employee_id: string }>(`select employee_id from pierre_rt_performance_interviews where company_id=$1 and id=$2`, [h.companyA, firstInterview])).rows[0].employee_id;
    await createPerformanceObjective(h.db, ctxA, { employee_id: empId, interview_id: firstInterview, campaign_id: campaignId, title: "Améliorer la relation client", due_on: "2026-12-31" });
    await createPerformanceActionItem(h.db, ctxA, { employee_id: empId, interview_id: firstInterview, campaign_id: campaignId, action: "Formation relation client", due_on: "2026-01-01" });
    const overdue = await detectOverduePerformanceItems(h.db, ctxA, "2026-07-25");
    expect(overdue.overdue).toBeGreaterThanOrEqual(1);
    await computePerformanceCampaignProgress(h.db, ctxA, campaignId);
    const brief = await buildPerformanceBrief(h.db, ctxA, campaignId);
    expect(Number(brief.population)).toBeGreaterThanOrEqual(80);
    expect(Number(brief.completed_interviews)).toBe(1);
  });

  it("three modes → different persisted interview status for the same participant flow", async () => {
    const h = harness!;
    const statuses: Record<string, string> = {};
    for (const mode of ["brouillon", "copilote", "autonomie"] as const) {
      const c = await run(h, "performance.campaign.create", { campaign_key: `c-${mode}`, title: `C ${mode}`, mode, idempotency_key: `c-${mode}` });
      const cid = String(c.output!.campaign_id);
      await run(h, "performance.campaign.population.build", { campaign_id: cid });
      const part = (await h.db.query<{ id: string }>(`select id from pierre_rt_performance_campaign_participants where company_id=$1 and campaign_id=$2 limit 1`, [h.companyA, cid])).rows[0].id;
      const iv = await run(h, "performance.interview.create", { campaign_id: cid, participant_id: part });
      statuses[mode] = String(iv.output!.status);
    }
    expect(statuses.brouillon).toBe("draft");
    expect(statuses.copilote).toBe("prepared");
    expect(statuses.autonomie).toBe("scheduled");
  });

  it("governed refusals + tenant isolation", async () => {
    const h = harness!;
    const bad = await run(h, "performance.interview.create", { campaign_id: campaignId, participant_id: "00000000-0000-0000-0000-0000000000fe" });
    expect(bad.status).toBe("blocked");
    for (const t of ["pierre_rt_performance_campaigns", "pierre_rt_performance_interviews", "pierre_rt_performance_summaries", "pierre_rt_performance_objectives"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n, t).toBe(0);
    }
  });
});
