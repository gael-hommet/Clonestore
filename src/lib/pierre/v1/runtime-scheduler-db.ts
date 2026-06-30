// src/lib/pierre/v1/runtime-scheduler-db.ts
// PHASE 8.5 — dedicated runtime SCHEDULER DB executor. A REAL server connection bound to the least-
// privilege role `pierre_rt_runtime_scheduler` (the dedicated DSN authenticates as that role). The
// scheduler only makes work AVAILABLE (claims due schedules, reclaims expired leases bumping the
// fencing generation, fires schedule occurrences, resolves waits, ingests runtime events) — it never
// executes a business action, never sends email, never reads a contract/employee. NEVER browser-
// exposed, NEVER the Supabase service role, NEVER an app-role fallback. Fail-closed: a missing DSN
// THROWS. No credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class RuntimeSchedulerDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "runtime_scheduler_db_unconfigured", status = 503) {
    super(message);
    this.name = "RuntimeSchedulerDbError";
    this.code = code;
    this.status = status;
  }
}

export function getRuntimeSchedulerDatabaseUrl(): string | null {
  return process.env.PIERRE_RUNTIME_SCHEDULER_DATABASE_URL ?? null;
}
export function isRuntimeSchedulerDbConfigured(): boolean {
  return !!getRuntimeSchedulerDatabaseUrl();
}

const globalForSchedulerPool = globalThis as unknown as { __pierreRuntimeSchedulerPool?: unknown };

/** A DB executor bound to pierre_rt_runtime_scheduler. Fail-closed: never the service/app role. */
export async function createRuntimeSchedulerExecutor(): Promise<SqlExecutor> {
  const { isE2ETestRuntime } = await import("./db");
  if (isE2ETestRuntime()) { const { getTestRuntimeDb } = await import("./test-runtime-db"); return getTestRuntimeDb(); }
  const url = getRuntimeSchedulerDatabaseUrl();
  if (!url) throw new RuntimeSchedulerDbError("runtime scheduler database is not configured (PIERRE_RUNTIME_SCHEDULER_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForSchedulerPool.__pierreRuntimeSchedulerPool) {
    globalForSchedulerPool.__pierreRuntimeSchedulerPool = new pg.default.Pool({
      connectionString: url,
      max: Number(process.env.PIERRE_RUNTIME_SCHEDULER_DB_MAX ?? 2),
      idleTimeoutMillis: 30000,
      application_name: "pierre_runtime_scheduler",
    });
    (globalForSchedulerPool.__pierreRuntimeSchedulerPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-runtime-scheduler-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForSchedulerPool.__pierreRuntimeSchedulerPool as never);
}

/**
 * Run a callback in ONE transaction bound to the scheduler role: BEGIN → SET LOCAL ROLE
 * pierre_rt_runtime_scheduler → verify current_user → set app.current_company → callback → COMMIT/
 * ROLLBACK. Fail-closed: a login not a member of the role can not SET LOCAL ROLE and is refused; the
 * scheduler never runs under a broader role (app/service/superuser) nor as the worker role.
 */
export async function withRuntimeSchedulerTransaction<T>(binding: { company_id: string }, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await createRuntimeSchedulerExecutor();
  return db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_runtime_scheduler`);
    const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
    if (cu !== "pierre_rt_runtime_scheduler") throw new RuntimeSchedulerDbError(`runtime role binding failed: current_user=${cu}, expected pierre_rt_runtime_scheduler`, "runtime_role_mismatch", 500);
    await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
    return fn(tx);
  });
}
