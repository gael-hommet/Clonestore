// src/lib/pierre/v1/tenant-tx.ts
// PHASE 8.2 — production-like tenant transaction binding.
//
// Runs business work inside a transaction bound to the tenant under the
// NON-superuser application role, so RLS is actually enforced by Postgres (not
// just by app-level WHERE clauses):
//
//   BEGIN
//   SET LOCAL ROLE pierre_rt_app          -- non-owner, no BYPASSRLS
//   set_config('app.current_company', …, true)   -- transaction-local GUC
//   set_config('app.current_user', …, true)
//   <callback>
//   COMMIT   (ROLLBACK on throw)
//
// SET LOCAL + set_config(.., true) are transaction-scoped: the role and GUCs are
// reset at COMMIT/ROLLBACK, so nothing leaks across reused pooled connections.
// The service (superuser) role is reserved for migrations, tenant resolution and
// explicit system operations — never for per-tenant business reads/writes.

import type { SqlExecutor } from "./sql";

export type TenantBinding = { company_id: string; user_id: string };

export async function withTenantTransaction<T>(
  db: SqlExecutor,
  binding: TenantBinding,
  callback: (tx: SqlExecutor) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("set local role pierre_rt_app");
    await tx.query("select set_config('app.current_company', $1, true)", [binding.company_id]);
    await tx.query("select set_config('app.current_user', $1, true)", [binding.user_id]);
    return callback(tx);
  });
}
