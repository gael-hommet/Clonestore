import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { RUNTIME_ACTION_HANDLERS, type RuntimeActionContext } from "../runtime-action-handlers";
import {
  createPerformanceActionPlan, submitPerformanceActionPlanForValidation, applyPerformanceActionPlanValidation,
  createPerformanceActionItem,
} from "../performance";
import { createTrainingRequirement, validateTrainingRequirementSource, createCompanyPolicy, registerTrainingProvider } from "../training";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";

// P22 Reprise 11 — REAL sources + CANONICAL approvals.
//  A) A training source is only 'active' when its source_ref resolves to a REAL tenant object of the
//     declared source_type; a bare string ("p1") is NOT a source. A durable verification row is persisted.
//  B) A performance action plan becomes 'validated' ONLY through the canonical pierre_rt_validations
//     human-decision chain (submit → approved decision → apply) — never a direct shortcut.

let harness: Harness | null = null;
const MISSION = "10000000-0000-0000-0000-0000000000c1";
afterAll(async () => { await harness?.close(); });
function ctxFor(h: Harness, p: Record<string, unknown>): RuntimeActionContext {
  return { appDb: h.db as SqlExecutor, tenant: h.ctx("A") as TenantContext, companyId: h.companyA, missionId: MISSION, missionRunId: "44444444-4444-4444-4444-444444444444", stepRunId: "55555555-5555-5555-5555-555555555555", jobId: "66666666-6666-6666-6666-666666666666", idempotencyKey: "idem", payload: p, deps: {}, assertLease: async () => {}, checkpoint: async () => {} };
}
const run = (h: Harness, k: string, p: Record<string, unknown>) => RUNTIME_ACTION_HANDLERS[k](ctxFor(h, p));
async function seedMission(h: Harness) {
  await h.db.query(`insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key) values ($1,$2,$3,$4,gen_random_uuid(),gen_random_uuid(),$5) on conflict (id) do nothing`, [MISSION, h.companyA, h.userA, "sources+approvals", "sa-mission"]);
}
async function verif(h: Harness, key: string) {
  return (await h.db.query<{ status: string; source_id: string | null; reason: string }>(
    `select v.status, v.source_id, v.reason from pierre_rt_training_source_verifications v join pierre_rt_training_requirements r on r.id=v.requirement_id where r.company_id=$1 and r.requirement_key=$2`, [h.companyA, key])).rows[0];
}

describe("P22 real source resolution (a source_ref is not a source)", () => {
  it("company_policy: unresolved ref stays configuration_required; a real active policy makes it active + persists verification", async () => {
    harness = await createHarness();
    const h = harness; const ctxA = h.ctx("A");
    // Declared mandatory + a source_ref that points at NOTHING real.
    const req = await createTrainingRequirement(h.db, ctxA, { requirement_key: "pol_missing", title: "X", source_type: "company_policy", source_ref: "p1", mandatory: true });
    expect(req.status).toBe("configuration_required");
    const v1 = await validateTrainingRequirementSource(h.db, ctxA, "pol_missing");
    expect(v1.status).toBe("configuration_required"); // "p1" is a string, not a policy
    expect((await verif(h, "pol_missing")).status).toBe("not_found");

    // Now the REAL policy exists (active) → resolves → active, verification 'verified' pointing at the real id.
    const pol = await createCompanyPolicy(h.db, ctxA, { policy_key: "p1", title: "Politique sécurité" });
    const v2 = await validateTrainingRequirementSource(h.db, ctxA, "pol_missing");
    expect(v2.status).toBe("active");
    const rec = await verif(h, "pol_missing");
    expect(rec.status).toBe("verified");
    expect(rec.source_id).toBe(pol.id);

    // A DRAFT (non-active) policy does not count.
    await createTrainingRequirement(h.db, ctxA, { requirement_key: "pol_draft", title: "Y", source_type: "company_policy", source_ref: "draftpol", mandatory: true });
    await createCompanyPolicy(h.db, ctxA, { policy_key: "draftpol", title: "Brouillon", status: "draft" });
    expect((await validateTrainingRequirementSource(h.db, ctxA, "pol_draft")).status).toBe("configuration_required");
  });

  it("country_pack resolves against an active country config; provider against an active provider; cloneadn stays configuration_required", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    // country_pack — needs an ACTIVE country config bound to the tenant.
    await createTrainingRequirement(h.db, ctxA, { requirement_key: "cp", title: "Pack pays", source_type: "country_pack", source_ref: "FR", mandatory: true });
    expect((await validateTrainingRequirementSource(h.db, ctxA, "cp")).status).toBe("configuration_required");
    await h.db.query(`insert into pierre_rt_country_configs (id, company_id, country_code, pack_key, status, version) values (gen_random_uuid(),$1,'FR','fr_core','active',1)`, [h.companyA]);
    expect((await validateTrainingRequirementSource(h.db, ctxA, "cp")).status).toBe("active");

    // provider — needs an ACTIVE training provider.
    await createTrainingRequirement(h.db, ctxA, { requirement_key: "pv", title: "Provider", source_type: "provider", source_ref: "lms-x", mandatory: true });
    expect((await validateTrainingRequirementSource(h.db, ctxA, "pv")).status).toBe("configuration_required");
    await registerTrainingProvider(h.db, ctxA, { provider_key: "lms-x", name: "LMS X" });
    expect((await validateTrainingRequirementSource(h.db, ctxA, "pv")).status).toBe("active");

    // cloneadn — no persisted registry object exists → honestly configuration_required.
    await createTrainingRequirement(h.db, ctxA, { requirement_key: "adn", title: "ADN", source_type: "cloneadn", source_ref: "rule-1", mandatory: true });
    expect((await validateTrainingRequirementSource(h.db, ctxA, "adn")).status).toBe("configuration_required");
  });

  it("human_authorized resolves ONLY against an approved persisted human decision targeting this requirement", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    await seedMission(h);
    const req = await createTrainingRequirement(h.db, ctxA, { requirement_key: "ha", title: "Autorisée", source_type: "human_authorized", source_ref: "auth", mandatory: true });
    expect((await validateTrainingRequirementSource(h.db, ctxA, "ha")).status).toBe("configuration_required");
    // Persist an APPROVED human decision that targets this requirement.
    await h.db.query(
      `insert into pierre_rt_validations (id, company_id, mission_id, validator_role, required_count, status, reason, risk_context, decided_by, decided_at)
       values (gen_random_uuid(),$1,$2,'hr_manager',1,'approved','autorisation formation',$3::jsonb,$4, now())`,
      [h.companyA, MISSION, JSON.stringify({ kind: "training_source", requirement_id: req.id }), h.userA]);
    expect((await validateTrainingRequirementSource(h.db, ctxA, "ha")).status).toBe("active");
  });
});

