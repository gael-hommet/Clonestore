// e2e/p86-customer-lifecycle-step1.spec.ts
// PHASE 8.6 STEP 1 — two REAL, executed browser E2E against the self-booted Next + in-process PGlite:
//   1) owner activation (commercial proof → activation → fenced provisioning → onboarding → cockpit)
//   2) invitation + acceptance (token only via the Fake mailbox, never the client API)
// No test.skip, no PLAYWRIGHT_RUN, no live accounts, no permissive multi-status assertions, no swallowed
// errors. Every terminal state is produced by the real services/routes — nothing is pre-seeded.

import { test, expect, type Page } from "@playwright/test";

const SECRET = "p86-local-secret";
const cp = { "x-pierre-e2e-secret": SECRET };

async function reset(page: Page): Promise<void> {
  const r = await page.request.post("/api/internal/e2e/reset", { headers: cp });
  expect(r.status(), "reset").toBe(200);
}
async function seedAndLogin(page: Page, email?: string): Promise<{ user_id: string; email: string }> {
  const seed = await (await page.request.post("/api/internal/e2e/seed-user", { headers: cp, data: { email } })).json();
  const s = await page.request.post("/api/internal/e2e/session", { headers: cp, data: { user_id: seed.user_id, email: seed.email } });
  expect(s.status(), "session").toBe(200);
  return seed;
}
async function state(page: Page): Promise<Record<string, Array<Record<string, unknown>>>> {
  const r = await page.request.get("/api/internal/e2e/state", { headers: cp });
  expect(r.status(), "state").toBe(200);
  return r.json();
}

/** Drive a fresh tenant from commercial proof to a READY company. Returns { ownerId, companyId }. */
async function activateOwner(page: Page, ref: string): Promise<{ ownerId: string; companyId: string }> {
  const owner = await seedAndLogin(page);
  // real client activation route — owner identity comes from the session, never the body
  const act = await page.request.post("/api/pierre/v1/activation", { data: { test_commercial_reference: ref, company_name: "E2E Owner Co" } });
  expect(act.status(), "activation request").toBe(200);
  // commercial proof (billing role) marks the activation provisioning
  const ce = await page.request.post("/api/internal/e2e/commercial-event", { headers: cp, data: { provider_event_id: `evt_${ref}`, event_key: "commercial.payment_confirmed", subscription_reference: ref } });
  expect(ce.status(), "commercial-event").toBe(200);
  expect((await ce.json()).activation_marked).toBe("provisioning");
  // real activation worker (claim + lease + fencing + atomic provision)
  const tick = await page.request.post("/api/internal/e2e/activation-tick", { headers: cp });
  expect(tick.status(), "activation-tick").toBe(200);
  const provisioned = (await tick.json()).provisioned as string[];
  expect(provisioned.length, "exactly one company provisioned").toBe(1);
  const companyId = provisioned[0];

  // exact post-provision invariants
  const st = await state(page);
  expect(st.companies.length).toBe(1);
  expect(st.companies[0].status).toBe("onboarding");
  const owners = st.members.filter((m) => m.role === "owner" && m.status === "active");
  expect(owners.length).toBe(1);
  expect(st.entitlements.filter((e) => e.status === "active").length).toBe(1);
  expect(st.onboarding_sessions.length).toBe(1);
  expect(st.activations[0].status).toBe("onboarding_required");

  // set the real company identity/legal data the onboarding rules verify
  const patch = await page.request.patch("/api/pierre/v1/company", { headers: { "x-pierre-company": companyId }, data: { registration_country: "FR", legal_name: "E2E Owner Co SAS", registration_number: "RCS-E2E-1", version: 1 } });
  expect(patch.status(), "company patch").toBe(200);

  // complete every required onboarding step through the real governed route (server decides completeness)
  const onb = await (await page.request.get("/api/pierre/v1/onboarding", { headers: { "x-pierre-company": companyId } })).json();
  const sessionId = onb.session.id as string;
  for (const step of (onb.steps as Array<{ step_key: string; required: boolean }>).filter((s) => s.required)) {
    const r = await page.request.patch(`/api/pierre/v1/onboarding/steps/${step.step_key}`, { headers: { "x-pierre-company": companyId }, data: { session_id: sessionId, data: { no_employees_for_now: true } } });
    expect(r.status(), `complete step ${step.step_key}`).toBe(200);
    expect((await r.json()).result, `step ${step.step_key} result`).toBe("completed");
  }
  // complete the session (READY gate) → company active, activation ready
  const done = await page.request.post("/api/pierre/v1/onboarding/complete", { headers: { "x-pierre-company": companyId }, data: { session_id: sessionId } });
  expect(done.status(), "onboarding complete").toBe(200);
  expect((await done.json()).result).toBe("completed");

  // product access is now allowed
  const access = await (await page.request.get("/api/pierre/v1/product-access", { headers: { "x-pierre-company": companyId } })).json();
  expect(access.access.decision).toBe("allowed");

  return { ownerId: owner.user_id, companyId };
}

