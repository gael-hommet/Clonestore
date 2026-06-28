// PHASE 8.4-R1.4 — STRICT per-strategy recipient resolution. With two real members of one tenant,
// different strategies resolve to DIFFERENT real recipients (the approver vs the requester) — never a
// blanket "first owner/admin". A task_target strategy requires a REAL persisted task: a payload
// `objective` alone (no task row) resolves to nobody (blocked).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { configureSignatory, seedDocument, emitOutbox } from "./p84-helpers";
import { addMember } from "./p84-r1-helpers";
import { newUuid } from "../sql";
import * as Comm from "../communications";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); await configureSignatory(h, h.companyA); });
afterEach(async () => { await h.close(); });
const deps = { secureLinkSecret: "s", publicBase: "https://app.test" };

describe("R1.4 strict per-strategy recipient resolution", () => {
  it("document_approver and document_requester resolve to DIFFERENT real members", async () => {
    const second = await addMember(h, h.companyA, "admin"); // a distinct real requester
    const doc = await seedDocument(h, owner, "Doc", { created_by: second.user_id }); // owner_membership = owner (userA)
    await emitOutbox(h, owner, "document.ready_for_review", { document_id: doc, version: 1 }); // approver strategy
    await emitOutbox(h, owner, "document.approved", { document_id: doc, version: 1 });          // requester strategy
    await Comm.createCommunicationIntents(h.db, owner, {}, deps);

    const rows = (await h.db.query<{ event_kind: string; resolved_user_id: string }>(
      `select i.event_kind, r.resolved_user_id from pierre_rt_communication_intents i
         join pierre_rt_communication_recipients r on r.company_id=i.company_id and r.intent_id=i.id where i.company_id=$1`, [h.companyA])).rows;
    const approver = rows.find((x) => x.event_kind === "document.ready_for_review")!.resolved_user_id;
    const requester = rows.find((x) => x.event_kind === "document.approved")!.resolved_user_id;
    expect(approver).toBe(h.userA);
    expect(requester).toBe(second.user_id);
    expect(approver).not.toBe(requester);
  });

  it("task_target requires a REAL task — a payload objective alone is blocked (no recipient)", async () => {
    await emitOutbox(h, owner, "low_risk_notification", { task_id: newUuid(), objective: "Envoyer un message" }, "tt1");
    const r = await Comm.createCommunicationIntents(h.db, owner, {}, deps);
    expect(r.blocked).toBe(1);
    const n = (await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_recipients where company_id=$1`, [h.companyA])).rows[0].n;
    expect(n).toBe(0);
  });
});
