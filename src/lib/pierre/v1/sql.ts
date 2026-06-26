// src/lib/pierre/v1/sql.ts
// PHASE 8.1 — Pierre Production Runtime Core — SQL executor abstraction + ids.
//
// ONE canonical runtime, DB-agnostic at the edge. The whole runtime (repos,
// queue, services, worker) depends only on `SqlExecutor`. It is backed by:
//   - PGlite (real in-process Postgres 16) for local integration tests/bench;
//   - node-postgres `pg.Pool` against the Supabase pooled connection string
//     (DATABASE_URL) in production.
// No table in memory, no localStorage. All state is in Postgres.

import { randomUUID } from "crypto";

export type SqlRow = Record<string, unknown>;

export interface SqlExecutor {
  /** Run a parameterized query. Returns rows. */
  query<T = SqlRow>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
  /** Run fn inside a single transaction with a bound executor. Commits on
   *  success, rolls back on any throw. Multiple writes that form one operation
   *  MUST go through here. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/** Bind a tenant GUC for the duration of a transaction (RLS enforcement when
 *  the connection is a non-service role). Safe to call with the service role
 *  too — it simply sets the setting. */
export async function bindTenant(tx: SqlExecutor, companyId: string, userId: string): Promise<void> {
  await tx.query("select set_config('app.current_company', $1, true)", [companyId]);
  await tx.query("select set_config('app.current_user', $1, true)", [userId]);
}

// ── ID helpers (no external dependency) ─────────────────────────────────────
export const newUuid = (): string => randomUUID();
export const newCorrelationId = (): string => randomUUID();
export const newRequestId = (): string => randomUUID();

/** Deterministic idempotency key derived from stable inputs. */
export function idempotencyKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((p) => (p === null || p === undefined ? "_" : String(p))).join("|");
}

/** True when an error is a Postgres unique-violation (SQLSTATE 23505), across drivers. */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === "23505") return true;
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" && /duplicate key value violates unique constraint|unique constraint/i.test(msg);
}

/**
 * Run an operation that races on a unique key (e.g. an allocated sequence number),
 * retrying a BOUNDED number of times on a unique violation. Any other error propagates
 * immediately. Used as a safety net behind row-level locking, so a lost race re-allocates
 * instead of surfacing a 23505 to the caller.
 */
export async function withUniqueViolationRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { if (!isUniqueViolation(e)) throw e; last = e; }
  }
  throw last;
}

// ── Production adapter (node-postgres) — duck-typed so we don't hard-import pg ─
type PgLikePool = {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: SqlRow[] }>;
  connect(): Promise<{
    query(text: string, params?: readonly unknown[]): Promise<{ rows: SqlRow[] }>;
    release(): void;
  }>;
};

/** Production executor over a node-postgres Pool (DATABASE_URL → Supabase). */
export function createPgExecutor(pool: PgLikePool): SqlExecutor {
  const exec: SqlExecutor = {
    async query<T = SqlRow>(text: string, params?: readonly unknown[]) {
      const r = await pool.query(text, params);
      return { rows: r.rows as T[] };
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const txExec: SqlExecutor = {
        async query<T2 = SqlRow>(text: string, params?: readonly unknown[]) {
          const r = await client.query(text, params);
          return { rows: r.rows as T2[] };
        },
        transaction(inner) {
          // Already in a transaction — reuse the same client (nested = same tx).
          return inner(txExec);
        },
      };
      try {
        await client.query("begin");
        const out = await fn(txExec);
        await client.query("commit");
        return out;
      } catch (e) {
        try { await client.query("rollback"); } catch { /* rollback best-effort */ }
        throw e;
      } finally {
        client.release();
      }
    },
  };
  return exec;
}