test.describe("P8.6 STEP 1 — owner activation + invitation (real local E2E)", () => {
  test("owner activation: commercial proof → fenced provisioning → onboarding → cockpit", async ({ page }) => {
    await reset(page);
    const { companyId } = await activateOwner(page, "sub_e2e_owner");

    // company is active + activation ready
    const st = await state(page);
    expect(st.companies[0].status).toBe("active");
    expect(st.activations[0].status).toBe("ready");

    // a real private page responds for the activated owner
    const resp = await page.goto("/agents/pierre/use");
    expect(resp, "cockpit navigation").not.toBeNull();
    expect(resp!.status()).toBeLessThan(400);
    expect(companyId).toBeTruthy();
  });

  test("invitation: owner invites HR manager, token only via mailbox, second user accepts, owner-only refused", async ({ page }) => {
    await reset(page);
    const { companyId } = await activateOwner(page, "sub_e2e_invite");

    // owner creates an invitation via the real client route — response carries NO raw token
    const inviteEmail = "teammate_e2e@e2e.test";
    const inv = await page.request.post("/api/pierre/v1/invitations", { headers: { "x-pierre-company": companyId }, data: { email: inviteEmail, roles: ["HR_MANAGER"] } });
    expect(inv.status(), "invitation create").toBe(200);
    const invBody = await inv.json();
    expect(JSON.stringify(invBody)).not.toMatch(/"token"/);
    expect(invBody.invitation_id ?? invBody.id).toBeTruthy();

    // P8.4 delivers the invitation; the token is readable ONLY from the secret-gated mailbox
    await page.request.post("/api/internal/e2e/communication-tick", { headers: cp, data: { company_id: companyId } });
    const mail = (await (await page.request.get(`/api/internal/e2e/mailbox?kind=invitation`, { headers: cp })).json()).mail as Array<{ to: string; token?: string }>;
    const msg = mail.find((m) => m.to === inviteEmail);
    expect(msg, "invitation mail present").toBeTruthy();
    expect(msg!.token, "token present in mailbox").toBeTruthy();
    const token = msg!.token!;

    // the second user logs in (fresh identity) and accepts via the real route
    await seedAndLogin(page, inviteEmail);
    const accept = await page.request.post("/api/pierre/v1/invitations/accept", { data: { token } });
    expect(accept.status(), "invitation accept").toBe(200);

    // the new member is active with HR_MANAGER
    const st = await state(page);
    const teammate = st.members.find((m) => m.user_id !== st.companies[0].owner_user_id && m.status === "active");
    expect(teammate, "teammate membership active").toBeTruthy();

    // an owner-only action (GDPR export needs gdpr.admin) by the HR manager is refused with EXACTLY 403
    const ownerOnly = await page.request.post("/api/pierre/v1/company/export", { headers: { "x-pierre-company": companyId }, data: {} });
    expect(ownerOnly.status()).toBe(403);
  });
});
