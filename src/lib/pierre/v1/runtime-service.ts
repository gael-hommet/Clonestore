// src/lib/pierre/v1/runtime-service.ts
// PHASE 8.5 — the governed autonomous runtime service: compile a plan into an immutable plan version +
// a mission RUN + typed STEP RUNS, and drive a durable WORKER loop. The worker claims jobs atomically
// (the claim BUMPS the fencing token), starts the step, checkpoints before the effect, executes the
// typed handler (governed services only), records an append-only attempt under the fencing token, then
// completes / waits / fails the job — every mutation asserting ownership + fencing + lease. A stale
// re-claiming worker is positively rejected. The DB is the only source of truth; no in-memory timer.

import { createHash } from "crypto";
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./tenant-context";
import { compileMissionPlan, type RuntimePlanInput } from "./runtime-plan-compiler";
import { runtimeLimits } from "./runtime-limits";
import { getRuntimeActionDefinition, validateRuntimeActionInput } from "./runtime-action-registry";
import { getRuntimeActionHandler, type RuntimeActionContext, type RuntimeDeps, type RuntimeActionResult } from "./runtime-action-handlers";
import { RuntimeLeaseController } from "./runtime-lease-controller";
import { hasStepRefs, collectStepRefs, resolveStepRefs } from "./runtime-step-refs";

async function withTenant<T>(db: SqlExecutor, ctx: TenantContext, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); return fn(tx); });
}

// ── plan → immutable version → run → step runs → initial ready jobs ───────────────────
export type CreateRunResult = { ok: boolean; mission_run_id?: string; plan_version_id?: string; blockers: string[] };

/** R3.1 — plan/run creation runs under the dedicated PLANNER role. A runner binds the tenant + the
 *  pierre_rt_runtime_planner role for one transaction. The production caller injects
 *  withRuntimePlannerTransaction (a dedicated planner DSN); the default binds the role on the passed
 *  executor and verifies current_user — fail-closed when that executor is not a planner member. */
