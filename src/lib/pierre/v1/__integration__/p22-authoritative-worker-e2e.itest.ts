import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses, gov } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";

// P22 Reprise 11 — AUTHORITATIVE worker E2E. This does NOT call RUNTIME_ACTION_HANDLERS directly. It
// drives real perf/training authoritative actions through the P8.5 governed runtime:
//   plan → createMissionRunFromPlan (persists pierre_rt_step_runs + pierre_rt_runtime_jobs)
//        → runPierreRuntimeJobs (worker claims a job, reads input_json, calls the registered handler)
//        → real business objects persisted
//        → approval.request WAITS on a real pierre_rt_validations decision (run status 'waiting')
//        → human decision on the real validation + the governed resolve primitive (what the scheduler
//          calls) resolves the pinned wait → dependents run → the run reaches 'completed'.
//
// HONEST SCOPE (two real limits discovered this reprise, documented — not hidden):
//  1. The plan is built explicitly (as every P8.5 itest does), NOT selected from a natural-language
//     instruction by the cognitive analyzer. `apiCreateMission` drives a DIFFERENT subsystem
//     (cognitive-analyzer → pierre_rt_tasks → executors.ts) that never reaches RUNTIME_ACTION_HANDLERS.
//  2. The governed runtime does NOT thread an upstream step's output into a downstream step's input
//     (each step's payload is its immutable compile-time input_json). So multi-step chains are only
//     expressible when later steps reference a shared BUSINESS KEY (e.g. requirement_key), not a
//     runtime-generated uuid. That is why the training chain below keys every step by requirement_key,
//     and why hr-mission-pack steps like population.build (which need a runtime campaign_id) cannot yet
//     run through a single compiled plan. This is the concrete blocker for §3/§4 full pack execution.

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

async function drainJobs(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    const ready = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_jobs where company_id=$1 and status in ('queued','ready')`, [h.companyA])).rows[0].n;
    if (ready === 0) break;
  }
}
/** The human approves the real validation; the governed resolve primitive (the exact one the scheduler
 *  invokes) resolves the wait pinned to that content fingerprint. A wrong fingerprint is ignored. */
async function humanApprove(runId: string, missionId: string, fingerprint: string): Promise<string> {
  const val = (await h.db.query<{ id: string }>(`select id from pierre_rt_validations where company_id=$1 and mission_id=$2 and status='pending'`, [h.companyA, missionId])).rows[0];
  await h.db.query(`update pierre_rt_validations set status='approved', decided_at=now(), decided_by=$3 where company_id=$1 and id=$2`, [h.companyA, val.id, h.userA]);
  const wait = (await h.db.query<{ id: string; validation_id: string }>(`select id, validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and wait_kind='approval' and status='pending'`, [runId])).rows[0];
  const r = (await gov<{ pierre_rt_resolve_runtime_wait: string }>(h, owner, `select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, wait.id, null, "approval.decided", "validation", wait.validation_id, fingerprint])).rows[0].pierre_rt_resolve_runtime_wait;
  await runPierreRuntimeScheduler(h.db, owner, {});
  await drainJobs();
  return r;
}

describe("P22 authoritative worker E2E (governed runtime, not a direct handler call)", () => {
  it("PERFORMANCE: worker creates a real campaign, waits on a human approval, resumes on the decision, completes", async () => {
    const m = await seedMission(h, owner, "Lancer la campagne d'entretiens annuels");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "campaign", action_key: "performance.campaign.create", input: { campaign_key: "annual-e2e", title: "Campagne annuelle", mode: "copilote" } },
      { step_key: "approve", action_key: "approval.request", input: { reason: "Valider le lancement de la campagne", fingerprint: "CAMP_A" }, depends_on: ["campaign"] },
      { step_key: "done", action_key: "mission.noop", depends_on: ["approve"] },
    ] } });
    const runId = created.mission_run_id!;

    await drainJobs();
    // The worker (not a direct call) created the REAL campaign object.
    const camp = (await h.db.query<{ id: string }>(`select id from pierre_rt_performance_campaigns where company_id=$1 and campaign_key='annual-e2e'`, [h.companyA])).rows[0];
    expect(camp).toBeTruthy();
    // The approval step is WAITING on a real pending validation; the run is waiting.
    expect((await stepStatuses(h, runId)).approve).toBe("waiting");
    expect((await runState(h, runId)).status).toBe("waiting");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_validations where company_id=$1 and mission_id=$2 and status='pending'`, [h.companyA, m])).rows[0].n).toBe(1);

    // Human decision → governed resolve of the pinned wait → dependents run → completed.
    expect(await humanApprove(runId, m, "CAMP_A")).toBe("resolved");
    expect((await runState(h, runId)).status).toBe("completed");
    // No double effect: exactly one campaign.
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_performance_campaigns where company_id=$1 and campaign_key='annual-e2e'`, [h.companyA])).rows[0].n).toBe(1);
  });

  it("TRAINING: worker creates a real policy + requirement, validates the source against the REAL policy (active), gates on a human approval, resumes, completes", async () => {
    const m = await seedMission(h, owner, "Mettre en place la formation sécurité obligatoire");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "policy", action_key: "hr.policy.create", input: { policy_key: "sec-e2e", title: "Politique sécurité" } },
      { step_key: "req", action_key: "training.requirement.create", input: { requirement_key: "e2e-sec", title: "Sécurité", source_type: "company_policy", source_ref: "sec-e2e", mandatory: true }, depends_on: ["policy"] },
      { step_key: "validate", action_key: "training.requirement.validate_source", input: { requirement_key: "e2e-sec" }, depends_on: ["req"] },
      { step_key: "approve", action_key: "approval.request", input: { reason: "Valider l'obligation de formation", fingerprint: "TRN_A" }, depends_on: ["validate"] },
      { step_key: "done", action_key: "mission.noop", depends_on: ["approve"] },
    ] } });
    const runId = created.mission_run_id!;

    await drainJobs();
    // Real objects created by the worker; the source is now ACTIVE because it resolved to the REAL policy.
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_training_requirements where company_id=$1 and requirement_key='e2e-sec'`, [h.companyA])).rows[0].status).toBe("active");
    const verif = (await h.db.query<{ status: string; source_type: string }>(`select v.status, v.source_type from pierre_rt_training_source_verifications v join pierre_rt_training_requirements r on r.id=v.requirement_id where r.company_id=$1 and r.requirement_key='e2e-sec'`, [h.companyA])).rows[0];
    expect(verif.status).toBe("verified");
    expect(verif.source_type).toBe("company_policy");
    expect((await stepStatuses(h, runId)).approve).toBe("waiting");

    expect(await humanApprove(runId, m, "TRN_A")).toBe("resolved");
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("a rejected/obsolete approval never resumes the run (stays waiting) — no auto-pass", async () => {
    const m = await seedMission(h, owner, "Campagne à rejeter");
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "campaign", action_key: "performance.campaign.create", input: { campaign_key: "rej-e2e", title: "Rej", mode: "copilote" } },
      { step_key: "approve", action_key: "approval.request", input: { reason: "Valider", fingerprint: "REJ_A" }, depends_on: ["campaign"] },
      { step_key: "done", action_key: "mission.noop", depends_on: ["approve"] },
    ] } });
    const runId = created.mission_run_id!;
    await drainJobs();
    // A decision resolving with a DIFFERENT (obsolete) fingerprint must not resume the wait.
    expect(await humanApprove(runId, m, "WRONG_FP")).toBe("ignored_fingerprint");
    expect((await stepStatuses(h, runId)).approve).toBe("waiting");
    expect((await runState(h, runId)).status).toBe("waiting");
  });
});
