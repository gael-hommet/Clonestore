// PHASE 8.4.10 — the in-app message feed is real, recipient-bound, with a correct unread count, an
// idempotent mark-as-read, and a non-destructive archive. A user never sees / mutates another user's
// message.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider: new FakeEmailProvider({ providerKey: "resend" }), secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

async function deliverInApp(): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.signature_ready", { document_id: doc }); // in_app only
  await Comm.createCommunicationIntents(h.db, owner, {}, deps());
  await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps());
  return (await h.db.query<{ id: string }>(`select id from pierre_rt_notifications where company_id=$1 and recipient_user_id=$2`, [h.companyA, h.userA])).rows[0].id;
}

describe("P8.4.10 in-app message feed", () => {
  it("lists the recipient's messages with a correct unread count", async () => {
    await deliverInApp();
    const feed = await Comm.listInternalMessages(h.db, owner);
    expect(feed.items.length).toBe(1);
    expect(feed.unread).toBe(1);
    expect(feed.items[0].title).toBeTruthy();
    expect(feed.items[0].action_path).toBeTruthy();
  });
  it("mark-as-read is idempotent and lowers the unread count", async () => {
    const id = await deliverInApp();
    expect((await Comm.markInternalMessageRead(h.db, owner, id)).updated).toBe(true);
    expect((await Comm.markInternalMessageRead(h.db, owner, id)).updated).toBe(false); // idempotent (already read)
    expect((await Comm.listInternalMessages(h.db, owner)).unread).toBe(0);
  });
  it("archive is non-destructive (the row remains, hidden from the default feed)", async () => {
    const id = await deliverInApp();
    await Comm.archiveInternalMessage(h.db, owner, id);
    expect((await Comm.listInternalMessages(h.db, owner)).items.length).toBe(0);
    expect((await Comm.listInternalMessages(h.db, owner, { include_archived: true })).items.length).toBe(1);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_notifications where id=$1`, [id])).rows[0].n).toBe(1); // not deleted
  });
  it("a different user cannot read or mark another user's message", async () => {
    const id = await deliverInApp(); // belongs to userA
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    // B (other tenant + user) sees none, and a mark is a no-op
    expect((await Comm.listInternalMessages(h.db, ownerB)).items.length).toBe(0);
    expect((await Comm.markInternalMessageRead(h.db, ownerB, id)).updated).toBe(false);
    expect((await h.db.query<{ read_at: string | null }>(`select read_at from pierre_rt_notifications where id=$1`, [id])).rows[0].read_at).toBeNull(); // still unread for A
  });
});
