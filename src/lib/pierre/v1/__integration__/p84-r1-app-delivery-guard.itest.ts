// PHASE 8.4-R1.8 — the app role may CREATE a queued delivery (carrying its frozen content) but can
// NEVER fabricate delivery truth: a BEFORE INSERT guard refuses any non-queued/scheduled status under
// the application role, and the app holds no UPDATE on deliveries.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { asRole, refused } from "./p84-r1-helpers";
import { newUuid } from "../sql";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

async function intentRecipient(): Promise<{ intentId: string; recipientId: string }> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
  await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
  const r = (await h.db.query<{ intent_id: string; recipient_id: string }>(`select intent_id, recipient_id from pierre_rt_communication_deliveries where company_id=$1 limit 1`, [h.companyA])).rows[0];
  return { intentId: r.intent_id, recipientId: r.recipient_id };
}
const ins = (status: string) => `insert into pierre_rt_communication_deliveries (id, company_id, intent_id, recipient_id, channel, status, idempotency_key) values ($1,$2,$3,$4,'in_app','${status}',$5)`;

describe("R1.8 app-role delivery insert guard", () => {
  it("the app role can insert a QUEUED delivery", async () => {
    const { intentId, recipientId } = await intentRecipient();
    await expect(asRole(h, "pierre_rt_app", h.companyA, (q) => q(ins("queued"), [newUuid(), h.companyA, intentId, recipientId, newUuid()]))).resolves.toBeDefined();
  });

  it("the app role can NOT insert a DELIVERED delivery (guard refuses fabricated truth)", async () => {
    const { intentId, recipientId } = await intentRecipient();
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(ins("delivered"), [newUuid(), h.companyA, intentId, recipientId, newUuid()])))).toBe(true);
  });

  it("the app role can NOT insert a SUBMITTED delivery either", async () => {
    const { intentId, recipientId } = await intentRecipient();
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(ins("submitted"), [newUuid(), h.companyA, intentId, recipientId, newUuid()])))).toBe(true);
  });
});
