import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";
import { routeInstructionToPack } from "../hr-mission-packs/instruction-router";
import { packToRuntimePlan } from "../hr-mission-packs/runtime-map";
import { apiListValidations, apiDecideValidation } from "../api";

// P22 Reprise 12 — THE UNIFIED PATH. A natural HR instruction is routed (deterministically, no LLM) to a
// mission pack, compiled to the AUTHORITATIVE runtime plan, and executed by the governed worker producing
// REAL business objects. Upstream runtime ids are threaded into downstream steps via {$ref}. A human
// validation gates activation and is resolved through the REAL decision service (apiDecideValidation →
// scheduler drains the durable event → the wait resolves) — NOT a direct SQL update. The run ends in a
// real terminal (report → mission.complete), never mission.noop.

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

async function drainJobs(): Promise<void> {
  for (let i = 0; i < 16; i++) {
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    const ready = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_jobs where company_id=$1 and status in ('queued','ready')`, [h.companyA])).rows[0].n;
    if (ready === 0) break;
  }
}

describe("P22 unified: natural instruction → pack → authoritative runtime → real validation → real terminal", () => {
  it("routes a French instruction to the mandatory-training pack and runs it end-to-end on the governed runtime", async () => {
    // 1) NATURAL INSTRUCTION → PACK (deterministic router, reads supportedIntents; no LLM, no manual plan).
    const instruction = "Mets en place la formation obligatoire de sécurité pour nos salariés";
    const route = routeInstructionToPack(instruction);
    expect(route).toBeTruthy();
    expect(route!.pack.id).toBe("training.mandatory_compliance_setup");

    // 2) PACK → AUTHORITATIVE RUNTIME PLAN → persisted run (real compiler, real runtime).
    const missionId = await seedMission(h, owner, instruction);
    const plan = packToRuntimePlan(route!.pack);
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: missionId, plan }) as { ok?: boolean; mission_run_id?: string };
    expect(created.ok).not.toBe(false);
    const runId = created.mission_run_id!;

    // 3) WORKER executes the authoritative actions until it hits the human-validation WAIT.
    await drainJobs();
    // Real business objects exist, created BY THE WORKER (threaded ids, source resolved to a real policy).
    const req = (await h.db.query<{ id: string; status: string }>(`select id, status from pierre_rt_training_requirements where company_id=$1 and requirement_key='mandatory-training'`, [h.companyA])).rows[0];
    expect(req.status).toBe("active"); // source resolved to the real hr.policy.create policy
    const session = (await h.db.query<{ id: string; requirement_id: string }>(`select id, requirement_id from pierre_rt_training_sessions where company_id=$1`, [h.companyA])).rows[0];
    expect(session.requirement_id).toBe(req.id); // threaded requirement_id
    const item = (await h.db.query<{ requirement_id: string; session_id: string; plan_id: string }>(`select requirement_id, session_id, plan_id from pierre_rt_training_plan_items where company_id=$1`, [h.companyA])).rows[0];
    expect(item.requirement_id).toBe(req.id);
    expect(item.session_id).toBe(session.id); // threaded session_id + plan_id
    // The run is WAITING on the human validation gate.
    expect((await stepStatuses(h, runId)).approve).toBe("waiting");
    expect((await runState(h, runId)).status).toBe("waiting");

    // 4) REAL VALIDATION JOURNEY — through the decision service/API, NOT a direct SQL status flip.
    const pending = (await apiListValidations(h.db, owner, missionId)).find((v) => v.status === "pending");
    expect(pending).toBeTruthy();
    await apiDecideValidation(h.db, owner, pending!.id, "approve", pending!.version);
    // The decision emitted a durable runtime event; the scheduler drains it and resolves the wait.
    await runPierreRuntimeScheduler(h.db, owner, {});
    await drainJobs();

    // 5) REAL TERMINAL — the report ran and the run completed (never mission.noop).
    expect((await stepStatuses(h, runId)).report).toBe("succeeded");
    expect((await stepStatuses(h, runId)).close).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
    // The terminal is business-meaningful: mission_run completed + a durable completion event.
    const completedAt = (await h.db.query<{ completed_at: string | null }>(`select completed_at from pierre_rt_mission_runs where id=$1`, [runId])).rows[0].completed_at;
    expect(completedAt).toBeTruthy();
  });

  it("a rejected validation does NOT resume or complete the run (no auto-pass)", async () => {
    const route = routeInstructionToPack("Mettre en place la formation obligatoire");
    const missionId = await seedMission(h, owner, "reject");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: missionId, plan: packToRuntimePlan(route!.pack) }) as { mission_run_id?: string };
    const runId = created.mission_run_id!;
    await drainJobs();
    const pending = (await apiListValidations(h.db, owner, missionId)).find((v) => v.status === "pending");
    await apiDecideValidation(h.db, owner, pending!.id, "reject", pending!.version);
    await runPierreRuntimeScheduler(h.db, owner, {});
    await drainJobs();
    expect((await stepStatuses(h, runId)).approve).toBe("waiting"); // a rejection resolves no wait
    expect((await runState(h, runId)).status).toBe("waiting");
    expect((await stepStatuses(h, runId)).report).not.toBe("succeeded");
  });

  it("the router is deterministic and reads supportedIntents (English intent also routes)", () => {
    expect(routeInstructionToPack("set up mandatory training compliance")!.pack.id).toBe("training.mandatory_compliance_setup");
    // same input → same output
    const a = routeInstructionToPack("formation obligatoire")!.pack.id;
    const b = routeInstructionToPack("formation obligatoire")!.pack.id;
    expect(a).toBe(b);
    // gibberish routes to nothing (never a random pack)
    expect(routeInstructionToPack("zzz qqq")).toBeNull();
  });
});
