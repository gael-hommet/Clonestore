// src/lib/pierre/v1/db.ts
// PHASE 8.1 — Pierre Production Runtime Core — production SqlExecutor (node-postgres).
//
// `pg` is a REAL production dependency (package.json -> dependencies). A single
// pooled connection to the Supabase pooled connection string (DATABASE_URL) is
// reused across requests/hot-reloads (Next.js / serverless safe). SSL, connection
// and statement timeouts are configured. No dynamic import to hide a missing dep.

import { Pool, type PoolConfig } from "pg";
import type { SqlExecutor } from "./sql";
import { createPgExecutor } from "./sql";

function sslFor(url: string): PoolConfig["ssl"] {
  if (process.env.PGSSL === "disable") return false;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
  } catch { /* fall through */ }
  // Supabase requires TLS; rejectUnauthorized=false unless a CA is provided.
  return process.env.PGSSL_CA ? { ca: process.env.PGSSL_CA } : { rejectUnauthorized: false };
}

/** Build a pool for a specific URL (own lifecycle — caller must end()). */
export function buildRuntimePool(url: string): Pool {
  const queryTimeout = Number(process.env.PIERRE_DB_QUERY_TIMEOUT_MS ?? 15000);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PIERRE_DB_MAX ?? 10),
    connectionTimeoutMillis: Number(process.env.PIERRE_DB_CONN_TIMEOUT_MS ?? 5000),
    idleTimeoutMillis: 30000,
    query_timeout: queryTimeout,
    statement_timeout: queryTimeout,
    ssl: sslFor(url),
    allowExitOnIdle: false,
  });
  // Never crash the process on an idle client error; never enter a reconnect loop.
  // Log a redacted code only (no connection string / no secret).
  pool.on("error", (err: NodeJS.ErrnoException) => {
    // eslint-disable-next-line no-console
    console.error("[pierre-db] idle client error:", err.code ?? err.name ?? "unknown");
  });
  return pool;
}

// Cached singleton across hot reloads / lambda invocations.
const globalForPool = globalThis as unknown as { __pierreRuntimePool?: Pool };

function singletonPool(): Pool {
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("DATABASE_URL not configured for Pierre runtime");
  if (!globalForPool.__pierreRuntimePool) globalForPool.__pierreRuntimePool = buildRuntimePool(url);
  return globalForPool.__pierreRuntimePool;
}

/** Production runtime executor over the shared pool. */
export async function getRuntimeDb(): Promise<SqlExecutor> {
  return createPgExecutor(singletonPool());
}

/** Diagnostic/test helper: an executor over an explicit URL with its own pool. */
export function createRuntimeExecutorForUrl(url: string): { db: SqlExecutor; close: () => Promise<void> } {
  const pool = buildRuntimePool(url);
  return { db: createPgExecutor(pool), close: () => pool.end() };
}
