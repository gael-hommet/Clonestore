// src/lib/pierre/v1/__integration__/employee-360-scale.bench.ts
// PHASE 8.2 — LOCAL scale benchmark: 1k and 10k employees in one tenant. Measures
// list / search / completeness / timeline latency at scale. LOCAL only (PGlite,
// single connection) — NOT production, NOT a 100k scale proof.

import { describe, it, expect } from "vitest";
import { createHarness } from "./harness";
import { listEmployees, createEmployee, EmployeeRepo } from "../employees";
import { searchEmployees } from "../employee-search";
import { computeEmployeeCompleteness } from "../completeness";

function pct(s: number[], p: number) { return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; }
function stats(x: number[]) { const s = [...x].sort((a, b) => a - b); return { p50: +pct(s, 50).toFixed(2), p95: +pct(s, 95).toFixed(2), p99: +pct(s, 99).toFixed(2) }; }
async function timed(fn: () => Promise<void>) { const t = performance.now(); await fn(); return performance.now() - t; }

async function bulkEmployees(db: import("../sql").SqlExecutor, companyId: string, n: number) {
  await db.query(
    `insert into pierre_rt_employees (id, company_id, first_name, last_name, employee_number, status, contract_type, sensitivity, search_text)
     select gen_random_uuid(), $1, 'First'||g, 'Last'||g, 'E'||g, 'active', 'cdi', 'normal',
            lower('first'||g||' last'||g||' e'||g)
     from generate_series(1, $2) g`, [companyId, n]);
}

describe("PHASE 8.2 — local Employee 360 scale benchmark", () => {
  it("1k and 10k employees: list / search / completeness (LOCAL, not production)", async () => {
    const h = await createHarness();
    const ctx = h.ctx("A");

    async function measure(n: number) {
      await h.db.query("delete from pierre_rt_employees where company_id=$1", [h.companyA]);
      const tInsert = await timed(async () => { await bulkEmployees(h.db, h.companyA, n); });
      const list: number[] = [];
      for (let i = 0; i < 50; i++) list.push(await timed(async () => { await listEmployees(h.db, ctx, { limit: 20 }); }));
      const search: number[] = [];
      for (let i = 0; i < 50; i++) search.push(await timed(async () => { await searchEmployees(h.db, ctx, `first${(i % n) + 1}`); }));
      // completeness on a real employee
      const someId = (await h.db.query<{ id: string }>("select id from pierre_rt_employees where company_id=$1 limit 1", [h.companyA])).rows[0].id;
      const comp: number[] = [];
      for (let i = 0; i < 30; i++) comp.push(await timed(async () => { await computeEmployeeCompleteness(h.db, ctx, someId); }));
      return { n, tInsert, list: stats(list), search: stats(search), comp: stats(comp) };
    }

    const r1k = await measure(1000);
    const r10k = await measure(10000);

    /* eslint-disable no-console */
    console.log("\n=========== PHASE 8.2 LOCAL EMPLOYEE-360 SCALE (NOT production) ===========");
    console.log("environment :", `${process.platform} node ${process.version} · PGlite (PG16) · single connection`);
    for (const r of [r1k, r10k]) {
      console.log(`\n[${r.n} employees]  insert=${r.tInsert.toFixed(0)}ms`);
      console.log(`  list(20)     p50=${r.list.p50} p95=${r.list.p95} p99=${r.list.p99} ms`);
      console.log(`  search       p50=${r.search.p50} p95=${r.search.p95} p99=${r.search.p99} ms`);
      console.log(`  completeness p50=${r.comp.p50} p95=${r.comp.p95} p99=${r.comp.p99} ms`);
    }
    console.log("\nNOTE: local figures (single in-process connection). Production p95 + 100k");
    console.log("      scale require a server Postgres + pg_trgm + load tests (NOT proven here).");
    console.log("==========================================================================\n");
    /* eslint-enable no-console */

    // sanity: at 10k, paginated reads stay bounded (indexed; no full-table scan blowup)
    expect(r10k.list.p95).toBeLessThan(150);
    await h.close();
    void EmployeeRepo; void createEmployee;
  }, 120000);
});
