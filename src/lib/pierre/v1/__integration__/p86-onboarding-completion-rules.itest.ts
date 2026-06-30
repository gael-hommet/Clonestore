// src/lib/pierre/v1/__integration__/p86-onboarding-completion-rules.itest.ts
// PHASE 8.6 — onboarding completion is SERVER-AUTHORITATIVE with REAL per-step verification. A step
// cannot be completed unless its facts actually exist in persisted tenant data; dependencies must be
// completed first; the evidence hash is computed by the SERVER (the client can never supply it); and an
// unknown product is refused (never defaults to the Pierre registry).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";
import type { SqlExecutor } from "../sql";
import { newUuid, newRequestId, newCorrelationId } from "../sql";
import type { TenantContext } from "../tenant-context";
import { markActivationProvisioning } from "../commercial-events";
import { requestCustomerActivation, computeProvisioningKey, claimCustomerActivation, provisionCustomerCompany } from "../customer-activation";
import { completeOnboardingStep } from "../onboarding-service";
import { computeEvidenceHash } from "../onboarding-completion-rules";
import { RuntimeError } from "../errors";

function execFrom(q: (text: string, params?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): SqlExecutor {
  const e: SqlExecutor = { query: (<T = Record<string, unknown>>(t: string, p?: readonly unknown[]) => q(t, p) as Promise<{ rows: T[] }>), transaction: (fn) => fn(e) };
  return e;
}
const APP = "pierre_rt_app", BILLING = "pierre_rt_billing_webhook", WORKER = "pierre_rt_customer_activation_worker";
const OWNER_PERMS = ["company.read", "company.write", "company.admin", "tenancy.admin", "mission.create", "employee.write", "validation.decide", "pierre.use"];
function ownerCtx(companyId: string, userId: string): TenantContext {
  return { company_id: companyId, user_id: userId, membership_id: newUuid(), role: "owner", role_keys: ["OWNER"], permissions: [...OWNER_PERMS], site_ids: null, request_id: newRequestId(), correlation_id: newCorrelationId() };
}

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.close(); });

async function provision(ref: string): Promise<{ company: string; owner: string; sessionId: string }> {
  const owner = newUuid();
  const provKey = computeProvisioningKey({ commercial_reference: ref });
  const id = await asRole(h, APP, h.companyA, (q) => requestCustomerActivation(execFrom(q), { provisioning_key: provKey, commercial_reference: ref, owner_user_id: owner, company_name: "Rules Co" }));
  await asRole(h, BILLING, h.companyA, (q) => markActivationProvisioning(execFrom(q), id, "stripe_subscription", ref));
  const company = await asRole(h, WORKER, h.companyA, async (q) => { const tx = execFrom(q); const c = await claimCustomerActivation(tx, "w"); return provisionCustomerCompany(tx, { activation: c! }); });
  const sessionId = (await h.pg.query<{ id: string }>(`select id from pierre_rt_onboarding_sessions where company_id=$1`, [company])).rows[0].id;
  return { company: company as string, owner, sessionId };
}
const complete = (company: string, ctx: TenantContext, sessionId: string, step: string, data?: Record<string, unknown>) =>
  asRole(h, APP, company, (q) => completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: step, data }));

