// PHASE 8.4.17 — preferences + suppressions. A user can opt out of OPTIONAL/OPERATIONAL categories;
// a MANDATORY category (approval/transactional/security) can NEVER be disabled. A suppressed address
// is respected; a mandatory communication to a suppressed address is escalated, not falsely delivered.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { FakeEmailProvider } from "../communication-provider";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext; let provider: FakeEmailProvider;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); provider = new FakeEmailProvider({ providerKey: "resend" }); });
afterEach(async () => { await h.close(); });
const deps = () => ({ provider, secureLinkSecret: "s", publicBase: "https://app.test", from: "CloneStore <hr@clonestore.pro>" });

async function intentsFor(kind: string, payload: Record<string, unknown>) { await emitOutbox(h, owner, kind, payload); await Comm.createCommunicationIntents(h.db, owner); }

describe("P8.4.17 preferences + suppressions", () => {
  it("a user can opt out of an OPERATIONAL email; the in-app message is still created", async () => {
    const doc = await seedDocument(h, owner);
    await Comm.setCommunicationPreference(h.db, owner, { user_id: h.userA, category: "operational", channel: "email", enabled: false });
    await intentsFor("document.approved", { document_id: doc }); // operational
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps());
    expect(r.suppressed).toBe(1); // the email was suppressed by preference
    expect(r.delivered).toBe(1); // the in-app still delivered
    expect(provider.sent.length).toBe(0); // no email actually sent
  });
  it("a MANDATORY category cannot be disabled (the preference write is refused)", async () => {
    await expect(Comm.setCommunicationPreference(h.db, owner, { user_id: h.userA, category: "approval", channel: "email", enabled: false })).rejects.toThrow(/mandatory/i);
    await expect(Comm.setCommunicationPreference(h.db, owner, { user_id: h.userA, category: "transactional", channel: "in_app", enabled: false })).rejects.toThrow(/mandatory/i);
  });
  it("even with a stray preference row, a mandatory category is delivered (not suppressed)", async () => {
    const doc = await seedDocument(h, owner);
    // force a (normally-impossible) opt-out row directly, then verify it is IGNORED for the mandatory category
    await h.db.query(`insert into pierre_rt_communication_preferences (company_id, user_id, category, channel, enabled) values ($1,$2,'approval','in_app',false)`, [h.companyA, h.userA]);
    await intentsFor("document.ready_for_review", { document_id: doc }); // approval (mandatory)
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps());
    expect(r.delivered).toBe(1); // mandatory in-app delivered despite the opt-out row
  });
  it("a suppressed address (hard bounce) → an optional email is suppressed (not retried)", async () => {
    const doc = await seedDocument(h, owner);
    await h.db.query(`insert into pierre_rt_communication_suppressions (id, company_id, email_lower, reason) values (gen_random_uuid(),$1,'hr@acme.test','hard_bounce')`, [h.companyA]);
    await intentsFor("document.approved", { document_id: doc }); // operational
    const r = await Comm.dispatchCommunicationDeliveries(h.db, owner, { worker: "w" }, deps());
    expect(r.suppressed).toBe(1);
    expect(provider.sent.length).toBe(0);
    const em = (await h.db.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where company_id=$1 and channel='email'`, [h.companyA])).rows[0];
    expect(em.status).toBe("suppressed");
  });
});
