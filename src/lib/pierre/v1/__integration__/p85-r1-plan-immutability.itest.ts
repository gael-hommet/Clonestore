// PHASE 8.5-R1 §R1.3 — a mission plan version is DB-immutable. Once created, plan_json / fingerprint /
// version_number / mission_id / company_id can NEVER change (even for the owner); the only permitted
// status transition is active → superseded, via the governed function. A delete is refused.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedRunWithJob, gov } from "./p85-helpers";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });
const refused = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };

describe("P8.5-R1 plan version DB immutability", () => {
  it("the plan body / fingerprint / version are frozen and a delete is refused (even superuser)", async () => {
    const { runId } = await seedRunWithJob(h, owner);
    const pv = (await h.db.query<{ plan_version_id: string }>(`select plan_version_id from pierre_rt_mission_runs where id=$1`, [runId])).rows[0].plan_version_id;
    expect(await refused(() => h.db.query(`update pierre_rt_mission_plan_versions set plan_json='{"tampered":true}' where id=$1`, [pv]))).toBe(true);
    expect(await refused(() => h.db.query(`update pierre_rt_mission_plan_versions set plan_fingerprint='different' where id=$1`, [pv]))).toBe(true);
    expect(await refused(() => h.db.query(`update pierre_rt_mission_plan_versions set version_number=42 where id=$1`, [pv]))).toBe(true);
    expect(await refused(() => h.db.query(`delete from pierre_rt_mission_plan_versions where id=$1`, [pv]))).toBe(true);
  });

  it("an illegal status transition is refused; active → superseded via the governed fn is allowed", async () => {
    const { runId } = await seedRunWithJob(h, owner);
    const pv = (await h.db.query<{ plan_version_id: string }>(`select plan_version_id from pierre_rt_mission_runs where id=$1`, [runId])).rows[0].plan_version_id;
    expect(await refused(() => h.db.query(`update pierre_rt_mission_plan_versions set status='active2' where id=$1`, [pv]))).toBe(true);
    await gov(h, owner, `select pierre_rt_supersede_plan_version($1,$2)`, [h.companyA, pv]);
    expect((await h.db.query<{ status: string }>(`select status from pierre_rt_mission_plan_versions where id=$1`, [pv])).rows[0].status).toBe("superseded");
  });
});
