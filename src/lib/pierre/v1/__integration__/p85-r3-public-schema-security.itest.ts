// PHASE 8.5-R3 §R3.3 — the search_path=public pinning is only safe because no untrusted role may CREATE
// in `public`. v25 revokes CREATE on schema public from PUBLIC and from the app/runtime roles, so a
// SECURITY DEFINER function can never resolve a planted object that shadows a runtime relation/function.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { asRole, refused } from "./p84-r1-helpers";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });
const has = async (sql: string) => ((await h.db.query<{ n: number }>(sql)).rows[0].n > 0);

describe("P8.5-R3 public schema security", () => {
  it("PUBLIC holds no CREATE on schema public", async () => {
    expect(await has(`select count(*)::int n from information_schema.role_usage_grants where 1=0`)).toBe(false); // (no-op guard)
    // has_schema_privilege('public', 'public', 'CREATE') must be false
    const can = (await h.db.query<{ ok: boolean }>(`select has_schema_privilege('public','public','CREATE') as ok`)).rows[0].ok;
    expect(can).toBe(false);
  });

  it("the app + runtime roles cannot CREATE a table/function in public", async () => {
    expect(await refused(() => asRole(h, "pierre_rt_app", h.companyA, (q) => q(`create table public.evil_app (x int)`)))).toBe(true);
    expect(await refused(() => asRole(h, "pierre_rt_runtime_worker", h.companyA, (q) => q(`create table public.evil_worker (x int)`)))).toBe(true);
    expect(await refused(() => asRole(h, "pierre_rt_runtime_planner", h.companyA, (q) => q(`create table public.evil_planner (x int)`)))).toBe(true);
  });

  it("every pierre_rt SECURITY DEFINER function still has a fixed search_path (post-v25)", async () => {
    const unhardened = (await h.db.query<{ n: number }>(
      `select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prosecdef and p.proname like 'pierre_rt_%'
          and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))`)).rows[0].n;
    expect(unhardened).toBe(0);
  });
});