export type PlannerRunner = <T>(binding: { company_id: string }, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
export type CreateRunDeps = { runPlanner?: PlannerRunner };

function defaultPlannerRunner(db: SqlExecutor): PlannerRunner {
  return (binding, fn) => db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_runtime_planner`);
    const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
    if (cu !== "pierre_rt_runtime_planner") throw new Error(`planner role binding failed: current_user=${cu}, expected pierre_rt_runtime_planner`);
    await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
    return fn(tx);
  });
}

export async function createMissionRunFromPlan(
  db: SqlExecutor, ctx: TenantContext,
  input: { mission_id: string; plan: RuntimePlanInput; autonomy?: string; created_by?: string | null },
  deps: CreateRunDeps = {},
): Promise<CreateRunResult> {
  requirePermission(ctx, "mission.create");
  const compiled = compileMissionPlan(input.plan);
  if (!compiled.ok) return { ok: false, blockers: compiled.blockers };

  // R4.7 — a tenant may not exceed the active-mission ceiling (hard refusal; nothing partial is created)
  const LIM = runtimeLimits();
  const active = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_mission_runs where company_id=$1 and status in ('queued','running','waiting','paused','blocked')`, [ctx.company_id])).rows[0].n;
  if (active >= LIM.maxActiveMissionsPerTenant) return { ok: false, blockers: [`too_many_active_missions:${active}>=${LIM.maxActiveMissionsPerTenant}`] };

  // R1.2/R3.1 — the ENTIRE creation is one GOVERNED, atomic transaction under the PLANNER role. The
  // app role holds NO direct DML and can no longer EXECUTE the create function (v24); only the planner
  // can. The server forces the initial step/job statuses; the compiled steps + deps are passed as data.
  const steps = compiled.steps.map((s) => ({ step_key: s.step_key, action_key: s.action_key, action_version: s.action_version, step_ordinal: s.step_ordinal, input: s.input, input_hash: s.input_hash, dependency_count: s.dependency_count }));
  const planDeps = compiled.steps.flatMap((s) => s.depends_on.map((d) => ({ step_key: s.step_key, depends_on: d })));
  const runPlanner = deps.runPlanner ?? defaultPlannerRunner(db);
  const row = (await runPlanner({ company_id: ctx.company_id }, (tx) => tx.query<{ mission_run_id: string; plan_version_id: string }>(
    `select created_mission_run_id as mission_run_id, created_plan_version_id as plan_version_id from pierre_rt_create_compiled_mission_run($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [ctx.company_id, input.mission_id, compiled.schema_version, compiled.plan_fingerprint, JSON.stringify(input.plan), JSON.stringify(compiled.steps), JSON.stringify(steps), JSON.stringify(planDeps), input.created_by ?? ctx.user_id, ctx.correlation_id ?? null, input.autonomy ?? "normal"]))).rows[0];
  return { ok: true, mission_run_id: row.mission_run_id, plan_version_id: row.plan_version_id, blockers: [] };
}

// ── the durable worker loop ───────────────────────────────────────────────────────────
type JobRow = { id: string; mission_id: string; mission_run_id: string; step_run_id: string; action_key: string; action_version: string; fencing_token: number; max_attempts: number; idempotency_key: string | null };
export type WorkerResult = { claimed: number; succeeded: number; waiting: number; blocked: number; retried: number; reconcile: number; dead_letter: number };

/** Classify a thrown handler error into a governed fail disposition (§31). */
function classify(err: unknown): { disposition: "retry" | "reconcile" | "permanent" | "block"; code: string; retryAfter: number } {
  const msg = (err as Error)?.message ?? String(err);
  if (/cross.?tenant|tenant mismatch|permission denied|42501/i.test(msg)) return { disposition: "permanent", code: "permission_denied", retryAfter: 0 };
  if (/invalid input|validation/i.test(msg)) return { disposition: "permanent", code: "invalid_input", retryAfter: 0 };
  if (/timeout.*ambiguous|submission_unknown/i.test(msg)) return { disposition: "reconcile", code: "timeout_ambiguous", retryAfter: 60 };
  if (/rate.?limit|unavailable|temporar|transient|provider_5xx|network/i.test(msg)) return { disposition: "retry", code: "transient", retryAfter: 60 };
  return { disposition: "retry", code: "runtime_error", retryAfter: 60 };
}

type WorkerTx = <T>(fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;

/** R3.2 — bind the worker role per truth-call (SET LOCAL ROLE pierre_rt_runtime_worker + verified
 *  current_user + tenant GUC). The worker loop interleaves external I/O (handler calls), so the role
 *  is bound per short governed transaction, never held across the I/O. Fail-closed: a connection that
 *  can not become the worker role is refused before any truth-write. */
function defaultWorkerTx(db: SqlExecutor, ctx: TenantContext): WorkerTx {
  return (fn) => db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_runtime_worker`);
    const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
    if (cu !== "pierre_rt_runtime_worker") throw new Error(`worker role binding failed: current_user=${cu}, expected pierre_rt_runtime_worker`);
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    return fn(tx);
  });
}

