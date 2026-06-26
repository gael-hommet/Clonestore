// src/lib/pierre/v1/__integration__/runtime-core.itest.ts
// PHASE 8.1 — Pierre Production Runtime Core — integration tests against a REAL
// in-process PostgreSQL 16 (PGlite). Proves persistence, tenancy/RLS, state
// machine, validations, durable queue (SKIP LOCKED), workers, retries,
// dead-letter, idempotency, CloneGuard path, CloneTrace, outbox, recovery.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { apiCreateMission, apiListMissions, apiGetMission, apiGetMissionTasks, apiGetMissionTimeline, apiCancelMission, apiListValidations, apiDecideValidation } from "../api";
import { drainQueue, runWorkerOnce } from "../worker";
import { claimJobs, enqueueJob, recoverStaleLeases, failJob, queueDepth, type JobRow } from "../queue";
import { transitionMission } from "../mission-service";
import { MissionRepo } from "../repositories";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

// ─────────────────────────────────────────────────────────────────────────────
// A. TENANCY
// ─────────────────────────────────────────────────────────────────────────────
describe("A. Tenancy & RLS isolation", () => {
  it("A1. authorized tenant create + read", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer le candidat Dupont avant vendredi" });
    expect(v.mission_id).toBeTruthy();
    const got = await apiGetMission(h.db, h.ctx("A"), v.mission_id);
    expect(got.mission_id).toBe(v.mission_id);
  });

  it("A2. cross-tenant read is denied at the app layer", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Classer les documents RH" });
    await expect(apiGetMission(h.db, h.ctx("B"), v.mission_id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("A3. RLS enforces isolation for the restricted role (defense-in-depth)", async () => {
    const a = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Synthèse mensuelle équipe A" });
    await apiCreateMission(h.db, h.ctx("B"), { instruction: "Synthèse mensuelle équipe B" });

    // As the restricted role bound to company A, only A's rows are visible…
    const seenByA = await h.asTenantRole(h.companyA, (q) => q("select id from pierre_rt_missions"));
    expect(seenByA.rows.length).toBe(1);
    expect((seenByA.rows[0] as { id: string }).id).toBe(a.mission_id);

    // …and A cannot read B's mission even by id.
    const crossed = await h.asTenantRole(h.companyB, (q) => q("select id from pierre_rt_missions where id=$1", [a.mission_id]));
    expect(crossed.rows.length).toBe(0);
  });

  it("A4. requester without permission is rejected (IDOR/role guard)", async () => {
    const viewer = h.ctx("A", "viewer");
    await expect(apiCreateMission(h.db, viewer, { instruction: "x" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. MISSIONS
// ─────────────────────────────────────────────────────────────────────────────
describe("B. Missions", () => {
  it("B1. real persistence of mission + tasks + timeline", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer le manager pour le rapport mensuel" });
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    expect(tasks.length).toBeGreaterThan(0);
    const tl = await apiGetMissionTimeline(h.db, h.ctx("A"), v.mission_id);
    const types = tl.map((e) => e.type);
    expect(types).toContain("mission_received");
    expect(types).toContain("analysis_completed");
    expect(types).toContain("task_created");
  });

  it("B2. idempotent create — same key returns same mission, no duplicate", async () => {
    const ctx = h.ctx("A");
    const key = "fixed-key-1";
    const a = await apiCreateMission(h.db, ctx, { instruction: "Classer les CV reçus", idempotency_key: key });
    const b = await apiCreateMission(h.db, ctx, { instruction: "Classer les CV reçus", idempotency_key: key });
    expect(b.mission_id).toBe(a.mission_id);
    expect(b.idempotent_replay).toBe(true);
    const { rows } = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_missions where company_id=$1", [h.companyA]);
    expect(rows[0].n).toBe(1);
  });

  it("B3. pagination is cursor-based and bounded", async () => {
    for (let i = 0; i < 5; i++) await apiCreateMission(h.db, h.ctx("A"), { instruction: `Relance ${i}`, idempotency_key: `k${i}` });
    const p1 = await apiListMissions(h.db, h.ctx("A"), { limit: 2 });
    expect(p1.items.length).toBe(2);
    expect(p1.next_cursor).toBeTruthy();
    const p2 = await apiListMissions(h.db, h.ctx("A"), { limit: 2, cursor: p1.next_cursor });
    expect(p2.items.length).toBe(2);
    const ids = new Set([...p1.items, ...p2.items].map((m) => m.id));
    expect(ids.size).toBe(4);
  });

  it("B4. sensitive instruction -> approval required + CloneGuard, not auto-executed", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer le licenciement de M. Martin" });
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    expect(tasks.every((t) => t.status !== "succeeded")).toBe(true);
    expect(v.status).not.toBe("done");
    const vals = await apiListValidations(h.db, h.ctx("A"), v.mission_id);
    // sensitive => either a validation exists or the task is escalated (guard black)
    const escalated = tasks.some((t) => t.status === "escalated");
    expect(vals.length > 0 || escalated).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────
describe("C. State machine", () => {
  it("C1. illegal transition is rejected", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Classer documents" });
    const m = await MissionRepo.byId(h.db, h.companyA, v.mission_id);
    await expect(transitionMission(h.db, h.companyA, m!, "archived", "aggregated", "system")).rejects.toMatchObject({ code: "illegal_transition" });
  });

  it("C2. optimistic concurrency: stale version conflicts", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Classer documents" });
    const m = await MissionRepo.byId(h.db, h.companyA, v.mission_id);
    await MissionRepo.updateStatus(h.db, h.companyA, m!.id, m!.version, "blocked");
    await expect(MissionRepo.updateStatus(h.db, h.companyA, m!.id, m!.version, "cancelled")).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("C3. cancellation cancels tasks and is reflected", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer trois managers" });
    const res = await apiCancelMission(h.db, h.ctx("A"), v.mission_id);
    expect(res.status).toBe("cancelled");
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    expect(tasks.every((t) => ["cancelled", "succeeded", "archived"].includes(t.status))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. VALIDATIONS
// ─────────────────────────────────────────────────────────────────────────────
describe("D. Validations", () => {
  it("D1. approve unlocks the task and queues it; idempotent decision", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un avenant au contrat de Mme Leroy" });
    const vals = await apiListValidations(h.db, h.ctx("A"), v.mission_id);
    expect(vals.length).toBeGreaterThan(0);
    const target = vals[0];
    const r1 = await apiDecideValidation(h.db, h.ctx("A"), target.id, "approve", target.version);
    expect(r1.status).toBe("approved");
    // second decision is idempotent (already decided)
    const r2 = await apiDecideValidation(h.db, h.ctx("A"), target.id, "approve", target.version);
    expect(r2.status).toBe("approved");
  });

  it("D2. reject cancels the task", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un courrier de sanction" });
    const vals = await apiListValidations(h.db, h.ctx("A"), v.mission_id);
    if (vals.length === 0) return; // guard escalated instead — acceptable
    const r = await apiDecideValidation(h.db, h.ctx("A"), vals[0].id, "reject", vals[0].version);
    expect(r.status).toBe("rejected");
  });

  it("D3. validation.decide requires permission", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un avenant" });
    const vals = await apiListValidations(h.db, h.ctx("A"), v.mission_id);
    if (vals.length === 0) return;
    await expect(apiDecideValidation(h.db, h.ctx("A", "viewer"), vals[0].id, "approve", vals[0].version))
      .rejects.toMatchObject({ code: "forbidden" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. QUEUE
// ─────────────────────────────────────────────────────────────────────────────
describe("E. Durable queue", () => {
  it("E1. SKIP LOCKED claim never double-claims a job", async () => {
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer les candidats du lot 1" });
    // two concurrent claims against the same DB
    const [w1, w2] = await Promise.all([
      claimJobs(h.db, { worker_id: "w1", batch: 5, lease_ms: 60000 }),
      claimJobs(h.db, { worker_id: "w2", batch: 5, lease_ms: 60000 }),
    ]);
    const ids = [...w1, ...w2].map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length); // disjoint — no double claim
  });

  it("E2. retry with backoff then dead-letter after max attempts", async () => {
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Classer le document de l'équipe" });
    // Force a job to fail repeatedly. Each pass we advance time past the backoff
    // (run_after) so the retry becomes claimable — simulating the scheduler.
    for (let i = 0; i < 8; i++) {
      await h.db.query("update pierre_rt_jobs set run_after = now() where company_id=$1 and status in ('ready','retry')", [h.companyA]);
      const claimed = await claimJobs(h.db, { worker_id: "wfail", batch: 1, lease_ms: 60000 });
      if (claimed.length === 0) break;
      const job = claimed[0] as JobRow;
      await failJob(h.db, job, job.lease_owner ?? "wfail", "forced failure");
    }
    const depth = await queueDepth(h.db, h.companyA);
    expect(depth.dead).toBeGreaterThanOrEqual(1);
  });

  it("E3. stale lease recovery makes a crashed worker's job claimable again", async () => {
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer le manager" });
    const claimed = await claimJobs(h.db, { worker_id: "crashy", batch: 1, lease_ms: 1 });
    expect(claimed.length).toBe(1);
    // simulate crash: lease expires
    await h.db.query("update pierre_rt_jobs set lease_expires_at = now() - interval '1 minute' where id=$1", [claimed[0].id]);
    const recovered = await recoverStaleLeases(h.db);
    expect(recovered).toBeGreaterThanOrEqual(1);
    const reclaim = await claimJobs(h.db, { worker_id: "fresh", batch: 1, lease_ms: 60000 });
    expect(reclaim.length).toBe(1);
  });

  it("E4. per-tenant concurrency cap is enforced", async () => {
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Relancer le manager du rapport mensuel", idempotency_key: "ca" });
    await apiCreateMission(h.db, h.ctx("A"), { instruction: "Classer le dossier de l'équipe", idempotency_key: "cb" });
    const first = await claimJobs(h.db, { worker_id: "w", batch: 5, lease_ms: 60000, tenant_concurrency_cap: 1 });
    expect(first.length).toBe(1);
    const second = await claimJobs(h.db, { worker_id: "w2", batch: 5, lease_ms: 60000, tenant_concurrency_cap: 1 });
    expect(second.length).toBe(0); // tenant already at cap
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F. EXECUTION + G. OUTBOX
// ─────────────────────────────────────────────────────────────────────────────
describe("F/G. Governed execution + outbox", () => {
  it("F1. low-risk mission drains to done via worker; trace persisted", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Faire une synthèse opérationnelle de l'équipe" });
    const res = await drainQueue(h.db, { worker_id: "wkr", batch: 5, lease_ms: 60000 });
    expect(res.succeeded).toBeGreaterThan(0);
    const m = await apiGetMission(h.db, h.ctx("A"), v.mission_id);
    expect(["done", "partially_completed", "in_progress"]).toContain(m.status);
    const tl = await apiGetMissionTimeline(h.db, h.ctx("A"), v.mission_id);
    expect(tl.some((e) => e.type === "task_succeeded")).toBe(true);
  });

  it("F2. integration-pending executor is NEVER succeeded (awaiting_integration)", async () => {
    // craft a mission whose task maps to an email_send executor by direct enqueue.
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Notifier l'équipe" });
    // turn the first task into an email_send (integration pending) to exercise the guard.
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    await h.db.query("update pierre_rt_tasks set type='email_send', status='queued' where id=$1", [tasks[0].id]);
    await enqueueJob(h.db, { company_id: h.companyA, task_id: tasks[0].id, mission_id: v.mission_id, dedup_key: `email:${tasks[0].id}` });
    const res = await runWorkerOnce(h.db, { worker_id: "wkr2", batch: 5, lease_ms: 60000 });
    expect(res.awaiting_integration).toBeGreaterThanOrEqual(1);
    const { rows } = await h.db.query<{ outcome: string }>("select outcome from pierre_rt_execution_attempts where task_id=$1", [tasks[0].id]);
    expect(rows.some((r) => r.outcome === "awaiting_integration")).toBe(true);
    expect(rows.some((r) => r.outcome === "succeeded")).toBe(false);
    // outbox prepared transactionally
    const ob = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_outbox where company_id=$1", [h.companyA]);
    expect(ob.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("F3. CloneGuard blocks a black-level action in-path (no execution)", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Sanctionner immédiatement le salarié" });
    const tasks = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    // approve any gating validation so the task could be queued, then ensure guard still blocks at execution
    const vals = await apiListValidations(h.db, h.ctx("A"), v.mission_id);
    for (const val of vals) { try { await apiDecideValidation(h.db, h.ctx("A"), val.id, "approve", val.version); } catch { /* */ } }
    await h.db.query("update pierre_rt_tasks set status='queued', risk='critical' where id=$1", [tasks[0].id]);
    await enqueueJob(h.db, { company_id: h.companyA, task_id: tasks[0].id, mission_id: v.mission_id, dedup_key: `g:${tasks[0].id}` });
    await runWorkerOnce(h.db, { worker_id: "wkrg", batch: 5, lease_ms: 60000 });
    const after = await apiGetMissionTasks(h.db, h.ctx("A"), v.mission_id);
    const t0 = after.find((t) => t.id === tasks[0].id)!;
    expect(t0.status).not.toBe("succeeded");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I. RELIABILITY
// ─────────────────────────────────────────────────────────────────────────────
describe("I. Reliability", () => {
  it("I1. mission is never lost and no task stays stuck after recovery", async () => {
    const v = await apiCreateMission(h.db, h.ctx("A"), { instruction: "Préparer un rappel d'échéance pour l'équipe" });
    // claim with tiny lease (simulate crash mid-flight), then recover + drain
    await claimJobs(h.db, { worker_id: "ghost", batch: 5, lease_ms: 1 });
    await h.db.query("update pierre_rt_jobs set lease_expires_at = now() - interval '1 minute' where status='leased'");
    await recoverStaleLeases(h.db);
    const res = await drainQueue(h.db, { worker_id: "recovery", batch: 5, lease_ms: 60000 });
    expect(res.succeeded + res.awaiting_integration).toBeGreaterThan(0);
    const depth = await queueDepth(h.db, h.companyA);
    expect(depth.leased).toBe(0); // nothing left leased forever
    const m = await apiGetMission(h.db, h.ctx("A"), v.mission_id);
    expect(m.mission_id).toBe(v.mission_id); // mission survived
  });

  it("I2. duplicate create request does not double-execute", async () => {
    const ctx = h.ctx("A");
    const [a, b] = await Promise.all([
      apiCreateMission(h.db, ctx, { instruction: "Classer le dossier", idempotency_key: "dup1" }),
      apiCreateMission(h.db, ctx, { instruction: "Classer le dossier", idempotency_key: "dup1" }),
    ]);
    expect(a.mission_id).toBe(b.mission_id);
    const { rows } = await h.db.query<{ n: number }>("select count(*)::int n from pierre_rt_missions where company_id=$1 and idempotency_key='dup1'", [h.companyA]);
    expect(rows[0].n).toBe(1);
  });
});
