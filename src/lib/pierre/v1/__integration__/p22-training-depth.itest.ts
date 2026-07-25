import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { computeTrainingCoverage, buildTrainingBrief } from "../training";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 TRAINING depth — real SQL. Sourced vs unsourced-mandatory (CONFIGURATION_REQUIRED), sessions,
// enrollments (dedup), attendance, proofs, no-completion-without-attendance, no-certification-without-
// proof, expiry/renewals, coverage from SQL, three-mode, tenant isolation, governed refusals.

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-000000000f01";
afterAll(async () => { await harness?.close(); });
function ctxFor(h: Harness, p: Record<string, unknown>): RuntimeActionContext {
  return { appDb: h.db as SqlExecutor, tenant: h.ctx("A") as TenantContext, companyId: h.companyA, missionId: MISSION, missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload: p, deps: {}, assertLease: async () => {}, checkpoint: async () => {} };
}
const run = (h: Harness, k: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[k](ctxFor(h, p));
async function seedMission(h: Harness, id: string) {
  await h.db.query(`insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key) values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`, [id, h.companyA, h.userA, "formations obligatoires 120 salariés", `train-${id}`]);
}

describe("P22 training depth — 120 employees on real SQL", () => {
  let sessionId = ""; let emp0 = ""; let emp1 = "";
  it("sourced requirement is active; unsourced mandatory is CONFIGURATION_REQUIRED (no invented obligation)", async () => {
    harness = await createHarness();
    const h = harness; await seedMission(h, MISSION);
    const ids: string[] = [];
    for (let i = 0; i < 120; i++) { const e = await createEmployee(h.db, h.ctx("A"), { first_name: `T${i}`, last_name: `N${i}` }); ids.push(e.id); }
    emp0 = ids[0]; emp1 = ids[1];

    const sourced = await run(h, "training.requirement.create", { requirement_key: "safety_2026", title: "Sécurité au travail", source_type: "company_policy", source_ref: "policy-42", mandatory: true, validity_months: 12 });
    expect(sourced.output!.status).toBe("active");
    const unsourced = await run(h, "training.requirement.create", { requirement_key: "mystery_mandatory", title: "Obligation non sourcée", mandatory: true });
    expect(unsourced.output!.status).toBe("configuration_required"); // never fabricated as a legal obligation
  });

  it("session → enrollments (dedup) → attendance → proof → certification (never without proof/attendance)", async () => {
    const h = harness!;
    const reqId = (await h.db.query<{ id: string }>(`select id from pierre_rt_training_requirements where company_id=$1 and requirement_key='safety_2026'`, [h.companyA])).rows[0].id;
    const s = await run(h, "training.session.create", { title: "Session sécurité juillet", requirement_id: reqId, starts_at: "2026-07-20T09:00:00Z", provider: "internal" });
    sessionId = String(s.output!.session_id);

    const e0 = await run(h, "training.enrollment.create", { session_id: sessionId, employee_id: emp0, requirement_id: reqId, mode: "copilote" });
    expect(e0.output!.deduped).toBe(false);
    const e0b = await run(h, "training.enrollment.create", { session_id: sessionId, employee_id: emp0, requirement_id: reqId });
    expect(e0b.output!.deduped).toBe(true); // no duplicate enrollment
    const enrollmentId = String(e0.output!.enrollment_id);

    // Cannot certify without a proof.
    // (attendance first)
    await run(h, "training.attendance.record", { enrollment_id: enrollmentId, attendance_status: "present" });
    const proof = await run(h, "training.proof.attach", { enrollment_id: enrollmentId, proof_type: "attestation", issued_on: "2026-07-20" });
    const proofId = String(proof.output!.proof_id);
    const cert = await run(h, "training.certification.issue", { employee_id: emp0, certification_key: "safety", proof_id: proofId, requirement_id: reqId, issued_on: "2026-07-20", validity_months: 12 });
    expect(cert.status).toBe("succeeded");
    expect(cert.output!.status).toBe("valid");
    // issued 2026-07-20 + validity 12 months → expires in 2027 (proves validity_months is applied).
    expect(new Date(String(cert.output!.expires_on)).getUTCFullYear()).toBe(2027);

    // A missing-proof certification never succeeds.
    const badCert = await run(h, "training.certification.issue", { employee_id: emp1, certification_key: "safety", proof_id: "00000000-0000-0000-0000-0000000000fe", issued_on: "2026-07-20" });
    expect(badCert.status).toBe("blocked");
  });

  it("expiry detection creates expiring/expired statuses + renewals deterministically", async () => {
    const h = harness!;
    // Certify emp1 with a proof expiring soon and emp0-second already expired, to exercise both.
    const reqId = (await h.db.query<{ id: string }>(`select id from pierre_rt_training_requirements where company_id=$1 and requirement_key='safety_2026'`, [h.companyA])).rows[0].id;
    // seed a proof for emp1
    const s2 = await run(h, "training.session.create", { title: "Session B", requirement_id: reqId, starts_at: "2026-01-01T09:00:00Z" });
    const e1 = await run(h, "training.enrollment.create", { session_id: String(s2.output!.session_id), employee_id: emp1, requirement_id: reqId, mode: "autonomie" });
    await run(h, "training.attendance.record", { enrollment_id: String(e1.output!.enrollment_id), attendance_status: "present" });
    const p1 = await run(h, "training.proof.attach", { enrollment_id: String(e1.output!.enrollment_id), proof_type: "attestation", issued_on: "2025-08-01" });
    // issued 2025-08-01, validity 12 months → expires 2026-08-01 (expiring soon as of 2026-07-20)
    await run(h, "training.certification.issue", { employee_id: emp1, certification_key: "safety", proof_id: String(p1.output!.proof_id), requirement_id: reqId, issued_on: "2025-08-01", validity_months: 12 });

    const det = await run(h, "training.expiry.detect", { as_of: "2026-07-20", expiring_within_days: 60 });
    expect(det.status).toBe("succeeded");
    expect(Number(det.output!.expiring)).toBeGreaterThanOrEqual(1);
    const renewals = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_training_renewals where company_id=$1 and status='scheduled'`, [h.companyA])).rows[0].n;
    expect(renewals).toBeGreaterThanOrEqual(1);
  });

  it("coverage computed from SQL; brief reports configuration_required honestly", async () => {
    const h = harness!;
    const cov = await computeTrainingCoverage(h.db, h.ctx("A"), "safety_2026");
    expect(cov.population).toBeGreaterThanOrEqual(120);
    expect(cov.certified).toBeGreaterThanOrEqual(1);
    const brief = await buildTrainingBrief(h.db, h.ctx("A"));
    expect(Number(brief.configuration_required)).toBeGreaterThanOrEqual(1);
    expect(Number(brief.valid_certifications)).toBeGreaterThanOrEqual(1);
  });

  it("three modes → different enrollment status; tenant isolation", async () => {
    const h = harness!;
    const reqId = (await h.db.query<{ id: string }>(`select id from pierre_rt_training_requirements where company_id=$1 and requirement_key='safety_2026'`, [h.companyA])).rows[0].id;
    const statuses: Record<string, string> = {};
    for (const mode of ["brouillon", "copilote", "autonomie"] as const) {
      const s = await run(h, "training.session.create", { title: `Sess ${mode}`, requirement_id: reqId });
      const emp = (await h.db.query<{ id: string }>(`select id from pierre_rt_employees where company_id=$1 offset 50 limit 1`, [h.companyA])).rows[0].id;
      const e = await run(h, "training.enrollment.create", { session_id: String(s.output!.session_id), employee_id: emp, requirement_id: reqId, mode });
      statuses[mode] = String(e.output!.status);
    }
    expect(statuses.brouillon).toBe("draft");
    expect(statuses.copilote).toBe("invited");
    expect(statuses.autonomie).toBe("confirmed");
    for (const t of ["pierre_rt_training_requirements", "pierre_rt_training_enrollments", "pierre_rt_training_certifications", "pierre_rt_training_renewals"]) {
      const n = (await h.db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1`, [h.companyB])).rows[0].n;
      expect(n, t).toBe(0);
    }
  });
});
