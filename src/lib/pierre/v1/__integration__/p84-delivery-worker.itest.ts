// PHASE 8.4.10/8.4.14 — the dispatch worker: real in-app message persistence + real email submit,
// claim/lease/ownership, two-worker disjointness, and the app role's inability to fabricate
// delivery truth. (PGlite single-connection → concurrency proven logically via claim exclusivity.)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider(); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "test-link-secret", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

async function readyDeliveries(): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
  await Comm.createCommunicationIntents(h.db, owner, {}, deps());
  return doc;
}

describe("P8.4 dispatch worker", () => {
  it("dispatches an in-app message (real, persisted, recipient-bound) and an email (real provider submit)", async () => {
    await readyDeliveries();
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w1" }, deps());
    expect(r.delivered).toBe(1); // in_app delivered
    expect(r.submitted).toBe(1); // email submitted
    // in-app message persisted to the REAL recipient (the owner user)
    const msg = (await h.db.query<{ recipient_user_id: string; title: string; action_path: string; read_at: string | null }>(`select recipient_user_id, title, action_path, read_at from pierre_rt_notifications where company_id=$1 and recipient_user_id is not null`, [h.companyA])).rows;
    expect(msg.length).toBe(1);
    expect(msg[0].recipient_user_id).toBe(h.userA);
    expect(msg[0].title).toBeTruthy();
    expect(msg[0].action_path).toContain("/secure/"); // a secure link, not an object key
    expect(msg[0].read_at).toBeNull(); // unread
    // email actually went to the provider, to the resolved signatory address
    expect(provider.sent.length).toBe(1);
    expect(provider.sent[0].input.to).toBe("hr@acme.test");
    // delivery truth
    const dels = (await h.db.query<{ channel: string; status: string; provider_message_id: string | null }>(`select channel, status, provider_message_id from pierre_rt_communication_deliveries where company_id=$1 order by channel`, [h.companyA])).rows;
    expect(dels.find((d) => d.channel === "in_app")?.status).toBe("delivered");
    const em = dels.find((d) => d.channel === "email");
    expect(em?.status).toBe("submitted");
    expect(em?.provider_message_id).toBeTruthy();
  });
  it("a re-dispatch sends nothing more (deliveries are terminal/claimed), exactly one email", async () => {
    await readyDeliveries();
    await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w1" }, deps());
    const r2 = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w2" }, deps());
    expect(r2.delivered + r2.submitted).toBe(0);
    expect(provider.sent.length).toBe(1); // never a second email
  });
  it("two workers claiming the same company get DISJOINT batches (no double send)", async () => {
    await readyDeliveries();
    // claim with w1 inside a tenant tx (the governed claim is FOR UPDATE SKIP LOCKED, tenant-bound)
    const claim = async (w: string) => h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]); return (await tx.query<{ id: string }>(`select id from pierre_rt_claim_communication_deliveries($1,$2,$3,$4,now())`, [h.companyA, 10, w, 60])).rows.map((x) => x.id); });
    const a = await claim("A"); const b = await claim("B");
    expect(a.length).toBe(2);
    expect(b.length).toBe(0); // B sees nothing — A holds the lease
  });
  it("the app role CANNOT fabricate a 'delivered' status, an attempt, or call the governed functions", async () => {
    await readyDeliveries();
    const del = (await h.db.query<{ id: string }>(`select id from pierre_rt_communication_deliveries where company_id=$1 limit 1`, [h.companyA])).rows[0];
    await h.pg.exec("set role pierre_rt_app");
    try {
      await expect(h.pg.query(`update pierre_rt_communication_deliveries set status='delivered' where id=$1`, [del.id])).rejects.toThrow(/permission denied/i);
      await expect(h.pg.query(`insert into pierre_rt_communication_attempts (id, company_id, delivery_id, attempt_number, result_status) values (gen_random_uuid(),$1,$2,1,'delivered')`, [h.companyA, del.id])).rejects.toThrow(/permission denied/i);
      await h.pg.query(`select set_config('app.current_company',$1,true)`, [h.companyA]);
      await expect(h.pg.query(`select pierre_rt_submit_communication_delivery($1,$2,'w','resend','x','h')`, [h.companyA, del.id])).rejects.toThrow(/permission denied/i);
    } finally { await h.pg.exec("reset role"); }
  });
});
