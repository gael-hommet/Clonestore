// PHASE 8.4-R1.8 — the rendered content is FROZEN before the first provider call. If the business
// object changes between the first attempt and a retry, the retried delivery reuses the EXACT frozen
// content (subject + content_hash) and the EXACT provider idempotency key + frozen recipient — the
// business change does NOT leak into the in-flight delivery.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

async function frozen(): Promise<{ id: string; content_hash: string; provider_idempotency_key: string; frozen_subject: string }> {
  const r = (await h.db.query<{ id: string; content_hash: string; provider_idempotency_key: string; frozen_subject: string }>(
    `select id, content_hash, provider_idempotency_key, frozen_subject from pierre_rt_communication_deliveries where company_id=$1 and channel='email'`, [h.companyA])).rows[0];
  return r;
}

describe("R1.8 content frozen before the first send", () => {
  it("a business change between attempt 1 and the retry does NOT change the frozen content/key", async () => {
    const doc = await seedDocument(h, owner, "Titre ORIGINAL");
    await emitOutbox(h, owner, "document.approved", { document_id: doc, version: 1 });
    await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
    const before = await frozen();
    expect(before.content_hash).toBeTruthy();
    expect(before.provider_idempotency_key).toContain("communication:");

    // attempt 1 FAILS (retriable) → delivery retry_scheduled, frozen content intact
    const failing = new FakeEmailProvider({ failNextSend: true });
    await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w1" }, { provider: failing, secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" });

    // the business object changes
    await h.db.query(`update pierre_rt_documents set title='Titre MODIFIE' where company_id=$1 and id=$2`, [h.companyA, doc]);

    // retry succeeds — the SENT email uses the FROZEN subject + idempotency key (not the new title)
    await h.db.query(`update pierre_rt_communication_deliveries set next_retry_at=now() - interval '1 second' where company_id=$1 and status='retry_scheduled'`, [h.companyA]);
    const ok = new FakeEmailProvider();
    await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w2" }, { provider: ok, secureLinkSecret: "s", publicBase: "https://app.test", from: "X <x@x.test>" });

    const after = await frozen();
    expect(after.content_hash).toBe(before.content_hash);
    expect(after.provider_idempotency_key).toBe(before.provider_idempotency_key);
    expect(ok.sent.length).toBe(1);
    expect(ok.sent[0].input.subject).toBe(before.frozen_subject);
    expect(ok.sent[0].input.subject).not.toContain("MODIFIE");
    expect(ok.sent[0].input.idempotencyKey).toBe(before.provider_idempotency_key);
  });
});
