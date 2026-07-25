import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 closure actions — the authoritative runtime actions added in Reprise 10 must exist AND produce real
// business objects (never a status flip): training plans/items/report/invitations, performance action
// items/objectives/overdue, template sections+questions, response completeness, report, reminders. Delivery
// channels are honestly INTEGRATION_UNAVAILABLE (no fake "sent"); document rendering is RENDERER_ACTIVATION_PENDING.

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-0000000000ca";
afterAll(async () => { await harness?.close(); });
function ctxFor(h: Harness, p: Record<string, unknown>): RuntimeActionContext {
  return { appDb: h.db as SqlExecutor, tenant: h.ctx("A") as TenantContext, companyId: h.companyA, missionId: MISSION, missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload: p, deps: {}, assertLease: async () => {}, checkpoint: async () => {} };
}
const run = (h: Harness, k: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[k](ctxFor(h, p));

describe("P22 perf+training closure actions — real objects, honest channels", () => {
  it("training plans: create → item.add → complete gate (open item blocks) → report/invitations honest", async () => {
    harness = await createHarness();
    const h = harness;
    await h.db.query(`insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key) values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`, [MISSION, h.companyA, h.userA, "plan de formation", "clo-plan"]);
    const emp = await createEmployee(h.db, h.ctx("A"), { first_name: "Plan", last_name: "Emp" });

    const req = await run(h, "training.requirement.create", { requirement_key: "sec", title: "Sécurité", source_type: "company_policy", source_ref: "pol-1", mandatory: true });
    await run(h, "training.requirement.validate_source", { requirement_key: "sec" });
    const reqId = String(req.output!.requirement_id);
    const session = await run(h, "training.session.create", { title: "S1", requirement_id: reqId });
    // Invitations: recipients computed for real, delivery INTEGRATION_UNAVAILABLE.
    await run(h, "training.enrollment.create", { session_id: String(session.output!.session_id), employee_id: emp.id, requirement_id: reqId, mode: "copilote" });
    const inv = await run(h, "training.invitations.send", { session_id: String(session.output!.session_id) });
    expect(inv.output!.status).toBe("INTEGRATION_UNAVAILABLE");
    expect(Number(inv.output!.recipients)).toBeGreaterThanOrEqual(1);
    expect(Number(inv.output!.delivered)).toBe(0);

    const plan = await run(h, "training.plan.create", { plan_key: "annual-sec", title: "Plan sécurité annuel", mode: "copilote", idempotency_key: "annual-sec" });
    expect(plan.status).toBe("succeeded");
    const planId = String(plan.output!.plan_id);
    // Idempotent by idempotency_key.
    const planAgain = await run(h, "training.plan.create", { plan_key: "annual-sec", title: "Plan sécurité annuel", mode: "copilote", idempotency_key: "annual-sec" });
    expect(String(planAgain.output!.plan_id)).toBe(planId);
    const item = await run(h, "training.plan.item.add", { plan_id: planId, requirement_id: reqId, source_type: "company_policy", source_ref: "pol-1", priority: "high" });
    const itemId = String(item.output!.plan_item_id);
    // Cannot complete while an item is open.
    const early = await run(h, "training.plan.complete", { plan_id: planId });
    expect(early.status).toBe("blocked");
    await h.db.query(`update pierre_rt_training_plan_items set status='done' where company_id=$1 and id=$2`, [h.companyA, itemId]);
    const done = await run(h, "training.plan.complete", { plan_id: planId });
    expect(done.status).toBe("succeeded");
    const planStatus = (await h.db.query<{ status: string }>(`select status from pierre_rt_training_plans where company_id=$1 and id=$2`, [h.companyA, planId])).rows[0].status;
    expect(planStatus).toBe("completed");

    const report = await run(h, "training.report.generate", {});
    expect(report.output!.computed_from).toBe("sql");
    expect(report.output!.document_status).toBe("RENDERER_ACTIVATION_PENDING");
  });

  it("performance: template sections/questions → response completeness (real) → action items/objectives/overdue → report/reminders", async () => {
    const h = harness!;
    // A template + a required question, wired to an interview (completeness is enforced against it).
    const tpl = (await h.db.query<{ id: string }>(`insert into pierre_rt_performance_templates (id, company_id, template_key, title) values (gen_random_uuid(),$1,'annual','Entretien annuel') returning id`, [h.companyA])).rows[0].id;
    const section = await run(h, "performance.template.section.add", { template_id: tpl, section_key: "bilan", title: "Bilan", ordinal: 1, required: true });
    const q = await run(h, "performance.template.question.add", { section_id: String(section.output!.section_id), question_key: "q_bilan", label: "Votre bilan ?", response_type: "long_text", required: true });
    expect(q.status).toBe("succeeded");

    const c = await run(h, "performance.campaign.create", { campaign_key: "clo", title: "Clôture", mode: "copilote", idempotency_key: "clo-camp" });
    const cid = String(c.output!.campaign_id);
    for (let i = 0; i < 2; i++) await createEmployee(h.db, h.ctx("A"), { first_name: `P${i}`, last_name: `Q${i}` });
    await run(h, "performance.campaign.population.build", { campaign_id: cid });
    const part = (await h.db.query<{ id: string }>(`select id from pierre_rt_performance_campaign_participants where company_id=$1 and campaign_id=$2 limit 1`, [h.companyA, cid])).rows[0].id;
    const iv = await run(h, "performance.interview.create", { campaign_id: cid, participant_id: part });
    const interviewId = String(iv.output!.interview_id);
    await h.db.query(`update pierre_rt_performance_interviews set template_id=$3 where company_id=$1 and id=$2`, [h.companyA, interviewId, tpl]);

    // Required question unanswered → completeness is honestly INCOMPLETE.
    const before = await run(h, "performance.response.completeness.validate", { interview_id: interviewId });
    expect(before.output!.complete).toBe(false);
    expect((before.output!.missing as string[]).includes("q_bilan")).toBe(true);
    // Answer it → complete.
    await run(h, "performance.response.record", { interview_id: interviewId, respondent_type: "employee", question_key: "q_bilan", response: "RAS" });
    const after = await run(h, "performance.response.completeness.validate", { interview_id: interviewId });
    expect(after.output!.complete).toBe(true);
    expect(Number(after.output!.total_required)).toBe(1);

    // Action items + objectives are real rows; overdue detection is deterministic.
    const emp = (await h.db.query<{ id: string }>(`select id from pierre_rt_employees where company_id=$1 limit 1`, [h.companyA])).rows[0].id;
    const ai = await run(h, "performance.action_item.create", { employee_id: emp, campaign_id: cid, action: "Formation à planifier", due_on: "2020-01-01" });
    expect(ai.status).toBe("succeeded");
    const obj = await run(h, "performance.objective.create", { employee_id: emp, campaign_id: cid, title: "Objectif Q3", success_criteria: "mesurable" });
    expect(obj.status).toBe("succeeded");
    const overdue = await run(h, "performance.overdue.detect", { as_of: "2026-07-25" });
    expect(Number(overdue.output!.overdue)).toBeGreaterThanOrEqual(1);

    const report = await run(h, "performance.report.generate", { campaign_id: cid });
    expect(report.output!.computed_from).toBe("sql");
    expect(report.output!.document_status).toBe("RENDERER_ACTIVATION_PENDING");
    const rem = await run(h, "performance.reminders.send", { campaign_id: cid });
    expect(rem.output!.status).toBe("INTEGRATION_UNAVAILABLE");
    expect(Number(rem.output!.delivered)).toBe(0);

    // Tenant isolation: none of the new objects leak to company B.
    for (const t of ["pierre_rt_training_plans", "pierre_rt_training_plan_items", "pierre_rt_performance_template_sections", "pierre_rt_performance_template_questions", "pierre_rt_performance_action_plans"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n, t).toBe(0);
    }
  });
});