export async function runPierreRuntimeJobs(
  db: SqlExecutor, ctx: TenantContext,
  opts: { worker?: string; limit?: number; lease_seconds?: number } = {}, deps: RuntimeDeps = {},
): Promise<WorkerResult> {
  const worker = opts.worker ?? `rt-worker:${newUuid().slice(0, 8)}`;
  const limit = Math.min(opts.limit ?? 20, 100);
  const lease = Math.max(opts.lease_seconds ?? 60, 1);
  const res: WorkerResult = { claimed: 0, succeeded: 0, waiting: 0, blocked: 0, retried: 0, reconcile: 0, dead_letter: 0 };
  const appDb = deps.appDb ?? db;
  // every worker truth-call runs under the worker role (route injects withRuntimeWorkerTransaction).
  const wtx: WorkerTx = deps.runWorkerTx ? (fn) => deps.runWorkerTx!({ company_id: ctx.company_id }, fn) : defaultWorkerTx(db, ctx);

  const claimed = (await wtx((tx) => tx.query<JobRow>(`select * from pierre_rt_runtime_claim($1,$2,$3,$4,now()) limit $5`, [ctx.company_id, limit, worker, lease, limit]))).rows;
  res.claimed = claimed.length;

  for (const job of claimed) {
    const token = job.fencing_token;
    try {
      const dfn = getRuntimeActionDefinition(job.action_key, job.action_version);
      if (!dfn) { // an unknown/obsolete action is never executed — it blocks the plan
        await governedFail(wtx, job.id, worker, token, ctx.company_id, "unknown_action", "unknown or obsolete action", "block", 0, job.max_attempts);
        res.blocked += 1; continue;
      }
      const step = (await wtx((tx) => tx.query<{ input_json: Record<string, unknown> }>(`select input_json from pierre_rt_step_runs where company_id=$1 and id=$2`, [ctx.company_id, job.step_run_id]))).rows[0];
      let payload = step?.input_json ?? {};
      // P22 Reprise 12 — resolve {$ref} step-output references from the run's completed dependency steps
      // BEFORE validation + handler. A ref that cannot be resolved is a governed block, never a silent pass.
      if (hasStepRefs(payload)) {
        try {
          const stepKeys = [...new Set(collectStepRefs(payload).map((r) => r.step))];
          const outRows = (await wtx((tx) => tx.query<{ step_key: string; output_json: Record<string, unknown> | null }>(
            `select step_key, output_json from pierre_rt_step_runs where company_id=$1 and mission_run_id=$2 and step_key = any($3) and status='succeeded'`,
            [ctx.company_id, job.mission_run_id, stepKeys]))).rows;
          payload = resolveStepRefs(payload, new Map(outRows.map((r) => [r.step_key, r.output_json]))) as Record<string, unknown>;
        } catch (e) {
          await governedFail(wtx, job.id, worker, token, ctx.company_id, "unresolved_step_ref", (e as Error)?.message?.slice(0, 180) ?? "unresolved ref", "block", 0, job.max_attempts);
          res.blocked += 1; continue;
        }
      }
      const valid = validateRuntimeActionInput(job.action_key, payload);
      if (!valid.ok) { await governedFail(wtx, job.id, worker, token, ctx.company_id, "invalid_input", valid.errors.join("|"), "block", 0, job.max_attempts); res.blocked += 1; continue; }

      await wtx((tx) => tx.query(`select pierre_rt_runtime_start_step($1,$2,$3,$4)`, [ctx.company_id, job.id, worker, token]));
      await wtx((tx) => tx.query(`select pierre_rt_runtime_checkpoint($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [ctx.company_id, job.id, worker, token, "before_action", 0, sha(job.id + ":" + token), null, "{}"]));

      const handler = getRuntimeActionHandler(job.action_key);
      if (!handler) { await governedFail(wtx, job.id, worker, token, ctx.company_id, "no_handler", "no handler for action", "block", 0, job.max_attempts); res.blocked += 1; continue; }

      const hctx: RuntimeActionContext = {
        appDb, tenant: ctx, companyId: ctx.company_id, missionId: job.mission_id, missionRunId: job.mission_run_id,
        stepRunId: job.step_run_id, jobId: job.id, idempotencyKey: job.idempotency_key ?? `step:${job.step_run_id}`, payload, deps,
        // R1.5 — heartbeat re-asserts ownership + fencing + lease (under the worker role); it throws
        // (42501) if a newer generation reclaimed the job, so the handler aborts BEFORE any external effect.
        assertLease: () => wtx((tx) => tx.query(`select pierre_rt_runtime_heartbeat($1,$2,$3,$4,$5)`, [ctx.company_id, job.id, worker, token, lease])).then(() => undefined),
        checkpoint: (kind: string, ref?: string | null) => wtx((tx) => tx.query(`select pierre_rt_runtime_checkpoint($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [ctx.company_id, job.id, worker, token, kind, 0, sha(job.id + ":" + token + ":" + kind), ref ?? null, "{}"])).then(() => undefined),
      };
      let result: RuntimeActionResult;
      try {
        // R4.11 — a LONG action (its timeout exceeds one lease window) runs under an auto-renewing lease:
        // the controller heartbeats (via the governed assertLease) every half-lease so the recovery sweeper
        // never reclaims the job mid-flight; a refused heartbeat aborts the action BEFORE it can "succeed".
        if (dfn.timeoutSeconds > lease) {
          const controller = new RuntimeLeaseController({ heartbeat: hctx.assertLease, intervalMs: Math.max((lease * 1000) / 2, 1), scheduler: deps.leaseScheduler });
          result = await controller.runWithLease(() => handler(hctx));
        } else {
          result = await handler(hctx);
        }
      } catch (err) {
        await governedRecordAttempt(wtx, job.id, worker, token, ctx.company_id, "failed", classify(err).code);
        const c = classify(err);
        const final = await governedFail(wtx, job.id, worker, token, ctx.company_id, c.code, (err as Error)?.message?.slice(0, 180) ?? "error", c.disposition, c.retryAfter, job.max_attempts);
        if (final === "dead_letter") res.dead_letter += 1; else if (final === "waiting_reconciliation") res.reconcile += 1; else if (final === "blocked") res.blocked += 1; else res.retried += 1;
        continue;
      }

      await governedRecordAttempt(wtx, job.id, worker, token, ctx.company_id, result.status, result.blockerCode ?? null, result.externalReference ?? null);
      if (result.status === "succeeded") {
        await wtx((tx) => tx.query(`select pierre_rt_runtime_complete_job($1,$2,$3,$4,$5,$6,$7)`, [ctx.company_id, job.id, worker, token, "succeeded", result.outputHash ?? null, JSON.stringify(result.output ?? {})]));
        res.succeeded += 1;
      } else if (result.status === "waiting" && result.wait) {
        const w = result.wait;
        await wtx((tx) => tx.query(`select pierre_rt_runtime_wait_job($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [ctx.company_id, job.id, worker, token, w.wait_kind, w.event_kind ?? null, w.object_type ?? null, w.object_id ?? null, w.expected_fingerprint ?? null, w.validation_id ?? null, w.wake_at ?? null, w.expires_at ?? null]));
        res.waiting += 1;
      } else if (result.status === "submission_unknown") {
        await governedFail(wtx, job.id, worker, token, ctx.company_id, "submission_unknown", "ambiguous submission", "reconcile", 60, job.max_attempts);
        res.reconcile += 1;
      } else {
        await governedFail(wtx, job.id, worker, token, ctx.company_id, result.blockerCode ?? "blocked", result.blockerCode ?? "blocked", "block", 0, job.max_attempts);
        res.blocked += 1;
      }
    } catch (loopErr) {
      // a governed mutator rejected us (stale fencing / lost lease) — never a false success
      try { await governedFail(wtx, job.id, worker, token, ctx.company_id, "loop_error", (loopErr as Error)?.message?.slice(0, 120) ?? "loop", "retry", 60, job.max_attempts); } catch { /* best effort */ }
    }
  }
  return res;
}

function sha(s: string): string { return createHash("sha256").update(s).digest("hex"); }

async function governedRecordAttempt(wtx: WorkerTx, jobId: string, worker: string, token: number, company: string, status: string, errorCode: string | null = null, externalRef: string | null = null): Promise<void> {
  await wtx((tx) => tx.query(`select pierre_rt_runtime_record_attempt($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [company, jobId, worker, token, status, errorCode, null, null, null, externalRef]));
}
async function governedFail(wtx: WorkerTx, jobId: string, worker: string, token: number, company: string, code: string, safe: string, disposition: string, retryAfter: number, maxAttempts: number): Promise<string> {
  return (await wtx((tx) => tx.query<{ pierre_rt_runtime_fail_job: string }>(`select pierre_rt_runtime_fail_job($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [company, jobId, worker, token, code, safe, disposition, retryAfter, maxAttempts]))).rows[0].pierre_rt_runtime_fail_job;
}

// ── operator actions (app role; governed) ─────────────────────────────────────────────
export async function pauseMissionRun(db: SqlExecutor, ctx: TenantContext, runId: string): Promise<void> {
  requirePermission(ctx, "mission.cancel");
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_pause_mission_run($1,$2)`, [ctx.company_id, runId]));
}
export async function resumeMissionRun(db: SqlExecutor, ctx: TenantContext, runId: string): Promise<void> {
  requirePermission(ctx, "mission.cancel");
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_resume_mission_run($1,$2)`, [ctx.company_id, runId]));
}
export async function requestCancelMissionRun(db: SqlExecutor, ctx: TenantContext, runId: string): Promise<void> {
  requirePermission(ctx, "mission.cancel");
  await withTenant(db, ctx, async (tx) => { await tx.query(`select pierre_rt_request_cancel_mission_run($1,$2)`, [ctx.company_id, runId]); await tx.query(`select pierre_rt_finalize_cancel_mission_run($1,$2)`, [ctx.company_id, runId]); });
}
