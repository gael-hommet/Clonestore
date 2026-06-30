// src/lib/pierre/v1/__integration__/p86-provisioning-concurrency.itest.ts
// PHASE 8.6 — provisioning IDEMPOTENCY + provisioning_key concurrency, proven on real Postgres (PGlite).
//
// The provisioning_key is the load-bearing invariant of the activation→company path: two activations of
// the SAME commercial proof must collapse onto ONE activation (and therefore ONE company), while two
// DISTINCT proofs must yield two independent companies. We also prove provisioning is idempotent at the
// worker boundary (re-provisioning an already-bound activation returns the same company, never a second
// one) and that the role split holds (app requests; billing marks; worker claims+provisions — and the
// app role is refused the worker truth functions).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import {
  requestCustomerActivation, computeProvisioningKey, claimCustomerActivation,
  provisionCustomerCompany, type ActivationRow,
} from "../customer-activation";
import { markActivationProvisioning } from "../commercial-events";
import { getEntitlement } from "../entitlements";

// Adapt the asRole `q` into a SqlExecutor so the real service modules run inside a role-bound tx.
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

const BILLING = "pierre_rt_billing_webhook";
const WORKER = "pierre_rt_customer_activation_worker";
const APP = "pierre_rt_app";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

/** Read an activation row directly (superuser harness view) — used to assert post-conditions. */
async function readActivation(id: string): Promise<ActivationRow> {
  const r = await h.pg.query(
    `select id, provisioning_key, company_id, product_key, commercial_reference, status,
            requested_by, owner_user_id, company_name, source_type, source_reference, blocked_reason
       from pierre_rt_customer_activations where id=$1`,
    [id],
  );
  return r.rows[0] as ActivationRow;
}

/** Full happy path: request (app) → mark (billing) → claim+provision (worker). Returns ids. */
async function driveToCompany(
  provKey: string, commercialRef: string, owner: string, companyName: string,
): Promise<{ activationId: string; companyId: string }> {
  const activationId = await asRole(h, APP, h.companyA, (q) =>
    requestCustomerActivation(execFrom(q), {
      provisioning_key: provKey, commercial_reference: commercialRef, owner_user_id: owner,
      company_name: companyName, requested_by: owner,
    }));
  await asRole(h, BILLING, h.companyA, (q) =>
    markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", commercialRef));
  const companyId = await asRole(h, WORKER, h.companyA, async (q) => {
    const tx = execFrom(q);
    const claimed = await claimCustomerActivation(tx, "worker-1");
    expect(claimed?.id).toBe(activationId);
    return provisionCustomerCompany(tx, { activation: claimed! });
  });
  return { activationId, companyId };
}

describe("P8.6 provisioning_key — idempotent REQUEST (app role)", () => {
  it("two requests with the SAME provisioning_key return the SAME activation id (and create one row)", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_req_same" });

    const id1 = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_req_same", owner_user_id: owner, company_name: "Same Co", requested_by: owner }));
    const id2 = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_req_same", owner_user_id: owner, company_name: "Same Co (retry)" }));

    expect(id1).toBeTruthy();
    expect(id2).toBe(id1);

    // exactly one persisted activation for that key
    const n = await h.pg.query(`select count(*)::int as n from pierre_rt_customer_activations where provisioning_key=$1`, [provKey]);
    expect((n.rows[0] as { n: number }).n).toBe(1);

    // the idempotent retry did NOT overwrite the first request's payload (the original row wins)
    const row = await readActivation(id1);
    expect(row.company_name).toBe("Same Co");
    expect(row.status).toBe("awaiting_commercial_proof");
  });

  it("a DIFFERENT provisioning_key yields a DISTINCT activation id", async () => {
    const owner = newUuid();
    const keyA = computeProvisioningKey({ commercial_reference: "sub_req_distinct_a" });
    const keyB = computeProvisioningKey({ commercial_reference: "sub_req_distinct_b" });
    expect(keyA).not.toBe(keyB);

    const idA = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: keyA, commercial_reference: "sub_req_distinct_a", owner_user_id: owner, company_name: "Distinct A" }));
    const idB = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: keyB, commercial_reference: "sub_req_distinct_b", owner_user_id: owner, company_name: "Distinct B" }));

    expect(idA).not.toBe(idB);
  });

  it("computeProvisioningKey is deterministic and prefixed", () => {
    const k1 = computeProvisioningKey({ commercial_reference: "sub_det" });
    const k2 = computeProvisioningKey({ commercial_reference: "sub_det" });
    expect(k1).toBe(k2);
    expect(k1.startsWith("prov:")).toBe(true);
    // distinct inputs → distinct keys
    expect(computeProvisioningKey({ commercial_reference: "x" })).not.toBe(computeProvisioningKey({ commercial_reference: "y" }));
  });
});

