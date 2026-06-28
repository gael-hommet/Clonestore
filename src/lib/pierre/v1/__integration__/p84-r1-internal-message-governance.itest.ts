// PHASE 8.4-R1.12 — pierre_rt_create_internal_message is worker-owned: it requires a delivery that is
// in_app + processing + leased by THIS worker, and a recipient that matches the delivery's recipient.
// A wrong worker, an unmatched recipient, or a non-leased delivery is refused.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { asRole, refused } from "./p84-r1-helpers";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const claim = `select * from pierre_rt_claim_communication_deliveries($1,$2,$3,$4,now())`;
const create = `select pierre_rt_create_internal_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`;

async function claimedInApp(worker: string): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.signature_ready", { document_id: doc }); // in_app only
  await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
  const id = (await h.db.query<{ id: string }>(`select id from pierre_rt_communication_deliveries where company_id=$1 and channel='in_app'`, [h.companyA])).rows[0].id;
  await asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(claim, [h.companyA, 10, worker, 60]));
  return id;
}
const args = (recipient: string, deliveryId: string, worker: string) => [h.companyA, recipient, deliveryId, worker, "document.signature_ready", "T", "B", "/x", "document", null, "normal", `d:${deliveryId}:${worker}`];

describe("R1.12 worker-owned internal message creation", () => {
  it("a wrong worker (not the lease owner) is refused", async () => {
    const id = await claimedInApp("wA");
    expect(await refused(() => asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(create, args(h.userA, id, "wB"))))).toBe(true);
  });

  it("a recipient that does not match the delivery recipient is refused", async () => {
    const id = await claimedInApp("wA");
    expect(await refused(() => asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(create, args(h.userB, id, "wA"))))).toBe(true);
  });

  it("the lease owner with the matching recipient succeeds", async () => {
    const id = await claimedInApp("wA");
    const out = await asRole(h, "pierre_rt_communication_worker", h.companyA, (q) => q(create, args(h.userA, id, "wA")));
    expect(out.rows.length).toBe(1);
  });
});
