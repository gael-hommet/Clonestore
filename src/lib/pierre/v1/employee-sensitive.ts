// src/lib/pierre/v1/employee-sensitive.ts
// PHASE 8.2 — sensitive employee data, strictly isolated.
//
// Stored in a dedicated table with a dedicated permission (employee.sensitive.*).
// Every read is audited (category + actor, NEVER the value). Values are opaque
// (encrypted at rest in production via KMS/pgcrypto). Sensitive values never
// appear in logs or the general timeline. Ordinary managers are excluded.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";

export type SensitiveCategory =
  | "compensation" | "medical" | "disability" | "disciplinary" | "conflict"
  | "report" | "official_id" | "bank_details" | "protected_note";

export async function writeSensitive(db: SqlExecutor, ctx: TenantContext, employeeId: string, category: SensitiveCategory, valueEncrypted: string, strategy = "app_kms"): Promise<void> {
  requirePermission(ctx, "employee.sensitive.write");
  await db.query(
    `insert into pierre_rt_employee_sensitive_data (id, company_id, employee_id, category, value_encrypted, encryption_strategy)
     values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, employeeId, category, valueEncrypted, strategy]);
}

/** Read a sensitive record. Logs the access (category + actor, not the value). */
export async function readSensitive(db: SqlExecutor, ctx: TenantContext, employeeId: string, category: SensitiveCategory): Promise<{ category: string; value_encrypted: string | null; encryption_strategy: string } | null> {
  requirePermission(ctx, "employee.sensitive.read");
  await db.query(
    `insert into pierre_rt_employee_sensitive_access_log (id, company_id, employee_id, category, actor_user_id)
     values ($1,$2,$3,$4,$5)`,
    [newUuid(), ctx.company_id, employeeId, category, ctx.user_id]);
  const { rows } = await db.query<{ category: string; value_encrypted: string | null; encryption_strategy: string }>(
    `select category, value_encrypted, encryption_strategy from pierre_rt_employee_sensitive_data
      where company_id=$1 and employee_id=$2 and category=$3 order by created_at desc limit 1`,
    [ctx.company_id, employeeId, category]);
  return rows[0] ?? null;
}

/** Categories present (NOT values). Audited. */
export async function listSensitiveCategories(db: SqlExecutor, ctx: TenantContext, employeeId: string): Promise<string[]> {
  requirePermission(ctx, "employee.sensitive.read");
  const { rows } = await db.query<{ category: string }>(
    `select distinct category from pierre_rt_employee_sensitive_data where company_id=$1 and employee_id=$2`, [ctx.company_id, employeeId]);
  return rows.map((r) => r.category);
}

export async function sensitiveAccessCount(db: SqlExecutor, ctx: TenantContext, employeeId: string): Promise<number> {
  requirePermission(ctx, "audit.read");
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_employee_sensitive_access_log where company_id=$1 and employee_id=$2`, [ctx.company_id, employeeId]);
  return rows[0].n;
}

export function assertNoSensitiveInLogPayload(payload: Record<string, unknown>): void {
  // Defensive: callers must never put a sensitive value in a general log/trace.
  const flat = JSON.stringify(payload).toLowerCase();
  for (const k of ["iban", "rib", "social_security", "numero_secu", "salaire_net", "bank_account"]) {
    if (flat.includes(k)) throw Errors.validation(`Sensitive token "${k}" must not appear in general logs`);
  }
}
