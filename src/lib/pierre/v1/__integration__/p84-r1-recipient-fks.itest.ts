// PHASE 8.4-R1.5 — tenant-safe recipient FKs + identity consistency. A resolved membership/employee
// must reference a REAL row of the SAME tenant; an employer_operator row requires a membership + user,
// an employee row requires an employee. Inconsistent rows are refused by the DB.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { refused } from "./p84-r1-helpers";
import { newUuid } from "../sql";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

async function anIntent(): Promise<string> {
  const doc = await seedDocument(h, owner);
  await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
  await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
  return (await h.db.query<{ id: string }>(`select id from pierre_rt_communication_intents where company_id=$1`, [h.companyA])).rows[0].id;
}

describe("R1.5 recipient FKs + identity consistency", () => {
  it("a resolved_membership_id that is not a real member of the tenant is refused (composite FK)", async () => {
    const intentId = await anIntent();
    const bad = newUuid();
    expect(await refused(() => h.db.query(
      `insert into pierre_rt_communication_recipients (id, company_id, intent_id, recipient_type, recipient_role, resolved_user_id, resolved_membership_id, resolution_status)
       values ($1,$2,$3,'employer_operator','x',$4,$5,'resolved')`, [newUuid(), h.companyA, intentId, h.userA, bad]))).toBe(true);
  });

  it("an employer_operator recipient without a membership+user is refused (identity check)", async () => {
    const intentId = await anIntent();
    expect(await refused(() => h.db.query(
      `insert into pierre_rt_communication_recipients (id, company_id, intent_id, recipient_type, recipient_role, resolution_status)
       values ($1,$2,$3,'employer_operator','x','resolved')`, [newUuid(), h.companyA, intentId]))).toBe(true);
  });

  it("an employee recipient without an employee id is refused (identity check)", async () => {
    const intentId = await anIntent();
    expect(await refused(() => h.db.query(
      `insert into pierre_rt_communication_recipients (id, company_id, intent_id, recipient_type, recipient_role, resolved_user_id, resolution_status)
       values ($1,$2,$3,'employee','x',$4,'resolved')`, [newUuid(), h.companyA, intentId, h.userA]))).toBe(true);
  });
});
