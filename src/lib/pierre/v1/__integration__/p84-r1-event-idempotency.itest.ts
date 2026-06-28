// PHASE 8.4-R1.6 — exact event idempotency. A document ready_for_review v1 then v2 produce TWO
// distinct intents (the version is part of the source key). An exact v2 replay (same key + same
// payload hash) is idempotent. A different payload under the SAME key is a replay CONFLICT (quarantined,
// never a second divergent delivery).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const deps = { secureLinkSecret: "s", publicBase: "https://app.test" };
const intentCount = async () => (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0].n;

describe("R1.6 exact event idempotency", () => {
  it("v1 then v2 of the same object produce TWO distinct legitimate intents", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 1 }, "rfr:v1");
    await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 2 }, "rfr:v2");
    const r2 = await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    expect(r2.created).toBe(1);
    expect(await intentCount()).toBe(2);
    const versions = (await h.db.query<{ object_version: string }>(`select object_version from pierre_rt_communication_intents where company_id=$1 order by object_version`, [h.companyA])).rows.map((x) => x.object_version);
    expect(versions).toEqual(["1", "2"]);
  });

  it("an EXACT v2 replay (same key + same payload) is idempotent — no new intent", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 2 }, "a");
    await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 2 }, "b"); // different dedup_key, same logical event
    const r2 = await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    expect(r2.created).toBe(0);
    expect(await intentCount()).toBe(1);
  });

  it("the SAME key with a DIFFERENT payload is a replay conflict (quarantined, not a 2nd intent)", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 2, note: "first" }, "x");
    await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 2, note: "TAMPERED" }, "y");
    const r2 = await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    expect(r2.conflicts).toBe(1);
    expect(r2.created).toBe(0);
    expect(await intentCount()).toBe(1);
    const q = (await h.db.query<{ comm_quarantine_reason: string }>(`select comm_quarantine_reason from pierre_rt_outbox where company_id=$1 and dedup_key='y'`, [h.companyA])).rows[0];
    expect(q.comm_quarantine_reason).toBe("replay_conflict");
  });
});
