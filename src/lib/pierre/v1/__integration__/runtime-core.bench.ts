// src/lib/pierre/v1/__integration__/runtime-core.bench.ts
// PHASE 8.1 — LOCAL performance benchmark against real in-process Postgres
// (PGlite). These are LOCAL numbers on the dev machine, single in-process
// connection — NOT production figures and NOT a scale proof.

import { describe, it, expect } from "vitest";
import { createHarness } from "./harness";
import { apiCreateMission, apiListMissions } from "../api";
import { claimJobs } from "../queue";
import { drainQueue } from "../worker";

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function stats(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  return { n: s.length, p50: +pct(s, 50).toFixed(2), p95: +pct(s, 95).toFixed(2), p99: +pct(s, 99).toFixed(2), max: +Math.max(...s).toFixed(2) };
}
async function timed(fn: () => Promise<void>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

describe("PHASE 8.1 — local runtime benchmark", () => {
  it("measures create / list / claim / throughput (LOCAL, not production)", async () => {
    const h = await createHarness();
    const env = `${process.platform} node ${process.version} · PGlite (in-process PG16) · single connection`;

    // create mission
    const N = 200;
    const createSamples: number[] = [];
    let errors = 0;
    for (let i = 0; i < N; i++) {
      try { createSamples.push(await timed(async () => { await apiCreateMission(h.db, h.ctx("A"), { instruction: `Relancer le manager dossier ${i}`, idempotency_key: `b${i}` }); })); }
      catch { errors++; }
    }

    // list paginated
    const listSamples: number[] = [];
    for (let i = 0; i < 100; i++) listSamples.push(await timed(async () => { await apiListMissions(h.db, h.ctx("A"), { limit: 20 }); }));

    // claim (queue transition)
    const claimSamples: number[] = [];
    for (let i = 0; i < 100; i++) claimSamples.push(await timed(async () => { await claimJobs(h.db, { worker_id: `b${i}`, batch: 1, lease_ms: 5000 }); }));

    // throughput: drain everything
    // reset leases so drain can claim
    await h.db.query("update pierre_rt_jobs set status='ready', lease_owner=null, lease_expires_at=null, run_after=now() where status in ('leased','retry')");
    const drainStart = performance.now();
    const res = await drainQueue(h.db, { worker_id: "bench", batch: 25, lease_ms: 10000 }, 200);
    const drainMs = performance.now() - drainStart;
    const processed = res.succeeded + res.awaiting_integration + res.failed;
    const throughput = processed / (drainMs / 1000);

    const create = stats(createSamples);
    const list = stats(listSamples);
    const claim = stats(claimSamples);

    /* eslint-disable no-console */
    console.log("\n================ PHASE 8.1 LOCAL BENCHMARK (NOT production) ================");
    console.log("environment            :", env);
    console.log(`create mission  (n=${create.n}) : p50=${create.p50}ms p95=${create.p95}ms p99=${create.p99}ms max=${create.max}ms`);
    console.log(`list paginated  (n=${list.n}) : p50=${list.p50}ms p95=${list.p95}ms p99=${list.p99}ms max=${list.max}ms`);
    console.log(`queue claim     (n=${claim.n}) : p50=${claim.p50}ms p95=${claim.p95}ms p99=${claim.p99}ms max=${claim.max}ms`);
    console.log(`throughput      : ${processed} tasks in ${drainMs.toFixed(0)}ms = ${throughput.toFixed(1)} tasks/s`);
    console.log(`error rate      : ${errors}/${N} = ${((errors / N) * 100).toFixed(2)}%`);
    console.log("NOTE: local figures only. Production p95 + 100k scale require a real");
    console.log("      multi-connection Postgres + load tests (NOT proven here).");
    console.log("===========================================================================\n");
    /* eslint-enable no-console */

    // Sanity assertions (generous local budget — proves it isn't pathological).
    expect(errors).toBe(0);
    expect(create.p95).toBeLessThan(200);
    expect(list.p95).toBeLessThan(100);
    await h.close();
  });
});
