// src/lib/pierre/v1/__integration__/p86-commercial-event-idempotency-conflict.itest.ts
// PHASE 8.6 — COMMERCIAL EVENT idempotency + conflict, proven on real Postgres (PGlite).
//
// Focus (spec §15): the commercial event ledger is the fournisseur-neutral front door, and it must be
// boringly, provably safe under replay and tampering:
//   (1) same (provider, provider_event_id) + IDENTICAL payload_hash  → 'duplicate' (one ledger row, no
//       state churn). Replay-safety: a Stripe webhook retried N times applies once.
//   (2) same (provider, provider_event_id) + DIFFERENT payload_hash  → 'conflict', AND the stored row's
//       application_status flips to 'conflict' so a human is forced into the loop (the divergent second
//       delivery is NEVER silently trusted).
//   (3) a cancel/refund event for a company with NO live entitlement → applyEntitlementEvent returns
//       'ignored' and fabricates NOTHING. A cancellation can only ever DESTROY access, never mint it.
// Mutation runs strictly under the billing-webhook role (governed SECURITY DEFINER funcs); the app role
// is refused — proven here too, because "the app can't write commercial truth" is the whole point.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import {
  ingestCommercialEvent, applyEntitlementEvent, hashCommercialPayload, normalizeCommercialEventKey,
  type CommercialIngressResult,
} from "../commercial-events";
import { getEntitlement } from "../entitlements";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules inside a role-bound tx.
function execFrom(
  q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) =>
      q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const BILLING = "pierre_rt_billing_webhook";
const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

// Read the persisted ledger row by its natural key (superuser → bypasses RLS, sees unresolved rows too).
async function ledgerRow(provider: string, eventId: string) {
  const { rows } = await h.pg.query<{
    id: string; provider: string; provider_event_id: string; payload_hash: string;
    application_status: string; company_id: string | null; event_key: string;
  }>(
    `select id, provider, provider_event_id, payload_hash, application_status, company_id, event_key
       from pierre_rt_commercial_events where provider=$1 and provider_event_id=$2`,
    [provider, eventId],
  );
  return rows;
}

describe("P8.6 commercial event — idempotency", () => {
  it("a verified event ingests once; identical replays are 'duplicate' and add NO new ledger rows", async () => {
    const evtId = "evt_idem_" + newUuid();
    const hash = hashCommercialPayload({ subscription: "sub_idem", amount: 4900, currency: "eur" });
    const ingest = (): Promise<CommercialIngressResult> =>
      asRole(h, BILLING, h.companyA, (q) =>
        ingestCommercialEvent(execFrom(q), {
          provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed",
          payload_hash: hash, subscription_reference: "sub_idem",
        }));

    // first delivery → received
    expect(await ingest()).toBe("received");
    // exactly one ledger row exists, still pending (un-resolved by ingress alone)
    let rows = await ledgerRow("stripe", evtId);
    expect(rows).toHaveLength(1);
    expect(rows[0].application_status).toBe("pending");
    const ledgerId = rows[0].id;

    // three identical replays (webhook retries) → all 'duplicate'
    expect(await ingest()).toBe("duplicate");
    expect(await ingest()).toBe("duplicate");
    expect(await ingest()).toBe("duplicate");

    // still exactly ONE row, same id, untouched status: replay caused no insert and no state churn
    rows = await ledgerRow("stripe", evtId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(ledgerId);
    expect(rows[0].application_status).toBe("pending");
  });

  it("idempotency is keyed on (provider, provider_event_id) — a different provider with the same id is NOT a duplicate", async () => {
    const sharedId = "evt_shared_" + newUuid();
    const hash = hashCommercialPayload({ x: 1 });
    const stripe = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: sharedId, event_key: "commercial.payment_confirmed", payload_hash: hash,
      }));
    const other = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "manual_invoice", provider_event_id: sharedId, event_key: "commercial.payment_confirmed", payload_hash: hash,
      }));
    expect(stripe).toBe("received");
    expect(other).toBe("received"); // same id, distinct provider → distinct ledger entry

    const stripeRows = await ledgerRow("stripe", sharedId);
    const otherRows = await ledgerRow("manual_invoice", sharedId);
    expect(stripeRows).toHaveLength(1);
    expect(otherRows).toHaveLength(1);
    expect(stripeRows[0].id).not.toBe(otherRows[0].id);
  });
});

