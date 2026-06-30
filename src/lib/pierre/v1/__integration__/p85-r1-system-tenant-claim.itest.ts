// PHASE 8.5-R1 §R1.10 — a system tick discovers tenants WITH due work (it never trusts a free
// company_id). The tenant-claim returns a tenant that has a due job, and excludes a tenant with none.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { seedRunWithJob } from "./p85-helpers";

let h: Harness; let owner: TenantContext;
beforeEach(async () => { h = await createHarness(); owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); });
afterEach(async () => { await h.close(); });

describe("P8.5-R1 system tenant discovery", () => {
  it("claim_runtime_tenants returns tenants with due work and excludes tenants without any", async () => {
    await seedRunWithJob(h, owner); // tenant A has a queued job; tenant B has nothing
    const tenants = (await h.db.query<{ company_id: string }>(`select tenant_company_id as company_id from pierre_rt_claim_runtime_tenants(50, now())`)).rows.map((r) => r.company_id);
    expect(tenants).toContain(h.companyA);
    expect(tenants).not.toContain(h.companyB);
  });
});
