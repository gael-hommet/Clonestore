// src/lib/pierre/v1/__integration__/p86-no-client-authority-failclosed.itest.ts
// PHASE 8.6 — NO CLIENT COMMERCIAL AUTHORITY + executor fail-closed.
//
// Two independent guarantees, proven against the REAL migration on PGlite:
//
//   1) The application role (pierre_rt_app) has ZERO commercial/entitlement/activation truth authority.
//      Every truth function (apply_entitlement_event, ingest_commercial_event, resolve_commercial_event,
//      mark_activation_provisioning, provision_customer_company, claim_customer_activation,
//      block_customer_activation) is REVOKED from the app role, and the app role has no INSERT grant on
//      pierre_rt_product_entitlements. So an app-bound transaction can NEVER mint or mutate an entitlement,
//      ingest/resolve a commercial event, or claim/provision/block an activation — refused() proves each.
//
//   2) The dedicated billing-webhook / activation-worker DB executors are FAIL-CLOSED: with their dedicated
//      DSNs absent from the environment, isConfigured() is false and createExecutor() THROWS the typed
//      *DbError — there is NEVER a silent fallback to a broader (service/app) role.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import {
  applyEntitlementEvent, ingestCommercialEvent, resolveCommercialEvent, markActivationProvisioning,
  hashCommercialPayload,
} from "../commercial-events";
import {
  claimCustomerActivation, blockCustomerActivation, provisionCustomerCompany,
} from "../customer-activation";
import {
  isBillingWebhookDbConfigured, createBillingWebhookExecutor, BillingWebhookDbError,
} from "../billing-webhook-db";
import {
  isCustomerActivationDbConfigured, createCustomerActivationExecutor, CustomerActivationDbError,
} from "../customer-activation-db";

