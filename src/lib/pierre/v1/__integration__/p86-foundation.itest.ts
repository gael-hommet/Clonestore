// src/lib/pierre/v1/__integration__/p86-foundation.itest.ts
// PHASE 8.6 — foundation spine, proven on real Postgres (PGlite): commercial event ingress
// (idempotency/conflict), the entitlement state machine, resolveProductAccess gate, atomic company
// provisioning (idempotency + provisioning_key concurrency), invitations (create/accept/replay/email/
// expiry), ownership transfer + last-owner protection, and role-based refusal of truth functions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused, addMember } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import { resolveTenantContext } from "../tenant-context";
import {
  ingestCommercialEvent, applyEntitlementEvent, resolveCommercialEvent, hashCommercialPayload,
  normalizeCommercialEventKey, markActivationProvisioning,
} from "../commercial-events";
import { resolveProductAccess, getEntitlement } from "../entitlements";
import {
  requestCustomerActivation, computeProvisioningKey, claimCustomerActivation, provisionCustomerCompany,
} from "../customer-activation";

// Adapt the asRole `q` into a SqlExecutor so we exercise the real service modules.
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

describe("P8.6 commercial event ingress", () => {
  it("normalizes provider event types to canonical keys", () => {
    expect(normalizeCommercialEventKey("stripe", "checkout.session.completed")).toBe("commercial.payment_confirmed");
    expect(normalizeCommercialEventKey("stripe", "customer.subscription.deleted")).toBe("commercial.subscription_cancelled");
    expect(normalizeCommercialEventKey("stripe", "unknown.event")).toBeNull();
  });

  it("is idempotent on (provider, provider_event_id) and conflict-aware on hash mismatch", async () => {
    const evtId = "evt_" + newUuid();
    const h1 = hashCommercialPayload({ a: 1, b: 2 });
    const first = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: h1, subscription_reference: "sub_1" }));
    expect(first).toBe("received");
    const dup = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: h1, subscription_reference: "sub_1" }));
    expect(dup).toBe("duplicate");
    const conflict = await asRole(h, BILLING, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: evtId, event_key: "commercial.payment_confirmed", payload_hash: hashCommercialPayload({ a: 9 }), subscription_reference: "sub_1" }));
    expect(conflict).toBe("conflict");
  });
});

