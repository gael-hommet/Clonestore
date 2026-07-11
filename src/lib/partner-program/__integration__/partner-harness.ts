// Programme partenaires — harnais d'intégration (PostgreSQL réel via PGlite).
// Applique les migrations pierre_v* (pour le rôle pierre_rt_app) PUIS les migrations
// clonestore_pp, et expose un SqlExecutor compatible Pierre v1.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import type { SqlExecutor, SqlRow } from "@/lib/pierre/v1/sql";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");

function migrationSql(): string[] {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && (f.includes("pierre_v") || f.includes("clonestore_pp")))
    .sort()
    .map((f) => readFileSync(resolve(MIG_DIR, f), "utf-8"));
}

function wrap(pg: PGlite): SqlExecutor {
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
          transaction(inner) {
            return inner(txExec);
          },
        };
        return fn(txExec);
      }) as Promise<T>;
    },
  };
  return exec;
}

export type PartnerHarness = { db: SqlExecutor; pg: PGlite; close(): Promise<void> };

export async function createPartnerHarness(): Promise<PartnerHarness> {
  const pg = await PGlite.create();
  for (const sql of migrationSql()) await pg.exec(sql);
  return { db: wrap(pg), pg, close: () => pg.close() };
}
