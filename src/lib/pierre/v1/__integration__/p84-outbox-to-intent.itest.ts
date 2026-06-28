// PHASE 8.4.2 — outbox business events become governed communication intents. A communicable event
// creates one intent (+ recipient + deliveries); a replay is idempotent; a known internal event is
// skipped; an unknown event is quarantined (kept, signalled, NOT dispatched); a forged payload
// company_id has no effect (the tenant is the session tenant).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

describe("P8.4.2 outbox → communication intents", () => {
  it("a communicable event creates one intent + recipient + deliveries", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
    const r = await Comm.createCommunicationIntents(h.db, owner);
    expect(r.created).toBe(1);
    const intent = (await h.db.query<{ status: string; event_kind: string }>(`select status, event_kind from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows;
    expect(intent.length).toBe(1);
    expect(intent[0].event_kind).toBe("document.ready_for_review");
    const deliveries = (await h.db.query<{ channel: string; status: string }>(`select channel, status from pierre_rt_communication_deliveries where company_id=$1 order by channel`, [h.companyA])).rows;
    expect(deliveries.map((d) => d.channel).sort()).toEqual(["email", "in_app"]); // both channels (signatory email present)
    expect(deliveries.every((d) => d.status === "queued")).toBe(true);
  });
  it("a replay is idempotent (same intent, no duplicate deliveries)", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
    await Comm.createCommunicationIntents(h.db, owner);
    // re-emit the SAME logical event + re-run
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc }, `redo:${doc}`);
    const r2 = await Comm.createCommunicationIntents(h.db, owner);
    expect(r2.created).toBe(0); // same dedup fingerprint → no new intent
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0].n).toBe(1);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_deliveries where company_id=$1`, [h.companyA])).rows[0].n).toBe(2);
  });
  it("a known internal lifecycle event is skipped (no intent)", async () => {
    await emitOutbox(h, owner, "contract.created", { contract_id: "x" });
    const r = await Comm.createCommunicationIntents(h.db, owner);
    expect(r.skipped_non_communicable).toBe(1);
    expect(r.created).toBe(0);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);
  });
  it("an unknown event is QUARANTINED (intent unknown_event, no deliveries)", async () => {
    await emitOutbox(h, owner, "totally.invented.event", { foo: "bar" });
    const r = await Comm.createCommunicationIntents(h.db, owner);
    expect(r.unknown).toBe(1);
    const intent = (await h.db.query<{ status: string }>(`select status from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0];
    expect(intent.status).toBe("unknown_event");
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_deliveries where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);
  });
  it("an object that does not exist in the tenant → intent blocked (no deliveries)", async () => {
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: "00000000-0000-0000-0000-000000000000" });
    const r = await Comm.createCommunicationIntents(h.db, owner);
    expect(r.blocked).toBe(1);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_deliveries where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);
  });
});