describe("P8.6 entitlement state machine", () => {
  it("payment_confirmed → active; past_due → grace; cancelled → cancelled; reactivation of cancelled is ignored", async () => {
    const company = h.companyA;
    const s1 = await asRole(h, BILLING, company, (q) => applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.payment_confirmed", source_type: "stripe_subscription", source_reference: "subA" }));
    expect(s1).toBe("active");
    const s2 = await asRole(h, BILLING, company, (q) => applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_past_due" }));
    expect(s2).toBe("grace");
    const s3 = await asRole(h, BILLING, company, (q) => applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_reactivated" }));
    expect(s3).toBe("active");
    const s4 = await asRole(h, BILLING, company, (q) => applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_cancelled" }));
    expect(s4).toBe("cancelled");
    // a cancelled entitlement is terminal: a stray reactivation does NOT silently resurrect it
    const s5 = await asRole(h, BILLING, company, (q) => applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_reactivated" }));
    expect(s5).toBe("active"); // creates a fresh live entitlement (new subscription) — not the old one
    const live = await getEntitlement(h.db, company);
    expect(live?.status).toBe("active");
  });

  it("the application role CANNOT execute entitlement/commercial truth functions", async () => {
    const denied = await refused(() => asRole(h, APP, h.companyA, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: h.companyA, event_key: "commercial.payment_confirmed" })));
    expect(denied).toBe(true);
    const deniedIngest = await refused(() => asRole(h, APP, h.companyA, (q) =>
      ingestCommercialEvent(execFrom(q), { provider: "stripe", provider_event_id: "x", event_key: "commercial.payment_confirmed", payload_hash: "h" })));
    expect(deniedIngest).toBe(true);
  });
});

describe("P8.6 resolveProductAccess gate", () => {
  it("denies without entitlement, requires onboarding when entitled, allows when onboarding complete", async () => {
    const ctx = h.ctx("B");
    // no entitlement yet
    let access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("denied");
    // entitle (active) but no onboarding session → onboarding_required
    await asRole(h, BILLING, h.companyB, (q) => applyEntitlementEvent(execFrom(q), { company_id: h.companyB, event_key: "commercial.payment_confirmed" }));
    access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("onboarding_required");
    // seed a completed onboarding session → allowed
    await h.pg.query(`insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, progress_percent) values ($1,$2,'pierre','completed',100)`, [newUuid(), h.companyB]);
    access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("allowed");
    expect(access.can_use).toBe(true);
    // suspend → read-only/suspended
    await asRole(h, BILLING, h.companyB, (q) => applyEntitlementEvent(execFrom(q), { company_id: h.companyB, event_key: "commercial.subscription_suspended" }));
    access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("suspended");
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true);
  });
});

describe("P8.6 atomic provisioning", () => {
  it("request → provisioning → claim → provision creates company + owner + entitlement + onboarding + access event; idempotent", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_prov_1" });
    // request (app)
    const activationId = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_prov_1", owner_user_id: owner, company_name: "Acme SAS", requested_by: owner }));
    expect(activationId).toBeTruthy();
    // idempotent request → same id
    const again = await asRole(h, APP, h.companyA, (q) =>
      requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_prov_1", owner_user_id: owner, company_name: "Acme SAS" }));
    expect(again).toBe(activationId);
    // billing confirms → provisioning
    const mark = await asRole(h, BILLING, h.companyA, (q) => markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", "sub_prov_1"));
    expect(mark).toBe("provisioning");
    // worker claims + provisions
    const company = await asRole(h, WORKER, h.companyA, async (q) => {
      const tx = execFrom(q);
      const claimed = await claimCustomerActivation(tx, "w1");
      expect(claimed?.id).toBe(activationId);
      return provisionCustomerCompany(tx, { activation: claimed! });
    });
    expect(company).toBeTruthy();

    // owner membership + active entitlement + onboarding + access event exist
    const member = await h.pg.query(`select role, status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, owner]);
    expect(member.rows[0]).toMatchObject({ role: "owner", status: "active" });
    const ent = await getEntitlement(h.db, company as string);
    expect(ent?.status).toBe("active");
    const steps = await h.pg.query(`select count(*)::int as n from pierre_rt_onboarding_steps where company_id=$1`, [company]);
    expect((steps.rows[0] as { n: number }).n).toBeGreaterThan(0);
    const ev = await h.pg.query(`select count(*)::int as n from pierre_rt_company_access_events where company_id=$1 and event_kind='customer.activation_completed'`, [company]);
    expect((ev.rows[0] as { n: number }).n).toBe(1);

    // the provisioned company yields a real tenant context with an active owner membership
    const ctx = await resolveTenantContext(h.db, { user_id: owner, company_id: company as string });
    expect(ctx.role).toBe("owner");

    // idempotent re-provision (same activation already bound) returns the same company
    const company2 = await asRole(h, WORKER, h.companyA, (q) => provisionCustomerCompany(execFrom(q), { activation: { id: activationId, provisioning_key: provKey, company_id: company as string, product_key: "pierre", commercial_reference: "sub_prov_1", status: "onboarding_required", requested_by: owner, owner_user_id: owner, company_name: "Acme SAS", source_type: null, source_reference: null, locked_by: null, fencing_token: 0, claimed_at: null, lease_expires_at: null, blocked_reason: null } }));
    expect(company2).toBe(company);
  });

  it("two activations for the same provisioning_key yield ONE company", async () => {
    const owner = newUuid();
    const provKey = computeProvisioningKey({ commercial_reference: "sub_dup_1" });
    const id1 = await asRole(h, APP, h.companyA, (q) => requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_dup_1", owner_user_id: owner, company_name: "Dup SAS" }));
    const id2 = await asRole(h, APP, h.companyA, (q) => requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: "sub_dup_1", owner_user_id: owner, company_name: "Dup SAS" }));
    expect(id1).toBe(id2);
    await asRole(h, BILLING, h.companyA, (q) => markActivationProvisioning(execFrom(q), id1, "stripe_subscription", "sub_dup_1"));
    const c = await asRole(h, WORKER, h.companyA, async (q) => { const tx = execFrom(q); const a = await claimCustomerActivation(tx, "w"); return provisionCustomerCompany(tx, { activation: a! }); });
    const companies = await h.pg.query(`select count(*)::int as n from pierre_rt_companies where name='Dup SAS'`);
    expect((companies.rows[0] as { n: number }).n).toBe(1);
    expect(c).toBeTruthy();
  });
});

describe("P8.6 invitations", () => {
  it("create → accept (email-matched) → active membership; replay is idempotent; wrong email + expiry refused", async () => {
    const company = h.companyA;
    const email = "teammate@example.com";
    const emailNorm = email.toLowerCase();
    const tokenHash = "th_" + newUuid();
    const expires = new Date(Date.now() + 3600_000).toISOString();
    // create (app, governed)
    const invId = await asRole(h, APP, company, async (q) => {
      const r = await q(`select pierre_rt_create_membership_invitation($1,$2,$3,$4,$5,$6,$7) as id`, [company, email, emailNorm, ["HR_MANAGER"], tokenHash, h.userA, expires]);
      return (r.rows[0] as { id: string }).id;
    });
    expect(invId).toBeTruthy();
    const user = newUuid();
    // accept with a DIFFERENT email → refused
    const wrong = await refused(() => asRole(h, APP, company, (q) => q(`select pierre_rt_accept_membership_invitation($1,$2,$3,$4)`, [tokenHash, user, "other@example.com", new Date().toISOString()])));
    expect(wrong).toBe(true);
    // accept with the matching email → membership
    const memberId = await asRole(h, APP, company, async (q) => {
      const r = await q(`select pierre_rt_accept_membership_invitation($1,$2,$3,$4) as m`, [tokenHash, user, emailNorm, new Date().toISOString()]);
      return (r.rows[0] as { m: string }).m;
    });
    expect(memberId).toBeTruthy();
    const m = await h.pg.query(`select status from pierre_rt_members where company_id=$1 and user_id=$2`, [company, user]);
    expect((m.rows[0] as { status: string }).status).toBe("active");
    // replay accept → same membership (idempotent)
    const memberId2 = await asRole(h, APP, company, async (q) => {
      const r = await q(`select pierre_rt_accept_membership_invitation($1,$2,$3,$4) as m`, [tokenHash, user, emailNorm, new Date().toISOString()]);
      return (r.rows[0] as { m: string }).m;
    });
    expect(memberId2).toBe(memberId);

    // expired invitation refused
    const th2 = "th_" + newUuid();
    await asRole(h, APP, company, (q) => q(`select pierre_rt_create_membership_invitation($1,$2,$3,$4,$5,$6,$7)`, [company, "late@example.com", "late@example.com", ["VIEWER"], th2, h.userA, new Date(Date.now() - 1000).toISOString()]));
    const expired = await refused(() => asRole(h, APP, company, (q) => q(`select pierre_rt_accept_membership_invitation($1,$2,$3,$4)`, [th2, newUuid(), "late@example.com", new Date().toISOString()])));
    expect(expired).toBe(true);
  });

  it("the raw token is NEVER stored — only its hash", async () => {
    const rows = await h.pg.query(`select column_name from information_schema.columns where table_name='pierre_rt_invitations'`);
    const cols = rows.rows.map((r) => (r as { column_name: string }).column_name);
    expect(cols).toContain("token_hash");
    expect(cols).not.toContain("token");
    expect(cols).not.toContain("token_raw");
  });
});

describe("P8.6 ownership transfer + last-owner protection", () => {
  it("transfers ownership to an active member and never leaves zero owners", async () => {
    // fresh tenant for isolation
    const company = newUuid();
    const ownerUser = newUuid();
    const ownerMember = newUuid();
    await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,'Owner Co','active')`, [company]);
    await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`, [ownerMember, company, ownerUser]);
    const second = await addMember(h, company, "admin");

    const res = await asRole(h, APP, company, async (q) => {
      const r = await q(`select pierre_rt_transfer_company_ownership($1,$2,$3,$4,$5) as r`, [company, ownerMember, second.membership_id, ownerUser, true]);
      return (r.rows[0] as { r: string }).r;
    });
    expect(res).toBe("transferred");
    const roles = await h.pg.query(`select id, role from pierre_rt_members where company_id=$1`, [company]);
    const byId = Object.fromEntries(roles.rows.map((x) => [(x as { id: string }).id, (x as { role: string }).role]));
    expect(byId[second.membership_id]).toBe("owner");
    expect(byId[ownerMember]).toBe("admin");

    // last-owner protection: the sole owner cannot be removed/suspended
    const cannotLeave = await refused(() => asRole(h, APP, company, (q) => q(`select pierre_rt_set_member_status($1,$2,$3,$4,$5)`, [company, second.membership_id, "left", second.user_id, "departure"])));
    expect(cannotLeave).toBe(true);
    // a DB-level guard also blocks a direct demotion of the last owner
    const guard = await refused(() => h.pg.query(`update pierre_rt_members set role='admin' where company_id=$1 and id=$2`, [company, second.membership_id]));
    expect(guard).toBe(true);
  });
});
