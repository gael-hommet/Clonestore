// PHASE 8.4-R1.1 / R1.8 — the dispatch worker reads ONLY the frozen communication content: even if the
// underlying business object is DELETED after the intent is created, the in-app delivery still
// succeeds with the frozen title/body — proving the worker never re-reads the business object.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const deps = { provider: new FakeEmailProvider(), secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" };

describe("R1.1/R1.8 worker reads only frozen content", () => {
  it("an in-app delivery still succeeds after the business object is deleted (frozen content)", async () => {
    const doc = await seedDocument(h, owner, "Document GELÉ");
    await emitOutbox(h, owner, "document.signature_ready", { document_id: doc }); // in_app only
    await Comm.createCommunicationIntents(h.db, owner, {}, deps);

    // the business object disappears AFTER freezing
    await h.db.query(`delete from pierre_rt_documents where company_id=$1 and id=$2`, [h.companyA, doc]);

    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps);
    expect(r.delivered).toBe(1); // delivered from frozen content, no business read

    const msg = (await h.db.query<{ title: string }>(`select title from pierre_rt_notifications where company_id=$1 and recipient_user_id=$2`, [h.companyA, h.userA])).rows[0];
    expect(msg.title).toBeTruthy();
  });
});
