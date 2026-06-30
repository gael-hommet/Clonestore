// PHASE 8.5 §30 — durable follow-ups / relances. A follow-up step persists a bounded schedule; the
// scheduler fires it, checking a TYPED stop-condition BEFORE creating a P8.4 communication. While the
// document is missing, a relance is sent (a new intention each time); once the document is approved the
// stop-condition is met and NO further relance is sent. The relance is bounded and never doubles.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, seedRuntimeDocument } from "./p85-helpers";
import { configureSignatory } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import { runPierreRuntimeScheduler } from "../runtime-scheduler";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const dueNow = () => h.db.query(`update pierre_rt_runtime_schedules set next_run_at=now()-interval '1 second', lease_expires_at=null, locked_by=null where company_id=$1 and status='active'`, [h.companyA]);
const intents = async () => (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0].n;

describe("P8.5 relance (bounded follow-up with a typed stop-condition)", () => {
  it("relances while the document is missing, stops once it is approved — bounded, never doubled", async () => {
    const doc = await seedRuntimeDocument(h, owner);
    const provider = new FakeEmailProvider();
    const comm = { provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" };
    const m = await seedMission(h, owner);
    await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "relance", action_key: "follow_up.schedule", input: {
        reason: "document attendu", delay_seconds: 0, recurrence: true, max_occurrences: 3,
        communication: { event_kind: "document.approved", object_id: doc },
        stop_condition: { type: "document_status_in", document_id: doc, statuses: ["approved"] },
      } },
    ] } });
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" }); // creates the durable schedule

    // first fire: document still draft → a relance is sent
    const t1 = await runPierreRuntimeScheduler(h.db, owner, {}, { comm });
    expect(t1.relances_fired).toBe(1);
    expect(await intents()).toBe(1);

    // second fire (forced due): still draft → a SECOND, DISTINCT relance (new intention)
    await dueNow();
    const t2 = await runPierreRuntimeScheduler(h.db, owner, {}, { comm });
    expect(t2.relances_fired).toBe(1);
    expect(await intents()).toBe(2); // two distinct source_event_keys, never merged

    // the document is approved → the stop-condition is met → NO further relance
    await h.db.query(`update pierre_rt_documents set status='approved' where company_id=$1 and id=$2`, [h.companyA, doc]);
    await dueNow();
    const t3 = await runPierreRuntimeScheduler(h.db, owner, {}, { comm });
    expect(t3.relances_fired).toBe(0);
    expect(t3.schedules_completed).toBeGreaterThanOrEqual(1);
    expect(await intents()).toBe(2); // unchanged — the relance stopped on the stop-condition

    // the schedule is closed; a further tick fires nothing
    const t4 = await runPierreRuntimeScheduler(h.db, owner, {}, { comm });
    expect(t4.relances_fired).toBe(0);
  });
});
