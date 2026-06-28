// src/lib/pierre/v1/communication-worker-db.ts
// PHASE 8.4-R1.1 — dedicated communication WORKER DB executor. A REAL server connection bound to the
// least-privilege role `pierre_rt_communication_worker` (the dedicated DSN authenticates as that
// role). It is NEVER browser-exposed, NEVER the Supabase service role, and NEVER a silent fallback to
// the application executor. It supports transactions + tenant binding (the governed worker functions
// derive the tenant from app.current_company). Fail-closed: a missing dedicated DSN THROWS — the
// dispatch worker is never served with a broader role. No credential is ever logged.

import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

export class CommunicationWorkerDbError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "comm_worker_db_unconfigured", status = 503) {
    super(message);
    this.name = "CommunicationWorkerDbError";
    this.code = code;
    this.status = status;
  }
}

/** The dedicated worker DSN (its user IS pierre_rt_communication_worker). Never the service role. */
export function getCommunicationWorkerDatabaseUrl(): string | null {
  return process.env.PIERRE_COMMUNICATION_WORKER_DATABASE_URL ?? null;
}

export function isCommunicationWorkerDbConfigured(): boolean {
  return !!getCommunicationWorkerDatabaseUrl();
}

// Cached singleton pool across hot reloads / lambda invocations (small max — the worker is serial).
const globalForWorkerPool = globalThis as unknown as { __pierreCommWorkerPool?: unknown };

/**
 * Build a DB executor bound to the least-privilege communication worker role. Fail-closed: if the
 * dedicated DSN is not configured, this THROWS — the worker is NEVER run with the service role or
 * the general application role. Tests inject their own executor (and prove the role isolation via
 * `set local role pierre_rt_communication_worker` against the real grants).
 */
export async function createCommunicationWorkerExecutor(): Promise<SqlExecutor> {
  const url = getCommunicationWorkerDatabaseUrl();
  if (!url) throw new CommunicationWorkerDbError("communication worker database is not configured (PIERRE_COMMUNICATION_WORKER_DATABASE_URL)");
  const pg = await import("pg");
  if (!globalForWorkerPool.__pierreCommWorkerPool) {
    globalForWorkerPool.__pierreCommWorkerPool = new pg.default.Pool({
      connectionString: url,
      max: Number(process.env.PIERRE_COMMUNICATION_WORKER_DB_MAX ?? 4),
      idleTimeoutMillis: 30000,
      application_name: "pierre_communication_worker",
    });
    (globalForWorkerPool.__pierreCommWorkerPool as { on(e: string, cb: (err: NodeJS.ErrnoException) => void): void }).on("error", (err) => {
      console.error("[pierre-comm-worker-db] idle client error:", err.code ?? err.name ?? "unknown");
    });
  }
  return createPgExecutor(globalForWorkerPool.__pierreCommWorkerPool as never);
}
