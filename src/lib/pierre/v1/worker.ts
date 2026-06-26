// src/lib/pierre/v1/worker.ts
// PHASE 8.1 — Pierre Production Runtime Core — worker.
//
// Claims jobs durably (SKIP LOCKED), runs the governed executor lifecycle,
// persists results + execution attempts + CloneTrace, and routes outcomes to
// retry / dead-letter / next-action / aggregation. Runs server-side, never
// depends on a browser being open. Idempotent and crash-safe: a crashed worker's
// lease expires and the job is recovered by recoverStaleLeases().

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import {
  claimJobs, completeJob, failJob, enqueueJob, type JobRow, type ClaimOptions,
} from "./queue";
import { TaskRepo, EventRepo, type TaskRow } from "./repositories";
import { resolveExecutor } from "./executors";
import { transitionTask, aggregateMission } from "./mission-service";
import type { TaskStatus } from "./state-machine";
import { withTenantTransaction } from "./tenant-tx";

/** Walk a claimed task through the canonical path to in_progress
 *  (retry_scheduled→queued→leased→in_progress, etc.). Bumps the attempt counter
 *  exactly once, at execution start. */
async function advanceToInProgress(db: SqlExecutor, companyId: string, task: TaskRow): Promise<TaskRow> {
  let t = task;
  const step = async (to: TaskStatus, reason: Parameters<typeof transitionTask>[4], bump = false) => {
    t = await transitionTask(db, { company_id: companyId }, t, to, reason, "worker", { bumpAttempt: bump });
  };
  if (t.status === "retry_scheduled") await step("queued", "queued");
  if (t.status === "ready") await step("queued", "queued");
  if (t.status === "queued") await step("leased", "claimed");
  if (t.status === "leased") await step("in_progress", "execution_started", true);
  return t;
}

export type WorkerResult = {
  worker_id: string;
  claimed: number;
  succeeded: number;
  failed: number;
  awaiting_integration: number;
  dead_lettered: number;
  items: Array<{ job_id: string; task_id: string; outcome: string }>;
};

async function recordAttempt(db: SqlExecutor, task: TaskRow, attemptNo: number, outcome: string, detail: Record<string, unknown>): Promise<void> {
  await db.query(
    `insert into pierre_rt_execution_attempts (id, company_id, task_id, attempt_no, outcome, detail, finished_at)
     values ($1,$2,$3,$4,$5,$6, now())`,
    [newUuid(), task.company_id, task.id, attemptNo, outcome, JSON.stringify(detail)]);
}

