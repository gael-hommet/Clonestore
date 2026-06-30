// PHASE 8.5 §23/§24/§25 — durable waits + resume. A step can WAIT on a timer (resolved when the
// scheduler tick reaches wake_at), on an external event (resolved by the ingestor on an EXACT match),
// or on an approval (resolved only when the fingerprint matches — a content change does NOT resume).
// A replayed event never resolves twice. Resolution makes the waiting step succeed and the run advance.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runState, stepStatuses, gov } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler, ingestPierreRuntimeEvent } from "../runtime-scheduler";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("P8.5 durable waits + resume", () => {
  it("a timer wait is resolved by the scheduler when its wake_at is due → the run advances", async () => {
    const m = await seedMission(h, owner);
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "wait", action_key: "wait.until_time", input: { wake_at: new Date(Date.now() - 1000).toISOString() } },
      { step_key: "after", action_key: "mission.noop", depends_on: ["wait"] },
    ] } });
    const runId = created.mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" }); // executes the wait → step waiting, run waiting
    expect((await stepStatuses(h, runId)).wait).toBe("waiting");
    expect((await runState(h, runId)).status).toBe("waiting");

    const sched = await runPierreRuntimeScheduler(h.db, owner, {}); // timer due → resolved
    expect(sched.timers_resolved).toBe(1);
    expect((await stepStatuses(h, runId)).wait).toBe("succeeded");
    expect((await stepStatuses(h, runId)).after).toBe("queued"); // dependent enqueued

    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("an external-event wait resolves only on an EXACT match; a replay never resolves twice", async () => {
    const m = await seedMission(h, owner);
    const objectId = newUuid();
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "w", action_key: "wait.for_event", input: { event_kind: "document.approved", object_type: "document", object_id: objectId } },
    ] } });
    const runId = created.mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect((await stepStatuses(h, runId)).w).toBe("waiting");

    // a non-matching event does NOT resolve
    const wrong = await ingestPierreRuntimeEvent(h.db, owner, { source: "test", event_key: "e0", kind: "document.approved", object_type: "document", object_id: newUuid(), payload_hash: "h0" });
    expect(wrong.resolved).toBe(0);
    expect((await stepStatuses(h, runId)).w).toBe("waiting");

    // the exact event resolves it once
    const hit = await ingestPierreRuntimeEvent(h.db, owner, { source: "test", event_key: "e1", kind: "document.approved", object_type: "document", object_id: objectId, payload_hash: "h1" });
    expect(hit.resolved).toBe(1);
    expect((await stepStatuses(h, runId)).w).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");

    // a replay of the SAME event is idempotent (duplicate) and resolves nothing further
    const replay = await ingestPierreRuntimeEvent(h.db, owner, { source: "test", event_key: "e1", kind: "document.approved", object_type: "document", object_id: objectId, payload_hash: "h1" });
    expect(replay.status).toBe("duplicate");
  });

  it("an approval wait resolves only when the fingerprint matches (an obsolete content does NOT)", async () => {
    const m = await seedMission(h, owner);
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "appr", action_key: "approval.request", input: { reason: "Valider le contrat", fingerprint: "CONTENT_A" } },
    ] } });
    const runId = created.mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" });
    expect((await stepStatuses(h, runId)).appr).toBe("waiting");
    const waitId = (await h.db.query<{ id: string; validation_id: string }>(`select id, validation_id from pierre_rt_runtime_waits where mission_run_id=$1`, [runId])).rows[0];

    // approval arrives for a DIFFERENT (obsolete) content fingerprint → ignored, step stays waiting
    // (event id is null here — the FK-bound real-event path is proven in p85-r1-real-validation-bridge)
    const obsolete = (await gov<{ pierre_rt_resolve_runtime_wait: string }>(h, owner, `select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, waitId.id, null, "approval.decided", "validation", waitId.validation_id, "CONTENT_B"])).rows[0].pierre_rt_resolve_runtime_wait;
    expect(obsolete).toBe("ignored_fingerprint");
    expect((await stepStatuses(h, runId)).appr).toBe("waiting");

    // approval for the pinned content fingerprint → resolves
    const okMatch = (await gov<{ pierre_rt_resolve_runtime_wait: string }>(h, owner, `select pierre_rt_resolve_runtime_wait($1,$2,$3,$4,$5,$6,$7)`, [h.companyA, waitId.id, null, "approval.decided", "validation", waitId.validation_id, "CONTENT_A"])).rows[0].pierre_rt_resolve_runtime_wait;
    expect(okMatch).toBe("resolved");
    expect((await stepStatuses(h, runId)).appr).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
  });
});
