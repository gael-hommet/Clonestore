// src/lib/pierre/v1/__integration__/p86-product-access-gate.itest.ts
// PHASE 8.6 — exhaustive proof of the central resolveProductAccess() gate, the SINGLE authority every
// private Pierre surface must consult. Each decision is exercised on its OWN isolated company so the
// "one live entitlement per (company,product)" unique index never interferes:
//   denied (no entitlement, and a deliberately-seeded pending entitlement) — onboarding_required
//   (active entitlement, onboarding not completed) — allowed (active + completed onboarding) — grace
//   (grace + completed) — suspended (commercial suspension) — read_only (cancelled).
// Entitlement TRUTH is written ONLY through the governed billing-webhook role (applyEntitlementEvent);
// onboarding sessions are seeded directly via h.pg where a particular status is needed. The application
// role only READS the gate (resolveProductAccess runs on the superuser-backed h.db, as in production it
// runs under the app role which has SELECT on these tables).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid, newRequestId, newCorrelationId } from "../sql";
import type { TenantContext } from "../tenant-context";
import { applyEntitlementEvent, type CommercialEventKey } from "../commercial-events";
import { resolveProductAccess, getEntitlement, getOnboardingSession } from "../entitlements";

const BILLING = "pierre_rt_billing_webhook";

// Adapt the asRole `q` into a SqlExecutor so the real service modules run inside a role-bound tx.
function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = {
    query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>),
    transaction: (fn) => fn(e),
  };
  return e;
}

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

/** Create a fresh, isolated company with an active owner; return a usable owner TenantContext. */
async function freshCompany(name: string): Promise<{ companyId: string; ownerUserId: string; ctx: TenantContext }> {
  const companyId = newUuid();
  const ownerUserId = newUuid();
  const membershipId = newUuid();
  await h.pg.query(`insert into pierre_rt_companies (id, name, status) values ($1,$2,'active')`, [companyId, name]);
  await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','active')`, [membershipId, companyId, ownerUserId]);
  const ctx: TenantContext = {
    company_id: companyId,
    user_id: ownerUserId,
    membership_id: membershipId,
    role: "owner",
    role_keys: ["OWNER"],
    permissions: ["company.read", "pierre.use"],
    site_ids: null,
    request_id: newRequestId(),
    correlation_id: newCorrelationId(),
  };
  return { companyId, ownerUserId, ctx };
}

/** Apply an entitlement transition under the governed billing-webhook role. */
async function entitle(companyId: string, eventKey: CommercialEventKey, sourceReference?: string): Promise<string> {
  return asRole(h, BILLING, companyId, (q) =>
    applyEntitlementEvent(execFrom(q), {
      company_id: companyId,
      event_key: eventKey,
      source_type: "stripe_subscription",
      source_reference: sourceReference ?? null,
    }));
}

/** Seed a completed onboarding session directly (the gate only inspects session.status). */
async function seedCompletedOnboarding(companyId: string): Promise<void> {
  await h.pg.query(
    `insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, progress_percent, completed_at)
     values ($1,$2,'pierre','completed',100, now())`,
    [newUuid(), companyId],
  );
}

