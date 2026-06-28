// PHASE 8.4.6 — recipients are resolved from REAL tenant identities. A cross-tenant object is
// invisible (blocked); a free payload email/company is NEVER authoritative; the resolved address is
// the tenant's own signatory email.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { resolveCommunicationRecipient } from "../communication-recipient-resolver";
import * as Comm from "../communications";

let h: Harness; let ownerA: TenantContext; let ownerB: TenantContext;
beforeEach(async () => {
  h = await createHarness();
  ownerA = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
  await configureSignatory(h, h.companyA, "hr-a@acme.test");
  await configureSignatory(h, h.companyB, "hr-b@beta.test");
});
afterEach(async () => { await h.close(); });

describe("P8.4.6 recipient tenant isolation", () => {
  it("resolves the tenant's OWN signatory email + operator (never a payload value)", async () => {
    const doc = await seedDocument(h, ownerA);
    const r = await resolveCommunicationRecipient(h.db, ownerA, { recipientStrategy: "document_approver", objectType: "document", objectId: doc, payload: { email: "attacker@evil.test", company_id: h.companyB }, requiresEmail: true });
    expect(r.resolved).toBe(true);
    expect(r.recipient?.resolved_email).toBe("hr-a@acme.test"); // tenant's own, NOT the payload value
    expect(r.recipient?.resolved_user_id).toBe(h.userA);
  });
  it("a document of ANOTHER tenant is invisible → blocked", async () => {
    const docB = await seedDocument(h, ownerB);
    const r = await resolveCommunicationRecipient(h.db, ownerA, { recipientStrategy: "document_approver", objectType: "document", objectId: docB, payload: {}, requiresEmail: true });
    expect(r.resolved).toBe(false);
    expect(r.blockers).toContain("object_not_found_in_tenant");
  });
  it("a forged payload company_id has NO effect on the outbox→intent tenant", async () => {
    const docA = await seedDocument(h, ownerA);
    await emitOutbox(h, ownerA, "document.ready_for_review", { document_id: docA, company_id: h.companyB });
    await Comm.createCommunicationIntents(h.db, ownerA);
    const intentCompany = (await h.db.query<{ company_id: string }>(`select company_id from pierre_rt_communication_intents where id=(select id from pierre_rt_communication_intents limit 1)`)).rows[0];
    expect(intentCompany.company_id).toBe(h.companyA); // session tenant, never the payload's
  });
  it("a missing employer email blocks the email channel (the in-app stays)", async () => {
    await configureSignatory(h, h.companyA, null as unknown as string); // no signatory email
    const doc = await seedDocument(h, ownerA);
    await emitOutbox(h, ownerA, "document.ready_for_review", { document_id: doc });
    await Comm.createCommunicationIntents(h.db, ownerA);
    const channels = (await h.db.query<{ channel: string }>(`select channel from pierre_rt_communication_deliveries where company_id=$1`, [h.companyA])).rows.map((r) => r.channel);
    expect(channels).toEqual(["in_app"]); // no email delivery created without a real address
  });
});
