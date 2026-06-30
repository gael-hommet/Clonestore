// src/lib/pierre/v1/__integration__/p86-cockpit-real-data.itest.ts
// PHASE 8.6 — the cockpit snapshot aggregates REAL tenant data from the governed tables (no mocks). This
// exercises buildCockpitSnapshot against the real in-process schema and asserts the real company,
// entitlement, onboarding, overview counts and lists come back — and that a data error is NOT swallowed.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, provisionActiveCompany, type Harness } from "./harness";
import { resolveProductAccess } from "../entitlements";
import { buildCockpitSnapshot } from "../cockpit-snapshot";
import { newUuid } from "../sql";

let h: Harness;
beforeEach(async () => { h = await createHarness(); await provisionActiveCompany(h, h.companyA); });
afterEach(async () => { await h.close(); });

describe("P8.6 cockpit snapshot — real data, structured (no mocks/zeros-on-error)", () => {
  it("aggregates the real company, entitlement, onboarding, overview and sections", async () => {
    const ctx = h.ctx("A", "owner");
    const access = await resolveProductAccess(h.db, ctx);
    expect(access.decision).toBe("allowed");
    const snap = await buildCockpitSnapshot(h.db, ctx, access, "2026-06-29T00:00:00Z");

    expect(snap.company.id).toBe(h.companyA);
    expect(snap.product_access.decision).toBe("allowed");
    expect(snap.entitlement?.status).toBe("active");
    expect(snap.onboarding?.status).toBe("completed");
    // every overview field is a real number from the DB (not undefined / not a mock)
    for (const k of ["active_missions", "waiting_missions", "required_validations", "pending_documents", "pending_signatures", "blocked_communications", "active_members", "employees_count"] as const) {
      expect(typeof snap.overview[k]).toBe("number");
    }
    expect(snap.overview.active_members).toBeGreaterThanOrEqual(1); // the owner is a real active member
    expect(Array.isArray(snap.missions)).toBe(true);
    expect(snap.members.some((m) => m.user_id === h.userA)).toBe(true);
    expect(snap.next_action).toBe("launch_first_mission"); // entitled + onboarded + no missions yet
    expect(snap.blockers).toEqual([]);
  });

  it("reflects real rows (a count moves off its baseline from real data — not a constant)", async () => {
    const ctx = h.ctx("A", "owner");
    const access = await resolveProductAccess(h.db, ctx);
    const before = await buildCockpitSnapshot(h.db, ctx, access, "2026-06-29T00:00:00Z");
    const baseline = before.overview.active_members;

    const newUserId = newUuid();
    await h.pg.query(`insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'hr_manager')`, [newUuid(), h.companyA, newUserId]);

    const after = await buildCockpitSnapshot(h.db, ctx, access, "2026-06-29T00:00:00Z");
    expect(after.overview.active_members).toBe(baseline + 1);
    expect(after.members.some((m) => m.user_id === newUserId)).toBe(true);
  });

  it("propagates a data error as a thrown error (never a degraded zero/empty snapshot)", async () => {
    const ctx = h.ctx("A", "owner");
    const access = await resolveProductAccess(h.db, ctx);
    // a broken executor (simulating a DB failure) must make the snapshot THROW, not return zeros.
    const brokenDb = { query: async () => { throw new Error("db down"); }, transaction: async () => { throw new Error("db down"); } } as never;
    await expect(buildCockpitSnapshot(brokenDb, ctx, access, "2026-06-29T00:00:00Z")).rejects.toThrow();
  });
});
