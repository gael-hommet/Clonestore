// src/lib/pierre/v1/__integration__/p86-onboarding-server-progress.itest.ts
// PHASE 8.6 — SERVER-AUTHORITATIVE onboarding progress, proven on real Postgres (PGlite).
//
// The onboarding is NOT a front-end progress bar. The SERVER decides whether a step is really complete
// and recomputes progress_percent over the REQUIRED steps only. This suite provisions a real company
// (so it owns a real session + the registry-seeded steps), then — under the app role with the tenant
// GUC bound — drives completeOnboardingStep() and asserts:
//   • progress_percent is recomputed server-side over REQUIRED steps (completing half ≈ 50, the optional
//     step does NOT move the needle, completing the last required step → 100);
//   • a stale expected_version makes the service throw a typed version_conflict (optimistic lock);
//   • re-completing a done step is a no-op ('already_completed'), and current_step_key advances;
//   • the client has NO direct write path to progress_percent — only the governed function moves it
//     (a direct UPDATE by the app role is refused by RLS/grants).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid, newRequestId, newCorrelationId } from "../sql";
import type { TenantContext } from "../tenant-context";
import { markActivationProvisioning } from "../commercial-events";
import {
  requestCustomerActivation, computeProvisioningKey, claimCustomerActivation, provisionCustomerCompany,
} from "../customer-activation";
import { completeOnboardingStep, getOnboardingState } from "../onboarding-service";
import { PIERRE_ONBOARDING_STEPS } from "../onboarding-registry";
import { RuntimeError } from "../errors";

// Adapt the asRole `q` into a SqlExecutor so we exercise the REAL service modules inside a role-bound tx.
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

// The full OWNER permission set (mirrors harness.ctx) — every onboarding step's declared permission
// (company.write / company.admin / tenancy.admin / mission.create / employee.write) is included so
// requirePermission() never blocks the SERVER-side completeness checks we are actually testing.
const OWNER_PERMS: readonly string[] = [
  "company.read", "company.write", "company.admin",
  "mission.create", "mission.read", "mission.cancel",
  "employee.read", "employee.write", "employee.archive", "employee.sensitive.read", "employee.sensitive.write",
  "document.read", "document.write", "absence.read", "absence.write",
  "payroll_prep.read", "payroll_prep.write", "validation.read", "validation.decide",
  "pierre.use", "audit.read", "site.read", "site.write", "tenancy.admin",
  "task.read", "queue.admin", "gdpr.admin",
];

/** A TenantContext for an arbitrary provisioned company/owner (harness.ctx only knows A/B). */
function ctxFor(companyId: string, userId: string): TenantContext {
  return {
    company_id: companyId, user_id: userId, membership_id: newUuid(),
    role: "owner", role_keys: ["OWNER"], permissions: [...OWNER_PERMS],
    site_ids: null, request_id: newRequestId(), correlation_id: newCorrelationId(),
  };
}

/** End-to-end provisioning of a fresh tenant → returns its company id + owner + onboarding session id. */
async function provisionTenant(h: Harness, name: string): Promise<{ company: string; owner: string; sessionId: string }> {
  const owner = newUuid();
  const provKey = computeProvisioningKey({ commercial_reference: `sub_${name}_${newUuid()}` });
  const activationId = await asRole(h, APP, h.companyA, (q) =>
    requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: provKey, owner_user_id: owner, company_name: name }));
  await asRole(h, BILLING, h.companyA, (q) => markActivationProvisioning(execFrom(q), activationId, "stripe_subscription", provKey));
  const company = await asRole(h, WORKER, h.companyA, async (q) => {
    const tx = execFrom(q);
    const claimed = await claimCustomerActivation(tx, "w");
    return provisionCustomerCompany(tx, { activation: claimed! });
  });
  // Persist the REAL company data the server-side completion rules require (identity + legal). This is the
  // genuine precondition the rules enforce — a step can only be completed once its facts actually exist.
  await h.pg.query(
    `update pierre_rt_companies set registration_country='FR', registration_number='RCS-123456', legal_name=$2 where id=$1`,
    [company, `${name} SAS`]);
  const sess = await h.pg.query<{ id: string }>(
    `select id from pierre_rt_onboarding_sessions where company_id=$1 order by created_at desc limit 1`, [company]);
  return { company: company as string, owner, sessionId: sess.rows[0].id };
}

/** Data some completion rules consult (e.g. the explicit "no employees yet" decision for employee_data). */
function stepData(stepKey: string): Record<string, unknown> {
  return stepKey === "employee_data" ? { no_employees_for_now: true } : {};
}

