// PHASE 8.5-FINAL §7 — compensations are REALLY EXECUTED, not just classified. executeMissionCompensations
// calls the SAME governed services the runtime used (P8.4 cancel, documentary archive, the governed local
// cancel) on REAL objects: a queued communication delivery becomes 'cancelled', a draft document becomes
// 'archived'. A DELIVERED communication is reported irreversible (never undone). A REQUIRED compensation
// that FAILS leaves the mission in manual review (NEVER a false 'cancelled'). Double-cancel is idempotent.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";
import { seedMission } from "./p85-helpers";
import { createMissionRunFromPlan } from "../runtime-service";
import { executeMissionCompensations, type CompensationEffect } from "../runtime-compensation-execution";

let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider(); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

async function activeRun(): Promise<string> {
  const m = await seedMission(h, owner, "Run à compenser");
  const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [{ step_key: "s", action_key: "wait.until_time", input: { wake_at: new Date(Date.now() + 3600000).toISOString() } }] } });
  return created.mission_run_id!;
}
/** create a REAL queued in-app communication delivery; return its id. */
async function queuedDelivery(): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
  await Comm.createCommunicationIntents(h.db, owner, {}, deps()); // QUEUED deliveries, nothing dispatched
  return (await h.db.query<{ id: string }>(`select id from pierre_rt_communication_deliveries where company_id=$1 and channel='in_app' and status='queued'`, [owner.company_id])).rows[0].id;
}
const delStatus = (id: string) => h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [id]).then((r) => r.rows[0].status);
const runStatus = (id: string) => h.db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id=$1`, [id]).then((r) => r.rows[0].status);
const docStatus = (id: string) => h.db.query<{ status: string }>(`select status from pierre_rt_documents where id=$1`, [id]).then((r) => r.rows[0].status);

describe("P8.5-FINAL compensation execution", () => {
  it("a queued communication delivery is REALLY cancelled via the governed service; the run cancels clean", async () => {
    const runId = await activeRun();
    const deliveryId = await queuedDelivery();
    const docId = await seedDocument(h, owner, "Brouillon");
    const effects: CompensationEffect[] = [
      { action_key: "communication.create_intent", state: "queued", reference: deliveryId },
      { action_key: "document.generate", state: "draft", reference: docId },
    ];
    const out = await executeMissionCompensations(h.db, owner, runId, effects);
    expect(out.clean).toBe(true);
    expect(out.mission_status).toBe("cancelled");
    expect(await delStatus(deliveryId)).toBe("cancelled"); // REAL governed cancel happened
    expect(await docStatus(docId)).toBe("archived");        // REAL governed archive happened
    expect(await runStatus(runId)).toBe("cancelled");
  });

  it("a DELIVERED communication is reported irreversible and never undone; the run is NOT cleanly cancelled", async () => {
    const runId = await activeRun();
    const deliveryId = await queuedDelivery();
    await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps()); // in-app → DELIVERED (irreversible)
    const out = await executeMissionCompensations(h.db, owner, runId, [{ action_key: "communication.create_intent", state: "delivered", reference: deliveryId }]);
    expect(out.clean).toBe(false);
    expect(out.mission_status).toBe("manual_review");
    expect(out.irreversible_external_effects.map((e) => e.action_key)).toEqual(["communication.create_intent"]);
    expect(await delStatus(deliveryId)).toBe("delivered");   // never pretended-undone
    expect(await runStatus(runId)).not.toBe("cancelled");    // no false cancelled
  });

  it("a FAILED required compensation blocks the mission in manual review (no false cancelled)", async () => {
    const runId = await activeRun();
    const deliveryId = await queuedDelivery();
    const out = await executeMissionCompensations(h.db, owner, runId, [{ action_key: "communication.create_intent", state: "queued", reference: deliveryId }], { __failAction: "communication.create_intent" });
    expect(out.clean).toBe(false);
    expect(out.mission_status).toBe("manual_review");
    expect(out.compensation_failures.map((e) => e.action_key)).toEqual(["communication.create_intent"]);
    expect(out.manual_actions_required.length).toBeGreaterThan(0);
    expect(await delStatus(deliveryId)).toBe("queued");      // the failed comp left it untouched
    expect(await runStatus(runId)).not.toBe("cancelled");
    // a durable runtime event + a CloneTrace record were written for the operator
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='runtime.event' and payload->>'kind'='mission.compensation_manual_review'`, [owner.company_id])).rows[0].n).toBe(1);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_events where company_id=$1 and type='mission.compensation_manual_review'`, [owner.company_id])).rows[0].n).toBe(1);
  });

  it("double compensation is idempotent (the second run does not error or double-undo)", async () => {
    const runId = await activeRun();
    const deliveryId = await queuedDelivery();
    const effects: CompensationEffect[] = [{ action_key: "communication.create_intent", state: "queued", reference: deliveryId }];
    await executeMissionCompensations(h.db, owner, runId, effects);
    const second = await executeMissionCompensations(h.db, owner, runId, [{ action_key: "communication.create_intent", state: "cancelled", reference: deliveryId }]);
    expect(second.mission_status).toBe("cancelled"); // already cancelled, idempotent
    expect(await delStatus(deliveryId)).toBe("cancelled");
    expect(await runStatus(runId)).toBe("cancelled");
  });
});
