// src/lib/pierre/v1/__integration__/p86-owner-and-onboarding-seed.itest.ts
// PHASE 8.6 — proven on real Postgres (PGlite): the POST-PROVISIONING company invariant.
//
// After the activation worker provisions a customer company, the migration's governed
// pierre_rt_provision_customer_company must have atomically produced a coherent tenant:
//   - an OWNER membership (role=owner, status=active) PLUS its OWNER membership_role row,
//   - an ACTIVE product entitlement,
//   - an onboarding SESSION (status=in_progress) with EXACTLY one step per onboardingStepSeed('pierre'),
//   - the company in status 'onboarding',
//   - EXACTLY one append-only access event of kind customer.activation_completed,
//   - and resolveTenantContext must resolve that owner to role 'owner' with OWNER among its role_keys.
//
// We drive the real service modules (requestCustomerActivation → markActivationProvisioning →
// claimCustomerActivation → provisionCustomerCompany) through the least-privilege roles (app / billing /
// worker), exactly as production would, then assert the seeded shape with direct reads.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import { resolveTenantContext } from "../tenant-context";
import { markActivationProvisioning } from "../commercial-events";
import { getEntitlement, getOnboardingSession } from "../entitlements";
import {
  requestCustomerActivation, computeProvisioningKey, claimCustomerActivation, provisionCustomerCompany,
  type ActivationRow,
} from "../customer-activation";
import { onboardingStepSeed } from "../onboarding-registry";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules inside a role-bound tx.
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

/**
 * Drive a fresh customer activation all the way through provisioning and return the
 * resolved {company, owner, activationId}. Exercises the real least-privilege roles.
 */