// Adapt the asRole `q` into a SqlExecutor so we can drive the real service modules inside a role-bound tx.
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("P8.6 the app role has NO commercial/entitlement/activation truth authority", () => {
  it("CANNOT apply an entitlement event (no execute grant on apply_entitlement_event)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: h.companyA, event_key: "commercial.payment_confirmed" })));
    expect(denied).toBe(true);
    // And no entitlement was minted as a side effect (the call was refused before any write).
    const ent = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [h.companyA]);
    expect(ent.rows[0].n).toBe(0);
  });

  it("CANNOT ingest a commercial event (no execute grant on ingest_commercial_event)", async () => {
    const evtId = "evt_" + newUuid();
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), {
        provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed",
        payload_hash: hashCommercialPayload({ a: 1 }), subscription_reference: "sub_app_attempt",
      })));
    expect(denied).toBe(true);
    // No ledger row leaked in (superuser read confirms the ingest never happened).
    const led = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_commercial_events where provider_event_id=$1`, [evtId]);
    expect(led.rows[0].n).toBe(0);
  });

  it("CANNOT resolve a commercial event (no execute grant on resolve_commercial_event)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      resolveCommercialEvent(execFrom(q), { event_id: newUuid(), company_id: h.companyA, status: "applied" })));
    expect(denied).toBe(true);
  });

  it("CANNOT mark an activation as provisioning (no execute grant on mark_activation_provisioning)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      markActivationProvisioning(execFrom(q), newUuid(), "stripe_subscription", "sub_app_attempt")));
    expect(denied).toBe(true);
  });

  it("CANNOT claim a customer activation (no execute grant on claim_customer_activation)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      claimCustomerActivation(execFrom(q), "rogue-app-worker")));
    expect(denied).toBe(true);
  });

  it("CANNOT block a customer activation (no execute grant on block_customer_activation)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      blockCustomerActivation(execFrom(q), { id: newUuid(), locked_by: "rogue", fencing_token: 0 }, "rogue_block_attempt")));
    expect(denied).toBe(true);
  });

  it("CANNOT provision a customer company — proven via the RAW SQL function (worker-only)", async () => {
    // Drive the governed function directly so the refusal is the DB permission check, not a wrapper guard.
    const steps = "[]";
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      q(`select pierre_rt_provision_customer_company($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) as company_id`, [
        newUuid(), "rogue-worker", 1, "Rogue Co", newUuid(), "pierre", "stripe_subscription", "sub_rogue", steps, null,
      ])));
    expect(denied).toBe(true);
    // The service wrapper takes the same forbidden path — also refused.
    const deniedWrapper = await refused(() => asRole(h, APP, h.companyA, (q) =>
      provisionCustomerCompany(execFrom(q), {
        activation: {
          id: newUuid(), provisioning_key: "prov:x", company_id: null, product_key: "pierre",
          commercial_reference: "sub_rogue", status: "provisioning", requested_by: null,
          owner_user_id: newUuid(), company_name: "Rogue Co", source_type: null, source_reference: null,
          locked_by: "rogue-worker", fencing_token: 1, claimed_at: null, lease_expires_at: null,
          blocked_reason: null,
        },
      })));
    expect(deniedWrapper).toBe(true);
    // No rogue company was created.
    const co = await h.pg.query<{ n: number }>(`select count(*)::int as n from pierre_rt_companies where name='Rogue Co'`);
    expect(co.rows[0].n).toBe(0);
  });

  it("CANNOT directly INSERT into pierre_rt_product_entitlements (app has SELECT only, no INSERT grant)", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      q(`insert into pierre_rt_product_entitlements (id, company_id, product_key, status)
         values ($1,$2,'pierre','active')`, [newUuid(), h.companyA])));
    expect(denied).toBe(true);
    // The forged entitlement does not exist.
    const ent = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [h.companyA]);
    expect(ent.rows[0].n).toBe(0);
  });
});

describe("P8.6 dedicated commercial executors are FAIL-CLOSED (no DB, no service-role fallback)", () => {
  // Snapshot + scrub the dedicated DSNs so we exercise the unconfigured path; restore afterward.
  let savedBilling: string | undefined;
  let savedActivation: string | undefined;
  beforeAll(() => {
    savedBilling = process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL;
    savedActivation = process.env.PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL;
    delete process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL;
    delete process.env.PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL;
  });
  afterAll(() => {
    if (savedBilling === undefined) delete process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL;
    else process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL = savedBilling;
    if (savedActivation === undefined) delete process.env.PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL;
    else process.env.PIERRE_CUSTOMER_ACTIVATION_DATABASE_URL = savedActivation;
  });

  it("billing-webhook: isConfigured() is false and createExecutor() rejects with BillingWebhookDbError", async () => {
    expect(isBillingWebhookDbConfigured()).toBe(false);
    await expect(createBillingWebhookExecutor()).rejects.toThrowError(BillingWebhookDbError);
    // The error is the typed, fail-closed contract — code + 503 status, never a silent fallback.
    const err = await createBillingWebhookExecutor().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BillingWebhookDbError);
    expect((err as BillingWebhookDbError).code).toBe("billing_webhook_db_unconfigured");
    expect((err as BillingWebhookDbError).status).toBe(503);
  });

  it("customer-activation: isConfigured() is false and createExecutor() rejects with CustomerActivationDbError", async () => {
    expect(isCustomerActivationDbConfigured()).toBe(false);
    await expect(createCustomerActivationExecutor()).rejects.toThrowError(CustomerActivationDbError);
    const err = await createCustomerActivationExecutor().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CustomerActivationDbError);
    expect((err as CustomerActivationDbError).code).toBe("customer_activation_db_unconfigured");
    expect((err as CustomerActivationDbError).status).toBe(503);
  });

  it("a blank/whitespace DSN is still treated as configured ONLY when truthy — empty string stays fail-closed", () => {
    // Defensive: an explicitly-empty env var must NOT be read as configured (it is falsy).
    process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL = "";
    expect(isBillingWebhookDbConfigured()).toBe(false);
    delete process.env.PIERRE_BILLING_WEBHOOK_DATABASE_URL;
    expect(isBillingWebhookDbConfigured()).toBe(false);
  });
});
