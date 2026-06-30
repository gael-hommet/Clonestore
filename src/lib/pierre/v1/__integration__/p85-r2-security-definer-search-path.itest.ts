// PHASE 8.5-R2 §R2.3 — every runtime SECURITY DEFINER function pins a fixed, safe search_path
// (pg_catalog, public), so it can never resolve a table/function from a caller-controlled schema.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

describe("P8.5-R2 SECURITY DEFINER search_path hardening", () => {
  it("NO pierre_rt SECURITY DEFINER function is missing a fixed search_path", async () => {
    const unhardened = (await h.db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prosecdef and p.proname like 'pierre_rt_%'
          and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))`)).rows;
    expect(unhardened.map((r) => r.proname)).toEqual([]);
  });

  it("the runtime claim/complete/fail functions carry search_path=pg_catalog, public", async () => {
    for (const fn of ["pierre_rt_runtime_claim", "pierre_rt_runtime_complete_job", "pierre_rt_runtime_fail_job", "pierre_rt_create_compiled_mission_run", "pierre_rt_apply_runtime_event"]) {
      const cfg = (await h.db.query<{ proconfig: string[] | null }>(`select proconfig from pg_proc where proname=$1 and prosecdef limit 1`, [fn])).rows[0]?.proconfig ?? [];
      expect(cfg.some((c) => /^search_path=/.test(c))).toBe(true);
    }
  });
});
