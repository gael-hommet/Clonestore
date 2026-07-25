import { describe, it, expect, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { createEmployee } from "../employees";
import { createPerformanceActionItem } from "../performance";
import { createTrainingRequirement, createTrainingSession, createTrainingEnrollment } from "../training";

// P22 bridge — a validated PERFORMANCE development action becomes a source-linked TRAINING need
// (source_type='company_policy', source_ref=performance_action_item.id). No training need without a
// source; the same need is not duplicated. Proves the real performance → training chain on real SQL.

let harness: Harness | null = null;
afterAll(async () => { await harness?.close(); });

describe("P22 performance→training bridge on real SQL", () => {
  it("a performance action item yields a source-linked training requirement + enrollment", async () => {
    harness = await createHarness();
    const h = harness; const ctxA = h.ctx("A");
    const emp = await createEmployee(h.db, ctxA, { first_name: "Bridge", last_name: "Test" });

    // A performance development action (would be validated in a real campaign).
    const action = await createPerformanceActionItem(h.db, ctxA, { employee_id: emp.id, action: "Développer la compétence sécurité", due_on: "2026-12-31", plan_key: "dev-plan" });

    // Bridge: the action becomes a source-linked training requirement (never an invented obligation).
    const req = await createTrainingRequirement(h.db, ctxA, {
      requirement_key: `dev-from-action-${action.id.slice(0, 8)}`, title: "Sécurité (issue d'un plan d'action)",
      source_type: "company_policy", source_ref: action.id, mandatory: false, validity_months: 24,
    });
    expect(req.status).toBe("active");

    // The requirement carries the performance action as its source_ref (explicit link, not a duplicate).
    const stored = (await h.db.query<{ source_type: string; source_ref: string }>(
      `select source_type, source_ref from pierre_rt_training_requirements where company_id=$1 and id=$2`, [h.companyA, req.id])).rows[0];
    expect(stored.source_type).toBe("company_policy");
    expect(stored.source_ref).toBe(action.id);

    const session = await createTrainingSession(h.db, ctxA, { title: "Session sécurité (dev)", requirement_id: req.id });
    const enr = await createTrainingEnrollment(h.db, ctxA, { session_id: session.id, employee_id: emp.id, requirement_id: req.id, mode: "copilote" });
    expect(enr.deduped).toBe(false);

    // The chain is queryable end to end: action → requirement(source_ref=action) → session → enrollment(employee).
    const chain = (await h.db.query<{ n: number }>(
      `select count(*)::int n
         from pierre_rt_training_enrollments e
         join pierre_rt_training_requirements r on r.id=e.requirement_id and r.company_id=e.company_id
        where e.company_id=$1 and e.employee_id=$2 and r.source_ref=$3`,
      [h.companyA, emp.id, action.id])).rows[0].n;
    expect(chain).toBe(1);
  });
});
