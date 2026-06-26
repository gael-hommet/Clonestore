// src/lib/pierre/v1/__integration__/tenancy-employee360.bench.ts
// PHASE 8.2 — LOCAL benchmark (real in-process Postgres via PGlite). Backfill
// throughput, tenant resolution p95, employee list p95. LOCAL figures only — NOT
// production, NOT a scale proof.

import { describe, it, expect } from "vitest";
import { createHarness } from "./harness";
import { newUuid } from "../sql";
import { runTenancyBackfill } from "../backfill";
import { resolveTenantContext } from "../tenant-context";
import { createEmployee, listEmployees } from "../employees";

function pct(s: number[], p: number) { return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; }
function stats(x: number[]) { const s = [...x].sort((a, b) => a - b); return { n: s.length, p50: +pct(s, 50).toFixed(2), p95: +pct(s, 95).toFixed(2), p99: +pct(s, 99).toFixed(2) }; }
async function timed(fn: () => Promise<void>) { const t = performance.now(); await fn(); return performance.now() - t; }

describe("PHASE 8.2 — local tenancy/Employee360 benchmark", () => {
  it("backfill throughput · tenant resolution p95 · employee list p95 (LOCAL)", async () => {
    const h = await createHarness();

    // Backfill of N legacy owners.
    const N = 200;
    await h.db.query(`create table if not exists orders (id uuid default gen_random_uuid(), user_id uuid, status text, email text)`);
    for (let i = 0; i < N; i++) await h.db.query(`insert into orders (user_id, status) values ($1,'active')`, [newUuid()]);
    const tBackfill = await timed(async () => { await runTenancyBackfill(h.db); });

    // Tenant resolution latency (owner of company A).
    const resolveSamples: number[] = [];
    for (let i = 0; i < 100; i++) resolveSamples.push(await timed(async () => { await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA }); }));

    // Employee list latency (seed then paginate).
    const ctx = h.ctx("A");
    for (let i = 0; i < 200; i++) await createEmployee(h.db, ctx, { first_name: `E${i}`, last_name: "Test" });
    const listSamples: number[] = [];
    for (let i = 0; i < 100; i++) listSamples.push(await timed(async () => { await listEmployees(h.db, ctx, { limit: 20 }); }));

    const resolveS = stats(resolveSamples);
    const listS = stats(listSamples);

    /* eslint-disable no-console */
    console.log("\n========== PHASE 8.2 LOCAL BENCHMARK (NOT production) ==========");
    console.log("environment        :", `${process.platform} node ${process.version} · PGlite (PG16) · single connection`);
    console.log(`backfill           : ${N} owners in ${tBackfill.toFixed(0)}ms = ${(N / (tBackfill / 1000)).toFixed(0)} owners/s`);
    console.log(`tenant resolution  : p50=${resolveS.p50}ms p95=${resolveS.p95}ms p99=${resolveS.p99}ms`);
    console.log(`employee list (20) : p50=${listS.p50}ms p95=${listS.p95}ms p99=${listS.p99}ms`);
    console.log("NOTE: local only. Production p95 + 100k scale need a server Postgres + load tests.");
    console.log("===============================================================\n");
    /* eslint-enable no-console */

    expect(resolveS.p95).toBeLessThan(100);
    expect(listS.p95).toBeLessThan(100);
    await h.close();
  });
});
