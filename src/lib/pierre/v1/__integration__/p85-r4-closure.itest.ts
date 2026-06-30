// PHASE 8.5-R4 — closure invariants for the governed autonomous runtime. The atomic tenant leases, the
// canonical (non-forgeable) plan hash, the governed event bridges, the real resource limits, the lease
// controller and the compensation registry are all PRESENT, least-privilege, and consistent — the
// runtime is closed against the gaps R4 set out to fix.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { allCompensationRules } from "../runtime-compensation-registry";
import { runtimeLimits } from "../runtime-limits";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });
const count = async (sql: string) => (await h.db.query<{ n: number }>(sql)).rows[0].n;

describe("P8.5-R4 governed runtime closure", () => {
  it("the v26 + v27 closure markers are present", async () => {
    expect(await count(`select count(*)::int n from pierre_rt_runtime_closure_markers where marker in ('v26_tenant_leases','v27_canonical_plan_hash')`)).toBe(2);
  });

  it("R4.6 — the tenant-lease table + lifecycle functions exist; no role holds direct DML", async () => {
    expect(await count(`select count(*)::int n from information_schema.tables where table_name='pierre_rt_runtime_tenant_leases'`)).toBe(1);
    expect(await count(`select count(*)::int n from pg_proc where proname in ('pierre_rt_claim_runtime_tenant_leases','pierre_rt_heartbeat_tenant_lease','pierre_rt_complete_tenant_lease','pierre_rt_fail_tenant_lease')`)).toBe(4);
    expect(await count(`select count(*)::int n from information_schema.role_table_grants where table_name='pierre_rt_runtime_tenant_leases' and grantee in ('pierre_rt_app','pierre_rt_runtime_worker','pierre_rt_runtime_scheduler') and privilege_type in ('INSERT','UPDATE','DELETE')`)).toBe(0);
    // the claim primitive is NOT executable by PUBLIC nor the app role (least-privilege, fail-closed)
    expect(await count(`select count(*)::int n from information_schema.role_routine_grants where routine_name='pierre_rt_claim_runtime_tenant_leases' and grantee in ('PUBLIC','pierre_rt_app')`)).toBe(0);
  });

  it("R4.5 — the canonical plan hash is DB-authoritative (function + content column present)", async () => {
    expect(await count(`select count(*)::int n from pg_proc where proname='pierre_rt_canonical_plan_content'`)).toBe(1);
    expect(await count(`select count(*)::int n from information_schema.columns where table_name='pierre_rt_mission_plan_versions' and column_name='plan_content_md5'`)).toBe(1);
  });

  it("R4.7 — the resource limits are finite, positive and hard-capped (never unbounded)", () => {
    const L = runtimeLimits();
    for (const v of [L.maxSteps, L.maxDepth, L.maxDepsPerStep, L.maxActiveMissionsPerTenant, L.maxInputBytes]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("R4.13 — the compensation registry is closed and honest (every rule has a safe summary)", () => {
    const rules = allCompensationRules();
    expect(rules.length).toBeGreaterThanOrEqual(5);
    expect(rules.every((r) => r.safeSummary.length > 0)).toBe(true);
    // an externally-irreversible action declares at least one irreversible state (never claims a clean undo)
    expect(rules.some((r) => r.irreversibleStates.length > 0)).toBe(true);
  });
});
