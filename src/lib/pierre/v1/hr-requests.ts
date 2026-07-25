// P22 — governed HR Helpdesk service. Persists a real HR request/ticket (pierre_rt_hr_requests) with
// owner, status, priority, SLA, employee + mission links. Tracks from intake to resolution.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type HrRequestRow = {
  id: string; company_id: string; mission_id: string | null; employee_id: string | null;
  category: string; subject: string; body: string | null; status: string; priority: string;
  owner_user_id: string | null; sla_due_at: string | null; created_by: string | null; version: number;
};

const CATEGORIES = new Set(["general", "payroll", "absence", "contract", "onboarding", "sensitive", "other"]);
const STATUSES = new Set(["open", "in_progress", "awaiting_info", "escalated", "resolved", "closed"]);

export async function createHrRequest(
  db: SqlExecutor, ctx: TenantContext,
  input: { subject: string; body?: string | null; category?: string; priority?: string; employee_id?: string | null; mission_id?: string | null; sla_due_at?: string | null },
): Promise<HrRequestRow> {
  requirePermission(ctx, "employee.read");
  if (!input.subject?.trim()) throw Errors.validation("subject is required");
  const category = input.category ?? "general";
  if (!CATEGORIES.has(category)) throw Errors.validation(`invalid category: ${category}`);
  const id = newUuid();
  const { rows } = await db.query<HrRequestRow>(
    `insert into pierre_rt_hr_requests (id, company_id, mission_id, employee_id, category, subject, body, priority, sla_due_at, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [id, ctx.company_id, input.mission_id ?? null, input.employee_id ?? null, category, input.subject, input.body ?? null, input.priority ?? "normal", input.sla_due_at ?? null, ctx.user_id]);
  return rows[0];
}

export async function classifyHrRequest(db: SqlExecutor, ctx: TenantContext, id: string, category: string): Promise<HrRequestRow> {
  requirePermission(ctx, "employee.read");
  if (!CATEGORIES.has(category)) throw Errors.validation(`invalid category: ${category}`);
  const { rows } = await db.query<HrRequestRow>(
    `update pierre_rt_hr_requests set category=$3, updated_at=now(), version=version+1 where company_id=$1 and id=$2 returning *`,
    [ctx.company_id, id, category]);
  if (!rows[0]) throw Errors.notFound("HR request not found");
  return rows[0];
}

export async function transitionHrRequest(db: SqlExecutor, ctx: TenantContext, id: string, toStatus: string): Promise<HrRequestRow> {
  requirePermission(ctx, "employee.read");
  if (!STATUSES.has(toStatus)) throw Errors.validation(`invalid status: ${toStatus}`);
  const { rows } = await db.query<HrRequestRow>(
    `update pierre_rt_hr_requests set status=$3, updated_at=now(), version=version+1 where company_id=$1 and id=$2 returning *`,
    [ctx.company_id, id, toStatus]);
  if (!rows[0]) throw Errors.notFound("HR request not found");
  return rows[0];
}