const REQUIRED_STEPS = PIERRE_ONBOARDING_STEPS.filter((s) => s.required).map((s) => s.step_key);
const OPTIONAL_STEPS = PIERRE_ONBOARDING_STEPS.filter((s) => !s.required).map((s) => s.step_key);

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

describe("P8.6 onboarding — server-authoritative progress recompute", () => {
  it("seeds exactly the registry steps; progress starts at 0 over the REQUIRED steps", async () => {
    const { company, owner, sessionId } = await provisionTenant(h, "Progress Co A");
    expect(REQUIRED_STEPS.length).toBeGreaterThan(1); // the registry actually has required steps
    expect(OPTIONAL_STEPS.length).toBeGreaterThan(0); // …and at least one OPTIONAL step (employee_data)

    const ctx = ctxFor(company, owner);
    const state = await getOnboardingState(h.db, ctx);
    expect(state.session).not.toBeNull();
    expect(state.session!.id).toBe(sessionId);
    expect(state.session!.progress_percent).toBe(0);
    expect(state.session!.status).toBe("in_progress");
    // every registry step is seeded as a real row, with the registry's required flags
    expect(state.steps.map((s) => s.step_key).sort()).toEqual(PIERRE_ONBOARDING_STEPS.map((s) => s.step_key).sort());
    const seededRequired = state.steps.filter((s) => s.required).map((s) => s.step_key).sort();
    expect(seededRequired).toEqual([...REQUIRED_STEPS].sort());
    // nothing completed yet
    expect(state.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("recomputes progress_percent server-side over REQUIRED steps as they are completed (≈50 at half, 100 at full)", async () => {
    const { company, owner, sessionId } = await provisionTenant(h, "Progress Co B");
    const ctx = ctxFor(company, owner);
    const total = REQUIRED_STEPS.length;

    // complete each required step in order; assert the server's recomputed percent each time.
    const seen: number[] = [];
    for (let i = 0; i < total; i++) {
      const stepKey = REQUIRED_STEPS[i];
      const result = await asRole(h, APP, company, (q) =>
        completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: stepKey, data: stepData(stepKey) }));
      expect(result).toBe("completed");
      const sess = await h.pg.query<{ progress_percent: number }>(
        `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId]);
      const pct = sess.rows[0].progress_percent;
      seen.push(pct);
      // server formula is integer (done*100)/total over REQUIRED steps
      const expected = Math.floor(((i + 1) * 100) / total);
      expect(pct).toBe(expected);
    }
    // monotonic, ends at 100, and crosses ~50 around the halfway point
    expect(seen[seen.length - 1]).toBe(100);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    const half = seen[Math.floor(total / 2) - 1];
    expect(half).toBeGreaterThanOrEqual(40);
    expect(half).toBeLessThanOrEqual(60);
  });

  it("an OPTIONAL step does NOT move progress_percent (recompute is over REQUIRED steps only)", async () => {
    const { company, owner, sessionId } = await provisionTenant(h, "Progress Co C");
    const ctx = ctxFor(company, owner);

    // complete one REQUIRED step → percent reflects 1/total
    const firstReq = REQUIRED_STEPS[0];
    await asRole(h, APP, company, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: firstReq }));
    const after1 = (await h.pg.query<{ progress_percent: number }>(
      `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0].progress_percent;
    expect(after1).toBe(Math.floor(100 / REQUIRED_STEPS.length));

    // complete the OPTIONAL step → percent must NOT change (it is not a required step). employee_data's
    // rule requires either real employees or the explicit "none for now" decision — we pass the latter.
    const opt = OPTIONAL_STEPS[0];
    const optResult = await asRole(h, APP, company, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: opt, data: stepData(opt) }));
    expect(optResult).toBe("completed");
    const afterOpt = (await h.pg.query<{ progress_percent: number }>(
      `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0].progress_percent;
    expect(afterOpt).toBe(after1);

    // …yet the optional step is genuinely recorded as completed (the write happened, it just isn't counted)
    const optRow = (await h.pg.query<{ status: string }>(
      `select status from pierre_rt_onboarding_steps where session_id=$1 and step_key=$2`, [sessionId, opt])).rows[0];
    expect(optRow.status).toBe("completed");
  });

  it("optimistic lock: a stale expected_version makes the service throw a typed version_conflict (no write)", async () => {
    const { company, owner, sessionId } = await provisionTenant(h, "Progress Co D");
    const ctx = ctxFor(company, owner);
    const stepKey = REQUIRED_STEPS[0];

    // a freshly seeded step is version 1; pass a stale expected_version → version_conflict
    let thrown: unknown;
    try {
      await asRole(h, APP, company, (q) =>
        completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: stepKey, expected_version: 999 }));
    } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(RuntimeError);
    expect((thrown as RuntimeError).code).toBe("version_conflict");

    // the conflicted call performed NO write: the step is still pending, percent still 0
    const stepRow = (await h.pg.query<{ status: string; version: number }>(
      `select status, version from pierre_rt_onboarding_steps where session_id=$1 and step_key=$2`, [sessionId, stepKey])).rows[0];
    expect(stepRow.status).toBe("pending");
    expect(stepRow.version).toBe(1);
    const pct = (await h.pg.query<{ progress_percent: number }>(
      `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0].progress_percent;
    expect(pct).toBe(0);

    // the CORRECT expected_version (1) succeeds and advances the version
    const ok = await asRole(h, APP, company, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: stepKey, expected_version: 1 }));
    expect(ok).toBe("completed");
    const after = (await h.pg.query<{ status: string; version: number }>(
      `select status, version from pierre_rt_onboarding_steps where session_id=$1 and step_key=$2`, [sessionId, stepKey])).rows[0];
    expect(after.status).toBe("completed");
    expect(after.version).toBe(2);

    // refused() also captures the stale-version failure as a thrown rejection
    const conflictAgain = await refused(() => asRole(h, APP, company, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: REQUIRED_STEPS[1], expected_version: 12345 })));
    expect(conflictAgain).toBe(true);
  });

  it("re-completing a done step is an idempotent no-op ('already_completed') and current_step_key advances", async () => {
    const { company, owner, sessionId } = await provisionTenant(h, "Progress Co E");
    const ctx = ctxFor(company, owner);

    const first = REQUIRED_STEPS[0];
    const r1 = await asRole(h, APP, company, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: first }));
    expect(r1).toBe("completed");
    const pctAfter1 = (await h.pg.query<{ progress_percent: number; current_step_key: string | null }>(
      `select progress_percent, current_step_key from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0];
    // current step advanced off the just-completed one
    expect(pctAfter1.current_step_key).not.toBe(first);

    // re-complete the SAME step → 'already_completed', percent unchanged
    const r2 = await asRole(h, APP, company, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: first }));
    expect(r2).toBe("already_completed");
    const pctAfter2 = (await h.pg.query<{ progress_percent: number }>(
      `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0].progress_percent;
    expect(pctAfter2).toBe(pctAfter1.progress_percent);
  });

  it("the client has NO direct write path to progress_percent — only the governed function moves it", async () => {
    const { company, sessionId } = await provisionTenant(h, "Progress Co F");

    // a direct UPDATE of progress_percent by the app role is refused (RLS/grant: app may only SELECT,
    // and onboarding writes go exclusively through the SECURITY DEFINER function).
    const directRefused = await refused(() => asRole(h, APP, company, (q) =>
      q(`update pierre_rt_onboarding_sessions set progress_percent=100 where id=$1`, [sessionId])));
    expect(directRefused).toBe(true);

    // a direct INSERT/forge of a completed step is likewise refused for the app role
    const insertRefused = await refused(() => asRole(h, APP, company, (q) =>
      q(`insert into pierre_rt_onboarding_steps (id, company_id, session_id, step_key, status, required) values ($1,$2,$3,'forged','completed',true)`,
        [newUuid(), company, sessionId])));
    expect(insertRefused).toBe(true);

    // the value remains whatever the SERVER last computed (still 0 here — nothing completed)
    const pct = (await h.pg.query<{ progress_percent: number }>(
      `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0].progress_percent;
    expect(pct).toBe(0);
  });

  it("tenant isolation: completing a step requires the bound tenant GUC to match the ctx company", async () => {
    const { company, owner, sessionId } = await provisionTenant(h, "Progress Co G");
    const ctx = ctxFor(company, owner);

    // bind a DIFFERENT tenant GUC (companyA) while the ctx/function target the provisioned company →
    // the governed function detects the mismatch ('tenant mismatch') and refuses.
    const mismatch = await refused(() => asRole(h, APP, h.companyA, (q) =>
      completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: REQUIRED_STEPS[0] })));
    expect(mismatch).toBe(true);

    // nothing was written under the mismatched binding
    const pct = (await h.pg.query<{ progress_percent: number }>(
      `select progress_percent from pierre_rt_onboarding_sessions where id=$1`, [sessionId])).rows[0].progress_percent;
    expect(pct).toBe(0);
  });
});
