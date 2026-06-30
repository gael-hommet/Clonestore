// src/lib/pierre/v1/__integration__/p86-activation-lease-fencing.itest.ts
// PHASE 8.6 — customer-activation claim/lease/FENCING. A claim bumps the fencing token and takes the
// lease; provisioning verifies lease ownership + the current fencing token + a live lease + the
// provisioning status. A stale worker (old fencing) or an unclaimed worker can NEVER provision; once a
// lease is reclaimed (fencing bumped), the previous holder is positively rejected.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import { markActivationProvisioning } from "../commercial-events";
import { requestCustomerActivation, computeProvisioningKey, claimCustomerActivation, provisionCustomerCompany } from "../customer-activation";

function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = { query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>), transaction: (fn) => fn(e) };
  return e;
}
const APP = "pierre_rt_app", BILLING = "pierre_rt_billing_webhook", WORKER = "pierre_rt_customer_activation_worker";

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

async function provisioningReadyActivation(ref: string, owner: string): Promise<string> {
  const provKey = computeProvisioningKey({ commercial_reference: ref });
  const id = await asRole(h, APP, h.companyA, (q) => requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: ref, owner_user_id: owner, company_name: "Fencing Co" }));
  await asRole(h, BILLING, h.companyA, (q) => markActivationProvisioning(execFrom(q), id, "stripe_subscription", ref));
  // claim is a QUEUE (claims any provisioning-ready activation), so isolate THIS one: park any other
  // still-provisioning activations left by earlier cases, so a claim here deterministically returns `id`.
  await h.pg.query(`update pierre_rt_customer_activations set status='blocked', lease_expires_at=null where status='provisioning' and id<>$1`, [id]);
  return id;
}
const steps = JSON.stringify([{ step_key: "company_identity", required: true }]);

describe("P8.6 activation claim bumps the fencing token + takes a lease", () => {
  it("claim returns the lease owner + a bumped fencing token; attempt_count increments", async () => {
    const id = await provisioningReadyActivation("sub_fence_1", newUuid());
    const before = (await h.pg.query<{ fencing_token: string; attempt_count: number }>(`select fencing_token, attempt_count from pierre_rt_customer_activations where id=$1`, [id])).rows[0];
    expect(Number(before.fencing_token)).toBe(0);
    const claimed = await asRole(h, WORKER, h.companyA, (q) => claimCustomerActivation(execFrom(q), "w1"));
    expect(claimed?.id).toBe(id);
    expect(claimed?.locked_by).toBe("w1");
    expect(Number(claimed?.fencing_token)).toBe(1);
    const after = (await h.pg.query<{ attempt_count: number; lease_expires_at: string | null }>(`select attempt_count, lease_expires_at from pierre_rt_customer_activations where id=$1`, [id])).rows[0];
    expect(after.attempt_count).toBe(1);
    expect(after.lease_expires_at).not.toBeNull();
  });
});

describe("P8.6 provisioning requires a valid claim (lease + fencing)", () => {
  it("a STALE fencing token is rejected; the correct one provisions", async () => {
    const owner = newUuid();
    const id = await provisioningReadyActivation("sub_fence_2", owner);
    const claimed = await asRole(h, WORKER, h.companyA, (q) => claimCustomerActivation(execFrom(q), "w1"));
    const fencing = Number(claimed!.fencing_token); // = 1

    // stale fencing (0) → refused
    const stale = await refused(() => asRole(h, WORKER, h.companyA, (q) =>
      q(`select pierre_rt_provision_customer_company($1,$2,$3,'Fencing Co',$4,'pierre','stripe_subscription','sub_fence_2',$5::jsonb,null)`,
        [id, "w1", fencing - 1, owner, steps])));
    expect(stale).toBe(true);
    // wrong worker → refused
    const wrongWorker = await refused(() => asRole(h, WORKER, h.companyA, (q) =>
      q(`select pierre_rt_provision_customer_company($1,$2,$3,'Fencing Co',$4,'pierre','stripe_subscription','sub_fence_2',$5::jsonb,null)`,
        [id, "intruder", fencing, owner, steps])));
    expect(wrongWorker).toBe(true);
    // still unprovisioned
    expect((await h.pg.query<{ company_id: string | null }>(`select company_id from pierre_rt_customer_activations where id=$1`, [id])).rows[0].company_id).toBeNull();

    // correct worker + fencing → provisions
    const company = await asRole(h, WORKER, h.companyA, (q) => provisionCustomerCompany(execFrom(q), { activation: claimed! }));
    expect(company).toBeTruthy();
  });

  it("an UNCLAIMED activation cannot be provisioned (no lease owner)", async () => {
    const owner = newUuid();
    const id = await provisioningReadyActivation("sub_fence_3", owner);
    // never claimed: locked_by is null, fencing 0 → provision refused
    const denied = await refused(() => asRole(h, WORKER, h.companyA, (q) =>
      q(`select pierre_rt_provision_customer_company($1,$2,$3,'Fencing Co',$4,'pierre','stripe_subscription','sub_fence_3',$5::jsonb,null)`,
        [id, "w1", 1, owner, steps])));
    expect(denied).toBe(true);
  });

  it("a reclaimed lease (fencing bumped) positively rejects the previous holder", async () => {
    const owner = newUuid();
    const id = await provisioningReadyActivation("sub_fence_4", owner);
    const first = await asRole(h, WORKER, h.companyA, (q) => claimCustomerActivation(execFrom(q), "w1"));
    const firstFencing = Number(first!.fencing_token); // 1
    // expire the lease, then a second worker reclaims (fencing → 2)
    await h.pg.query(`update pierre_rt_customer_activations set lease_expires_at=now()-interval '1 hour' where id=$1`, [id]);
    const second = await asRole(h, WORKER, h.companyA, (q) => claimCustomerActivation(execFrom(q), "w2"));
    expect(Number(second!.fencing_token)).toBe(2);
    // the FIRST holder (fencing 1) is now stale → refused
    const staleHolder = await refused(() => asRole(h, WORKER, h.companyA, (q) =>
      q(`select pierre_rt_provision_customer_company($1,'w1',$2,'Fencing Co',$3,'pierre','stripe_subscription','sub_fence_4',$4::jsonb,null)`,
        [id, firstFencing, owner, steps])));
    expect(staleHolder).toBe(true);
    // the current holder (w2, fencing 2) provisions
    const company = await asRole(h, WORKER, h.companyA, (q) => provisionCustomerCompany(execFrom(q), { activation: second! }));
    expect(company).toBeTruthy();
  });
});
