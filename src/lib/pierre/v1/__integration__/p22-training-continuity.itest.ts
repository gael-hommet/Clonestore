import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import { completeTrainingEnrollment } from "../training";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 training continuity — durable NEEDS_INFORMATION (proof required, missing), resume after the proof
// is received + verified, then completion + certification with no double effect. (PGlite in-process:
// literal multi-process restart via runtime-scheduler proven separately; here: durable state + resume.)

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-00000000ff01";
afterAll(async () => { await harness?.close(); });
function ctxFor(h: Harness, p: Record<string, unknown>): RuntimeActionContext {
  return { appDb: h.db as SqlExecutor, tenant: h.ctx("A") as TenantContext, companyId: h.companyA, missionId: MISSION, missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload: p, deps: {}, assertLease: async () => {}, checkpoint: async () => {} };
}
const run = (h: Harness, k: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[k](ctxFor(h, p));

describe("P22 training continuity — durable NEEDS_INFORMATION, resume, no double cert", () => {
  it("completion blocked while proof required+missing; resumes after proof verified; no double certification", async () => {
    harness = await createHarness();
    const h = harness; const ctxA = h.ctx("A");
    await h.db.query(`insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key) values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`, [MISSION, h.companyA, h.userA, "formation continuité", "cont-train"]);
    const emp = await createEmployee(h.db, ctxA, { first_name: "Cont", last_name: "Train" });

    const req = await run(h, "training.requirement.create", { requirement_key: "sec", title: "Sécurité", source_type: "company_policy", source_ref: "p1", mandatory: true, validity_months: 12, proof_required: true });
    await run(h, "hr.policy.create", { policy_key: "p1", title: "Politique sécurité" }); // the REAL source object
    await run(h, "training.requirement.validate_source", { requirement_key: "sec" });
    const reqId = String(req.output!.requirement_id);
    const s = await run(h, "training.session.create", { title: "S1", requirement_id: reqId, starts_at: "2026-07-20T09:00:00Z" });
    const e = await run(h, "training.enrollment.create", { session_id: String(s.output!.session_id), employee_id: emp.id, requirement_id: reqId, mode: "copilote" });
    const enrollmentId = String(e.output!.enrollment_id);
    await run(h, "training.attendance.record", { enrollment_id: enrollmentId, attendance_status: "present" });

    // Proof required + missing → completion returns a durable blocker (not a fake completion).
    const blocked = await completeTrainingEnrollment(h.db, ctxA, enrollmentId);
    expect(blocked.completed).toBe(false);
    expect(String(blocked.blocker)).toContain("NEEDS_INFORMATION");
    // ── "restart": re-read the durable blocked state from SQL ──
    const durable = (await h.db.query<{ status: string }>(`select status from pierre_rt_training_enrollments where company_id=$1 and id=$2`, [h.companyA, enrollmentId])).rows[0];
    expect(durable.status).toBe("blocked");

    // Resume: proof received but not verified → still cannot complete (under_review).
    const proof = await run(h, "training.proof.attach", { enrollment_id: enrollmentId, proof_type: "attestation", issued_on: "2026-07-20" });
    const underReview = await completeTrainingEnrollment(h.db, ctxA, enrollmentId);
    expect(underReview.completed).toBe(false);
    expect(String(underReview.blocker)).toContain("under_review");

    // Verify the proof → completion + certification now possible.
    await run(h, "training.proof.verify", { proof_id: String(proof.output!.proof_id), verified_on: "2026-07-20" });
    const done = await completeTrainingEnrollment(h.db, ctxA, enrollmentId);
    expect(done.completed).toBe(true);
    const cert = await run(h, "training.certification.issue", { employee_id: emp.id, certification_key: "sec", proof_id: String(proof.output!.proof_id), requirement_id: reqId, issued_on: "2026-07-20", validity_months: 12 });
    expect(cert.status).toBe("succeeded");
    // Re-issuing is an upsert on (company, employee, certification_key) — exactly one certification.
    await run(h, "training.certification.issue", { employee_id: emp.id, certification_key: "sec", proof_id: String(proof.output!.proof_id), requirement_id: reqId, issued_on: "2026-07-20", validity_months: 12 });
    const certs = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_training_certifications where company_id=$1 and employee_id=$2 and certification_key='sec'`, [h.companyA, emp.id])).rows[0].n;
    expect(certs).toBe(1);
  });
});
