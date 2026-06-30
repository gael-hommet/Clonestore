// src/lib/pierre/v1/__integration__/p86-suspension-reactivation.itest.ts
// PHASE 8.6 — suspension → reactivation is a STATE TRANSITION, never a duplication.
//
// A commercial suspension (e.g. Stripe `customer.subscription.paused`) followed by a resume
// (`customer.subscription.resumed`) must move the SAME entitlement row through the state machine:
// active → suspended → active. It must NOT create a second entitlement, must keep exactly one row for
// the company+product, and the optimistic-locking `version` must strictly increase on every transition
// (proving each step is a real UPDATE, not a no-op or an insert). resolveProductAccess must report the
// suspended window as read-only (can_use=false, can_read=true) and the reactivated window as usable.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid, newRequestId, newCorrelationId } from "../sql";
import type { TenantContext } from "../tenant-context";
import { applyEntitlementEvent } from "../commercial-events";
import { resolveProductAccess, getEntitlement } from "../entitlements";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules inside a role-bound tx.
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const BILLING = "pierre_rt_billing_webhook";
const APP = "pierre_rt_app";

let h: Harness;

// A dedicated, isolated tenant for this spec (so foundation-test mutations on companyA/B never bleed in).
let company: string;
let owner: string;

/** A TenantContext for the isolated company (owner role with full permissions). */
function tenantCtx(): TenantContext {
  return {
    company_id: company, user_id: owner, membership_id: newUuid(), role: "owner", role_keys: ["OWNER"],
    permissions: ["company.read", "pierre.use"], site_ids: null,
    request_id: newRequestId(), correlation_id: newCorrelationId(),
  };
}

/** Count entitlement rows for the isolated company (across ALL statuses, all products). */
async function entitlementRowCount(productKey = "pierre"): Promise<number> {
  const r = await h.pg.query(
    `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1 and product_key=$2`,
    [company, productKey],
  );
  return (r.rows[0] as { n: number }).n;
}

beforeAll(async () => {
  h = await createHarness();
  company = newUuid();
  owner = newUuid();
  await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,'Reactivation Co','active')`, [company]);
  await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`, [newUuid(), company, owner]);
  // A completed onboarding session so resolveProductAccess reflects pure entitlement state (allowed vs suspended),
  // not an onboarding gate. Reactivation must restore full use, not merely re-open onboarding.
  await h.pg.query(
    `insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, progress_percent) values ($1,$2,'pierre','completed',100)`,
    [newUuid(), company],
  );
});
afterAll(async () => { await h.close(); });

describe("P8.6 suspension → reactivation does not duplicate the entitlement", () => {
  it("activates a single entitlement and resolveProductAccess allows full use", async () => {
    const status = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), {
        company_id: company, event_key: "commercial.payment_confirmed",
        source_type: "stripe_subscription", source_reference: "sub_react_1",
      }));
    expect(status).toBe("active");

    expect(await entitlementRowCount()).toBe(1);

    const ent = await getEntitlement(h.db, company);
    expect(ent).not.toBeNull();
    expect(ent?.status).toBe("active");
    expect(ent?.source_reference).toBe("sub_react_1");

    const access = await resolveProductAccess(h.db, tenantCtx());
    expect(access.decision).toBe("allowed");
    expect(access.can_use).toBe(true);
    expect(access.can_read).toBe(true);
    expect(access.entitlement_status).toBe("active");
  });

  it("suspending the live entitlement flips access to read-only without inserting a new row", async () => {
    const before = await getEntitlement(h.db, company);
    expect(before).not.toBeNull();
    const idBefore = before!.id;
    const versionBefore = before!.version;

    const status = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_suspended" }));
    expect(status).toBe("suspended");

    // Same physical row — suspension is a transition, not a new entitlement.
    expect(await entitlementRowCount()).toBe(1);
    const after = await getEntitlement(h.db, company);
    expect(after?.id).toBe(idBefore);
    expect(after?.status).toBe("suspended");
    // Optimistic-lock version strictly increased: a real UPDATE occurred.
    expect(after!.version).toBeGreaterThan(versionBefore);
    expect(after?.suspended_at).not.toBeNull();

    // Access gate: suspended → read-only. Costly actions blocked, read/export preserved.
    const access = await resolveProductAccess(h.db, tenantCtx());
    expect(access.decision).toBe("suspended");
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true);
    expect(access.entitlement_status).toBe("suspended");
  });

  it("reactivating restores the SAME entitlement row to active (no duplicate, version increased)", async () => {
    const suspended = await getEntitlement(h.db, company);
    expect(suspended?.status).toBe("suspended");
    const idBefore = suspended!.id;
    const versionBefore = suspended!.version;

    const status = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_reactivated" }));
    expect(status).toBe("active");

    // EXACTLY one entitlement row for the company — reactivation reused the suspended row.
    expect(await entitlementRowCount()).toBe(1);

    const reactivated = await getEntitlement(h.db, company);
    expect(reactivated?.id).toBe(idBefore);           // SAME row id — no duplicate created
    expect(reactivated?.status).toBe("active");        // back to active
    expect(reactivated!.version).toBeGreaterThan(versionBefore); // a real UPDATE, version climbed again
    // suspended_at is retained as a historical marker (the transition does not erase it),
    // but the live status is unambiguously active.
    expect(reactivated?.cancelled_at).toBeNull();

    // Access gate restored to full use.
    const access = await resolveProductAccess(h.db, tenantCtx());
    expect(access.decision).toBe("allowed");
    expect(access.can_use).toBe(true);
    expect(access.can_read).toBe(true);
    expect(access.entitlement_status).toBe("active");
  });

  it("a full active→suspended→active cycle yields exactly one row whose version climbed monotonically", async () => {
    // Re-prove the invariant end-to-end on the accumulated history: still a single row, and its version
    // is strictly greater than the first version we ever observed (>=4 transitions: activate, suspend,
    // reactivate, and any earlier touch). This guards against a regression that would spawn a parallel row.
    const all = await h.pg.query(
      `select id, status, version from pierre_rt_product_entitlements where company_id=$1 and product_key='pierre'`,
      [company],
    );
    expect(all.rows.length).toBe(1);
    const row = all.rows[0] as { id: string; status: string; version: number };
    expect(row.status).toBe("active");
    // version started at 1 on insert and incremented on each subsequent UPDATE (suspend, reactivate).
    expect(row.version).toBeGreaterThanOrEqual(3);

    // And there is genuinely no second LIVE entitlement hiding under a different status.
    const live = await h.pg.query(
      `select count(*)::int as n from pierre_rt_product_entitlements
        where company_id=$1 and product_key='pierre' and status in ('pending','active','grace','suspended')`,
      [company],
    );
    expect((live.rows[0] as { n: number }).n).toBe(1);
  });

  it("the application role cannot drive these transitions — only the billing-webhook role can", async () => {
    const denied = await refused(() => asRole(h, APP, company, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_suspended" })));
    expect(denied).toBe(true);

    // The refusal must not have mutated anything: still one active row.
    expect(await entitlementRowCount()).toBe(1);
    const ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("active");
  });
});
