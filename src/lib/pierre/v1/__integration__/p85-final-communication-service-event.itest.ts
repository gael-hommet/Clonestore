// PHASE 8.5-FINAL §5 — the COMMUNICATION delivery is SERVICE-DRIVEN. A runtime step waiting on a
// communication resumes ONLY because the REAL P8.4 governed delivery transition (a persisted in-app
// message, or a verified provider 'delivered' webhook) emitted a durable runtime event IN ITS OWN
// TRANSACTION. A merely 'submitted' email is NOT a delivery and wakes nothing; a queued delivery wakes
// nothing; re-running drains idempotently. No raw UPDATE, no terminal pre-seed, no manual ingest.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";
import { seedMission, runtimeTick, runState, stepStatuses } from "./p85-helpers";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";

const SECRET = "comm-webhook-secret";
let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider({ providerKey: "resend" }); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });
function ingress() {
  return { async query(t: string, p?: readonly unknown[]) { await h.pg.exec("set role pierre_rt_communication_webhook"); try { const r = await h.pg.query(t, p ? [...p] : undefined); return { rows: r.rows as never[] }; } finally { await h.pg.exec("reset role"); } }, transaction(fn: (tx: unknown) => unknown) { return fn(this); } } as never;
}
function webhook(type: string, messageId: string, eventId: string) {
  const { body, signature } = provider.__makeWebhookBody({ type, data: { id: messageId }, event_id: eventId }, SECRET);
  return { rawBody: Buffer.from(body), headers: { "x-fake-signature": signature }, secret: SECRET };
}

/** prepare a REAL communication about `doc` (intents + recipients + queued deliveries), and a runtime run
 *  that durably WAITS for that communication to be delivered. No terminal state is pre-seeded. */
async function runWaitingOnCommunication(): Promise<{ runId: string; doc: string }> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
  await Comm.createCommunicationIntents(h.db, owner, {}, deps()); // intents + recipients + QUEUED deliveries
  const mission = await seedMission(h, owner, "Communiquer puis poursuivre");
  const created = await createMissionRunFromPlan(h.db, owner, { mission_id: mission, plan: { steps: [
    { step_key: "notify", action_key: "wait.for_event", input: { event_kind: "communication.delivered", object_type: "communication", object_id: doc } },
    { step_key: "done", action_key: "mission.complete", depends_on: ["notify"] },
  ] } });
  await runPierreRuntimeJobs(h.db, owner, { worker: "w" }); // creates the durable wait
  return { runId: created.mission_run_id!, doc };
}
// the DURABLE SERVICE EMISSION is the outbox runtime.event row the P8.4 transition wrote (before any drain)
const deliveredEvents = (_doc: string) => h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_outbox where company_id=$1 and kind='runtime.event' and payload->>'kind'='communication.delivered'`, [owner.company_id]).then((r) => r.rows[0].n);

describe("P8.5-FINAL communication service event", () => {
  it("a queued (not yet dispatched) delivery wakes nothing", async () => {
    const { runId } = await runWaitingOnCommunication();
    await runPierreRuntimeScheduler(h.db, owner, {}); // no delivery has happened yet
    expect((await stepStatuses(h, runId)).notify).toBe("waiting");
  });

  it("a REAL in-app delivery emits the event that resumes the step; a 'submitted' email does NOT", async () => {
    const { runId, doc } = await runWaitingOnCommunication();
    // the REAL dispatch: in-app is delivered (persisted message), the email is only SUBMITTED
    const d = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w1" }, deps());
    expect(d.delivered).toBe(1); // in-app delivered
    expect(d.submitted).toBe(1); // email merely submitted (NOT delivered)
    // exactly ONE delivered runtime event was emitted — the in-app one; the submitted email emitted none
    expect(await deliveredEvents(doc)).toBe(1);

    for (let i = 0; i < 4 && (await runState(h, runId)).status !== "completed"; i++) await runtimeTick(h, owner);
    expect((await stepStatuses(h, runId)).notify).toBe("succeeded");
    expect((await runState(h, runId)).status).toBe("completed");
  });

  it("a verified provider 'delivered' webhook emits the event (real P8.4 ingress, no manual ingest)", async () => {
    const { doc } = await runWaitingOnCommunication();
    await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w1" }, deps()); // in-app delivered + email submitted
    const before = await deliveredEvents(doc);
    const email = (await h.db.query<{ provider_message_id: string }>(`select provider_message_id from pierre_rt_communication_deliveries where company_id=$1 and channel='email'`, [owner.company_id])).rows[0];
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.delivered", email.provider_message_id, "e1"), providerInstance: provider });
    await Comm.applyPendingCommunicationEvents(h.db, owner); // REAL terminal transition → emits a runtime event
    expect(await deliveredEvents(doc)).toBe(before + 1); // a second delivered event from the email webhook
  });

  it("re-dispatching / re-ticking is idempotent (one delivered event, no double resolve)", async () => {
    const { runId, doc } = await runWaitingOnCommunication();
    await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w1" }, deps());
    await runtimeTick(h, owner); await runtimeTick(h, owner); // drain twice
    expect(await deliveredEvents(doc)).toBe(1);
    expect((await runState(h, runId)).status).toBe("completed");
  });
});
