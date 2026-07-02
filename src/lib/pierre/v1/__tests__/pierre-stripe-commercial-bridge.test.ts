// PHASE 8.7.4 — unit tests for the additive Pierre commercial bridge. Every branch is exercised with an
// injected billing-tx (no real DB, no Stripe). Asserts: INERT for real/untagged traffic; acts only on
// explicit pierre_synthetic controlled events; correct event-key mapping; idempotent duplicate; missing/bad
// company refused; errors swallowed; the tagged company is the one whose entitlement is transitioned.
import { describe, it, expect } from "vitest";
import { bridgePierreCommercial, recognizePierreControlledEvent } from "../pierre-stripe-commercial-bridge";

const COMPANY = "11111111-2222-3333-4444-555555555555";
const pierreMeta = (extra: Record<string, string> = {}) => ({ pierre_synthetic: "true", pierre_product_key: "pierre", pierre_company_id: COMPANY, pierre_run_id: "rtest0001", ...extra });

function evt(type: string, object: Record<string, unknown>, id = "evt_test_1"): any {
  return { id, type, created: 1_700_000_000, livemode: false, data: { object } };
}

// a fake billing-tx that records the governed calls and returns configurable results.
function fakeBilling(opts: { ingest?: string; entitlement?: string; throwOn?: string } = {}) {
  const calls: Array<{ fn: string; params: readonly unknown[] }> = [];
  const runBillingTx = async (_binding: { company_id?: string | null }, fn: (tx: any) => Promise<any>) => {
    const tx = {
      query: async (text: string, params: readonly unknown[] = []) => {
        if (opts.throwOn && text.includes(opts.throwOn)) throw new Error("boom");
        if (text.includes("pierre_rt_ingest_commercial_event")) { calls.push({ fn: "ingest", params }); return { rows: [{ result: opts.ingest ?? "received" }] }; }
        if (text.includes("select id from pierre_rt_commercial_events")) { calls.push({ fn: "loadEvent", params }); return { rows: [{ id: "ce-test-id" }] }; }
        if (text.includes("pierre_rt_apply_entitlement_event")) { calls.push({ fn: "entitlement", params }); return { rows: [{ result: opts.entitlement ?? "active" }] }; }
        if (text.includes("pierre_rt_resolve_commercial_event")) { calls.push({ fn: "resolve", params }); return { rows: [] }; }
        return { rows: [] };
      },
    };
    return fn(tx);
  };
  return { runBillingTx, calls };
}

describe("P8.7.4 Pierre Stripe commercial bridge (DI)", () => {
  it("is INERT for a real (untagged) subscription event — no DB call", async () => {
    const b = fakeBilling();
    const r = await bridgePierreCommercial(evt("customer.subscription.created", { id: "sub_real", customer: "cus_real", metadata: { user_id: "u", agent_slug: "pierre" } }), { runBillingTx: b.runBillingTx });
    expect(r.acted).toBe(false);
    expect(r.reason).toBe("not_pierre_controlled");
    expect(b.calls).toHaveLength(0);
  });

  it("is INERT when pierre_synthetic is missing/false (safety for real traffic)", async () => {
    const b = fakeBilling();
    const r = await bridgePierreCommercial(evt("customer.subscription.created", { id: "sub_x", customer: "cus_x", metadata: { pierre_product_key: "pierre", pierre_company_id: COMPANY } }), { runBillingTx: b.runBillingTx });
    expect(r.acted).toBe(false);
    expect(b.calls).toHaveLength(0);
  });

  it("refuses a missing / invalid company id", async () => {
    const b = fakeBilling();
    const miss = await bridgePierreCommercial(evt("customer.subscription.created", { id: "s", customer: "c", metadata: pierreMeta({ pierre_company_id: "" }) }), { runBillingTx: b.runBillingTx });
    expect(miss.acted).toBe(false);
    const bad = await bridgePierreCommercial(evt("customer.subscription.created", { id: "s", customer: "c", metadata: { pierre_synthetic: "true", pierre_product_key: "pierre", pierre_company_id: "not-a-uuid" } }), { runBillingTx: b.runBillingTx });
    expect(bad.acted).toBe(false);
    expect(b.calls).toHaveLength(0);
  });

  it("acts on a valid Pierre subscription.created → ingest + entitlement active for the TAGGED company", async () => {
    const b = fakeBilling({ ingest: "received", entitlement: "active" });
    const r = await bridgePierreCommercial(evt("customer.subscription.created", { id: "sub_syn", customer: "cus_syn", metadata: pierreMeta() }), { runBillingTx: b.runBillingTx });
    expect(r.acted).toBe(true);
    expect(r.event_key).toBe("commercial.subscription_active");
    expect(r.ingest).toBe("received");
    expect(r.entitlement).toBe("active");
    expect(b.calls.map((c) => c.fn)).toEqual(["ingest", "loadEvent", "entitlement", "resolve"]);
    // the entitlement call targets EXACTLY the tagged company (isolation) + the sub id as source_reference
    const ent = b.calls.find((c) => c.fn === "entitlement")!;
    expect(ent.params[0]).toBe(COMPANY);
    expect(ent.params).toContain("sub_syn");
    // the ingest is keyed by the Stripe event id (idempotency anchor)
    const ing = b.calls.find((c) => c.fn === "ingest")!;
    expect(ing.params[1]).toBe("evt_test_1");
  });

  it("maps subscription.deleted → cancelled, invoice.payment_failed → payment_failed", async () => {
    const del = await bridgePierreCommercial(evt("customer.subscription.deleted", { id: "sub_syn", customer: "cus_syn", metadata: pierreMeta() }), { runBillingTx: fakeBilling().runBillingTx });
    expect(del.event_key).toBe("commercial.subscription_cancelled");
    const fail = await bridgePierreCommercial(evt("invoice.payment_failed", { id: "in_1", subscription: "sub_syn", customer: "cus_syn", metadata: pierreMeta() }), { runBillingTx: fakeBilling().runBillingTx });
    expect(fail.event_key).toBe("commercial.payment_failed");
  });

  it("is idempotent — a duplicate provider event ingests as 'duplicate'", async () => {
    const b = fakeBilling({ ingest: "duplicate", entitlement: "active" });
    const r = await bridgePierreCommercial(evt("customer.subscription.created", { id: "sub_syn", customer: "cus_syn", metadata: pierreMeta() }, "evt_dup"), { runBillingTx: b.runBillingTx });
    expect(r.acted).toBe(true);
    expect(r.ingest).toBe("duplicate");
  });

  it("swallows any billing error (never breaks the webhook)", async () => {
    const b = fakeBilling({ throwOn: "pierre_rt_ingest_commercial_event" });
    const r = await bridgePierreCommercial(evt("customer.subscription.created", { id: "sub_syn", customer: "cus_syn", metadata: pierreMeta() }), { runBillingTx: b.runBillingTx });
    expect(r.acted).toBe(false);
    expect(r.reason).toBe("error");
  });

  it("recognizePierreControlledEvent returns null for unsupported event types", () => {
    expect(recognizePierreControlledEvent(evt("customer.updated", { id: "c", metadata: pierreMeta() }))).toBeNull();
    expect(recognizePierreControlledEvent(evt("customer.subscription.created", { id: "s", customer: "c", metadata: pierreMeta() }))).toEqual({ company_id: COMPANY, run_id: "rtest0001" });
  });
});
