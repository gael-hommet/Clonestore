// PHASE 8.5-R4 §R4.6 — ATOMIC TENANT LEASES. Tenant discovery now hands a tenant to exactly one holder
// at a time: a claimed (un-expired) tenant is NOT re-handed to a second holder; the lease carries a
// monotonic fencing token bumped on every claim; heartbeat/complete/fail are guarded by holder+fencing
// (a stale holder is refused, a terminal op is idempotent); an expired lease is reclaimable (fencing
// bumped). The claim primitive is callable only by the worker/scheduler roles (the app role is refused).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { seedRunWithJob } from "./p85-helpers";
import { asRole, refused } from "./p84-r1-helpers";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

const NOW = "2026-07-04T10:00:00.000Z";
const claim = (holder: string, now = NOW, scope = "worker", limit = 10, lease = 300) =>
  h.db.query<{ tenant_company_id: string; lease_fencing: number }>(
    `select tenant_company_id, lease_fencing from pierre_rt_claim_runtime_tenant_leases($1,$2,$3,$4,$5::timestamptz)`,
    [scope, holder, limit, lease, now]);

describe("P8.5-R4 atomic tenant leases", () => {
  it("a claimed tenant is not re-handed to a second holder until released/expired", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    await seedRunWithJob(h, h.ctx("B"));

    const first = (await claim("holder-1")).rows;
    expect(first.map((r) => r.tenant_company_id).sort()).toEqual([h.companyA, h.companyB].sort());
    expect(first.every((r) => Number(r.lease_fencing) === 1)).toBe(true);

    // a second holder, while both are leased and un-expired, receives NOTHING
    const second = (await claim("holder-2")).rows;
    expect(second).toEqual([]);
  });

  it("heartbeat/complete are guarded by holder + fencing; a terminal op is idempotent", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    const fencing = Number((await claim("holder-1")).rows.find((r) => r.tenant_company_id === h.companyA)!.lease_fencing);

    // the wrong holder is refused
    expect(await refused(() => h.db.query(`select pierre_rt_heartbeat_tenant_lease($1,'worker','intruder',$2,300,$3::timestamptz)`, [h.companyA, fencing, NOW]))).toBe(true);
    // a stale fencing is refused
    expect(await refused(() => h.db.query(`select pierre_rt_complete_tenant_lease($1,'worker','holder-1',$2,$3::timestamptz)`, [h.companyA, fencing + 999, NOW]))).toBe(true);
    // the rightful holder heartbeats then completes
    expect((await h.db.query<{ ok: boolean }>(`select pierre_rt_heartbeat_tenant_lease($1,'worker','holder-1',$2,300,$3::timestamptz) ok`, [h.companyA, fencing, NOW])).rows[0].ok).toBe(true);
    expect((await h.db.query<{ ok: boolean }>(`select pierre_rt_complete_tenant_lease($1,'worker','holder-1',$2,$3::timestamptz) ok`, [h.companyA, fencing, NOW])).rows[0].ok).toBe(true);
    // re-completing an already-released lease is a no-op (idempotent), NOT a raise
    expect((await h.db.query<{ ok: boolean }>(`select pierre_rt_complete_tenant_lease($1,'worker','holder-1',$2,$3::timestamptz) ok`, [h.companyA, fencing, NOW])).rows[0].ok).toBe(false);
  });

  it("a released lease is reclaimable with a BUMPED fencing token", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    const f1 = Number((await claim("holder-1")).rows[0].lease_fencing);
    await h.db.query(`select pierre_rt_complete_tenant_lease($1,'worker','holder-1',$2,$3::timestamptz)`, [h.companyA, f1, NOW]);
    const re = (await claim("holder-2")).rows.find((r) => r.tenant_company_id === h.companyA)!;
    expect(Number(re.lease_fencing)).toBe(f1 + 1); // monotonic — the old holder is now fenced
  });

  it("an expired lease is reclaimable by another holder", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    await claim("holder-1", NOW, "worker", 10, 60); // 60s lease from 10:00:00
    const beforeExpiry = (await claim("holder-2", "2026-07-04T10:00:30.000Z")).rows; // 30s later — still held
    expect(beforeExpiry).toEqual([]);
    const afterExpiry = (await claim("holder-2", "2026-07-04T10:02:00.000Z")).rows; // 2min later — expired
    expect(afterExpiry.map((r) => r.tenant_company_id)).toEqual([h.companyA]);
  });

  it("the claim primitive is callable by the worker/scheduler roles but refused for the app role", async () => {
    await seedRunWithJob(h, h.ctx("A"));
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(`select pierre_rt_claim_runtime_tenant_leases('worker','h',10,300,$1::timestamptz)`, [NOW])))).toBe(true);
    const asWorker = await asRole(h, "pierre_rt_runtime_worker", h.companyA, (q) => q(`select tenant_company_id from pierre_rt_claim_runtime_tenant_leases('worker','h',10,300,$1::timestamptz)`, [NOW]));
    expect(asWorker.rows.length).toBeGreaterThanOrEqual(1);
  });
});
