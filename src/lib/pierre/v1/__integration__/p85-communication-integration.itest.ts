// PHASE 8.5 §27 — the runtime NEVER sends email directly. A communication.create_intent step emits a
// governed outbox event + runs the P8.4 pipeline (createCommunicationIntents → dispatch). The email
// reaches the recipient ONLY through the governed P8.4 delivery (here a Fake provider), never a direct
// send. Each occurrence is a DISTINCT source_event_key (a legitimate relance is a new intention).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedMission, seedRuntimeDocument, stepStatuses } from "./p85-helpers";
import { configureSignatory } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

describe("P8.5 communication integration (P8.4, no direct send)", () => {
  it("a communication step delivers ONLY through the governed P8.4 pipeline", async () => {
    const doc = await seedRuntimeDocument(h, owner);
    const provider = new FakeEmailProvider();
    const m = await seedMission(h, owner);
    const created = await createMissionRunFromPlan(h.db, owner, { mission_id: m, plan: { steps: [
      { step_key: "notify", action_key: "communication.create_intent", input: { event_kind: "document.approved", object_id: doc } },
    ] } });
    const runId = created.mission_run_id!;
    await runPierreRuntimeJobs(h.db, owner, { worker: "w" }, { comm: { provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" } });

    expect((await stepStatuses(h, runId)).notify).toBe("succeeded");
    // the email went through the P8.4 governed delivery (Fake), not a direct runtime send
    const dels = (await h.db.query<{ channel: string; status: string }>(`select channel, status from pierre_rt_communication_deliveries where company_id=$1`, [h.companyA])).rows;
    expect(dels.some((d) => d.channel === "email" && ["submitted", "delivered"].includes(d.status))).toBe(true);
    expect(dels.some((d) => d.channel === "in_app" && d.status === "delivered")).toBe(true);
    expect(provider.sent.length).toBe(1); // exactly one governed send
    // a real in-app message was persisted to the recipient
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_notifications where company_id=$1 and recipient_user_id is not null`, [h.companyA])).rows[0].n).toBe(1);
    // and one governed communication intent exists (a single logical event)
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0].n).toBe(1);
  });
});
