// PHASE 8.4.13/8.4.15 — idempotency, timeout recovery, retry classification, dead-letter, worker
// ownership. An ambiguous post-send timeout is RECONCILED (never a blind resend); a 429/5xx retries
// with bounded backoff → dead-letter; a permanent error never retries; complete/fail require the lease.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider, EmailProviderError, type EmailDeliveryProvider, type EmailSendInput } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const deps = (provider: EmailDeliveryProvider) => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

async function emailDelivery(): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.approved", { document_id: doc }); // operational, email allowed
  await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
  return (await h.db.query<{ id: string }>(`select id from pierre_rt_communication_deliveries where company_id=$1 and channel='email'`, [h.companyA])).rows[0].id;
}
async function clearRetry() { await h.db.query(`update pierre_rt_communication_deliveries set next_retry_at=now() - interval '1 second' where company_id=$1 and status in ('retry_scheduled','submission_unknown')`, [h.companyA]); }
async function statusOf(id: string) { return (await h.db.query<{ status: string; attempt_count: number }>(`select status, attempt_count from pierre_rt_communication_deliveries where company_id=$1 and id=$2`, [h.companyA, id])).rows[0]; }

class AlwaysFail implements EmailDeliveryProvider {
  readonly providerKey = "resend";
  constructor(private code: string, private retriable: boolean) {}
  async sendEmail(): Promise<never> { throw new EmailProviderError(this.code, this.code, this.retriable, this.retriable ? 503 : 422); }
  async verifyWebhook(): Promise<never> { throw new EmailProviderError("n/a", "n/a", false); }
}

describe("P8.4 retries, dead-letter, timeout recovery", () => {
  it("an ambiguous post-send timeout is RECONCILED (no blind resend; the send happened once)", async () => {
    const id = await emailDelivery();
    const provider = new FakeEmailProvider({ providerKey: "resend", timeoutAfterSend: true });
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps(provider));
    // the send was accepted by the provider once; recovery via the idempotency key submits the delivery
    expect(provider.sent.length).toBe(1);
    expect((await statusOf(id)).status).toBe("submitted");
    expect(r.submitted).toBe(1);
  });
  it("a 429 retries with a bounded backoff (retry_scheduled, not delivered)", async () => {
    const id = await emailDelivery();
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps(new FakeEmailProvider({ providerKey: "resend", rateLimitNextSend: true })));
    expect(r.retried).toBe(1);
    expect((await statusOf(id)).status).toBe("retry_scheduled");
  });
  it("a permanent (4xx) error never retries (the email fails; the in-app still delivers)", async () => {
    const id = await emailDelivery();
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps(new AlwaysFail("provider_4xx", false)));
    expect(r.submitted).toBe(0); // the email was NOT submitted
    expect((await statusOf(id)).status).toBe("failed"); // permanent, not retry_scheduled
  });
  it("repeated retriable failures DEAD-LETTER after the bound", async () => {
    const id = await emailDelivery();
    const provider = new AlwaysFail("provider_5xx", true);
    for (let i = 0; i < 5; i++) { await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: `w-${i}` }, deps(provider)); await clearRetry(); }
    const st = await statusOf(id);
    expect(st.status).toBe("dead_letter");
    expect(st.attempt_count).toBeGreaterThanOrEqual(5);
  });
  it("the governed submit/fail require the worker to OWN a valid lease (worker B cannot finish A's claim)", async () => {
    const id = await emailDelivery();
    // claim as A
    await h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]); await tx.query(`select id from pierre_rt_claim_communication_deliveries($1,$2,$3,$4,now())`, [h.companyA, 10, "A", 60]); });
    const gov = async (sql: string, params: unknown[]) => { try { await h.db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company',$1,true)`, [h.companyA]); await tx.query(sql, params); }); return true; } catch { return false; } };
    // B cannot submit / complete / fail
    expect(await gov(`select pierre_rt_submit_communication_delivery($1,$2,'B','resend','x','h')`, [h.companyA, id])).toBe(false);
    expect(await gov(`select pierre_rt_fail_communication_delivery($1,$2,'B','e','retry',60,5)`, [h.companyA, id])).toBe(false);
    // A (the owner) can
    expect(await gov(`select pierre_rt_submit_communication_delivery($1,$2,'A','resend','x','h')`, [h.companyA, id])).toBe(true);
  });
});
