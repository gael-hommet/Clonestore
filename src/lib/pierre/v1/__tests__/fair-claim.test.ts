// src/lib/pierre/v1/__tests__/fair-claim.test.ts
// PHASE 8.9 — the tenant-fair claim primitive. Reproduces the global-queue fairness
// defect (a noisy tenant's older backlog monopolizes the oldest-first candidate window)
// and proves fairClaimRound()/claimJobsForTenant() fix it without a schema change: every
// active tenant is served in one round, the noisy tenant is capped to its quota, and the
// FOR UPDATE SKIP LOCKED no-double-claim guarantee is preserved.

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { createHarness, type Harness } from "../__integration__/harness";
import { claimJobs } from "../queue";
import { claimJobsForTenant, fairClaimRound, dueTenants } from "../fair-claim";
import { newUuid } from "../sql";

// E1.1 — STABILISATION DU HARNESS (l'assertion d'équité n'est PAS touchée).
// Ce test d'intégration monte une vraie base PGlite et insère ~215 travaux : il dépasse
// légitimement le délai vitest PAR DÉFAUT (5 000 ms) dès que la machine est chargée par des
// suites parallèles — d'où un échec « Test timed out in 5000ms » intermittent, jamais un
// défaut produit. Deux corrections déterministes :
//   1. le harnais est monté dans un hook (son coût de démarrage ne s'impute plus au test) ;
//   2. le délai est déclaré DANS le fichier, au lieu de dépendre d'un drapeau de ligne de
//      commande que la suite complète n'utilise pas forcément.
const DB_TIMEOUT_MS = 120_000;

let h: Harness;
beforeAll(async () => { h = await createHarness(); }, DB_TIMEOUT_MS);
afterAll(async () => { if (h) await h.close(); }, DB_TIMEOUT_MS); // nettoyage garanti

async function makeTenant(name: string): Promise<string> {
  const cid = newUuid();
  await h.pg.query("insert into pierre_rt_companies (id, name) values ($1,$2)", [cid, name]);
  await h.pg.query("insert into pierre_rt_members (id, company_id, user_id, role) values ($1,$2,$3,'owner')", [newUuid(), cid, newUuid()]);
  return cid;
}
async function makeTask(cid: string): Promise<{ task: string; mission: string }> {
  const mission = newUuid(); const task = newUuid();
  await h.pg.query(
    `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, correlation_id, request_id, idempotency_key)
     values ($1,$2,$3,'fair test',$4,$5,$6)`, [mission, cid, newUuid(), newUuid(), newUuid(), `mk-${mission}`]);
  await h.pg.query(
    `insert into pierre_rt_tasks (id, company_id, mission_id, type, objective, idempotency_key)
     values ($1,$2,$3,'noop','fair task',$4)`, [task, cid, mission, `tk-${task}`]);
  return { task, mission };
}
async function enqueue(cid: string, t: { task: string; mission: string }, n: number, tag: string, ageSeconds: number): Promise<void> {
  await h.pg.query(
    `insert into pierre_rt_jobs (id, company_id, task_id, mission_id, status, priority, run_after, max_attempts, dedup_key)
     select gen_random_uuid(), $1, $2, $3, 'ready', 100, now() - ($5 || ' seconds')::interval, 5, $4 || '-' || g
     from generate_series(1,$6) g`, [cid, t.task, t.mission, tag, String(ageSeconds), n]);
}
const resetJobs = () => h.pg.query("update pierre_rt_jobs set status='ready', lease_owner=null, lease_expires_at=null, attempts=0");

describe("fair-claim primitive", () => {
  it("reproduces the defect: global claimJobs lets a noisy tenant monopolize; fairClaimRound serves everyone", async () => {
    const noisy = await makeTenant("noisy");
    const normals = [await makeTenant("n1"), await makeTenant("n2"), await makeTenant("n3"), await makeTenant("n4")];
    const noisyTask = await makeTask(noisy);
    await enqueue(noisy, noisyTask, 200, "noisy", 3600); // 200 OLDER jobs (1h ago) → sort first globally
    const normalTasks: Record<string, { task: string; mission: string }> = {};
    for (const c of normals) { normalTasks[c] = await makeTask(c); await enqueue(c, normalTasks[c], 3, "n", 1); } // 3 NEWER jobs each

    // ── BEFORE: global claim, two batches of 25 → all go to the noisy tenant (oldest-first) ──
    const served = new Set<string>();
    for (let r = 0; r < 2; r++) {
      const jobs = await claimJobs(h.db, { worker_id: "g", batch: 25, lease_ms: 30000 });
      for (const j of jobs) served.add(j.company_id);
    }
    const normalsServedGlobally = normals.filter((c) => served.has(c)).length;
    expect(served.has(noisy)).toBe(true);
    expect(normalsServedGlobally).toBe(0); // DEFECT: 50 claims, not one quiet tenant served

    // ── AFTER: fair round over all due tenants, quota 2/tenant → every tenant served in ONE round ──
    await resetJobs();
    const tenants = await dueTenants(h.db, 5000);
    expect(tenants.length).toBe(5);
    const claimed = await fairClaimRound(h.db, { worker_id: "f", tenants, maxPerTenant: 2, lease_ms: 30000 });
    const byTenant = new Map<string, number>();
    for (const j of claimed) byTenant.set(j.company_id, (byTenant.get(j.company_id) ?? 0) + 1);
    // no tenant exceeds its quota, and every normal tenant is served this round (no starvation)
    for (const [, n] of byTenant) expect(n).toBeLessThanOrEqual(2);
    expect(byTenant.get(noisy)).toBe(2);                       // noisy capped at its fair quota (had 200 ready)
    for (const c of normals) expect(byTenant.get(c)).toBe(2);  // each quiet tenant served its quota this round
    // no duplicate claims
    const ids = claimed.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  }, DB_TIMEOUT_MS);

  it("claimJobsForTenant is tenant-scoped and never double-claims under concurrency", async () => {
    const t = await h.pg.query<{ id: string }>("select id from pierre_rt_companies where name='n1'");
    const cid = t.rows[0].id;
    await resetJobs();
    // two concurrent claims for the SAME tenant must partition its jobs (no overlap)
    const [a, b] = await Promise.all([
      claimJobsForTenant(h.db, { company_id: cid, worker_id: "wa", batch: 5, lease_ms: 30000 }),
      claimJobsForTenant(h.db, { company_id: cid, worker_id: "wb", batch: 5, lease_ms: 30000 }),
    ]);
    for (const j of [...a, ...b]) expect(j.company_id).toBe(cid);         // tenant-scoped
    const overlap = a.filter((x) => b.some((y) => y.id === x.id));
    expect(overlap.length).toBe(0);                                        // no double claim
  }, DB_TIMEOUT_MS);
});
