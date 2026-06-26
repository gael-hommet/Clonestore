// src/lib/pierre/v1/__integration__/employee-import-scale.bench.ts
// PHASE 8.2-C — LOCAL scale benchmark: 10k-row CSV import (preview + commit +
// rollback), plus deep cursor pagination, 360-folder read, timeline and search at
// 10k, across two tenants. LOCAL only (PGlite, single connection) — NOT production,
// NOT a 100k proof.

import { describe, it, expect } from "vitest";
import { createHarness } from "./harness";
import { previewImport, commitImport, rollbackImport } from "../employee-import";
import { listEmployees, getEmployee360, employeeTimeline } from "../employees";
import { searchEmployees } from "../employee-search";

function pct(s: number[], p: number) { return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; }
function stats(x: number[]) { const s = [...x].sort((a, b) => a - b); return { p50: +pct(s, 50).toFixed(2), p95: +pct(s, 95).toFixed(2), p99: +pct(s, 99).toFixed(2) }; }
async function timed(fn: () => Promise<void>) { const t = performance.now(); await fn(); return performance.now() - t; }

function buildCsv(n: number): string {
  const lines = ["prénom,nom,matricule,email pro,poste,site"];
  for (let i = 1; i <= n; i++) lines.push(`Prénom${i},Nom${i},E${i},user${i}@acme.test,Poste${i % 7},PAR`);
  return lines.join("\n");
}

describe("PHASE 8.2-C — local employee CSV import scale (NOT production)", () => {
  it("10k-row import: preview / commit / rollback + read latencies at scale", async () => {
    const h = await createHarness();
    const ctx = h.ctx("A");
    const N = 10000;
    const csv = buildCsv(N);

    let batchId = "";
    const tPreview = await timed(async () => { const pv = await previewImport(h.db, ctx, { csv, idempotency_key: "bench-10k" }); batchId = pv.batch_id; });
    const tCommit = await timed(async () => { await commitImport(h.db, ctx, batchId); });

    const total = (await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_employees where company_id=$1", [h.companyA])).rows[0].n;

    // Read latencies at 10k.
    const list: number[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 50; i++) { list.push(await timed(async () => { const p = await listEmployees(h.db, ctx, { limit: 20, cursor }); cursor = p.next_cursor; })); if (!cursor) cursor = null; }
    const search: number[] = [];
    for (let i = 0; i < 50; i++) search.push(await timed(async () => { await searchEmployees(h.db, ctx, `nom${(i % N) + 1}`); }));
    const someId = (await h.db.query<{ id: string }>("select id from pierre_rt_employees where company_id=$1 limit 1", [h.companyA])).rows[0].id;
    const folder: number[] = [];
    for (let i = 0; i < 30; i++) folder.push(await timed(async () => { await getEmployee360(h.db, ctx, someId); }));
    const tl: number[] = [];
    for (let i = 0; i < 30; i++) tl.push(await timed(async () => { await employeeTimeline(h.db, ctx, someId); }));

    const tRollback = await timed(async () => { await rollbackImport(h.db, ctx, batchId); });

    /* eslint-disable no-console */
    console.log("\n=========== PHASE 8.2-C LOCAL IMPORT + 360 SCALE (NOT production) ===========");
    console.log("environment :", `${process.platform} node ${process.version} · PGlite (PG16) · single connection`);
    console.log(`\n[CSV import ${N} rows]`);
    console.log(`  preview   = ${tPreview.toFixed(0)}ms  (${(N / (tPreview / 1000)).toFixed(0)} rows/s)`);
    console.log(`  commit    = ${tCommit.toFixed(0)}ms  (${(N / (tCommit / 1000)).toFixed(0)} rows/s) inserted=${total}`);
    console.log(`  rollback  = ${tRollback.toFixed(0)}ms`);
    console.log(`\n[reads @ ${N}]`);
    console.log(`  list(20 cursor) p50=${stats(list).p50} p95=${stats(list).p95} p99=${stats(list).p99} ms`);
    console.log(`  search          p50=${stats(search).p50} p95=${stats(search).p95} p99=${stats(search).p99} ms`);
    console.log(`  360 folder      p50=${stats(folder).p50} p95=${stats(folder).p95} p99=${stats(folder).p99} ms`);
    console.log(`  timeline        p50=${stats(tl).p50} p95=${stats(tl).p95} p99=${stats(tl).p99} ms`);
    console.log("\nNOTE: local figures (single in-process connection). Production throughput +");
    console.log("      100k scale require a server Postgres + pg_trgm + load tests (NOT proven).");
    console.log("============================================================================\n");
    /* eslint-enable no-console */

    expect(total).toBe(N);
    expect(stats(list).p95).toBeLessThan(200);
    await h.close();
  }, 240000);
});