describe("P8.6 provisioning_key — claim + provision creates ONE company", () => {
  it("mark → claim → provision binds the company, flips status, and seeds owner/entitlement/onboarding", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_prov_full" });
    const { activationId, companyId } = await driveToCompany(provKey, "sub_prov_full", owner, "Provision Full SAS");

    expect(companyId).toBeTruthy();

    // the activation is now bound to exactly this company and advanced past provisioning
    const act = await readActivation(activationId);
    expect(act.company_id).toBe(companyId);
    expect(act.status).toBe("onboarding_required");

    // owner membership is active + an active entitlement exists
    const member = await h.pg.query(`select role, status from pierre_rt_members where company_id=$1 and user_id=$2`, [companyId, owner]);
    expect(member.rows[0]).toMatchObject({ role: "owner", status: "active" });
    const ent = await getEntitlement(h.db, companyId);
    expect(ent?.status).toBe("active");

    // exactly ONE company carries that name (no duplicate provisioning)
    const companies = await h.pg.query(`select count(*)::int as n from pierre_rt_companies where name='Provision Full SAS'`);
    expect((companies.rows[0] as { n: number }).n).toBe(1);

    // exactly ONE activation-completed access event
    const ev = await h.pg.query(`select count(*)::int as n from pierre_rt_company_access_events where company_id=$1 and event_kind='customer.activation_completed'`, [companyId]);
    expect((ev.rows[0] as { n: number }).n).toBe(1);
  });
});

