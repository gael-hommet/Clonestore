// src/lib/pierre/v1/__integration__/p86-commercial-ordering.itest.ts
// PHASE 8.6 — commercial events are ORDERED and applied through the SINGLE governed entry point
// pierre_rt_apply_commercial_event(event_id). occurred_at is authoritative: an older event never
// regresses a more recent entitlement state; an unresolved event is quarantined; a future-incoherent
// event is quarantined; the company is resolved from PERSISTED references (never the payload). The
// caller passes only the event id — it cannot fabricate a status.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import { ingestCommercialEvent, applyCommercialEvent, hashCommercialPayload, type CommercialEventKey } from "../commercial-events";
import { getEntitlement } from "../entitlements";

function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  return { query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>), transaction: (fn) => fn({} as SqlExecutor) } as SqlExecutor;
}
const BILLING = "pierre_rt_billing_webhook";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

// seed a company with a live entitlement whose source_reference resolves the commercial events.
async function seedCompanyWithEntitlement(ref: string): Promise<string> {
  const company = newUuid();
  await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,'Ordering Co','active')`, [company]);
  await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`, [newUuid(), company, newUuid()]);
  await h.pg.query(
    `insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type, source_reference, starts_at)
     values ($1,$2,'pierre','active','stripe_subscription',$3,now())`, [newUuid(), company, ref]);
  return company;
}
async function ingest(ref: string, key: CommercialEventKey, occurredAt: string, evtId = "evt_" + newUuid()): Promise<string> {
  await asRole(h, BILLING, h.companyA, (q) =>
    ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: key, payload_hash: hashCommercialPayload({ evtId }), subscription_reference: ref, occurred_at: occurredAt }));
  return (await h.pg.query<{ id: string }>(`select id from pierre_rt_commercial_events where provider_event_id=$1`, [evtId])).rows[0].id;
}
const apply = (eventId: string) => asRole(h, BILLING, h.companyA, (q) => applyCommercialEvent(execFrom(q), eventId));
const eventStatus = async (id: string) => (await h.pg.query<{ application_status: string }>(`select application_status from pierre_rt_commercial_events where id=$1`, [id])).rows[0].application_status;

describe("P8.6 commercial event ordering (occurred_at is authoritative)", () => {
  it("an OLDER event never regresses a more recent entitlement state (ignored_stale)", async () => {
    const ref = "subO_" + newUuid();
    const company = await seedCompanyWithEntitlement(ref);

    // a recent past_due → grace, stamps last_commercial_occurred_at = 2020-06-01
    const ePast = await ingest(ref, "commercial.subscription_past_due", "2020-06-01T00:00:00Z");
    expect(await apply(ePast)).toMatch(/^applied:grace$/);
    expect((await getEntitlement(h.db, company))?.status).toBe("grace");

    // an OLDER active event (2020-01-01) must NOT resurrect to active
    const eOldActive = await ingest(ref, "commercial.subscription_active", "2020-01-01T00:00:00Z");
    expect(await apply(eOldActive)).toBe("ignored_stale");
    expect(await eventStatus(eOldActive)).toBe("ignored");
    expect((await getEntitlement(h.db, company))?.status).toBe("grace"); // unchanged

    // a NEWER active event (2020-12-01) legitimately advances to active
    const eNewActive = await ingest(ref, "commercial.subscription_active", "2020-12-01T00:00:00Z");
    expect(await apply(eNewActive)).toMatch(/^applied:active$/);
    expect((await getEntitlement(h.db, company))?.status).toBe("active");
  });

  it("an UNRESOLVED event (no matching persisted reference) is quarantined, never applied", async () => {
    const eUnresolved = await ingest("subDOESNOTEXIST_" + newUuid(), "commercial.payment_confirmed", "2020-05-01T00:00:00Z");
    expect(await apply(eUnresolved)).toBe("quarantined");
    expect(await eventStatus(eUnresolved)).toBe("quarantined");
  });

  it("a FUTURE-incoherent event is quarantined", async () => {
    const ref = "subF_" + newUuid();
    await seedCompanyWithEntitlement(ref);
    const eFuture = await ingest(ref, "commercial.subscription_active", "2099-01-01T00:00:00Z");
    expect(await apply(eFuture)).toBe("quarantined");
    expect(await eventStatus(eFuture)).toBe("quarantined");
  });

  it("application is idempotent: re-applying an already-applied event does not transition again", async () => {
    const ref = "subI_" + newUuid();
    const company = await seedCompanyWithEntitlement(ref);
    const e = await ingest(ref, "commercial.subscription_past_due", "2020-03-01T00:00:00Z");
    expect(await apply(e)).toMatch(/^applied:grace$/);
    const v1 = (await getEntitlement(h.db, company))!.version;
    // second apply is a no-op on the already-applied event
    const again = await apply(e);
    expect(again).toBe("applied"); // returns the prior application_status
    expect((await getEntitlement(h.db, company))!.version).toBe(v1);
  });

  it("ingress is idempotent on (provider, provider_event_id) and conflict-aware on hash mismatch", async () => {
    const ref = "subC_" + newUuid();
    await seedCompanyWithEntitlement(ref);
    const evtId = "evt_dup_" + newUuid();
    const hash = hashCommercialPayload({ a: 1 });
    const r1 = await asRole(h, BILLING, h.companyA, (q) => ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hash, subscription_reference: ref }));
    expect(r1).toBe("received");
    const r2 = await asRole(h, BILLING, h.companyA, (q) => ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hash, subscription_reference: ref }));
    expect(r2).toBe("duplicate");
    const r3 = await asRole(h, BILLING, h.companyA, (q) => ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashCommercialPayload({ a: 2 }), subscription_reference: ref }));
    expect(r3).toBe("conflict");
  });
});
