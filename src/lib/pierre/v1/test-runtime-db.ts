// src/lib/pierre/v1/test-runtime-db.ts
// PHASE 8.6 — TEST-ONLY in-process runtime DB adapter for LOCAL deterministic E2E. It exposes the SAME
// SqlExecutor the production code uses, but backed by an in-process PGlite (real PostgreSQL 16) instead of
// a TCP pool — so a locally-spawned Next server has a real, migrated database WITHOUT Docker / system
// Postgres / Supabase. It is reachable ONLY when PIERRE_E2E_TEST_MODE=1 AND NODE_ENV!=='production'
// (db.ts gates the dynamic import); it is fail-closed in production (see getRuntimeDb + the guard test).
//
// This is NOT a mock: it is the genuine governed schema (v1→v28, roles, RLS, SECURITY DEFINER functions)
// applied to a real Postgres engine. The product runs its real services/transactions against it.

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import type { SqlExecutor, SqlRow } from "./sql";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
function migrationSql(): string[] {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && f.includes("pierre_v"))
    .sort()
    .map((f) => readFileSync(resolve(MIG_DIR, f), "utf-8"));
}

type PGliteLike = {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: { query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> }) => Promise<T>): Promise<T>;
};

function wrap(pg: PGliteLike): SqlExecutor {
  const exec: SqlExecutor = {
    async query<T = SqlRow>(text: string, params?: readonly unknown[]) {
      const r = await pg.query(text, params ? [...params] : undefined);
      return { rows: r.rows as T[] };
    },
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return pg.transaction(async (tx) => {
        const txExec: SqlExecutor = {
          async query<T2 = SqlRow>(text: string, params?: readonly unknown[]) {
            const r = await tx.query(text, params ? [...params] : undefined);
            return { rows: r.rows as T2[] };
          },
          transaction(inner) { return inner(txExec); },
        };
        return fn(txExec);
      }) as Promise<T>;
    },
  };
  return exec;
}

const g = globalThis as unknown as { __pierreTestPglite?: PGliteLike; __pierreTestExec?: SqlExecutor };

/** The shared in-process PGlite executor (migrations applied once). Test-mode only. */
export async function getTestRuntimeDb(): Promise<SqlExecutor> {
  if (process.env.NODE_ENV === "production") throw new Error("test runtime DB is forbidden in production");
  if (g.__pierreTestExec) return g.__pierreTestExec;
  const mod = (await import("@electric-sql/pglite")) as unknown as { PGlite: { create(): Promise<PGliteLike> } };
  const pg = await mod.PGlite.create();
  for (const sql of migrationSql()) await pg.exec(sql);
  g.__pierreTestPglite = pg;
  g.__pierreTestExec = wrap(pg);
  return g.__pierreTestExec;
}

/** Bind the shared test executor to a least-privilege role in one transaction (mirrors the dedicated
 *  executors' SET LOCAL ROLE), so test-mode billing/activation/worker paths run under the real role. */
export async function withTestRoleTransaction<T>(role: string, companyId: string | null, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await getTestRuntimeDb();
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${role}`);
    if (companyId) await tx.query(`select set_config('app.current_company', $1, true)`, [companyId]);
    return fn(tx);
  });
}

/** Deterministic reset between E2E scenarios: drop the in-process instance so the next getTestRuntimeDb()
 *  rebuilds a virgin v1→v28 DB. Test-mode only; forbidden in production. */
export async function resetTestRuntimeDb(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("test runtime DB reset is forbidden in production");
  const pg = g.__pierreTestPglite as { close?: () => Promise<void> } | undefined;
  if (pg?.close) { try { await pg.close(); } catch { /* best effort */ } }
  g.__pierreTestPglite = undefined;
  g.__pierreTestExec = undefined;
}
