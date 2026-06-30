// src/lib/pierre/v1/runtime-planner-db.ts
// PHASE 8.5-R2 §R2.4 — dedicated runtime PLANNER DB executor. Plan/run creation is the only privileged
// write the application surface needs, and it is now owned by a SEPARATE least-privilege role
// `pierre_rt_runtime_planner` (the application role can no longer execute the create function). The
// server-side planner compiles + fingerprints the plan, then creates the run under THIS role, so a run
// can never be forged by the app role. Fail-closed: a missing dedicated DSN throws; never the service/
// app role. No credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class RuntimePlannerDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "runtime_planner_db_unconfigured", status = 503) {
    super(message);
    this.name = "RuntimePlannerDbError";
    this.code = code;
    this.status = status;
  }
}

export function getRuntimePlannerDatabaseUrl(): string | null {
  return process.env.PIERRE_RUNTIME_PLANNER_DATABASE_URL ?? null;
}
export function isRuntimePlannerDbConfigured(): boolean {
  return !!getRuntimePlannerDatabaseUrl();
}

const globalForPlannerPool = globalThis as unknown as { __pierreRuntimePlannerPool?: unknown };

export async function createRuntimePlannerExecutor(): Promise<SqlExecutor> {
  const { isE2ETestRuntime } = await import("./db");
  if (isE2ETestRuntime()) { const { getTestRuntimeDb } = await import("./test-runtime-db"); return getTestRuntimeDb(); }
  const url = getRuntimePlannerDatabaseUrl();
  if (!url) throw new RuntimePlannerDbError("runtime planner database is not configured (PIERRE_RUNTIME_PLANNER_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForPlannerPool.__pierreRuntimePlannerPool) {
    globalForPlannerPool.__pierreRuntimePlannerPool = new pg.default.Pool({
      connectionString: url, max: Number(process.env.PIERRE_RUNTIME_PLANNER_DB_MAX ?? 2), idleTimeoutMillis: 30000, application_name: "pierre_runtime_planner",
    });
    (globalForPlannerPool.__pierreRuntimePlannerPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-runtime-planner-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForPlannerPool.__pierreRuntimePlannerPool as never);
}

/** Run plan/run creation in ONE transaction bound to the planner role (SET LOCAL ROLE → verify
 *  current_user → set app.current_company → callback). Fail-closed on a wrong/missing role binding. */
export async function withRuntimePlannerTransaction<T>(binding: { company_id: string }, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await createRuntimePlannerExecutor();
  return db.transaction(async (tx) => {
    await tx.query(`set local role pierre_rt_runtime_planner`);
    const cu = (await tx.query<{ current_user: string }>(`select current_user`)).rows[0].current_user;
    if (cu !== "pierre_rt_runtime_planner") throw new RuntimePlannerDbError(`runtime role binding failed: current_user=${cu}, expected pierre_rt_runtime_planner`, "runtime_role_mismatch", 500);
    await tx.query(`select set_config('app.current_company', $1, true)`, [binding.company_id]);
    return fn(tx);
  });
}
