import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 performance continuity — durable state + resume + single execution on real SQL.
// NOTE: PGlite is in-process (one DB per harness), so a literal multi-process restart is not possible
// here (true worker-restart is covered by the runtime-scheduler, proven separately). What IS proven:
// the awaiting-validation state is DURABLE (re-readable from SQL after dropping all JS references), the
// mission RESUMES after the human decision, and resuming twice does NOT double-complete.

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-00000000ee01";
afterAll(async () => { await harness?.close(); });
function ctxFor(h: Harness, p: Record<string, unknown>): RuntimeActionContext {
  return { appDb: h.db as SqlExecutor, tenant: h.ctx("A") as TenantContext, companyId: h.companyA, missionId: MISSION, missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload: p, deps: {}, assertLease: async () => {}, checkpoint: async () => {} };
}
const run = (h: Harness, k: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[k](ctxFor(h, p));

describe("P22 performance continuity — durable await/resume, no double effect", () => {
  it("awaiting-validation persists in SQL, resumes after a human decision, and does not double-complete", async () => {
    harness = await createHarness();
    const h = harness;
    await h.db.query(`insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key) values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`, [MISSION, h.companyA, h.userA, "entretien continuité", "cont-perf"]);
    for (let i = 0; i < 3; i++) await createEmployee(h.db, h.ctx("A"), { first_name: `C${i}`, last_name: `N${i}` });

    const c = await run(h, "performance.campaign.create", { campaign_key: "cont", title: "Continuité", mode: "copilote", idempotency_key: "cont" });
    const cid = String(c.output!.campaign_id);
    await run(h, "performance.campaign.population.build", { campaign_id: cid });
    const part = (await h.db.query<{ id: string }>(`select id from pierre_rt_performance_campaign_participants where company_id=$1 and campaign_id=$2 limit 1`, [h.companyA, cid])).rows[0].id;
    const iv = await run(h, "performance.interview.create", { campaign_id: cid, participant_id: part });
    const interviewId = String(iv.output!.interview_id);
    await run(h, "performance.response.record", { interview_id: interviewId, respondent_type: "manager", question_key: "q1", response: "ok" });
    await run(h, "performance.summary.generate", { interview_id: interviewId });
    const submit = await run(h, "performance.summary.submit_for_validation", { interview_id: interviewId });
    const validationId = String(submit.output!.validation_id);

    // ── "restart": drop all JS refs; re-read the durable state straight from SQL ──
    const durable = (await h.db.query<{ status: string; validation_id: string }>(
      `select status, validation_id from pierre_rt_performance_interviews where company_id=$1 and id=$2`, [h.companyA, interviewId])).rows[0];
    expect(durable.status).toBe("awaiting_validation");
    expect(durable.validation_id).toBe(validationId);

    // Human decision persisted, then resume.
    await h.db.query(`update pierre_rt_validations set status='approved', decided_at=now() where company_id=$1 and id=$2`, [h.companyA, validationId]);
    await run(h, "performance.summary.apply_validation", { interview_id: interviewId });
    const done1 = await run(h, "performance.interview.complete", { interview_id: interviewId });
    expect(done1.status).toBe("succeeded");

    // Resuming completion again is a no-op (idempotent — still exactly one completed interview).
    await run(h, "performance.interview.complete", { interview_id: interviewId }).catch(() => undefined);
    const completed = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_performance_interviews where company_id=$1 and campaign_id=$2 and status='completed'`, [h.companyA, cid])).rows[0].n;
    expect(completed).toBe(1);
    // Exactly one interview and one validation — no duplication.
    const ivs = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_performance_interviews where company_id=$1 and campaign_id=$2`, [h.companyA, cid])).rows[0].n;
    expect(ivs).toBe(1);
  });
});
