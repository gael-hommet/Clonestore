// src/lib/pierre/v1/__integration__/p86-onboarding-ready-gate-reopen.itest.ts
// PHASE 8.6 — the ONBOARDING READY GATE and step RE-OPEN, proven on real Postgres (PGlite).
//
// completeOnboardingSession is the server-authoritative gate that flips a provisioned company to
// `active` and its activation to `ready`. It refuses with a precise blocker string until EVERY
// condition holds: all REQUIRED steps completed (`incomplete_steps`), an active/grace entitlement
// (`no_active_entitlement`), and at least one active owner (`no_active_owner`). Only when all three
// hold does it return `completed`. Re-opening a completed step then reverts a `ready` activation back
// to `onboarding_required` and the session to `reopened`. This file engineers each blocker state and
// asserts the real transitions — it never weakens an assertion to make it pass.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid } from "../sql";
import type { TenantContext } from "../tenant-context";
import { markActivationProvisioning, applyEntitlementEvent } from "../commercial-events";
import {
  requestCustomerActivation, computeProvisioningKey, claimCustomerActivation, provisionCustomerCompany,
} from "../customer-activation";
import {
  completeOnboardingStep, reopenOnboardingStep, completeOnboardingSession, getOnboardingState,
} from "../onboarding-service";
import { PIERRE_ONBOARDING_STEPS } from "../onboarding-registry";
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

// The full OWNER permission set — sufficient for every required onboarding step's declared permission
// plus the company.admin needed to complete/reopen a session.
const OWNER_PERMS: readonly string[] = [
  "company.read", "company.write", "company.admin",
  "mission.create", "mission.read", "mission.cancel",
  "employee.read", "employee.write", "employee.archive", "employee.sensitive.read", "employee.sensitive.write",
  "document.read", "document.write", "absence.read", "absence.write",
  "payroll_prep.read", "payroll_prep.write", "validation.read", "validation.decide",
  "pierre.use", "audit.read", "site.read", "site.write", "tenancy.admin",
  "task.read", "queue.admin", "gdpr.admin",
];

/** A synthetic owner TenantContext bound to an arbitrary (provisioned/engineered) company. */
function ownerCtx(companyId: string, userId: string): TenantContext {
  return {
    company_id: companyId, user_id: userId, membership_id: newUuid(),
    role: "owner", role_keys: ["OWNER"], permissions: [...OWNER_PERMS],
    site_ids: null, request_id: newUuid(), correlation_id: newUuid(),
  };
}

const REQUIRED_STEP_KEYS = PIERRE_ONBOARDING_STEPS.filter((s) => s.required).map((s) => s.step_key);
const OPTIONAL_STEP_KEYS = PIERRE_ONBOARDING_STEPS.filter((s) => !s.required).map((s) => s.step_key);

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

/** Provision a brand-new customer company through the real activation pipeline. */
async function provisionFreshCompany(ref: string): Promise<{ company: string; owner: string; activationId: string }> {
  const owner = newUuid();
  const provKey = computeProvisioningKey({ commercial_reference: ref });
  const activationId = await asRole(h, APP, h.companyA, (q) =>
    requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: ref, owner_user_id: owner, company_name: "Ready Gate Co", requested_by: owner }));
  await asRole(h, BILLING, h.companyA, (q) => markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", ref));
  const company = await asRole(h, WORKER, h.companyA, async (q) => {
    const tx = execFrom(q);
    const claimed = await claimCustomerActivation(tx, "ready-gate-worker");
    return provisionCustomerCompany(tx, { activation: claimed! });
  });
  // persist the REAL company data the completion rules verify (identity + legal facts must actually exist)
  await h.pg.query(
    `update pierre_rt_companies set registration_country='FR', registration_number='RCS-654321', legal_name='Ready Gate Co SAS' where id=$1`,
    [company]);
  return { company, owner, activationId };
}

/** Data some completion rules consult (e.g. the explicit "no employees yet" decision). */
function stepData(stepKey: string): Record<string, unknown> {
  return stepKey === "employee_data" ? { no_employees_for_now: true } : {};
}

/** Complete a single onboarding step as the app role bound to its company (server enforces real rules). */
async function completeStep(company: string, owner: string, sessionId: string, stepKey: string): Promise<string> {
  return asRole(h, APP, company, (q) =>
    completeOnboardingStep(execFrom(q), ownerCtx(company, owner), { session_id: sessionId, step_key: stepKey, data: stepData(stepKey) }));
}