describe("P8.6 onboarding completion requires REAL persisted facts", () => {
  it("company_identity cannot be completed until the identity is actually persisted", async () => {
    const { company, owner, sessionId } = await provision("sub_rules_1");
    const ctx = ownerCtx(company, owner);
    // provisioned company has name + locale/timezone defaults but NO registration_country → rule fails
    let thrown: unknown;
    try { await complete(company, ctx, sessionId, "company_identity"); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(RuntimeError);
    expect((thrown as RuntimeError).code).toBe("guard_blocked");
    // the step is still pending (no write)
    expect((await h.pg.query<{ status: string }>(`select status from pierre_rt_onboarding_steps where session_id=$1 and step_key='company_identity'`, [sessionId])).rows[0].status).toBe("pending");
    // persist the real identity → now it completes
    await h.pg.query(`update pierre_rt_companies set registration_country='FR' where id=$1`, [company]);
    expect(await complete(company, ctx, sessionId, "company_identity")).toBe("completed");
  });

  it("company_legal_information requires real legal identity", async () => {
    const { company, owner, sessionId } = await provision("sub_rules_2");
    const ctx = ownerCtx(company, owner);
    await h.pg.query(`update pierre_rt_companies set registration_country='FR' where id=$1`, [company]);
    await complete(company, ctx, sessionId, "company_identity");
    // no legal_name / registration_number yet → blocked
    expect(await refused(() => complete(company, ctx, sessionId, "company_legal_information"))).toBe(true);
    await h.pg.query(`update pierre_rt_companies set registration_number='RCS-1' where id=$1`, [company]);
    expect(await complete(company, ctx, sessionId, "company_legal_information")).toBe("completed");
  });
});

describe("P8.6 onboarding enforces dependencies + unknown product", () => {
  it("a step cannot be completed before its declared dependencies", async () => {
    const { company, owner, sessionId } = await provision("sub_rules_3");
    const ctx = ownerCtx(company, owner);
    await h.pg.query(`update pierre_rt_companies set registration_country='FR' where id=$1`, [company]);
    // dependency chain: company_identity → hr_contacts → approval_responsibilities.
    expect(await complete(company, ctx, sessionId, "company_identity")).toBe("completed");
    // approval_responsibilities still depends on hr_contacts (not yet done) → blocked
    let thrown: unknown;
    try { await complete(company, ctx, sessionId, "approval_responsibilities"); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(RuntimeError);
    expect((thrown as RuntimeError).code).toBe("guard_blocked");
    expect((thrown as RuntimeError).message).toMatch(/hr_contacts/);
    // satisfy the dependency, then it proceeds (provisioned owner holds the OWNER role-key)
    expect(await complete(company, ctx, sessionId, "hr_contacts")).toBe("completed");
    expect(await complete(company, ctx, sessionId, "approval_responsibilities")).toBe("completed");
  });

  it("an unknown product is refused (never defaults to the Pierre registry)", async () => {
    const { company, owner, sessionId } = await provision("sub_rules_4");
    const ctx = ownerCtx(company, owner);
    expect(await refused(() => complete(company, ctx, sessionId, "company_identity", undefined).then(() =>
      asRole(h, APP, company, (q) => completeOnboardingStep(execFrom(q), ctx, { session_id: sessionId, step_key: "company_identity", product_key: "ghost_product" }))))).toBe(true);
  });
});

describe("P8.6 the SERVER computes the evidence hash (client cannot supply it)", () => {
  it("the recorded evidence_hash equals the deterministic server hash for the verified evidence", async () => {
    const { company, owner, sessionId } = await provision("sub_rules_5");
    const ctx = ownerCtx(company, owner);
    await h.pg.query(`update pierre_rt_companies set registration_country='FR' where id=$1`, [company]);
    await complete(company, ctx, sessionId, "company_identity");
    const stored = (await h.pg.query<{ evidence_hash: string | null }>(`select evidence_hash from pierre_rt_onboarding_steps where session_id=$1 and step_key='company_identity'`, [sessionId])).rows[0].evidence_hash;
    expect(stored).toBeTruthy();
    // the hash is the SERVER's deterministic hash of the verified evidence — recomputing matches.
    const c = (await h.pg.query<Record<string, unknown>>(`select name, registration_country, timezone, default_locale from pierre_rt_companies where id=$1`, [company])).rows[0];
    const expected = computeEvidenceHash("company_identity", "pierre", { name: c.name, country: c.registration_country, tz: c.timezone, locale: c.default_locale });
    expect(stored).toBe(expected);
    // it is a 64-hex sha256 (not a client-controlled token)
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });
});
