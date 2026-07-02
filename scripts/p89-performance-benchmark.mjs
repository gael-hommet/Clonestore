// scripts/p89-performance-benchmark.mjs
// PHASE 8.9 — reproducible LOCAL load/performance harness. Anti-Production (refuses any prod target
// / clonestore.pro / real provider), synthetic-only (PGlite + `p89-load-*` data), writes JSON metrics
// under .p89-proofs/<run_id>/, auto-cleans, and refuses a green verdict if cleanup fails.
// Run with tsx:  npx tsx scripts/p89-performance-benchmark.mjs --local [--iterations=N] [--seed=S]
// Modes: --dry-run (default, no mutation) | --local (PGlite synthetic).

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const MODE = has("--local") ? "local" : "dry-run";
const ITER = Math.max(1, Math.min(2000, Number(val("iterations", "200"))));
const SEED = val("seed", "p89");
const CLEANUP = val("cleanup", "true") !== "false";
const log = (m) => process.stderr.write(`[p89] ${m}\n`);

const guards = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/p89-load-guards.mjs")).href);
// hard anti-Production gate BEFORE anything
let ack;
try { ack = guards.assertSyntheticBenchEnv({ mode: MODE, env: process.env }); }
catch (e) { process.stderr.write(`\n[p89] REFUSED — ${e.message}\n`); process.exit(2); }

