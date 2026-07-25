import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { submitOfferForValidation } from "../recruitment";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 recruitment DEPTH — real SQL proof of the FULL workflow through the runtime handlers:
// requisition → candidate → application → interview → feedback → offer (draft, NEVER auto-sent).
// Proves each business object persists, tenant isolation, human-decision floor, and governed refusals.

let harness: Harness | null = null;
const missionId = "10000000-0000-0000-0000-000000000abc";
afterAll(async () => { await harness?.close(); });

async function seedMission(h: Harness): Promise<string> {
  await h.db.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
    [missionId, h.companyA, h.userA, "recruit a sales manager for Lyon", "00000000-0000-0000-0000-000000000c01", "00000000-0000-0000-0000-000000000e01", "p22-recruit-idem"]);
  return missionId;
}

function ctxFor(h: Harness, payload: Record<string, unknown>): RuntimeActionContext {
  const db: SqlExecutor = h.db; const tenant: TenantContext = h.ctx("A");
  return {
    appDb: db, tenant, companyId: h.companyA, missionId,
    missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555",
    jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload, deps: {},
    assertLease: async () => {}, checkpoint: async () => {},
  };
}
const run = (h: Harness, key: string, payload: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[key](ctxFor(h, payload));

describe("P22 recruitment depth — full workflow on real SQL", () => {
  it("drives requisition → candidate → application → interview → feedback → offer, all persisted", async () => {
    harness = await createHarness();
    const h = harness;
    await seedMission(h);

    const req = await run(h, "recruitment.requisition.create", { role_title: "Responsable commercial", headcount: 1 });
    expect(req.status).toBe("succeeded");
    const requisitionId = String(req.output!.requisition_id);

    const cand = await run(h, "recruitment.candidate.ingest", { full_name: "Camille Roy", requisition_id: requisitionId, source: "linkedin" });
    expect(cand.status).toBe("succeeded");
    const candidateId = String(cand.output!.candidate_id);

    const app = await run(h, "recruitment.application.create", { candidate_id: candidateId, requisition_id: requisitionId, consent: true });
    expect(app.status).toBe("succeeded");

    const iv = await run(h, "recruitment.interview.prepare", { candidate_id: candidateId, requisition_id: requisitionId, interview_type: "manager", scheduled_at: "2026-08-10T09:00:00Z", participants: ["mgr@co"] });
    expect(iv.status).toBe("succeeded");
    expect(iv.output!.status).toBe("scheduled");
    const interviewId = String(iv.output!.interview_id);

    const fb = await run(h, "recruitment.feedback.record", { interview_id: interviewId, candidate_id: candidateId, recommendation: "advance", criteria: { competence: "strong" } });
    expect(fb.status).toBe("succeeded");
    expect(fb.output!.recommendation).toBe("advance");

    const offer = await run(h, "recruitment.offer.prepare", { candidate_id: candidateId, role_title: "Responsable commercial", proposed_comp: { base: 45000 } });
    expect(offer.status).toBe("succeeded");
    // The offer is a DRAFT — never auto-sent.
    expect(offer.output!.status).toBe("draft");

    // Every business object exists in SQL, tenant-scoped.
    const counts = await h.db.query<{ t: string; n: number }>(`
      select 'req' t, count(*)::int n from pierre_rt_recruitment_requisitions where company_id=$1
      union all select 'cand', count(*)::int from pierre_rt_recruitment_candidates where company_id=$1
      union all select 'app', count(*)::int from pierre_rt_recruitment_applications where company_id=$1
      union all select 'iv', count(*)::int from pierre_rt_recruitment_interviews where company_id=$1
      union all select 'fb', count(*)::int from pierre_rt_recruitment_feedback where company_id=$1
      union all select 'offer', count(*)::int from pierre_rt_recruitment_offers where company_id=$1
    `, [h.companyA]);
    for (const row of counts.rows) expect(row.n, `table ${row.t}`).toBe(1);
  });

  it("offer is never auto-sent — it only advances to awaiting_validation via an explicit human step", async () => {
    const h = harness!;
    const offerRow = (await h.db.query<{ id: string; status: string }>(
      `select id, status from pierre_rt_recruitment_offers where company_id=$1 limit 1`, [h.companyA])).rows[0];
    expect(offerRow.status).toBe("draft"); // still draft after preparation
    const submitted = await submitOfferForValidation(h.db, h.ctx("A"), offerRow.id, null);
    expect(submitted.status).toBe("awaiting_validation"); // requires human validation before send — never 'sent' automatically
  });

  it("governed refusals — invalid recommendation + missing candidate never fake success", async () => {
    const h = harness!;
    const badRec = await run(h, "recruitment.feedback.record", { interview_id: "00000000-0000-0000-0000-0000000000fe", candidate_id: "00000000-0000-0000-0000-0000000000fd", recommendation: "hire_now" });
    expect(badRec.status).toBe("blocked");
    const badApp = await run(h, "recruitment.application.create", { candidate_id: "00000000-0000-0000-0000-0000000000fc" });
    expect(badApp.status).toBe("blocked");
  });

  it("tenant isolation — none of the recruitment objects leak into tenant B", async () => {
    const h = harness!;
    for (const t of ["pierre_rt_recruitment_requisitions", "pierre_rt_recruitment_candidates", "pierre_rt_recruitment_applications", "pierre_rt_recruitment_interviews", "pierre_rt_recruitment_feedback", "pierre_rt_recruitment_offers"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n, t).toBe(0);
    }
  });
});
