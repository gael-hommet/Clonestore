// PHASE 8.4.18/8.4.19 — verified provider webhook → idempotent governed ingest → tenant-bound state
// machine. Signature/replay enforced; tenant derived from (provider, message_id) not the payload;
// duplicate idempotent; submitted≠delivered; delivered terminal; an old/lower event never regresses;
// opened never flips status; a bounce records a suppression.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

const SECRET = "comm-webhook-secret";
let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider({ providerKey: "resend" }); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

// an ingress executor bound to the minimal webhook role
function ingress() {
  return { async query(t: string, p?: readonly unknown[]) { await h.pg.exec("set role pierre_rt_communication_webhook"); try { const r = await h.pg.query(t, p ? [...p] : undefined); return { rows: r.rows as never[] }; } finally { await h.pg.exec("reset role"); } }, transaction(fn: (tx: unknown) => unknown) { return fn(this); } } as never;
}
async function submittedEmail(): Promise<{ deliveryId: string; messageId: string }> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.approved", { document_id: doc });
  await Comm.createCommunicationIntents(h.db, owner, {}, deps());
  await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps());
  const d = (await h.db.query<{ id: string; provider_message_id: string }>(`select id, provider_message_id from pierre_rt_communication_deliveries where company_id=$1 and channel='email'`, [h.companyA])).rows[0];
  return { deliveryId: d.id, messageId: d.provider_message_id };
}
function webhook(type: string, messageId: string, eventId: string) {
  const { body, signature } = provider.__makeWebhookBody({ type, data: { id: messageId }, event_id: eventId }, SECRET);
  return { rawBody: Buffer.from(body), headers: { "x-fake-signature": signature }, secret: SECRET };
}

describe("P8.4 provider webhook + state machine", () => {
  it("an unsigned / wrongly-signed webhook is refused", async () => {
    const { messageId } = await submittedEmail();
    await expect(Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.delivered", messageId, "e1"), headers: { "x-fake-signature": "bad" }, providerInstance: provider })).rejects.toThrow(/signature/i);
  });
  it("a verified delivered event transitions the delivery to delivered (tenant derived from the message id)", async () => {
    const { deliveryId, messageId } = await submittedEmail();
    const out = await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.delivered", messageId, "e1"), providerInstance: provider });
    expect(out.status).toBe("received");
    expect(out.company).toBe(h.companyA); // derived, never from the payload
    await Comm.applyPendingCommunicationEvents(h.db, owner);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [deliveryId])).rows[0].status).toBe("delivered");
  });
  it("a duplicate event is idempotent; the same event id with a different payload is a conflict", async () => {
    const { messageId } = await submittedEmail();
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.delivered", messageId, "e1"), providerInstance: provider });
    const dup = await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.delivered", messageId, "e1"), providerInstance: provider });
    expect(dup.status).toBe("duplicate");
    // same event id, different body (different message id) → replay conflict
    await expect(Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.bounced", "other_msg", "e1"), providerInstance: provider })).rejects.toThrow(/replay|different payload/i);
  });
  it("submitted ≠ delivered; delivered is terminal; an older 'sent' after 'delivered' does NOT regress", async () => {
    const { deliveryId, messageId } = await submittedEmail();
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.delivered", messageId, "e1"), providerInstance: provider });
    await Comm.applyPendingCommunicationEvents(h.db, owner);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [deliveryId])).rows[0].status).toBe("delivered");
    // a late 'sent' (submitted) arriving after delivered must be ignored
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.sent", messageId, "e2"), providerInstance: provider });
    await Comm.applyPendingCommunicationEvents(h.db, owner);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [deliveryId])).rows[0].status).toBe("delivered"); // no regress
  });
  it("'opened' never flips the status; a bounce records a suppression", async () => {
    const { deliveryId, messageId } = await submittedEmail();
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.opened", messageId, "e1"), providerInstance: provider });
    await Comm.applyPendingCommunicationEvents(h.db, owner);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [deliveryId])).rows[0].status).toBe("submitted"); // opened ≠ delivered
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.bounced", messageId, "e2"), providerInstance: provider });
    const apply = await Comm.applyPendingCommunicationEvents(h.db, owner);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [deliveryId])).rows[0].status).toBe("bounced");
    expect(apply.suppressions).toBeGreaterThanOrEqual(1);
    expect((await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_suppressions where company_id=$1 and email_lower='hr@acme.test'`, [h.companyA])).rows[0].n).toBe(1);
  });
  it("an unknown provider event is kept but NOT applied", async () => {
    const { deliveryId, messageId } = await submittedEmail();
    await Comm.receiveCommunicationWebhook(ingress(), { ...webhook("email.weird_unknown", messageId, "e1"), providerInstance: provider });
    await Comm.applyPendingCommunicationEvents(h.db, owner);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where id=$1`, [deliveryId])).rows[0].status).toBe("submitted"); // unchanged
    expect((await h.db.query<{ application_status: string }>(`select application_status from pierre_rt_communication_provider_events where provider_event_id='e1'`)).rows[0].application_status).toBe("ignored");
  });
});
