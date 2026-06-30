// src/lib/pierre/v1/runtime-worker-db.ts
// PHASE 8.5 — dedicated runtime WORKER DB executor. A REAL server connection bound to the least-
// privilege role `pierre_rt_runtime_worker` (the dedicated DSN authenticates as that role). It is
// NEVER browser-exposed, NEVER the Supabase service role, and NEVER a silent fallback to the
// application executor. It supports transactions + tenant binding (the governed worker functions
// derive the tenant from app.current_company and assert ownership + the fencing token). Fail-closed:
// a missing dedicated DSN THROWS — the dispatch worker is never served with a broader role. No
// credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class RuntimeWorkerDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "runtime_worker_db_unconfigured", status = 503) {
    super(message);
    this.name = "RuntimeWorkerDbError";
    this.code = code;
    this.status = status;
  }
}

export function getRuntimeWorkerDatabaseUrl(): string | null {
  return process.env.PIERRE_RUNTIME_WORKER_DATABASE_URL ?? null;
}
export function isRuntimeWorkerDbConfigured(): boolean {
  return !!getRuntimeWorkerDatabaseUrl();
}

const globalForWorkerPool = globalThis as unknown as { __pierreRuntimeWorkerPool?: unknown };

/** A DB executor bound to pierre_rt_runtime_worker. Fail-closed: never the service/app role. */
export async function createRuntimeWorkerExecutor(): Promise<SqlExecutor> {
  const { isE2ETestRuntime } = await import("./db");
  if (isE2ETestRuntime()) { const { getTestRuntimeDb } = await import("./test-runtime-db"); return getTestRuntimeDb(); }
  const url = getRuntimeWorkerDatabaseUrl();
  if (!url) throw new RuntimeWorkerDbError("runtime worker database is not configured (PIERRE_RUNTIME_WORKER_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForWorkerPool.__pierreRuntimeWorkerPool) {
    globalForWorkerPool.__pierreRuntimeWorkerPool = new pg.default.Pool({
      connectionString: url,
      max: Number(process.env.PIERRE_RUNTIME_WORKER_DB_MAX ?? 4),
      idleTimeoutMillis: 30000,
      application_name: "pierre_runtime_worker",
    });
    (globalForWorkerPool.__pierreRuntimeWorkerPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-runtime-worker-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForWorkerPool.__pierreRuntimeWorkerPool as never);
}

/** Fail-closed assertion that the bound role is EXACTLY the expected runtime role (R1.1). A DSN that
 *  does not (or cannot) become the role — wrong login, missing membership, refused SET ROLE — is
 *  rejected here; the runtime never executes under a broader role (app/service/superuser). */
export async function assertRuntimeRole(tx: SqlExecutor, expected: string): Promise<void> {
  const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
  if (cu !== expected) throw new RuntimeWorkerDbError(`runtime role binding failed: current_user=${cu}, expected ${expected}`, "runtime_role_mismatch", 500);
}

/**
 * Run a callback in ONE transaction bound to the worker role: BEGIN → SET LOCAL ROLE
 * pierre_rt_runtime_worker → verify current_user → set app.current_company → callback → COMMIT/ROLLBACK.
 * SET LOCAL is transaction-scoped (reset at COMMIT), so nothing leaks across reused pooled connections.
 * Fail-closed: a login that is not a member of the role can not SET LOCAL ROLE and is refused.
 */
export async function withRuntimeWorkerTransaction<T>(binding: { company_id: string }, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await createRuntimeWorkerExecutor();
  return db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_runtime_worker`);
    await assertRuntimeRole(tx, "pierre_rt_runtime_worker");
    await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
    return fn(tx);
  });
}
