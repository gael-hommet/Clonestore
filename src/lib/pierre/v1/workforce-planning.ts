// P22 — governed Workforce Planning service. Persists a real, versioned workforce plan
// (pierre_rt_workforce_plans), tenant-scoped + permissioned. No headcount value is invented.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type WorkforcePlanRow = {
  id: string; company_id: string; mission_id: string | null; site_id: string | null;
  period: string; current_headcount: number; target_headcount: number; proposed_positions: unknown;
  assumptions: unknown; estimated_budget: string | null; status: string; validation_id: string | null;
  created_by: string | null; created_at: string; updated_at: string; version: number;
};

export async function createWorkforcePlan(
  db: SqlExecutor, ctx: TenantContext,
  input: { period: string; mission_id?: string | null; site_id?: string | null; current_headcount?: number; target_headcount?: number; proposed_positions?: unknown[]; assumptions?: Record<string, unknown>; estimated_budget?: number | null },
): Promise<WorkforcePlanRow> {
  requirePermission(ctx, "company.admin");
  if (!input.period?.trim()) throw Errors.validation("period is required");
  const id = newUuid();
  const { rows } = await db.query<WorkforcePlanRow>(
    `insert into pierre_rt_workforce_plans (id, company_id, mission_id, site_id, period, current_headcount, target_headcount, proposed_positions, assumptions, estimated_budget, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11) returning *`,
    [id, ctx.company_id, input.mission_id ?? null, input.site_id ?? null, input.period,
     input.current_headcount ?? 0, input.target_headcount ?? 0,
     JSON.stringify(input.proposed_positions ?? []), JSON.stringify(input.assumptions ?? {}),
     input.estimated_budget ?? null, ctx.user_id]);
  return rows[0];
}

export async function approveWorkforcePlan(db: SqlExecutor, ctx: TenantContext, id: string, validationId?: string | null): Promise<WorkforcePlanRow> {
  requirePermission(ctx, "company.admin");
  const { rows } = await db.query<WorkforcePlanRow>(
    `update pierre_rt_workforce_plans set status='approved', validation_id=$3, updated_at=now(), version=version+1
     where company_id=$1 and id=$2 returning *`, [ctx.company_id, id, validationId ?? null]);
  if (!rows[0]) throw Errors.notFound("Workforce plan not found");
  return rows[0];
}