describe("P8.6 commercial event — conflict", () => {
  it("same (provider, provider_event_id) with a DIFFERENT payload_hash → 'conflict', and the stored row flips to application_status='conflict'", async () => {
    const evtId = "evt_conflict_" + newUuid();
    const hashOriginal = hashCommercialPayload({ amount: 4900, currency: "eur" });
    const hashTampered = hashCommercialPayload({ amount: 9900, currency: "eur" }); // same id, different content

    const first = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashOriginal,
      }));
    expect(first).toBe("received");

    // sanity: the two hashes really do differ (otherwise this test proves nothing)
    expect(hashTampered).not.toBe(hashOriginal);

    const before = await ledgerRow("stripe", evtId);
    expect(before).toHaveLength(1);
    expect(before[0].payload_hash).toBe(hashOriginal);
    expect(before[0].application_status).toBe("pending");
    const ledgerId = before[0].id;

    // divergent re-delivery → conflict
    const conflict = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashTampered,
      }));
    expect(conflict).toBe("conflict");

    // the SAME stored row is now flagged 'conflict'; no second row was inserted; the ORIGINAL hash is kept
    // (the divergent payload is rejected, not adopted).
    const after = await ledgerRow("stripe", evtId);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(ledgerId);
    expect(after[0].application_status).toBe("conflict");
    expect(after[0].payload_hash).toBe(hashOriginal);
  });

  it("a conflicting re-delivery is itself idempotent — repeating the divergent hash keeps the row in 'conflict' and adds no rows", async () => {
    const evtId = "evt_conflict_repeat_" + newUuid();
    const hashOriginal = hashCommercialPayload({ v: "a" });
    const hashTampered = hashCommercialPayload({ v: "b" });

    expect(await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashOriginal,
      }))).toBe("received");

    const r1 = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashTampered,
      }));
    expect(r1).toBe("conflict");
    // second divergent delivery: still 'conflict' (the stored hash never matches the tampered one); the row
    // is already at status 'conflict' so the governed UPDATE's `application_status='pending'` guard no-ops.
    const r2 = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashTampered,
      }));
    expect(r2).toBe("conflict");

    const rows = await ledgerRow("stripe", evtId);
    expect(rows).toHaveLength(1);
    expect(rows[0].application_status).toBe("conflict");
    expect(rows[0].payload_hash).toBe(hashOriginal); // original is preserved across both conflict deliveries
  });
});

describe("P8.6 cancellation never fabricates an entitlement", () => {
  it("a cancellation for a company with NO live entitlement → 'ignored', and NO entitlement row is created", async () => {
    // a brand-new company that has never been entitled
    const company = newUuid();
    await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,'Never-Entitled Co','active')`, [company]);

    // precondition: no entitlement exists at all
    expect(await getEntitlement(h.db, company)).toBeNull();
    const countBefore = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [company]);
    expect(countBefore.rows[0].n).toBe(0);

    // a cancellation arrives for a phantom subscription
    const cancelled = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: company, event_key: "commercial.subscription_cancelled",
        source_type: "stripe_subscription", source_reference: "sub_phantom",
      }));
    expect(cancelled).toBe("ignored");

    // a refund for the same phantom → also 'ignored'
    const refunded = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: company, event_key: "commercial.refund_confirmed", source_reference: "sub_phantom",
      }));
    expect(refunded).toBe("ignored");

    // INVARIANT: still zero entitlement rows — a cancel/refund can only destroy access, never mint it
    const countAfter = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [company]);
    expect(countAfter.rows[0].n).toBe(0);
    expect(await getEntitlement(h.db, company)).toBeNull();
  });

  it("contrast: a payment_confirmed DOES create an active entitlement, and a subsequent cancellation then resolves to 'cancelled' (not 'ignored')", async () => {
    const company = newUuid();
    await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,'Lifecycle Co','active')`, [company]);

    // confirm → active entitlement is minted
    const active = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: company, event_key: "commercial.payment_confirmed",
        source_type: "stripe_subscription", source_reference: "sub_real",
      }));
    expect(active).toBe("active");
    const ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("active");

    // NOW a cancellation has a live entitlement to act on → 'cancelled' (proving 'ignored' above was about
    // the ABSENCE of an entitlement, not about cancellations being inert in general).
    const cancelled = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: company, event_key: "commercial.subscription_cancelled", source_reference: "sub_real",
      }));
    expect(cancelled).toBe("cancelled");

    // still exactly one entitlement row — the cancellation transitioned the existing one, did not add a row.
    const count = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [company]);
    expect(count.rows[0].n).toBe(1);
    const after = await getEntitlement(h.db, company);
    expect(after?.status).toBe("cancelled");
  });
});

describe("P8.6 only the billing-webhook role may write commercial truth", () => {
  it("the application role is REFUSED both ingestion and entitlement transitions", async () => {
    const deniedIngest = await refused(() => asRole(h, APP, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: "evt_app_" + newUuid(),
        event_key: "commercial.payment_confirmed", payload_hash: hashCommercialPayload({ a: 1 }),
      })));
    expect(deniedIngest).toBe(true);

    const deniedApply = await refused(() => asRole(h, APP, h.companyA, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: h.companyA, event_key: "commercial.subscription_cancelled",
      })));
    expect(deniedApply).toBe(true);
  });

  it("normalization maps provider-native cancellation/refund types to canonical commercial keys", () => {
    // (anchors the conflict/cancellation tests above to the SAME keys the live mapping produces)
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.deleted")).toBe("commercial.subscription_cancelled");
    expect(normalizeCommercialEventKey("stripe", "charge.refunded")).toBe("commercial.refund_confirmed");
    expect(normalizeCommercialEventKey("stripe", "checkout.session.completed")).toBe("commercial.payment_confirmed");
    expect(normalizeCommercialEventKey("stripe", "not.a.commercial.event")).toBeNull();
  });
});
