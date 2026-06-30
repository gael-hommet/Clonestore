// PHASE 8.5-R4 §R4.6 — FAIRNESS. Tenants are claimed least-recently-served first, so a high-volume
// tenant can never starve another: with a limit of 1, the claim hands out the tenant whose last_claimed_at
// is oldest (a never-claimed tenant — null — sorts first).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { seedRunWithJob } from "./p85-helpers";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const NOW = "2026-07-04T12:00:00.000Z";
const claim = (holder: string, limit: number, now = NOW) =>
  h.db.query<{ tenant_company_id: string }>(
    `select tenant_company_id from pierre_rt_claim_runtime_tenant_leases('worker',$1,$2,300,$3::timestamptz)`,
    [holder, limit, now]);

describe("P8.5-R4 tenant fairness", () => {
  it("with limit 1, the least-recently-claimed tenant is served first", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    await seedRunWithJob(h, h.ctx("B"));
    // materialize lease rows, then make A the most-recently-served and B the stalest
    await claim("warm", 10);
    await h.db.query(`select pierre_rt_complete_tenant_lease($1,'worker','warm',lease_fencing,$2::timestamptz) from pierre_rt_runtime_tenant_leases where lease_scope='worker'`, [h.companyA, NOW]);
    await h.db.query(`update pierre_rt_runtime_tenant_leases set lease_holder=null, lease_expires_at=null, last_claimed_at=$2 where company_id=$1 and lease_scope='worker'`, [h.companyA, "2026-07-04T11:59:00.000Z"]); // A served 1 min ago
    await h.db.query(`update pierre_rt_runtime_tenant_leases set lease_holder=null, lease_expires_at=null, last_claimed_at=$2 where company_id=$1 and lease_scope='worker'`, [h.companyB, "2026-07-04T08:00:00.000Z"]); // B served 4 h ago (staler)

    const got = (await claim("fair", 1)).rows.map((r) => r.tenant_company_id);
    expect(got).toEqual([h.companyB]); // the staler tenant wins the single slot
  });

  it("a never-claimed tenant (null last_claimed_at) is served before any previously-served tenant", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    await seedRunWithJob(h, h.ctx("B"));
    // give A a prior claim history; B has never been claimed
    await claim("warm", 10);
    await h.db.query(`select pierre_rt_complete_tenant_lease($1,'worker','warm',lease_fencing,$2::timestamptz) from pierre_rt_runtime_tenant_leases where company_id=$1 and lease_scope='worker'`, [h.companyA, NOW]);
    // drop B's row so it is a pristine, never-claimed tenant again
    await h.db.query(`delete from pierre_rt_runtime_tenant_leases where company_id=$1 and lease_scope='worker'`, [h.companyB]);
    await h.db.query(`update pierre_rt_runtime_tenant_leases set lease_holder=null, lease_expires_at=null, last_claimed_at=$2 where company_id=$1 and lease_scope='worker'`, [h.companyA, "2026-07-04T11:00:00.000Z"]);

    const got = (await claim("fair", 1)).rows.map((r) => r.tenant_company_id);
    expect(got).toEqual([h.companyB]); // the never-claimed tenant (null) sorts first
  });
});