const RUN_ID = `p89-${createHash("sha1").update(`${SEED}:${MODE}:${ITER}`).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p89-proofs", RUN_ID);
const writeProof = (name, obj) => { mkdirSync(proofDir, { recursive: true }); writeFileSync(join(proofDir, name), JSON.stringify({ run_id: RUN_ID, ...obj }, null, 2)); };

if (MODE === "dry-run") {
  log(`DRY RUN — engine=${ack.engine} providers=${ack.providers}. Would run ${ITER} iterations of throughput/idempotence/isolation/failure/memory against a fresh PGlite synthetic DB, write .p89-proofs/${RUN_ID}/, then auto-clean. No mutation performed.`);
  process.exit(0);
}

const { createHarness } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/__integration__/harness.ts")).href);
const { apiCreateMission } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/api.ts")).href);
const { enqueueJob, claimJobs, failJob, queueDepth } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/queue.ts")).href);

const timed = async (fn) => { const t0 = performance.now(); await fn(); return performance.now() - t0; };
const heap = () => process.memoryUsage().heapUsed;

async function taskFor(h, tenant, key) {
  await apiCreateMission(h.db, h.ctx(tenant), { instruction: `p89 ${tenant} ${key}`, idempotency_key: `p89-mk-${tenant}-${key}` });
  const company = tenant === "A" ? h.companyA : h.companyB;
  const r = await h.db.query("select id, mission_id from pierre_rt_tasks where company_id=$1 order by created_at desc limit 1", [company]);
  return { company_id: company, task_id: r.rows[0].id, mission_id: r.rows[0].mission_id };
}

let green = true; const metrics = { mode: MODE, iterations: ITER, engine: ack.engine, node: process.version, platform: process.platform, invariants: {}, latency: {}, cleanup: {} };
const h = await createHarness();
try {
  const heap0 = heap();
  const t = await taskFor(h, "A", "thru");

  // throughput + latency: enqueue → claim → complete
  const enq = [], clm = [];
  for (let i = 0; i < ITER; i++) enq.push(await timed(async () => { await enqueueJob(h.db, { ...t, dedup_key: `p89-${SEED}-${i}`, max_attempts: 5 }); }));
  const start = performance.now(); let processed = 0;
  for (let pass = 0; pass < ITER; pass++) {
    const batch = await timedClaim(clm, () => claimJobs(h.db, { worker_id: `w${pass % 4}`, batch: 25, lease_ms: 5000 }));
    if (!batch.length) break;
    for (const j of batch) { await h.db.query("update pierre_rt_jobs set status='succeeded', lease_owner=null where id=$1 and lease_owner=$2", [j.id, `w${pass % 4}`]); processed++; }
  }
  const throughput = processed / ((performance.now() - start) / 1000);
  metrics.latency.enqueue = guards.stats(enq);
  metrics.latency.claim = guards.stats(clm);
  metrics.throughput_jobs_per_s = +throughput.toFixed(1);
  metrics.processed = processed;

  // idempotence
  await enqueueJob(h.db, { ...t, dedup_key: "p89-dup", max_attempts: 5 });
  await enqueueJob(h.db, { ...t, dedup_key: "p89-dup", max_attempts: 5 });
  const dup = (await h.db.query("select count(*)::int n from pierre_rt_jobs where company_id=$1 and dedup_key='p89-dup'", [h.companyA])).rows[0].n;
  metrics.invariants.idempotent_enqueue = dup === 1; green &&= dup === 1;

  // isolation
  const tB = await taskFor(h, "B", "iso");
  for (let i = 0; i < 20; i++) { await enqueueJob(h.db, { ...t, dedup_key: `isoA-${i}`, max_attempts: 5 }); await enqueueJob(h.db, { ...tB, dedup_key: `isoB-${i}`, max_attempts: 5 }); }
  const claimed = await claimJobs(h.db, { worker_id: "iso", batch: 200, lease_ms: 5000 });
  const cross = claimed.filter((j) => (j.company_id === h.companyA && j.dedup_key.startsWith("isoB-")) || (j.company_id === h.companyB && j.dedup_key.startsWith("isoA-")));
  metrics.invariants.no_cross_tenant = cross.length === 0; green &&= cross.length === 0;
  for (const j of claimed) await h.db.query("update pierre_rt_jobs set status='succeeded', lease_owner=null where id=$1", [j.id]);

  // failure → dead-letter
  await enqueueJob(h.db, { ...t, dedup_key: "p89-dl", max_attempts: 2, run_after: new Date().toISOString() });
  let dead = false; const states = [];
  for (let r = 0; r < 8 && !dead; r++) {
    const b = await claimJobs(h.db, { worker_id: "fw", batch: 50, lease_ms: 30000 });
    const job = b.find((j) => j.dedup_key === "p89-dl"); if (!job) break;
    const disp = await failJob(h.db, job, "fw", "injected synthetic (no provider)"); states.push(disp);
    if (disp === "dead_lettered") dead = true; else await h.db.query("update pierre_rt_jobs set run_after=now() where id=$1 and status='retry'", [job.id]);
  }
  metrics.invariants.retry_then_dead_letter = dead && states.includes("retry_scheduled"); green &&= metrics.invariants.retry_then_dead_letter;
  metrics.failure_transitions = states;

  // memory
  const growthMB = (heap() - heap0) / 1048576;
  metrics.memory = { heap0_mb: +(heap0 / 1048576).toFixed(1), heap_end_mb: +(heap() / 1048576).toFixed(1), growth_mb: +growthMB.toFixed(1) };
  metrics.invariants.no_runaway_heap = growthMB < 200; green &&= growthMB < 200;

  writeProof("metrics.json", metrics);
  log(`metrics: throughput=${metrics.throughput_jobs_per_s}/s claim_p95=${metrics.latency.claim.p95}ms idempotent=${metrics.invariants.idempotent_enqueue} isolation=${metrics.invariants.no_cross_tenant} dead_letter=${metrics.invariants.retry_then_dead_letter} heap_growth=${metrics.memory.growth_mb}MB`);
} catch (e) {
  green = false; metrics.error = String(e?.message || e).slice(0, 200); writeProof("metrics.json", metrics); log(`ERROR: ${metrics.error}`);
} finally {
  // auto-clean: PGlite is ephemeral in-process — closing drops the whole synthetic DB. Verify + record.
  try { await h.close(); metrics.cleanup.harness_closed = true; } catch (e) { metrics.cleanup.harness_closed = false; metrics.cleanup.err = String(e?.message || e).slice(0, 120); }
  const cleanupOk = metrics.cleanup.harness_closed === true;
  metrics.cleanup.ok = cleanupOk; writeProof("cleanup-proof.json", { cleanup: metrics.cleanup, synthetic_db: "ephemeral pglite dropped on close", residue: cleanupOk ? "none" : "unknown" });
  green &&= cleanupOk;
  log(`VERDICT ${green ? "GREEN" : "RED"} — proofs .p89-proofs/${RUN_ID}/ cleanup=${cleanupOk}`);
  process.exit(green ? 0 : 1);
}

async function timedClaim(sink, fn) { const t0 = performance.now(); const r = await fn(); sink.push(performance.now() - t0); return r; }