describe("P22 canonical performance action-plan approval (no direct shortcut)", () => {
  it("draft → submit (pending) → cannot apply while pending → approved decision → apply → validated; idempotent", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    await seedMission(h);
    const emp = await createEmployee(h.db, ctxA, { first_name: "AP", last_name: "Canon" });
    const plan = await createPerformanceActionPlan(h.db, ctxA, { employee_id: emp.id, title: "Plan dev" });
    const s = await submitPerformanceActionPlanForValidation(h.db, ctxA, plan.id, MISSION);
    // Still pending → apply refuses.
    await expect(applyPerformanceActionPlanValidation(h.db, ctxA, plan.id)).rejects.toMatchObject({ code: "conflict" });
    const st1 = (await h.db.query<{ status: string }>(`select status from pierre_rt_performance_action_plans where company_id=$1 and id=$2`, [h.companyA, plan.id])).rows[0].status;
    expect(st1).toBe("awaiting_validation");
    // Human approves.
    await h.db.query(`update pierre_rt_validations set status='approved', decided_at=now(), decided_by=$3 where company_id=$1 and id=$2`, [h.companyA, s.validation_id, h.userA]);
    const applied = await applyPerformanceActionPlanValidation(h.db, ctxA, plan.id);
    expect(applied.status).toBe("validated");
    // Idempotent re-apply.
    expect((await applyPerformanceActionPlanValidation(h.db, ctxA, plan.id)).status).toBe("validated");
  });

  it("a rejected decision returns the plan to draft (not validated); a foreign-tenant validation is refused", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    await seedMission(h);
    const emp = await createEmployee(h.db, ctxA, { first_name: "AP2", last_name: "Rej" });
    const plan = await createPerformanceActionPlan(h.db, ctxA, { employee_id: emp.id, title: "Plan rejeté" });
    const s = await submitPerformanceActionPlanForValidation(h.db, ctxA, plan.id, MISSION);
    await h.db.query(`update pierre_rt_validations set status='rejected', decided_at=now() where company_id=$1 and id=$2`, [h.companyA, s.validation_id]);
    expect((await applyPerformanceActionPlanValidation(h.db, ctxA, plan.id)).status).toBe("rejected");
    const st = (await h.db.query<{ status: string }>(`select status from pierre_rt_performance_action_plans where company_id=$1 and id=$2`, [h.companyA, plan.id])).rows[0].status;
    expect(st).toBe("draft");

    // A validation whose risk_context targets a DIFFERENT plan must not validate this plan.
    const plan2 = await createPerformanceActionPlan(h.db, ctxA, { employee_id: emp.id, title: "Autre" });
    await submitPerformanceActionPlanForValidation(h.db, ctxA, plan2.id, MISSION);
    // Tamper: point plan2's validation at a wrong plan_id, approve it.
    await h.db.query(`update pierre_rt_validations set status='approved', risk_context=$3::jsonb where company_id=$1 and id=(select validation_id from pierre_rt_performance_action_plans where company_id=$1 and id=$2)`, [h.companyA, plan2.id, JSON.stringify({ kind: "performance_action_plan", plan_id: "00000000-0000-0000-0000-0000000000ff" })]);
    await expect(applyPerformanceActionPlanValidation(h.db, ctxA, plan2.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("bridge only activates when the action's plan reached validated via the canonical chain", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    await seedMission(h);
    const emp = await createEmployee(h.db, ctxA, { first_name: "Br", last_name: "Canon" });
    const plan = await createPerformanceActionPlan(h.db, ctxA, { employee_id: emp.id, title: "Plan bridge" });
    const action = await createPerformanceActionItem(h.db, ctxA, { employee_id: emp.id, action: "Compétence", plan_id: plan.id });
    const key = `br-${action.id.slice(0, 8)}`;
    await createTrainingRequirement(h.db, ctxA, { requirement_key: key, title: "Issue plan", source_type: "performance_action", source_ref: action.id, mandatory: true });
    // Plan only submitted (awaiting_validation) → bridge NOT active.
    const s = await submitPerformanceActionPlanForValidation(h.db, ctxA, plan.id, MISSION);
    expect((await validateTrainingRequirementSource(h.db, ctxA, key)).status).toBe("configuration_required");
    // Approve + apply → plan validated → bridge active.
    await h.db.query(`update pierre_rt_validations set status='approved', decided_at=now() where company_id=$1 and id=$2`, [h.companyA, s.validation_id]);
    await applyPerformanceActionPlanValidation(h.db, ctxA, plan.id);
    expect((await validateTrainingRequirementSource(h.db, ctxA, key)).status).toBe("active");
  });
});
