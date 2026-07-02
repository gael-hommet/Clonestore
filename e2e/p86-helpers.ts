// e2e/p86-helpers.ts — shared helpers for the P8.6 local E2E (control plane + real client routes).
import { expect, type Page } from "@playwright/test";

export const SECRET = "p86-local-secret";
export const cp = { "x-pierre-e2e-secret": SECRET };

export async function reset(page: Page): Promise<void> {
  expect((await page.request.post("/api/internal/e2e/reset", { headers: cp })).status(), "reset").toBe(200);
}
export async function seedUser(page: Page, email?: string): Promise<{ user_id: string; email: string }> {
  return (await page.request.post("/api/internal/e2e/seed-user", { headers: cp, data: { email } })).json();
}
export async function login(page: Page, user_id: string, email: string): Promise<void> {
  expect((await page.request.post("/api/internal/e2e/session", { headers: cp, data: { user_id, email } })).status(), "session").toBe(200);
}
export async function seedAndLogin(page: Page, email?: string): Promise<{ user_id: string; email: string }> {
  const u = await seedUser(page, email);
  await login(page, u.user_id, u.email);
  return u;
}
export async function state(page: Page): Promise<Record<string, Array<Record<string, unknown>>>> {
  const r = await page.request.get("/api/internal/e2e/state", { headers: cp });
  expect(r.status(), "state").toBe(200);
  return r.json();
}
export async function commercialEvent(page: Page, body: Record<string, unknown>): Promise<{ ingest: string; event_id: string | null; activation_marked: string | null }> {
  const r = await page.request.post("/api/internal/e2e/commercial-event", { headers: cp, data: body });
  expect(r.status(), "commercial-event").toBe(200);
  return r.json();
}
export async function applyCommercialEvent(page: Page, event_id: string): Promise<{ result: string }> {
  const r = await page.request.post("/api/internal/e2e/apply-commercial-event", { headers: cp, data: { event_id } });
  expect(r.status(), "apply-commercial-event").toBe(200);
  return r.json();
}
export async function activationTick(page: Page): Promise<{ claimed: number; provisioned: string[] }> {
  const r = await page.request.post("/api/internal/e2e/activation-tick", { headers: cp });
  expect(r.status(), "activation-tick").toBe(200);
  return r.json();
}
export async function runtimeTick(page: Page, company_id: string): Promise<Record<string, number>> {
  const r = await page.request.post("/api/internal/e2e/runtime-tick", { headers: cp, data: { company_id } });
  expect(r.status(), "runtime-tick").toBe(200);
  return r.json();
}
export async function schedulerTick(page: Page, company_id: string): Promise<Record<string, number>> {
  const r = await page.request.post("/api/internal/e2e/scheduler-tick", { headers: cp, data: { company_id } });
  expect(r.status(), "scheduler-tick").toBe(200);
  return r.json();
}
export async function communicationTick(page: Page): Promise<{ delivered: number }> {
  const r = await page.request.post("/api/internal/e2e/communication-tick", { headers: cp });
  expect(r.status(), "communication-tick").toBe(200);
  return r.json();
}
export async function mailbox(page: Page, kind?: string): Promise<Array<{ to: string; token?: string; kind: string }>> {
  const r = await page.request.get(`/api/internal/e2e/mailbox${kind ? `?kind=${kind}` : ""}`, { headers: cp });
  expect(r.status(), "mailbox").toBe(200);
  return (await r.json()).mail;
}
const H = (companyId: string) => ({ "x-pierre-company": companyId });

/**
 * Drive a company for the CURRENT session user from commercial proof to a READY company, returning its id.
 * Uses real client routes (activation, company patch, onboarding) + real workers — nothing pre-seeded.
 */
export async function provisionAndOnboard(page: Page, ref: string, name: string): Promise<string> {
  const act = await page.request.post("/api/pierre/v1/activation", { data: { test_commercial_reference: ref, company_name: name } });
  expect(act.status(), "activation request").toBe(200);
  const ce = await commercialEvent(page, { provider_event_id: `evt_${ref}`, event_key: "commercial.payment_confirmed", subscription_reference: ref });
  expect(ce.activation_marked).toBe("provisioning");
  const tick = await activationTick(page);
  expect(tick.provisioned.length, "one company provisioned").toBe(1);
  const companyId = tick.provisioned[0];

  // persist the real identity/legal data the onboarding rules verify, then complete onboarding for real.
  expect((await page.request.patch("/api/pierre/v1/company", { headers: H(companyId), data: { registration_country: "FR", legal_name: `${name} SAS`, registration_number: `RCS-${ref}`, version: 1 } })).status(), "company patch").toBe(200);
  const onb = await (await page.request.get("/api/pierre/v1/onboarding", { headers: H(companyId) })).json();
  const sessionId = onb.session.id as string;
  for (const step of (onb.steps as Array<{ step_key: string; required: boolean }>).filter((s) => s.required)) {
    const r = await page.request.patch(`/api/pierre/v1/onboarding/steps/${step.step_key}`, { headers: H(companyId), data: { session_id: sessionId, data: { no_employees_for_now: true } } });
    expect(r.status(), `step ${step.step_key}`).toBe(200);
  }
  expect((await page.request.post("/api/pierre/v1/onboarding/complete", { headers: H(companyId), data: { session_id: sessionId } })).status(), "onboarding complete").toBe(200);
  const access = await (await page.request.get("/api/pierre/v1/product-access", { headers: H(companyId) })).json();
  expect(access.access.decision).toBe("allowed");
  return companyId;
}

/** Seed + login a fresh owner and activate one ready company. Returns { ownerId, email, companyId }. */
export async function activateOwner(page: Page, ref: string, name = "E2E Owner Co"): Promise<{ ownerId: string; email: string; companyId: string }> {
  const owner = await seedAndLogin(page);
  const companyId = await provisionAndOnboard(page, ref, name);
  return { ownerId: owner.user_id, email: owner.email, companyId };
}

export { H as companyHeader };