describe("P8.6 provisioning idempotency — re-provision an already-bound activation", () => {
  it("calling provisionCustomerCompany again for the same activation returns the SAME company id (no second company)", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_prov_idem" });
    const { activationId, companyId } = await driveToCompany(provKey, "sub_prov_idem", owner, "Idem SAS");

    // re-provision via the bound activation row read back from the DB
    const bound = await readActivation(activationId);
    expect(bound.company_id).toBe(companyId);

    const again = await asRole(h, WORKER, h.companyA, (q) =>
      provisionCustomerCompany(execFrom(q), { activation: bound }));
    expect(again).toBe(companyId);

    // and a THIRD time, idempotent again
    const third = await asRole(h, WORKER, h.companyA, (q) =>
      provisionCustomerCompany(execFrom(q), { activation: bound }));
    expect(third).toBe(companyId);

    // the repeated calls created NO additional company, member, entitlement, or access event
    const companies = await h.pg.query(`select count(*)::int as n from pierre_rt_companies where name='Idem SAS'`);
    expect((companies.rows[0] as { n: number }).n).toBe(1);
    const members = await h.pg.query(`select count(*)::int as n from pierre_rt_members where company_id=$1`, [companyId]);
    expect((members.rows[0] as { n: number }).n).toBe(1);
    const ents = await h.pg.query(`select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [companyId]);
    expect((ents.rows[0] as { n: number }).n).toBe(1);
    const events = await h.pg.query(`select count(*)::int as n from pierre_rt_company_access_events where company_id=$1 and event_kind='customer.activation_completed'`, [companyId]);
    expect((events.rows[0] as { n: number }).n).toBe(1);
  });

  it("two activations for the SAME provisioning_key collapse to ONE activation and ONE company", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_collapse" });

    // two independent request calls (e.g. a double-submit / retried webhook) — same key
    const id1 = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_collapse", owner_user_id: owner, company_name: "Collapse SAS" }));
    const id2 = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_collapse", owner_user_id: owner, company_name: "Collapse SAS" }));
    expect(id2).toBe(id1);

    await asRole(h, BILLING, h.companyA, (q) =>
      markActivationProvisioning(execFrom(q), id1, "stripe_subscription", "sub_collapse"));

    const companyId = await asRole(h, WORKER, h.companyA, async (q) => {
      const tx = execFrom(q);
      const claimed = await claimCustomerActivation(tx, "worker-collapse");
      expect(claimed?.id).toBe(id1);
      return provisionCustomerCompany(tx, { activation: claimed! });
    });
    expect(companyId).toBeTruthy();

    // a second worker tick finds NOTHING to claim (the only activation is already onboarding_required)
    const claimedAgain = await asRole(h, WORKER, h.companyA, (q) => claimCustomerActivation(execFrom(q), "worker-collapse-2"));
    expect(claimedAgain).toBeNull();

    // exactly ONE company for that name, and exactly ONE activation row for that key
    const companies = await h.pg.query(`select count(*)::int as n from pierre_rt_companies where name='Collapse SAS'`);
    expect((companies.rows[0] as { n: number }).n).toBe(1);
    const acts = await h.pg.query(`select count(*)::int as n from pierre_rt_customer_activations where provisioning_key=$1`, [provKey]);
    expect((acts.rows[0] as { n: number }).n).toBe(1);
  });
});

describe("P8.6 provisioning_key — DISTINCT keys yield DISTINCT companies", () => {
  it("two distinct provisioning_keys provision two independent companies", async () => {
    const ownerX = newUuid();
    const ownerY = newUuid();
    const keyX = computeProvisioningKey({ commercial_reference: "sub_two_x" });
    const keyY = computeProvisioningKey({ commercial_reference: "sub_two_y" });

    const x = await driveToCompany(keyX, "sub_two_x", ownerX, "Two-X SAS");
    const y = await driveToCompany(keyY, "sub_two_y", ownerY, "Two-Y SAS");

    expect(x.activationId).not.toBe(y.activationId);
    expect(x.companyId).not.toBe(y.companyId);

    // each company is fully and independently provisioned
    const entX = await getEntitlement(h.db, x.companyId);
    const entY = await getEntitlement(h.db, y.companyId);
    expect(entX?.status).toBe("active");
    expect(entY?.status).toBe("active");

    // each owner is the active owner of their OWN company only
    const mX = await h.pg.query(`select company_id from pierre_rt_members where user_id=$1 and role='owner' and status='active'`, [ownerX]);
    const mY = await h.pg.query(`select company_id from pierre_rt_members where user_id=$1 and role='owner' and status='active'`, [ownerY]);
    expect(mX.rows.map((r) => (r as { company_id: string }).company_id)).toEqual([x.companyId]);
    expect(mY.rows.map((r) => (r as { company_id: string }).company_id)).toEqual([y.companyId]);
  });
});

describe("P8.6 provisioning — role split is enforced", () => {
  it("the application role CANNOT claim or provision (worker truth functions are refused)", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_role_split" });
    const activationId = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_role_split", owner_user_id: owner, company_name: "Role Split SAS" }));
    await asRole(h, BILLING, h.companyA, (q) =>
      markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", "sub_role_split"));

    // app cannot claim
    const cannotClaim = await refused(() => asRole(h, APP, h.companyA, (q) => claimCustomerActivation(execFrom(q), "app-impersonator")));
    expect(cannotClaim).toBe(true);

    // app cannot provision (build a plausible activation row by hand to prove it's the GRANT that blocks)
    const cannotProvision = await refused(() => asRole(h, APP, h.companyA, (q) =>
      provisionCustomerCompany(execFrom(q), {
        activation: {
          id: activationId, provisioning_key: provKey, company_id: null, product_key: "pierre",
          commercial_reference: "sub_role_split", status: "provisioning", requested_by: owner,
          owner_user_id: owner, company_name: "Role Split SAS", source_type: "stripe_subscription",
          source_reference: "sub_role_split", locked_by: "app-impersonator", fencing_token: 1,
          claimed_at: null, lease_expires_at: null, blocked_reason: null,
        },
      })));
    expect(cannotProvision).toBe(true);

    // app cannot mark-provisioning either (that is a billing truth function)
    const cannotMark = await refused(() => asRole(h, APP, h.companyA, (q) =>
      markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", "sub_role_split")));
    expect(cannotMark).toBe(true);

    // the activation was NOT provisioned by any refused attempt — still unbound, still provisioning
    const act = await readActivation(activationId);
    expect(act.company_id).toBeNull();
    expect(act.status).toBe("provisioning");

    // the legitimate worker can then complete it (the refusals were about ROLE, not state)
    const companyId = await asRole(h, WORKER, h.companyA, async (q) => {
      const tx = execFrom(q);
      const claimed = await claimCustomerActivation(tx, "worker-after-refusal");
      expect(claimed?.id).toBe(activationId);
      return provisionCustomerCompany(tx, { activation: claimed! });
    });
    expect(companyId).toBeTruthy();
  });
});
