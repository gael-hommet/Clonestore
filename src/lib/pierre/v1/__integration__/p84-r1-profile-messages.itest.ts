// PHASE 8.4-R1.11 — the /profile/messages real source: listInternalMessages returns the REAL persisted
// in-app messages for THIS recipient only (active tenant), with a real unread count, working
// mark-as-read + archive, and a working action path. No global data, no other tenant's data.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let ownerA: TenantContext; let ownerB: TenantContext;
beforeEach(async () => {
  h = await createHarness();
  ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
  await configureSignatory(h, h.companyA);
});
afterEach(async () => { await h.close(); });
const deps = { provider: new FakeEmailProvider(), secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" };

async function deliverToA(): Promise<void> {
  const doc = await seedDocument(h, ownerA);
  await emitOutbox(h, ownerA, "document.signature_ready", { document_id: doc }); // in_app only
  await Comm.createCommunicationIntents(h.db, ownerA, {}, deps);
  await Comm.dispatchCommunicationDeliveries(h.db, ownerA, { worker: "w" }, deps);
}

describe("R1.11 profile messages real source", () => {
  it("the recipient sees their REAL message with a real unread count + action path", async () => {
    await deliverToA();
    const { items, unread } = await Comm.listInternalMessages(h.db, ownerA);
    expect(items.length).toBe(1);
    expect(unread).toBe(1);
    expect(items[0].read_at).toBeNull();
    expect(items[0].action_path).toContain("/secure/");
  });

  it("another tenant's user sees NONE of it (recipient-only, tenant-scoped)", async () => {
    await deliverToA();
    const { items, unread } = await Comm.listInternalMessages(h.db, ownerB);
    expect(items.length).toBe(0);
    expect(unread).toBe(0);
  });

  it("mark-as-read is idempotent and only affects the recipient's own message", async () => {
    await deliverToA();
    const { items } = await Comm.listInternalMessages(h.db, ownerA);
    const id = items[0].id;
    expect((await Comm.markInternalMessageRead(h.db, ownerA, id)).updated).toBe(true);
    expect((await Comm.markInternalMessageRead(h.db, ownerA, id)).updated).toBe(false); // already read
    expect((await Comm.listInternalMessages(h.db, ownerA)).unread).toBe(0);
  });

  it("archive removes it from the default feed (non-destructive)", async () => {
    await deliverToA();
    const { items } = await Comm.listInternalMessages(h.db, ownerA);
    await Comm.archiveInternalMessage(h.db, ownerA, items[0].id);
    expect((await Comm.listInternalMessages(h.db, ownerA)).items.length).toBe(0);
    expect((await Comm.listInternalMessages(h.db, ownerA, { include_archived: true })).items.length).toBe(1);
  });
});
