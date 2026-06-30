// PHASE 8.5-FINAL §3 — the VALIDATION decision is SERVICE-DRIVEN. The runtime approval wait resumes ONLY
// because the REAL decision service (decideValidationAction) emitted a durable runtime event IN ITS OWN
// TRANSACTION — never a scheduler poll of decided validations, never a raw UPDATE. An approval with the
// pinned content fingerprint resumes the step; a rejection / changes_requested is recorded but never lets
// the sensitive step proceed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, runtimeTick, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan } from "../runtime-service";
import { decideValidationAction } from "../mission-service";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

async function startApprovalRun(fingerprint = "CONTENT_A"): Promise<{ runId: string; validationId: string; version: number }> {
  const mission = await seedMission(h, owner, "Action soumise à validation");
  const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
    { step_key: "gate", action_key: "approval.request", input: { reason: "Autoriser l'action", fingerprint } },
    { step_key: "act", action_key: "mission.complete", depends_on: ["gate"] },
  ] } });
  await runtimeTick(h, owner);
  const v = (await h.db.query<{ validation_id: string }>(`select validation_id from pierre_rt_runtime_waits where mission_run_id=$1 and object_type='validation'`, [created.mission_run_id])).rows[0];
  const ver = (await h.db.query<{ version: number }>(`select version from pierre_rt_validations where id=$1`, [v.validation_id])).rows[0].version;
  return { runId: created.mission_run_id!, validationId: v.validation_id, version: ver };
}

describe("P8.5-FINAL validation service event", () => {
  it("the REAL decideValidationAction emits the durable event that resumes the step (no poll, no raw UPDATE)", async () => {
    const { runId, validationId, version } = await startApprovalRun("CONTENT_A");
    expect((await stepStatuses(h, runId)).gate).toBe("waiting");

    // the REAL decision service — it emits the durable runtime event inside its own transaction
    const decided = await decideValidationAction(h.db, owner, validationId, "approve", version);
    expect(decided.status).toBe("approved");
    // the durable event landed in the transactional outbox BEFORE any scheduler tick
    const outboxBefore = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='runtime.event' and dedup_key like $2`, [owner.company_id, `rtev:p8x_approval:val:${validationId}:approved%`])).rows[0].n;
    expect(outboxBefore).toBe(1);

    // the scheduler drains the service-emitted event and resolves the wait → step + run advance
    for (let i = 0; i < 6 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).gate).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
    // the durable runtime event is in the ledger, applied
    const ledger = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_events where company_id=$1 and source='p8x_approval' and kind='approval.approved' and object_id=$2`, [owner.company_id, validationId])).rows[0].n;
    expect(ledger).toBe(1);
  });

  it("a REJECTED decision is recorded but never resumes the sensitive step", async () => {
    const { runId, validationId, version } = await startApprovalRun("CONTENT_A");
    const decided = await decideValidationAction(h.db, owner, validationId, "reject", version);
    expect(decided.status).toBe("rejected");
    for (let i = 0; i < 3; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).gate).toBe("waiting"); // never auto-passes
    expect((await runState(h, runId)).status).not.toBe("completed");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_events where source='p8x_approval' and kind='approval.rejected' and object_id=$1`, [validationId])).rows[0].n).toBe(1);
  });

  it("deciding the same validation twice is idempotent (one event, no double resolve)", async () => {
    const { runId, validationId, version } = await startApprovalRun("CONTENT_A");
    await decideValidationAction(h.db, owner, validationId, "approve", version);
    const again = await decideValidationAction(h.db, owner, validationId, "approve", version); // idempotent replay
    expect(again.status).toBe("approved");
    for (let i = 0; i < 6 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await runState(h, runId)).status).toBe("completed");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_runtime_events where source='p8x_approval' and object_id=$1`, [validationId])).rows[0].n).toBe(1);
  });
});
