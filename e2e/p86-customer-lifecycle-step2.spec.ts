// e2e/p86-customer-lifecycle-step2.spec.ts
// PHASE 8.6 STEP 2 — the four remaining real local E2E: first mission (real P8.5 runtime + validation),
// multi-tenant switch + isolation, suspension/reactivation (ordered commercial path + product gate),
// ownership transfer + last-owner protection. No test.skip, no PLAYWRIGHT_RUN, no live accounts, exact
// statuses only, no swallowed errors, no pre-seeded terminal state.

import { test, expect } from "@playwright/test";
import {
  reset, seedAndLogin, login, state, commercialEvent, applyCommercialEvent, runtimeTick, schedulerTick,
  communicationTick, mailbox, provisionAndOnboard, activateOwner, companyHeader as H,
} from "./p86-helpers";

test.describe("P8.6 STEP 2 — first mission, multi-tenant, suspension/reactivation, ownership", () => {
  test("first mission: cockpit → real runtime → validation → completion", async ({ page }) => {
    await reset(page);
    const { companyId } = await activateOwner(page, "sub_first_mission");

    // launch the first mission via the real WRITE_COSTLY client route (canonical P8.5 plan + planner)
    const launch = await page.request.post("/api/pierre/v1/missions/first", { headers: H(companyId), data: {} });
    expect(launch.status(), "first mission launch").toBe(200);
    const { mission_id, run_id } = await launch.json();
    expect(mission_id).toBeTruthy(); expect(run_id).toBeTruthy();

    // worker executes the approval step → a real validation + wait appear (run waiting)
    await runtimeTick(page, companyId);
    let st = await state(page);
    const run = st.mission_runs.find((r) => r.id === run_id);
    expect(run?.status, "run waiting on approval").toBe("waiting");
    const validation = st.validations.find((v) => v.mission_id === mission_id && v.status === "pending");
    expect(validation, "real pending validation").toBeTruthy();

    // approve through the REAL decision route (owner has validation.decide)
    const approve = await page.request.post(`/api/pierre/v1/validations/${validation!.id}/approve`, { headers: H(companyId), data: { version: validation!.version } });
    expect(approve.status(), "approve").toBe(200);

    // scheduler drains the approval event + resolves the wait; worker completes the mission
    for (let i = 0; i < 6; i++) {
      await schedulerTick(page, companyId);
      await runtimeTick(page, companyId);
      st = await state(page);
      if (st.mission_runs.find((r) => r.id === run_id)?.status === "completed") break;
    }
    const finalRun = st.mission_runs.find((r) => r.id === run_id);
    expect(finalRun?.status, "run completed").toBe("completed");
    expect(st.runtime_events.length, "runtime events produced").toBeGreaterThan(0);
    // a real private page responds
    const resp = await page.goto("/agents/pierre/use");
    expect(resp!.status()).toBeLessThan(400);
  });

  test("multi-tenant: switch A → B, isolate data, cross-tenant refused", async ({ page }) => {
    await reset(page);
    const owner = await seedAndLogin(page);
    const companyA = await provisionAndOnboard(page, "sub_tenant_a", "E2E Company A");
    const companyB = await provisionAndOnboard(page, "sub_tenant_b", "E2E Company B");

    // switch to A → the active company is A (server preference)
    expect((await page.request.post("/api/pierre/v1/company/switch", { data: { company_id: companyA } })).status(), "switch A").toBe(200);
    const cA = await (await page.request.get("/api/pierre/v1/company")).json();
    expect(cA.name).toBe("E2E Company A");

    // switch to B → the active company is B
    expect((await page.request.post("/api/pierre/v1/company/switch", { data: { company_id: companyB } })).status(), "switch B").toBe(200);
    const cB = await (await page.request.get("/api/pierre/v1/company")).json();
    expect(cB.name).toBe("E2E Company B");

    // the cockpit (active = B) does not leak company A's identity into the DOM
    await page.goto("/agents/pierre/use");
    expect(await page.content()).not.toContain("E2E Company A");

    // a SECOND user owns company C; the first user is NOT a member → cross-tenant access is refused (403)
    const v = await seedAndLogin(page, "tenant_c_owner@e2e.test");
    const companyC = await provisionAndOnboard(page, "sub_tenant_c", "E2E Company C");
    await login(page, owner.user_id, owner.email); // back to the first user
    const forbidden = await page.request.get("/api/pierre/v1/company", { headers: H(companyC) });
    expect(forbidden.status(), "cross-tenant refused").toBe(403);
    expect(JSON.stringify(await forbidden.json())).not.toContain("E2E Company C");
    expect(v.user_id).toBeTruthy();
  });

  test("suspension/reactivation: reads continue, costly writes stop, then access returns; stale ignored", async ({ page }) => {
    await reset(page);
    const { companyId } = await activateOwner(page, "sub_suspend");

    // a mission can be created while allowed
    expect((await page.request.post("/api/pierre/v1/missions", { headers: H(companyId), data: { instruction: "Vérifier les documents RH manquants" } })).status(), "mission while allowed").toBe(200);

    // suspend via the ORDERED commercial path
    const susp = await commercialEvent(page, { provider_event_id: "evt_susp", event_key: "commercial.subscription_suspended", subscription_reference: "sub_suspend", occurred_at: "2020-06-01T00:00:00Z" });
    expect((await applyCommercialEvent(page, susp.event_id!)).result).toBe("applied:suspended");
    const acc1 = await (await page.request.get("/api/pierre/v1/product-access", { headers: H(companyId) })).json();
    expect(acc1.access.decision).toBe("suspended");

    // READ continues; costly writes are refused by the API (not just the UI)
    expect((await page.request.get("/api/pierre/v1/missions", { headers: H(companyId) })).status(), "read under suspended").toBe(200);
    expect((await page.request.post("/api/pierre/v1/missions", { headers: H(companyId), data: { instruction: "x" } })).status(), "mission refused under suspended").toBe(403);
    expect((await page.request.post("/api/pierre/v1/invitations", { headers: H(companyId), data: { email: "x@e2e.test", roles: ["HR_MANAGER"] } })).status(), "invite refused under suspended").toBe(403);

    // reactivate (newer occurred_at) → access returns
    const react = await commercialEvent(page, { provider_event_id: "evt_react", event_key: "commercial.subscription_reactivated", subscription_reference: "sub_suspend", occurred_at: "2020-12-01T00:00:00Z" });
    expect((await applyCommercialEvent(page, react.event_id!)).result).toBe("applied:active");
    const acc2 = await (await page.request.get("/api/pierre/v1/product-access", { headers: H(companyId) })).json();
    expect(acc2.access.decision).toBe("allowed");
    expect((await page.request.post("/api/pierre/v1/missions", { headers: H(companyId), data: { instruction: "Reprise" } })).status(), "mission after reactivation").toBe(200);

    // no duplication
    const st = await state(page);
    expect(st.companies.length).toBe(1);
    expect(st.members.filter((m) => m.role === "owner" && m.status === "active").length).toBe(1);
    expect(st.entitlements.filter((e) => ["active", "grace", "suspended", "pending"].includes(e.status as string)).length).toBe(1);
    expect(st.activations.length).toBe(1);

    // a STALE old suspension event received after reactivation is ignored (does not regress)
    const stale = await commercialEvent(page, { provider_event_id: "evt_stale", event_key: "commercial.subscription_suspended", subscription_reference: "sub_suspend", occurred_at: "2020-02-01T00:00:00Z" });
    expect((await applyCommercialEvent(page, stale.event_id!)).result).toBe("ignored_stale");
    const acc3 = await (await page.request.get("/api/pierre/v1/product-access", { headers: H(companyId) })).json();
    expect(acc3.access.decision).toBe("allowed");
  });

  test("ownership: transfer, privilege switch and last-owner protection", async ({ page }) => {
    await reset(page);
    const a = await activateOwner(page, "sub_ownership");
    const companyId = a.companyId;

    // owner A invites B and C (real route, no raw token); deliver via the Fake mailbox
    for (const email of ["b_owner@e2e.test", "c_member@e2e.test"]) {
      expect((await page.request.post("/api/pierre/v1/invitations", { headers: H(companyId), data: { email, roles: ["HR_MANAGER"] } })).status(), `invite ${email}`).toBe(200);
    }
    await communicationTick(page);
    const mail = await mailbox(page, "invitation");
    const tokB = mail.find((m) => m.to === "b_owner@e2e.test")!.token!;
    const tokC = mail.find((m) => m.to === "c_member@e2e.test")!.token!;

    const b = await seedAndLogin(page, "b_owner@e2e.test");
    expect((await page.request.post("/api/pierre/v1/invitations/accept", { data: { token: tokB } })).status(), "B accept").toBe(200);
    const c = await seedAndLogin(page, "c_member@e2e.test");
    expect((await page.request.post("/api/pierre/v1/invitations/accept", { data: { token: tokC } })).status(), "C accept").toBe(200);

    const membershipOf = (st: Record<string, Array<Record<string, unknown>>>, userId: string) => st.members.find((m) => m.user_id === userId)!.id as string;
    let st = await state(page);
    const bM = membershipOf(st, b.user_id), cM = membershipOf(st, c.user_id);

    // A transfers ownership to B (A demoted to admin)
    await login(page, a.ownerId, a.email);
    expect((await page.request.post(`/api/pierre/v1/members/${bM}/transfer-ownership`, { headers: H(companyId), data: { demote_self: true } })).status(), "transfer A→B").toBe(200);
    st = await state(page);
    expect(st.members.find((m) => m.id === bM)!.role).toBe("owner");
    expect(st.members.find((m) => m.user_id === a.ownerId)!.role).toBe("admin");
    expect(st.active_owner_counts.find((r) => r.company_id === companyId)!.active_owners).toBe(1);

    // A (now admin) cannot perform the owner-only transfer → exactly 403
    expect((await page.request.post(`/api/pierre/v1/members/${cM}/transfer-ownership`, { headers: H(companyId), data: {} })).status(), "A not owner").toBe(403);

    // B (owner) suspends C, then cannot transfer ownership to a suspended target → exactly 409 (the
    // governed service rejects a non-active target with a business conflict).
    await login(page, b.user_id, b.email);
    expect((await page.request.post(`/api/pierre/v1/members/${cM}/suspend`, { headers: H(companyId), data: {} })).status(), "B suspends C").toBe(200);
    expect((await page.request.post(`/api/pierre/v1/members/${cM}/transfer-ownership`, { headers: H(companyId), data: {} })).status(), "transfer to suspended target → conflict").toBe(409);

    // B is the last active owner → cannot leave → exactly 409 (governed last-owner protection conflict)
    expect((await page.request.post("/api/pierre/v1/members/leave", { headers: H(companyId), data: {} })).status(), "last owner cannot leave").toBe(409);

    // B (owner) CAN transfer ownership back to the active admin A → exactly 200 (proves B's owner capability)
    const aM = membershipOf(st, a.ownerId);
    expect((await page.request.post(`/api/pierre/v1/members/${aM}/transfer-ownership`, { headers: H(companyId), data: { demote_self: true } })).status(), "transfer B→A").toBe(200);

    // an active owner always remains — never zero
    st = await state(page);
    expect(st.active_owner_counts.find((r) => r.company_id === companyId)!.active_owners).toBe(1);
  });
});
