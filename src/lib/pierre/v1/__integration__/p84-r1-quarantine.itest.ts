// PHASE 8.4-R1.7 — an unknown event is QUARANTINED on the outbox (a real state, NOT
// status='dispatched'): kept, signalled, inspectable, reprocessable, never delivered, no infinite loop.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { emitOutbox } from "./p84-helpers";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("R1.7 real outbox quarantine for unknown events", () => {
  it("an unknown event → quarantined (not dispatched), audited, no delivery, and not re-scanned", async () => {
    await emitOutbox(h, owner, "totally.invented.event", { foo: "bar" }, "u1");
    const r = await Comm.createCommunicationIntents(h.db, owner);
    expect(r.unknown).toBe(1);

    const ob = (await h.db.query<{ status: string; comm_processing_status: string; comm_quarantine_reason: string }>(
      `select status, comm_processing_status, comm_quarantine_reason from pierre_rt_outbox where company_id=$1 and dedup_key='u1'`, [h.companyA])).rows[0];
    expect(ob.comm_processing_status).toBe("quarantined");
    expect(ob.comm_quarantine_reason).toBe("unknown_event");
    expect(ob.status).not.toBe("dispatched"); // R1.7 — NEVER falsely marked dispatched

    // no delivery was created
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_deliveries where company_id=$1`, [h.companyA])).rows[0].n).toBe(0);

    // a re-run does NOT re-scan it (no infinite loop), and does not create a delivery
    const r2 = await Comm.createCommunicationIntents(h.db, owner);
    expect(r2.scanned).toBe(0);

    // it is audited + inspectable
    const audit = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where company_id=$1 and action='communication.unknown_event_received'`, [h.companyA])).rows[0].n;
    expect(audit).toBe(1);
  });
});
