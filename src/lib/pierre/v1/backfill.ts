// src/lib/pierre/v1/backfill.ts
// PHASE 8.2 — idempotent tenancy backfill (legacy per-user ownership -> canonical
// companies + owner memberships). Thin wrapper over the SQL function
// pierre_rt_backfill_tenancy() so it can be triggered by an admin route or a
// migration step. Re-runnable with no duplication.

import type { SqlExecutor } from "./sql";

export type BackfillResult = { companies_created: number; members_created: number };

export async function runTenancyBackfill(db: SqlExecutor): Promise<BackfillResult> {
  // The function uses a temporary table (on commit drop) and dynamic SQL guarded
  // by to_regclass, so it is safe whether or not the legacy tables exist.
  const { rows } = await db.transaction(async (tx) =>
    tx.query<{ companies_created: number; members_created: number }>("select * from pierre_rt_backfill_tenancy()"));
  const r = rows[0] ?? { companies_created: 0, members_created: 0 };
  return { companies_created: Number(r.companies_created), members_created: Number(r.members_created) };
}

/** True once an account has a canonical membership (i.e. it has been migrated). */
export async function isAccountMigrated(db: SqlExecutor, userId: string): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_members where user_id = $1`, [userId]);
  return (rows[0]?.n ?? 0) > 0;
}