async function processJob(db: SqlExecutor, job: JobRow): Promise<string> {
  const companyId = job.company_id;
  const task = await TaskRepo.byId(db, companyId, job.task_id);
  if (!task) {
    // Orphan job: complete it, nothing to do.
    await completeJob(db, job.id, job.lease_owner ?? "");
    return "orphan";
  }

  // CloneGuard is re-evaluated in-path (executor.run computes guard).
  // Advance the task through the canonical path to in_progress.
  let current = task;
  if (["queued", "ready", "leased", "retry_scheduled"].includes(current.status)) {
    try {
      current = await advanceToInProgress(db, companyId, current);
    } catch {
      // Concurrent transition (another worker) — skip safely.
      await completeJob(db, job.id, job.lease_owner ?? "");
      return "skipped_concurrent";
    }
  }

  const executor = resolveExecutor(current.type);
  const exec = await executor.run(db, current);

  // CloneGuard hard-block in-path: never execute a black-level action.
  if (!exec.guard.allow && exec.guard.level === "black") {
    await transitionTask(db, { company_id: companyId }, current, "escalated", "blocked_by_guard", "guard", { result: { guard: exec.guard }, metadata: { guard_level: "black" } });
    await recordAttempt(db, current, current.attempts, "blocked", { guard: exec.guard.level });
    await completeJob(db, job.id, job.lease_owner ?? "");
    await aggregateMission(db, companyId, current.mission_id);
    return "blocked";
  }

  if (exec.outcome === "succeeded") {
    const done = await transitionTask(db, { company_id: companyId }, current, "succeeded", "execution_succeeded", "worker", { result: exec.output });
    await recordAttempt(db, done, done.attempts, "succeeded", { kind: String(exec.output.kind ?? "") });
    await completeJob(db, job.id, job.lease_owner ?? "");

    // Unlock dependents whose dependencies are now all satisfied.
    const dependents = await TaskRepo.readyDependentsOf(db, companyId, done.id);
    for (const dep of dependents) {
      if (dep.status === "planned" || dep.status === "draft") {
        const unmet = await TaskRepo.unmetDependencies(db, companyId, dep.id);
        if (unmet === 0 && !dep.approval_required) {
          try {
            const r = await transitionTask(db, { company_id: companyId }, dep, "ready", "planning", "system");
            const q = await transitionTask(db, { company_id: companyId }, r, "queued", "queued", "system");
            await enqueueJob(db, { company_id: companyId, task_id: q.id, mission_id: q.mission_id, priority: q.priority, dedup_key: `task:${q.id}` });
          } catch { /* race: another worker unlocked it */ }
        }
      }
    }
    // Schedule next action if executor proposed one.
    if (exec.next_task) {
      await EventRepo.append(db, { company_id: companyId, mission_id: done.mission_id, task_id: done.id, type: "next_action_scheduled", actor_type: "worker", metadata: { next: exec.next_task.type } });
    }
    await aggregateMission(db, companyId, done.mission_id);
    return "succeeded";
  }

  if (exec.outcome === "awaiting_integration") {
    // Honest: NOT succeeded. Task parks in blocked (integration pending), job completes.
    await transitionTask(db, { company_id: companyId }, current, "blocked", "blocked_by_dependency", "worker", { result: exec.output, metadata: { awaiting_integration: true } });
    await recordAttempt(db, current, current.attempts, "awaiting_integration", { kind: String(exec.output.kind ?? "") });
    await completeJob(db, job.id, job.lease_owner ?? "");
    await aggregateMission(db, companyId, current.mission_id);
    return "awaiting_integration";
  }

  if (exec.outcome === "unsupported") {
    await transitionTask(db, { company_id: companyId }, current, "blocked", "blocked_by_dependency", "worker", { result: exec.output, metadata: { unsupported: true } });
    await recordAttempt(db, current, current.attempts, "unsupported", {});
    await completeJob(db, job.id, job.lease_owner ?? "");
    await aggregateMission(db, companyId, current.mission_id);
    return "unsupported";
  }

  // failed / blocked -> retry or dead-letter
  await recordAttempt(db, current, current.attempts, "failed", { reason: String(exec.output.error ?? "execution_failed") });
  const fate = await failJob(db, job, job.lease_owner ?? "", String(exec.output.error ?? "execution_failed"));
  if (fate === "dead_lettered") {
    await transitionTask(db, { company_id: companyId }, current, "failed", "execution_failed", "worker", { metadata: { dead_lettered: true } });
    await aggregateMission(db, companyId, current.mission_id);
    return "dead_lettered";
  }
  await transitionTask(db, { company_id: companyId }, current, "retry_scheduled", "retry_scheduled", "worker");
  return "retry_scheduled";
}

/** Run one worker pass: claim a batch and process each job. Each job is processed
 *  with its own error isolation so one failure never loses the others. */
export async function runWorkerOnce(db: SqlExecutor, opts: ClaimOptions): Promise<WorkerResult> {
  const jobs = await claimJobs(db, opts);
  const res: WorkerResult = { worker_id: opts.worker_id, claimed: jobs.length, succeeded: 0, failed: 0, awaiting_integration: 0, dead_lettered: 0, items: [] };
  for (const job of jobs) {
    let outcome = "error";
    try {
      // Claim is a global scheduler op (service role); PROCESSING is tenant-bound:
      // the whole job lifecycle runs under the job's tenant via the real RLS binding,
      // so a worker that picked up tenant A's job can never touch tenant B's rows.
      outcome = await withTenantTransaction(db, { company_id: job.company_id, user_id: `worker:${opts.worker_id}` }, (tx) => processJob(tx, job));
    } catch (e) {
      // Isolated failure: fail the job (retry/dead-letter), never lose the mission.
      try {
        const fate = await failJob(db, job, job.lease_owner ?? "", e instanceof Error ? e.message : "worker_error");
        outcome = fate === "dead_lettered" ? "dead_lettered" : "retry_scheduled";
      } catch { outcome = "error"; }
    }
    if (outcome === "succeeded") res.succeeded++;
    else if (outcome === "awaiting_integration") res.awaiting_integration++;
    else if (outcome === "dead_lettered") { res.failed++; res.dead_lettered++; }
    else if (outcome === "retry_scheduled" || outcome === "error") res.failed++;
    res.items.push({ job_id: job.id, task_id: job.task_id, outcome });
  }
  return res;
}

/** Drain the queue (bounded passes) — used by tests/cron to run to quiescence. */
export async function drainQueue(db: SqlExecutor, opts: ClaimOptions, maxPasses = 50): Promise<WorkerResult> {
  const total: WorkerResult = { worker_id: opts.worker_id, claimed: 0, succeeded: 0, failed: 0, awaiting_integration: 0, dead_lettered: 0, items: [] };
  for (let i = 0; i < maxPasses; i++) {
    const r = await runWorkerOnce(db, opts);
    total.claimed += r.claimed; total.succeeded += r.succeeded; total.failed += r.failed;
    total.awaiting_integration += r.awaiting_integration; total.dead_lettered += r.dead_lettered;
    total.items.push(...r.items);
    if (r.claimed === 0) break;
  }
  return total;
}
