// src/lib/pierre/v1/__integration__/p86-invitation-real-p84-delivery.itest.ts
// PHASE 8.6 — the invitation token is delivered ONLY through the real P8.4 pipeline: creating the
// invitation emits a `member.invited` outbox event (token in the GOVERNED payload), the worker turns it
// into a real intent + recipient (resolved from the persisted invitation) + email delivery, and the
// provider (the boundary) receives the token in the frozen content. The client route returns NO raw token
// and never touches the mailbox / enqueues directly.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createHarness, provisionActiveCompany, type Harness } from "./harness";
import { createInvitation } from "../members";
import { createCommunicationIntents, dispatchCommunicationDeliveries } from "../communications";
import { FakeEmailProvider } from "../communication-provider";

let h: Harness;
beforeEach(async () => { h = await createHarness(); await provisionActiveCompany(h, h.companyA); });
afterEach(async () => { await h.close(); });

describe("P8.6 invitation → REAL P8.4 delivery", () => {
  it("create emits an outbox event; the worker makes a real intent+recipient; the provider gets the token", async () => {
    const ctx = h.ctx("A", "owner");
    const inv = await createInvitation(h.db, ctx, { email: "newhire@e2e.test", roles: ["HR_MANAGER"] });
    expect(inv.raw_token).toBeTruthy();

    // 1) a REAL outbox business event was created (not a direct mailbox write)
    const ob = (await h.db.query<{ kind: string; status: string }>(`select kind, status from pierre_rt_outbox where company_id=$1 and kind='member.invited'`, [h.companyA])).rows;
    expect(ob.length).toBe(1);

    // 2) the REAL worker turns it into an intent + a recipient resolved from the persisted invitation
    const created = await createCommunicationIntents(h.db, ctx, {});
    expect(created.created).toBeGreaterThanOrEqual(1);
    const intents = (await h.db.query<{ event_kind: string; status: string }>(`select event_kind, status from pierre_rt_communication_intents where company_id=$1 and event_kind='member.invited'`, [h.companyA])).rows;
    expect(intents.length).toBe(1);
    const recips = (await h.db.query<{ resolved_email: string | null; recipient_type: string }>(`select resolved_email, recipient_type from pierre_rt_communication_recipients where company_id=$1`, [h.companyA])).rows;
    expect(recips.some((r) => r.resolved_email === "newhire@e2e.test" && r.recipient_type === "external_recipient")).toBe(true);

    // 3) dispatch via the provider boundary — the token reaches the provider in the frozen content
    const provider = new FakeEmailProvider({ providerKey: "fake_email" });
    const disp = await dispatchCommunicationDeliveries(h.db, ctx, {}, { provider, from: "CloneStore <no-reply@clonestore.pro>", secureLinkSecret: "s", publicBase: null });
    expect(disp.submitted).toBeGreaterThanOrEqual(1);
    expect(provider.sent.length).toBe(1);
    const sent = provider.sent[0].input;
    expect(sent.to).toBe("newhire@e2e.test");
    const content = `${sent.subject}\n${sent.plainText}\n${sent.html}`;
    expect(content).toContain(inv.raw_token); // the token travels ONLY via the provider payload
  });
});

describe("P8.6 invitation client route — no raw token, no direct enqueue", () => {
  const routeSrc = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/invitations/route.ts"), "utf-8");
  const membersSrc = readFileSync(resolve(process.cwd(), "src/lib/pierre/v1/members.ts"), "utf-8");
  it("the route never returns raw_token and never touches the mailbox/enqueue", () => {
    expect(routeSrc).not.toMatch(/raw_token/);
    expect(routeSrc).not.toMatch(/enqueueE2EDelivery/);
    expect(routeSrc).not.toMatch(/recordE2EMail|e2e-fake-mailbox/);
    expect(routeSrc).toContain("invitation_id: created.id");
  });
  it("invitation creation emits the member.invited outbox event (the real P8.4 entry point)", () => {
    expect(membersSrc).toMatch(/'member\.invited'/);
    expect(membersSrc).toMatch(/insert into pierre_rt_outbox/);
  });
});
