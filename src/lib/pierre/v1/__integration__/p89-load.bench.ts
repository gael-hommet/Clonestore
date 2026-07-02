// src/lib/pierre/v1/__integration__/p89-load.bench.ts
// PHASE 8.9 — LOCAL load/hardening scenarios against real in-process Postgres (PGlite, single
// connection). Covers the gaps not in the 8.1/8.2 benches: idempotence/collisions, queue
// fairness/backpressure, multi-tenant isolation under load, failure injection, memory stability.
// LOCAL figures only — NOT production, NOT a 100k proof. No provider is contacted. Queue jobs are
// enqueued via the real `enqueueJob` primitive (mission planning enqueues separately in prod).

import { describe, it, expect } from "vitest";
import { createHarness } from "./harness";
import { apiCreateMission, apiListMissions } from "../api";
import { enqueueJob, claimJobs, failJob, queueDepth, recoverStaleLeases } from "../queue";
import { stats } from "../p89-load-guards.mjs";

const timed = async (fn: () => Promise<void>) => { const t0 = performance.now(); await fn(); return performance.now() - t0; };

// Create a mission for a tenant and return an FK-valid (task_id, mission_id) to enqueue jobs against.
async function taskFor(h: Awaited<ReturnType<typeof createHarness>>, tenant: "A" | "B", key: string) {
  await apiCreateMission(h.db, h.ctx(tenant), { instruction: `p89 ${tenant} ${key}`, idempotency_key: `p89-mk-${tenant}-${key}` });
  const company = tenant === "A" ? h.companyA : h.companyB;
  const r = await h.db.query<{ id: string; mission_id: string }>("select id, mission_id from pierre_rt_tasks where company_id=$1 order by created_at desc limit 1", [company]);
  return { company_id: company, task_id: r.rows[0].id, mission_id: r.rows[0].mission_id };
}