async function provisionFreshCompany(opts: { name: string; ref: string }): Promise<{ company: string; owner: string; activationId: string }> {
  const owner = newUuid();
  const provKey = computeProvisioningKey({ commercial_reference: opts.ref });

  const activationId = await asRole(h, APP, h.companyA, (q) =>
    requestCustomerActivation(execFrom(q), {
      provisioning_key: provKey, commercial_reference: opts.ref,
      owner_user_id: owner, company_name: opts.name, requested_by: owner,
    }));
  expect(activationId).toBeTruthy();

  const mark = await asRole(h, BILLING, h.companyA, (q) =>
    markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", opts.ref));
  expect(mark).toBe("provisioning");

  const company = await asRole(h, WORKER, h.companyA, async (q) => {
    const tx = execFrom(q);
    const claimed: ActivationRow | null = await claimCustomerActivation(tx, "owner-seed-worker");
    expect(claimed?.id).toBe(activationId);
    return provisionCustomerCompany(tx, { activation: claimed! });
  });
  expect(company).toBeTruthy();
  return { company: company as string, owner, activationId };
}

describe("P8.6 provisioning seeds a coherent owner + onboarding shape", () => {
  let company: string;
  let owner: string;

  beforeAll(async () => {
    const r = await provisionFreshCompany({ name: "Seed Owner SAS", ref: "sub_owner_seed_1" });
    company = r.company;
    owner = r.owner;
  });

  it("creates the company in status 'onboarding'", async () => {
    const r = await h.pg.query<{ status: string; name: string; owner_user_id: string | null }>(
      `select status, name, owner_user_id from pierre_rt_companies where id=$1`, [company]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].status).toBe("onboarding");
    expect(r.rows[0].name).toBe("Seed Owner SAS");
    // the provisioning function records the owner on the company too
    expect(r.rows[0].owner_user_id).toBe(owner);
  });

  it("creates the owner membership with role=owner, status=active", async () => {
    const r = await h.pg.query<{ id: string; role: string; status: string }>(
      `select id, role, status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, owner]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ role: "owner", status: "active" });
    // and it is the SOLE membership of the freshly provisioned company
    const count = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_members where company_id=$1`, [company]);
    expect(count.rows[0].n).toBe(1);
  });

  it("attaches an OWNER membership_role to that owner membership", async () => {
    const member = await h.pg.query<{ id: string }>(
      `select id from pierre_rt_members where company_id=$1 and user_id=$2`, [company, owner]);
    const membershipId = member.rows[0].id;
    const roles = await h.pg.query<{ role_key: string }>(
      `select role_key from pierre_rt_membership_roles where company_id=$1 and membership_id=$2`,
      [company, membershipId]);
    const keys = roles.rows.map((x) => x.role_key);
    expect(keys).toContain("OWNER");
    // exactly the OWNER role at seed time — provisioning does not over-grant
    expect(keys).toEqual(["OWNER"]);
  });

  it("creates an ACTIVE product entitlement for the default product", async () => {
    const ent = await getEntitlement(h.db, company);
    expect(ent).not.toBeNull();
    expect(ent?.status).toBe("active");
    expect(ent?.product_key).toBe("pierre");
    expect(ent?.company_id).toBe(company);
    // exactly one entitlement row exists for the fresh company
    const count = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1`, [company]);
    expect(count.rows[0].n).toBe(1);
  });

  it("creates an in_progress onboarding session", async () => {
    const session = await getOnboardingSession(h.db, company);
    expect(session).not.toBeNull();
    expect(session?.status).toBe("in_progress");
    // exactly one session row exists for the fresh company
    const count = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_onboarding_sessions where company_id=$1`, [company]);
    expect(count.rows[0].n).toBe(1);
  });

  it("seeds exactly one onboarding step per onboardingStepSeed('pierre') entry, with matching required flags", async () => {
    const seed = onboardingStepSeed("pierre");
    expect(seed.length).toBeGreaterThan(0);

    const session = await getOnboardingSession(h.db, company);
    const steps = await h.pg.query<{ step_key: string; required: boolean; status: string; session_id: string; step_ordinal: number }>(
      `select step_key, required, status, session_id, step_ordinal
         from pierre_rt_onboarding_steps where company_id=$1 order by step_ordinal asc`, [company]);

    // one step per seed entry — no more, no fewer
    expect(steps.rows).toHaveLength(seed.length);

    // the set of step keys matches the registry seed exactly
    const seededKeys = steps.rows.map((s) => s.step_key).sort();
    const expectedKeys = seed.map((s) => s.step_key).sort();
    expect(seededKeys).toEqual(expectedKeys);

    // every seeded step is attached to THE session, is pending at seed time, and the
    // required flag mirrors the registry exactly
    const requiredBySeed = new Map(seed.map((s) => [s.step_key, s.required]));
    for (const row of steps.rows) {
      expect(row.session_id).toBe(session?.id);
      expect(row.status).toBe("pending");
      expect(row.required).toBe(requiredBySeed.get(row.step_key));
    }

    // the session's current_step_key points at the FIRST seeded step (lowest ordinal)
    expect(session?.current_step_key).toBe(steps.rows[0].step_key);
  });

  it("appends EXACTLY one customer.activation_completed access event", async () => {
    const ev = await h.pg.query<{ event_kind: string; new_state: string; target_user_id: string | null; actor_user_id: string | null; membership_id: string | null }>(
      `select event_kind, new_state, target_user_id, actor_user_id, membership_id
         from pierre_rt_company_access_events
        where company_id=$1 and event_kind='customer.activation_completed'`, [company]);
    expect(ev.rows).toHaveLength(1);
    const row = ev.rows[0];
    expect(row.new_state).toBe("onboarding_required");
    expect(row.target_user_id).toBe(owner);
    expect(row.actor_user_id).toBe(owner);
    // the event is bound to the freshly created owner membership
    const member = await h.pg.query<{ id: string }>(
      `select id from pierre_rt_members where company_id=$1 and user_id=$2`, [company, owner]);
    expect(row.membership_id).toBe(member.rows[0].id);
  });

  it("resolveTenantContext resolves the owner to role 'owner' with OWNER among role_keys", async () => {
    const ctx = await resolveTenantContext(h.db, { user_id: owner, company_id: company });
    expect(ctx.role).toBe("owner");
    expect(ctx.company_id).toBe(company);
    expect(ctx.user_id).toBe(owner);
    expect(ctx.role_keys ?? []).toContain("OWNER");
    // the resolved membership id matches the seeded owner membership
    const member = await h.pg.query<{ id: string }>(
      `select id from pierre_rt_members where company_id=$1 and user_id=$2`, [company, owner]);
    expect(ctx.membership_id).toBe(member.rows[0].id);
  });
});

describe("P8.6 the seeded onboarding shape is independent per provisioned company", () => {
  it("a second provisioning produces its OWN isolated owner + session + single access event", async () => {
    const seed = onboardingStepSeed("pierre");
    const { company, owner } = await provisionFreshCompany({ name: "Second Seed SAS", ref: "sub_owner_seed_2" });

    // its own active entitlement
    const ent = await getEntitlement(h.db, company);
    expect(ent?.status).toBe("active");

    // its own owner membership
    const member = await h.pg.query<{ role: string; status: string }>(
      `select role, status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, owner]);
    expect(member.rows[0]).toMatchObject({ role: "owner", status: "active" });

    // its own full set of onboarding steps
    const steps = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_onboarding_steps where company_id=$1`, [company]);
    expect(steps.rows[0].n).toBe(seed.length);

    // exactly one activation-completed event scoped to this company
    const ev = await h.pg.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_company_access_events
        where company_id=$1 and event_kind='customer.activation_completed'`, [company]);
    expect(ev.rows[0].n).toBe(1);

    // and the company sits in 'onboarding'
    const comp = await h.pg.query<{ status: string }>(`select status from pierre_rt_companies where id=$1`, [company]);
    expect(comp.rows[0].status).toBe("onboarding");
  });
});