/** Read the activation status straight from the table (superuser). */
async function activationStatus(activationId: string): Promise<string> {
  const r = await h.pg.query(`select status from pierre_rt_customer_activations where id=$1`, [activationId]);
  return (r.rows[0] as { status: string }).status;
}

/** Read the company status straight from the table (superuser). */
async function companyStatus(company: string): Promise<string> {
  const r = await h.pg.query(`select status from pierre_rt_companies where id=$1`, [company]);
  return (r.rows[0] as { status: string }).status;
}

describe("P8.6 onboarding READY gate — blocker progression", () => {
  it("returns 'incomplete_steps' while required steps remain, then advances as each is completed", async () => {
    const { company, owner } = await provisionFreshCompany("sub_gate_incomplete");
    const ctx = ownerCtx(company, owner);

    // freshly provisioned: session in_progress, all required steps pending, activation onboarding_required
    const state0 = await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx));
    expect(state0.session?.status).toBe("in_progress");
    expect(state0.session?.progress_percent).toBe(0);
    expect(REQUIRED_STEP_KEYS.length).toBeGreaterThan(1);
    const sessionId = state0.session!.id;
    const pendingRequired = state0.steps.filter((s) => s.required && s.status !== "completed");
    expect(pendingRequired.length).toBe(REQUIRED_STEP_KEYS.length);

    // gate refuses while ANY required step is pending
    const blocked0 = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(blocked0).toBe("incomplete_steps");

    // complete all-but-one required step → still blocked, progress < 100
    for (const key of REQUIRED_STEP_KEYS.slice(0, -1)) {
      const r = await completeStep(company, owner, sessionId, key);
      expect(r).toBe("completed");
    }
    const blockedPartial = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(blockedPartial).toBe("incomplete_steps");
    const statePartial = await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx));
    expect(statePartial.session!.progress_percent).toBeGreaterThan(0);
    expect(statePartial.session!.progress_percent).toBeLessThan(100);
    expect(statePartial.ready_blockers.length).toBeGreaterThan(0);

    // completing the LAST required step removes the step blocker
    const last = await completeStep(company, owner, sessionId, REQUIRED_STEP_KEYS[REQUIRED_STEP_KEYS.length - 1]);
    expect(last).toBe("completed");
    const stateAll = await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx));
    expect(stateAll.session!.progress_percent).toBe(100);
    expect(stateAll.ready_blockers.length).toBe(0);
    // an OPTIONAL step left pending does NOT block the gate (progress is over required steps only)
    for (const key of OPTIONAL_STEP_KEYS) {
      const opt = stateAll.steps.find((s) => s.step_key === key);
      expect(opt?.status).toBe("pending");
    }
  });

  it("after required steps are done, returns 'no_active_entitlement' when the entitlement is not active/grace", async () => {
    const { company, owner } = await provisionFreshCompany("sub_gate_no_ent");
    const ctx = ownerCtx(company, owner);
    const sessionId = (await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx))).session!.id;
    for (const key of REQUIRED_STEP_KEYS) expect(await completeStep(company, owner, sessionId, key)).toBe("completed");

    // suspend the live entitlement (billing truth) → suspended is NOT active/grace
    const suspended = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_suspended" }));
    expect(suspended).toBe("suspended");
    expect((await getEntitlement(h.db, company))?.status).toBe("suspended");

    // steps are all done, but the gate now blocks on the entitlement dimension
    const blocked = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(blocked).toBe("no_active_entitlement");

    // cancelling (a different terminal status) is still 'no_active_entitlement'
    const cancelled = await asRole(h, BILLING, company, (q) =>
      applyEntitlementEvent(execFrom(q), { company_id: company, event_key: "commercial.subscription_cancelled" }));
    expect(cancelled).toBe("cancelled");
    const blocked2 = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(blocked2).toBe("no_active_entitlement");

    // session is still NOT completed and the company is still onboarding while blocked
    const state = await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx));
    expect(state.session!.status).not.toBe("completed");
    expect(await companyStatus(company)).toBe("onboarding");
  });

  it("after required steps are done with an active entitlement, returns 'no_active_owner' when no active owner remains", async () => {
    // The DB owner-guard makes it impossible to remove the last owner of a provisioned company, so we
    // engineer the no-active-owner state directly: a company with an active entitlement and every
    // required step completed, but whose only owner membership is NOT active (the guard fires only on
    // UPDATE/DELETE of members, never on the initial INSERT).
    const company = newUuid();
    const owner = newUuid();
    const sessionId = newUuid();
    await h.pg.query(`insert into pierre_rt_companies (id, name, status, onboarding_status) values ($1,'No Owner Co','onboarding','in_progress')`, [company]);
    // owner membership inserted directly as SUSPENDED → zero ACTIVE owners (insert bypasses the guard)
    await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'owner','suspended')`, [newUuid(), company, owner]);
    // active entitlement
    await h.pg.query(`insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type, starts_at) values ($1,$2,'pierre','active','operator_activation',now())`, [newUuid(), company]);
    // onboarding session + all required steps already completed
    await h.pg.query(`insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, progress_percent) values ($1,$2,'pierre','in_progress',100)`, [sessionId, company]);
    let ord = 0;
    for (const key of REQUIRED_STEP_KEYS) {
      await h.pg.query(`insert into pierre_rt_onboarding_steps (id, company_id, session_id, step_key, step_ordinal, status, required) values ($1,$2,$3,$4,$5,'completed',true)`, [newUuid(), company, sessionId, key, ord++]);
    }
    const ctx = ownerCtx(company, owner);

    // sanity: steps + entitlement satisfied, only the active-owner dimension is missing
    expect((await getEntitlement(h.db, company))?.status).toBe("active");
    const ownerCount = await h.pg.query(`select count(*)::int as n from pierre_rt_members where company_id=$1 and role='owner' and status='active'`, [company]);
    expect((ownerCount.rows[0] as { n: number }).n).toBe(0);

    const blocked = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(blocked).toBe("no_active_owner");

    // reactivating the owner clears the last blocker → the gate completes
    await h.pg.query(`update pierre_rt_members set status='active' where company_id=$1 and user_id=$2`, [company, owner]);
    const done = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(done).toBe("completed");
    expect(await companyStatus(company)).toBe("active");
  });
});

describe("P8.6 onboarding READY gate — success then reopen", () => {
  it("completes the session (active company + ready activation), then reopen reverts to onboarding_required + reopened", async () => {
    const { company, owner, activationId } = await provisionFreshCompany("sub_gate_full");
    const ctx = ownerCtx(company, owner);
    const sessionId = (await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx))).session!.id;

    // all three conditions already hold straight out of provisioning EXCEPT the steps; complete them
    for (const key of REQUIRED_STEP_KEYS) expect(await completeStep(company, owner, sessionId, key)).toBe("completed");

    // pre-completion invariants
    expect((await getEntitlement(h.db, company))?.status).toBe("active");
    expect(await activationStatus(activationId)).toBe("onboarding_required");
    expect(await companyStatus(company)).toBe("onboarding");

    // GATE PASSES: session completed, company active, activation ready
    const result = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(result).toBe("completed");

    const completedState = await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx));
    expect(completedState.session!.status).toBe("completed");
    expect(completedState.session!.progress_percent).toBe(100);
    expect(completedState.session!.completed_at).not.toBeNull();
    expect(await companyStatus(company)).toBe("active");
    expect(await activationStatus(activationId)).toBe("ready");

    // RE-OPEN a completed required step → activation reverts to onboarding_required, session 'reopened'
    const reopenKey = REQUIRED_STEP_KEYS[0];
    await asRole(h, APP, company, (q) =>
      reopenOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: reopenKey, reason: "governance_review" }));

    const reopenedState = await asRole(h, APP, company, (q) => getOnboardingState(execFrom(q), ctx));
    expect(reopenedState.session!.status).toBe("reopened");
    expect(reopenedState.session!.reopened_at).not.toBeNull();
    expect(reopenedState.session!.completed_at).toBeNull();
    expect(reopenedState.session!.progress_percent).toBeLessThan(100);
    const reopenedStep = reopenedState.steps.find((s) => s.step_key === reopenKey);
    expect(reopenedStep?.status).toBe("reopened");
    // the reopened required step now blocks the gate again
    expect(reopenedState.ready_blockers.length).toBeGreaterThan(0);

    // the activation that was 'ready' is dragged back to 'onboarding_required'
    expect(await activationStatus(activationId)).toBe("onboarding_required");

    // the gate refuses again until the reopened step is re-completed (proves the revert is real)
    const blockedAfterReopen = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(blockedAfterReopen).toBe("incomplete_steps");

    // re-complete the reopened step and the gate is satisfied once more → ready again
    expect(await completeStep(company, owner, sessionId, reopenKey)).toBe("completed");
    const reCompleted = await asRole(h, APP, company, (q) => completeOnboardingSession(execFrom(q), ctx, sessionId));
    expect(reCompleted).toBe("completed");
    expect(await activationStatus(activationId)).toBe("ready");
    expect(await companyStatus(company)).toBe("active");
  });
});
