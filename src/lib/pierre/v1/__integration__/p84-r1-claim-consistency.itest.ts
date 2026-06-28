// PHASE 8.4-R1.10 — claim consistency. The frozen action path of a document delivery is a secure link
// whose claims are object-consistent: object_type=document and object_id=the document id (never
// object_type=contract pointing at a document id).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { verifySecureLink } from "../communication-secure-links";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });

describe("R1.10 secure-link claim consistency", () => {
  it("a document delivery's frozen link claims object_type=document + object_id=document_id", async () => {
    const doc = await seedDocument(h, owner);
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc });
    await Comm.createCommunicationIntents(h.db, owner, {}, { secureLinkSecret: "s", publicBase: "https://app.test" });
    const vars = (await h.db.query<{ canonical_variables: { action_path: string } }>(`select canonical_variables from pierre_rt_communication_deliveries where company_id=$1 and channel='in_app'`, [h.companyA])).rows[0].canonical_variables;
    const path = vars.action_path;
    expect(path).toContain("/secure/");
    const token = path.split("/secure/")[1];
    const claims = verifySecureLink(token, "s");
    expect(claims.c).toBe(h.companyA);
    expect(claims.ot).toBe("document");
    expect(claims.oid).toBe(doc);
  });
});