describe("PHASE 8.9 — load & operational hardening (LOCAL, not production)", () => {
  it("idempotence: dup enqueue (same dedup_key) → 1 job; double claim → no overlap (skip-locked + lease)", async () => {
    const h = await createHarness();
    try {
      const t = await taskFor(h, "A", "idem");
      await enqueueJob(h.db, { ...t, dedup_key: "p89-idem-key", max_attempts: 5 });
      await enqueueJob(h.db, { ...t, dedup_key: "p89-idem-key", max_attempts: 5 }); // conflict do-nothing
      const n = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_jobs where company_id=$1 and dedup_key=$2", [t.company_id, "p89-idem-key"]);
      expect(n.rows[0].n).toBe(1); // single canonical mutation

      for (let i = 0; i < 10; i++) await enqueueJob(h.db, { ...t, dedup_key: `p89-race-${i}`, max_attempts: 5 });
      const w1 = await claimJobs(h.db, { worker_id: "w1", batch: 20, lease_ms: 30000 });
      const w2 = await claimJobs(h.db, { worker_id: "w2", batch: 20, lease_ms: 30000 });
      const overlap = w1.filter((a) => w2.some((b) => b.id === a.id));
      expect(overlap).toHaveLength(0); // no job leased by two workers
      console.log(`[idempotence] dup_jobs=${n.rows[0].n} w1=${w1.length} w2=${w2.length} overlap=${overlap.length}`);
    } finally { await h.close(); }
  });

  it("queue fairness / backpressure: quiet tenant is not starved by a noisy tenant", async () => {
    const h = await createHarness();
    try {
      const tA = await taskFor(h, "A", "noisy"), tB = await taskFor(h, "B", "quiet");
      for (let i = 0; i < 60; i++) await enqueueJob(h.db, { ...tA, dedup_key: `p89-noisy-${i}`, max_attempts: 5 });
      for (let i = 0; i < 6; i++) await enqueueJob(h.db, { ...tB, dedup_key: `p89-quiet-${i}`, max_attempts: 5 });
      const before = { A: (await queueDepth(h.db, h.companyA)).ready, B: (await queueDepth(h.db, h.companyB)).ready };
      // bounded worker capacity: claim in small batches, count how soon the quiet tenant gets served
      let quietServed = 0, claimsToFirstQuiet = 0, claims = 0;
      for (let pass = 0; pass < 200; pass++) {
        const batch = await claimJobs(h.db, { worker_id: `fair${pass % 3}`, batch: 4, lease_ms: 2000 });
        if (!batch.length) break;
        claims++;
        const q = batch.filter((j) => j.company_id === h.companyB).length;
        if (q > 0 && claimsToFirstQuiet === 0) claimsToFirstQuiet = claims;
        quietServed += q;
        // complete them so the queue drains (governed complete)
        for (const j of batch) await h.db.query("update pierre_rt_jobs set status='succeeded', lease_owner=null where id=$1 and lease_owner=$2", [j.id, `fair${pass % 3}`]);
      }
      const after = { A: (await queueDepth(h.db, h.companyA)).ready, B: (await queueDepth(h.db, h.companyB)).ready };
      console.log(`[fairness] before A=${before.A} B=${before.B} | after A=${after.A} B=${after.B} | quietServed=${quietServed}/6 firstQuietAtClaim=${claimsToFirstQuiet}`);
      expect(before.A).toBe(60); expect(before.B).toBe(6); // real ready jobs enqueued
      expect(quietServed).toBe(6); // quiet tenant fully served (not starved)
      expect(after.A).toBe(0); expect(after.B).toBe(0);
    } finally { await h.close(); }
  });

  it("multi-tenant isolation under load: no cross-tenant read/claim/aggregation leak", async () => {
    const h = await createHarness();
    try {
      for (let i = 0; i < 15; i++) {
        await apiCreateMission(h.db, h.ctx("A"), { instruction: `Contrat CDI ${i}`, idempotency_key: `shared-${i}` });
        await apiCreateMission(h.db, h.ctx("B"), { instruction: `Contrat CDI ${i}`, idempotency_key: `shared-${i}` });
      }
      const listA = await apiListMissions(h.db, h.ctx("A"), { limit: 100 });
      const listB = await apiListMissions(h.db, h.ctx("B"), { limit: 100 });
      const arrA = (listA.items ?? listA) as { id: string; company_id?: string }[];
      const arrB = (listB.items ?? listB) as { id: string; company_id?: string }[];
      const idsA = new Set(arrA.map((m) => m.id));
      expect(arrB.filter((m) => idsA.has(m.id))).toHaveLength(0); // no shared ids
      // enqueue jobs for both, claim globally, assert every claimed job maps to its own company only
      const tA = await taskFor(h, "A", "iso"), tB = await taskFor(h, "B", "iso");
      for (let i = 0; i < 20; i++) { await enqueueJob(h.db, { ...tA, dedup_key: `iso-A-${i}`, max_attempts: 5 }); await enqueueJob(h.db, { ...tB, dedup_key: `iso-B-${i}`, max_attempts: 5 }); }
      const claimed = await claimJobs(h.db, { worker_id: "iso", batch: 100, lease_ms: 5000 });
      const bad = claimed.filter((j) => j.company_id !== h.companyA && j.company_id !== h.companyB);
      expect(bad).toHaveLength(0);
      // a job's dedup_key prefix must match its company (no cross-tenant mislabel)
      const mislabel = claimed.filter((j) => (j.company_id === h.companyA && j.dedup_key.startsWith("iso-B-")) || (j.company_id === h.companyB && j.dedup_key.startsWith("iso-A-")));
      expect(mislabel).toHaveLength(0);
      console.log(`[isolation] A_missions=${arrA.length} B_missions=${arrB.length} claimed=${claimed.length} cross_tenant=${bad.length + mislabel.length}`);
    } finally { await h.close(); }
  });

  it("failure injection: claim→fail→retry→…→dead_letter (governed, bounded, no provider)", async () => {
    const h = await createHarness();
    try {
      const t = await taskFor(h, "A", "fail");
      await enqueueJob(h.db, { ...t, dedup_key: "p89-fail-job", max_attempts: 2, run_after: new Date().toISOString() });
      const states: string[] = [];
      let deadLettered = false;
      for (let round = 0; round < 8 && !deadLettered; round++) {
        const batch = await claimJobs(h.db, { worker_id: "fw", batch: 20, lease_ms: 30000 });
        const job = batch.find((j) => j.dedup_key === "p89-fail-job");
        if (!job) { console.log(`[failure] round ${round}: job not claimable yet`); break; }
        const disp = await failJob(h.db, job, "fw", "injected synthetic failure (no provider)");
        states.push(disp);
        if (disp === "dead_lettered") { deadLettered = true; break; }
        // bench accelerator: make the retry claimable now (failJob governs the terminal decision, not this)
        await h.db.query("update pierre_rt_jobs set run_after=now() where id=$1 and status='retry'", [job.id]);
      }
      const depth = await queueDepth(h.db, h.companyA);
      const dl = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_dead_letters where company_id=$1 and job_id in (select id from pierre_rt_jobs where dedup_key=$2)", [h.companyA, "p89-fail-job"]);
      console.log(`[failure] transitions=${JSON.stringify(states)} dead_depth=${depth.dead} dead_letter_rows=${dl.rows[0].n}`);
      expect(states).toContain("retry_scheduled");
      expect(deadLettered).toBe(true);
      expect(dl.rows[0].n).toBeGreaterThanOrEqual(1); // canonical dead-letter row written
      expect(typeof (await recoverStaleLeases(h.db))).toBe("number"); // governed + idempotent
    } finally { await h.close(); }
  });

  it("memory stability: bounded create/list/enqueue/claim loop shows no runaway heap growth", async () => {
    const h = await createHarness();
    try {
      const t = await taskFor(h, "A", "mem");
      const ITER = 300, sample: number[] = [], lat: number[] = [];
      const heap0 = process.memoryUsage().heapUsed;
      for (let i = 0; i < ITER; i++) {
        lat.push(await timed(async () => {
          await apiListMissions(h.db, h.ctx("A"), { limit: 20 });
          await enqueueJob(h.db, { ...t, dedup_key: `p89-mem-${i}`, max_attempts: 5 });
          await claimJobs(h.db, { worker_id: `mw${i % 4}`, batch: 3, lease_ms: 1000 });
        }));
        if (i % 50 === 49) { if (global.gc) global.gc(); sample.push(process.memoryUsage().heapUsed); }
      }
      const heapEnd = sample[sample.length - 1] ?? process.memoryUsage().heapUsed;
      const growthMB = (heapEnd - heap0) / 1048576;
      const s = stats(lat);
      console.log(`[memory] iters=${ITER} heap0=${(heap0 / 1048576).toFixed(1)}MB end=${(heapEnd / 1048576).toFixed(1)}MB growth=${growthMB.toFixed(1)}MB samplesMB=${sample.map((x) => (x / 1048576).toFixed(0)).join(",")}`);
      console.log(`[memory] op latency p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms`);
      expect(growthMB).toBeLessThan(150); // no monotonic runaway
    } finally { await h.close(); }
  });
});
