import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 miracle-grade — REAL SQL proof (PGlite + real migrations, incl. the new
// 2026-07-25__p22_hr_domain_business_objects.sql) that the 4 previously table-less semantic gaps now
// create genuine business objects: workforce plan, recruitment candidate, HR request, country config.
// SUCCESS_WITHOUT_BUSINESS_OBJECT = FAIL is asserted per action, plus tenant isolation + governed refusal.

let harness: Harness | null = null;
let missionId = "33333333-3333-3333-3333-333333333333";
afterAll(async () => { await harness?.close(); });

async function seedMission(h: Harness): Promise<string> {
  const id = "10000000-0000-0000-0000-000000000abc";
  await h.db.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
    [id, h.companyA, h.userA, "gap closure test mission", "00000000-0000-0000-0000-000000000c01", "00000000-0000-0000-0000-000000000e01", "p22-gap-idem"]);
  return id;
}

function ctxFor(db: SqlExecutor, tenant: TenantContext, companyId: string, payload: Record<string, unknown>): RuntimeActionContext {
  return {
    appDb: db, tenant, companyId,
    missionId, missionRunId: "44444444-4444-4444-4444-444444444444",
    stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666",
    idempotencyKey: "idem", payload, deps: {}, assertLease: async () => {}, checkpoint: async () => {},
  };
}

describe("P22 gap closure — real SQL business objects", () => {
  it("workforce.plan.create persists a real workforce plan", async () => {
    harness = await createHarness();
    const h = harness;
    missionId = await seedMission(h);
    const res = await RUNTIME_ACTION_HANDLERS["workforce.plan.create"](
      ctxFor(h.db, h.ctx("A"), h.companyA, { period: "2026-Q4", target_headcount: 12, proposed_positions: [{ role: "vendeur", n: 3 }] }));
    expect(res.status, JSON.stringify(res.output)).toBe("succeeded");
    expect(res.output?.kind).toBe("workforce_plan");
    const n = (await h.db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_workforce_plans where company_id=$1 and period='2026-Q4'`, [h.companyA])).rows[0].n;
    expect(n).toBe(1);
  });

  it("recruitment.candidate.ingest persists a real candidate with a pipeline stage", async () => {
    const h = harness!;
    const res = await RUNTIME_ACTION_HANDLERS["recruitment.candidate.ingest"](
      ctxFor(h.db, h.ctx("A"), h.companyA, { full_name: "Camille Roy", source: "linkedin" }));
    expect(res.status).toBe("succeeded");
    expect(res.output?.pipeline_stage).toBe("new");
    const rows = (await h.db.query<{ full_name: string; pipeline_stage: string }>(
      `select full_name, pipeline_stage from pierre_rt_recruitment_candidates where company_id=$1`, [h.companyA])).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].full_name).toBe("Camille Roy");
  });

  it("hr.request.create persists a real HR ticket", async () => {
    const h = harness!;
    const res = await RUNTIME_ACTION_HANDLERS["hr.request.create"](
      ctxFor(h.db, h.ctx("A"), h.companyA, { subject: "Question congés", category: "absence", priority: "high" }));
    expect(res.status).toBe("succeeded");
    expect(res.output?.status).toBe("open");
    const rows = (await h.db.query<{ subject: string; status: string; category: string }>(
      `select subject, status, category from pierre_rt_hr_requests where company_id=$1`, [h.companyA])).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].category).toBe("absence");
  });

  it("country.pack.bind persists a real country config (idempotent per country → version bump)", async () => {
    const h = harness!;
    const ctxA = h.ctx("A");
    const r1 = await RUNTIME_ACTION_HANDLERS["country.pack.bind"](ctxFor(h.db, ctxA, h.companyA, { country_code: "FR", pack_key: "fr_core_v1" }));
    expect(r1.status).toBe("succeeded");
    const r2 = await RUNTIME_ACTION_HANDLERS["country.pack.bind"](ctxFor(h.db, ctxA, h.companyA, { country_code: "FR", pack_key: "fr_core_v2" }));
    expect(r2.status).toBe("succeeded");
    const rows = (await h.db.query<{ pack_key: string; version: number }>(
      `select pack_key, version from pierre_rt_country_configs where company_id=$1 and country_code='FR'`, [h.companyA])).rows;
    expect(rows.length).toBe(1); // idempotent per (company, country) — no duplicate
    expect(rows[0].pack_key).toBe("fr_core_v2");
    expect(rows[0].version).toBe(2);
  });

  it("governed refusals — invalid country + missing required field never fake success", async () => {
    const h = harness!;
    const badCountry = await RUNTIME_ACTION_HANDLERS["country.pack.bind"](ctxFor(h.db, h.ctx("A"), h.companyA, { country_code: "US", pack_key: "x" }));
    expect(badCountry.status).toBe("blocked");
    const badReq = await RUNTIME_ACTION_HANDLERS["hr.request.create"](ctxFor(h.db, h.ctx("A"), h.companyA, { subject: "" }));
    expect(badReq.status).toBe("blocked");
  });

  it("tenant isolation — none of the new objects leak into tenant B", async () => {
    const h = harness!;
    for (const t of ["pierre_rt_workforce_plans", "pierre_rt_recruitment_candidates", "pierre_rt_hr_requests", "pierre_rt_country_configs"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n).toBe(0);
    }
  });
});