describe("P8.6 resolveProductAccess — full decision matrix on isolated companies", () => {
  it("DENIED: a company with NO entitlement at all", async () => {
    const { companyId, ctx } = await freshCompany("Gate Denied None");
    // Sanity: there really is no entitlement.
    expect(await getEntitlement(h.db, companyId)).toBeNull();

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("denied");
    expect(access.entitlement_status).toBeNull();
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(false);
    expect(access.product_key).toBe("pierre");
    expect(access.reason).toBe("no_entitlement");
  });

  it("DENIED: a company whose only entitlement is PENDING", async () => {
    const { companyId, ctx } = await freshCompany("Gate Denied Pending");
    // A pending entitlement is a real (live) row but does not grant access. The governed SM creates an
    // 'active' row on payment, so to obtain a genuine 'pending' state we insert it directly — this is the
    // only way to reach the pending branch, and it respects the live-entitlement unique index.
    await h.pg.query(
      `insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type)
       values ($1,$2,'pierre','pending','operator_activation')`,
      [newUuid(), companyId],
    );
    const ent = await getEntitlement(h.db, companyId);
    expect(ent?.status).toBe("pending");

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("denied");
    expect(access.entitlement_status).toBe("pending");
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(false);
    expect(access.reason).toBe("entitlement_pending");
  });

  it("ONBOARDING_REQUIRED: active entitlement but onboarding not completed", async () => {
    const { companyId, ctx } = await freshCompany("Gate Onboarding");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_onb")).toBe("active");
    // No onboarding session at all -> still onboarding_required.
    expect(await getOnboardingSession(h.db, companyId)).toBeNull();

    let access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("onboarding_required");
    expect(access.entitlement_status).toBe("active");
    expect(access.onboarding_status).toBeNull();
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true); // entitled tenants may read during onboarding
    expect(access.reason).toBe("onboarding_incomplete");

    // An IN-PROGRESS (not completed) session is likewise insufficient.
    await h.pg.query(
      `insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, progress_percent)
       values ($1,$2,'pierre','in_progress',40)`,
      [newUuid(), companyId],
    );
    access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("onboarding_required");
    expect(access.onboarding_status).toBe("in_progress");
    expect(access.can_use).toBe(false);
  });

  it("ALLOWED: active entitlement + completed onboarding", async () => {
    const { companyId, ctx } = await freshCompany("Gate Allowed");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_allowed")).toBe("active");
    await seedCompletedOnboarding(companyId);
    expect((await getOnboardingSession(h.db, companyId))?.status).toBe("completed");

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("allowed");
    expect(access.entitlement_status).toBe("active");
    expect(access.onboarding_status).toBe("completed");
    expect(access.can_use).toBe(true);
    expect(access.can_read).toBe(true);
    expect(access.reason).toBe("active");
  });

  it("GRACE: grace entitlement + completed onboarding still lets the tenant work", async () => {
    const { companyId, ctx } = await freshCompany("Gate Grace");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_grace")).toBe("active");
    await seedCompletedOnboarding(companyId);
    // Payment lapses -> the live entitlement moves to 'grace' (governed SM, no new row created).
    expect(await entitle(companyId, "commercial.subscription_past_due")).toBe("grace");
    expect((await getEntitlement(h.db, companyId))?.status).toBe("grace");

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("grace");
    expect(access.entitlement_status).toBe("grace");
    expect(access.onboarding_status).toBe("completed");
    expect(access.can_use).toBe(true); // existing access maintained during grace
    expect(access.can_read).toBe(true);
    expect(access.reason).toBe("entitlement_grace");
  });

  it("GRACE without completed onboarding collapses back to onboarding_required", async () => {
    // Distinguishes the grace branch from onboarding: grace alone is NOT sufficient.
    const { companyId, ctx } = await freshCompany("Gate Grace No Onboarding");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_grace_noonb")).toBe("active");
    expect(await entitle(companyId, "commercial.subscription_past_due")).toBe("grace");

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("onboarding_required");
    expect(access.entitlement_status).toBe("grace");
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true);
  });

  it("SUSPENDED: a commercial suspension is read-only (cannot use, can still read/export)", async () => {
    const { companyId, ctx } = await freshCompany("Gate Suspended");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_susp")).toBe("active");
    await seedCompletedOnboarding(companyId);
    expect(await entitle(companyId, "commercial.subscription_suspended")).toBe("suspended");
    expect((await getEntitlement(h.db, companyId))?.status).toBe("suspended");

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("suspended");
    expect(access.entitlement_status).toBe("suspended");
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true);
    expect(access.reason).toBe("entitlement_suspended");
    // Onboarding completeness is irrelevant once suspended — suspension takes precedence over onboarding.
    expect(access.onboarding_status).toBe("completed");
  });

  it("READ_ONLY: a cancelled entitlement keeps consultation/export only", async () => {
    const { companyId, ctx } = await freshCompany("Gate Cancelled");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_cancel")).toBe("active");
    await seedCompletedOnboarding(companyId);
    expect(await entitle(companyId, "commercial.subscription_cancelled")).toBe("cancelled");
    expect((await getEntitlement(h.db, companyId))?.status).toBe("cancelled");

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("read_only");
    expect(access.entitlement_status).toBe("cancelled");
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true);
    expect(access.reason).toBe("entitlement_cancelled");
  });

  it("READ_ONLY precedes onboarding: a cancelled entitlement is read_only even with NO onboarding session", async () => {
    // Proves the terminal-entitlement branch is checked before the onboarding branch.
    const { companyId, ctx } = await freshCompany("Gate Cancelled No Onboarding");
    expect(await entitle(companyId, "commercial.payment_confirmed", "sub_cancel_noonb")).toBe("active");
    expect(await entitle(companyId, "commercial.subscription_cancelled")).toBe("cancelled");
    expect(await getOnboardingSession(h.db, companyId)).toBeNull();

    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("read_only");
    expect(access.entitlement_status).toBe("cancelled");
    expect(access.onboarding_status).toBeNull();
    expect(access.can_use).toBe(false);
    expect(access.can_read).toBe(true);
  });

  it("the decisions are mutually distinct and isolated per company (no cross-tenant bleed)", async () => {
    // Build all six states and confirm each company reports exactly its own decision.
    const denied = await freshCompany("Matrix Denied");

    const onboarding = await freshCompany("Matrix Onboarding");
    await entitle(onboarding.companyId, "commercial.payment_confirmed", "sub_m_onb");

    const allowed = await freshCompany("Matrix Allowed");
    await entitle(allowed.companyId, "commercial.payment_confirmed", "sub_m_allowed");
    await seedCompletedOnboarding(allowed.companyId);

    const grace = await freshCompany("Matrix Grace");
    await entitle(grace.companyId, "commercial.payment_confirmed", "sub_m_grace");
    await seedCompletedOnboarding(grace.companyId);
    await entitle(grace.companyId, "commercial.subscription_past_due");

    const suspended = await freshCompany("Matrix Suspended");
    await entitle(suspended.companyId, "commercial.payment_confirmed", "sub_m_susp");
    await seedCompletedOnboarding(suspended.companyId);
    await entitle(suspended.companyId, "commercial.subscription_suspended");

    const cancelled = await freshCompany("Matrix Cancelled");
    await entitle(cancelled.companyId, "commercial.payment_confirmed", "sub_m_cancel");
    await seedCompletedOnboarding(cancelled.companyId);
    await entitle(cancelled.companyId, "commercial.subscription_cancelled");

    const results = Object.fromEntries(
      await Promise.all([
        ["denied", denied], ["onboarding_required", onboarding], ["allowed", allowed],
        ["grace", grace], ["suspended", suspended], ["read_only", cancelled],
      ].map(async ([label, c]) => {
        const access = await resolveProductAccess(h.db, (c as Awaited<ReturnType<typeof freshCompany>>).ctx);
        return [label as string, access.decision];
      })),
    );

    expect(results).toEqual({
      denied: "denied",
      onboarding_required: "onboarding_required",
      allowed: "allowed",
      grace: "grace",
      suspended: "suspended",
      read_only: "read_only",
    });

    // can_use is true ONLY for allowed + grace; false for every restricted state.
    const allowedAccess = await resolveProductAccess(h.db, allowed.ctx);
    const graceAccess = await resolveProductAccess(h.db, grace.ctx);
    const deniedAccess = await resolveProductAccess(h.db, denied.ctx);
    const suspendedAccess = await resolveProductAccess(h.db, suspended.ctx);
    expect([allowedAccess.can_use, graceAccess.can_use]).toEqual([true, true]);
    expect([deniedAccess.can_use, suspendedAccess.can_use]).toEqual([false, false]);
  });
});
