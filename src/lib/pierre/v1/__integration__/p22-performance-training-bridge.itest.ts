import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { createPerformanceActionPlan, validatePerformanceActionPlan, createPerformanceActionItem } from "../performance";
import { createTrainingRequirement, validateTrainingRequirementSource, createTrainingSession, createTrainingEnrollment } from "../training";

// P22 bridge (corrected) — a VALIDATED performance action becomes a source-linked training need with
// source_type='performance_action' (contract), and only activates after source validation (the action's
// plan must be validated). An UNVALIDATED action, a missing action, or another tenant's action is refused.

let harness: Harness | null = null;
afterAll(async () => { await harness?.close(); });

describe("P22 performance→training bridge (source_type=performance_action) on real SQL", () => {
  it("validated action plan → source-linked requirement (performance_action) → active → session → enrollment", async () => {
    harness = await createHarness();
    const h = harness; const ctxA = h.ctx("A");
    const emp = await createEmployee(h.db, ctxA, { first_name: "Bridge", last_name: "Test" });

    // A performance action plan, validated (the gate before it may source training).
    const plan = await createPerformanceActionPlan(h.db, ctxA, { employee_id: emp.id, title: "Plan de développement sécurité" });
    await validatePerformanceActionPlan(h.db, ctxA, plan.id);
    const action = await createPerformanceActionItem(h.db, ctxA, { employee_id: emp.id, action: "Développer la compétence sécurité", plan_id: plan.id, due_on: "2026-12-31" });

    // Bridge: requirement with the CONTRACTUAL source_type=performance_action + source_ref=action.id.
    const req = await createTrainingRequirement(h.db, ctxA, {
      requirement_key: `dev-${action.id.slice(0, 8)}`, title: "Sécurité (issue d'un plan validé)",
      source_type: "performance_action", source_ref: action.id, mandatory: true, validity_months: 24,
    });
    expect(req.status).toBe("configuration_required"); // mandatory → not active until source validated

    const vs = await validateTrainingRequirementSource(h.db, ctxA, `dev-${action.id.slice(0, 8)}`);
    expect(vs.status).toBe("active"); // action exists AND its plan is validated

    const stored = (await h.db.query<{ source_type: string; source_ref: string }>(
      `select source_type, source_ref from pierre_rt_training_requirements where company_id=$1 and requirement_key=$2`, [h.companyA, `dev-${action.id.slice(0, 8)}`])).rows[0];
    expect(stored.source_type).toBe("performance_action");
    expect(stored.source_ref).toBe(action.id);

    const session = await createTrainingSession(h.db, ctxA, { title: "Session sécurité (dev)", requirement_id: req.id });
    const enr = await createTrainingEnrollment(h.db, ctxA, { session_id: session.id, employee_id: emp.id, requirement_id: req.id, mode: "copilote" });
    expect(enr.deduped).toBe(false);
    // Duplicate enrollment is deduped.
    const enr2 = await createTrainingEnrollment(h.db, ctxA, { session_id: session.id, employee_id: emp.id, requirement_id: req.id });
    expect(enr2.deduped).toBe(true);
  });

  it("an UNVALIDATED action plan does NOT activate the training source", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    const emp = await createEmployee(h.db, ctxA, { first_name: "Unval", last_name: "Plan" });
    const plan = await createPerformanceActionPlan(h.db, ctxA, { employee_id: emp.id, title: "Plan non validé" });
    // NOT validated.
    const action = await createPerformanceActionItem(h.db, ctxA, { employee_id: emp.id, action: "Action non validée", plan_id: plan.id });
    const req = await createTrainingRequirement(h.db, ctxA, { requirement_key: `unval-${action.id.slice(0, 8)}`, title: "X", source_type: "performance_action", source_ref: action.id, mandatory: true });
    const vs = await validateTrainingRequirementSource(h.db, ctxA, `unval-${action.id.slice(0, 8)}`);
    expect(vs.status).toBe("configuration_required"); // plan not validated → source not proven
  });

  it("a missing / non-existent action is refused as a source", async () => {
    const h = harness!; const ctxA = h.ctx("A");
    const req = await createTrainingRequirement(h.db, ctxA, { requirement_key: "ghost-action", title: "Ghost", source_type: "performance_action", source_ref: "00000000-0000-0000-0000-0000000000fe", mandatory: true });
    const vs = await validateTrainingRequirementSource(h.db, ctxA, "ghost-action");
    expect(vs.status).toBe("configuration_required");
  });
});
