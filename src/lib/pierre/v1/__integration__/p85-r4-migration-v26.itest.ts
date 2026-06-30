// PHASE 8.5-R4 §R4.4 — v26 is a UNIQUE, additive migration that applies cleanly on v1→v25 and is REALLY
// idempotent: re-executing it raises no error, creates no duplicate marker, and the lease table/functions
// exist with the correct least-privilege EXECUTE grants.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG = resolve(process.cwd(), "supabase/migrations");
const FILES = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const V26 = FILES.find((f) => f.includes("pierre_v26"))!;
const upToV25 = FILES.filter((f) => f < V26);

let pg: PGlite;
beforeAll(async () => { pg = await PGlite.create(); for (const f of upToV25) await pg.exec(readFileSync(resolve(MIG, f), "utf-8")); });
afterAll(async () => { await pg.close(); });
const count = async (sql: string) => (await pg.query<{ n: number }>(sql)).rows[0].n;

describe("P8.5-R4 v26 migration truth", () => {
  it("v26 exists, is unique (one pierre_v26 file), and applies cleanly on v1→v25", async () => {
    expect(V26).toBeTruthy();
    expect(FILES.filter((f) => f.includes("pierre_v26")).length).toBe(1);
    await expect(pg.exec(readFileSync(resolve(MIG, V26), "utf-8"))).resolves.not.toThrow();
  });

  it("the lease table and its four governed functions exist", async () => {
    expect(await count(`select count(*)::int n from information_schema.tables where table_name='pierre_rt_runtime_tenant_leases'`)).toBe(1);
    expect(await count(`select count(*)::int n from pg_proc where proname in ('pierre_rt_claim_runtime_tenant_leases','pierre_rt_heartbeat_tenant_lease','pierre_rt_complete_tenant_lease','pierre_rt_fail_tenant_lease')`)).toBe(4);
  });

  it("the worker and scheduler roles hold EXECUTE on the claim primitive (least-privilege, no DML)", async () => {
    expect(await count(`select count(*)::int n from information_schema.role_routine_grants where routine_name='pierre_rt_claim_runtime_tenant_leases' and grantee in ('pierre_rt_runtime_worker','pierre_rt_runtime_scheduler') and privilege_type='EXECUTE'`)).toBe(2);
    // no role was granted direct DML on the lease table
    expect(await count(`select count(*)::int n from information_schema.role_table_grants where table_name='pierre_rt_runtime_tenant_leases' and grantee in ('pierre_rt_app','pierre_rt_runtime_worker','pierre_rt_runtime_scheduler') and privilege_type in ('INSERT','UPDATE','DELETE')`)).toBe(0);
  });

  it("re-applying v26 is idempotent (no error, no duplicate marker)", async () => {
    const before = await count(`select count(*)::int n from pierre_rt_runtime_closure_markers`);
    await expect(pg.exec(readFileSync(resolve(MIG, V26), "utf-8"))).resolves.not.toThrow();
    const after = await count(`select count(*)::int n from pierre_rt_runtime_closure_markers`);
    expect(after).toBe(before);
    expect(await count(`select count(*)::int n from pierre_rt_runtime_closure_markers where marker='v26_tenant_leases'`)).toBe(1);
  });
});
