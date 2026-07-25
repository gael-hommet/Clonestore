// P22 — governed Recruitment service. Persists real requisitions/candidates and pipeline transitions
// (pierre_rt_recruitment_*). Pierre analyses/prepares/tracks; it NEVER auto-decides hiring, ranks on a
// protected characteristic, or invents candidate experience. No candidate value is fabricated here.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type RequisitionRow = { id: string; company_id: string; role_title: string; headcount: number; status: string; version: number };
export type CandidateRow = { id: string; company_id: string; requisition_id: string | null; full_name: string; pipeline_stage: string; status: string; version: number };

const PIPELINE_STAGES = new Set(["new", "screening", "interview", "reference", "offer", "hired", "rejected", "withdrawn"]);

export async function createRequisition(
  db: SqlExecutor, ctx: TenantContext,
  input: { role_title: string; headcount?: number; mission_id?: string | null; site_id?: string | null; contract_type?: string | null },
): Promise<RequisitionRow> {
  requirePermission(ctx, "employee.write");
  if (!input.role_title?.trim()) throw Errors.validation("role_title is required");
  const id = newUuid();
  const { rows } = await db.query<RequisitionRow>(
    `insert into pierre_rt_recruitment_requisitions (id, company_id, mission_id, site_id, role_title, headcount, contract_type, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [id, ctx.company_id, input.mission_id ?? null, input.site_id ?? null, input.role_title, input.headcount ?? 1, input.contract_type ?? null, ctx.user_id]);
  return rows[0];
}

export async function ingestCandidate(
  db: SqlExecutor, ctx: TenantContext,
  input: { full_name: string; requisition_id?: string | null; mission_id?: string | null; source?: string | null; metadata?: Record<string, unknown> },
): Promise<CandidateRow> {
  requirePermission(ctx, "employee.write");
  if (!input.full_name?.trim()) throw Errors.validation("full_name is required");
  const id = newUuid();
  const { rows } = await db.query<CandidateRow>(
    `insert into pierre_rt_recruitment_candidates (id, company_id, requisition_id, mission_id, full_name, source, metadata, created_by)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning *`,
    [id, ctx.company_id, input.requisition_id ?? null, input.mission_id ?? null, input.full_name, input.source ?? null, JSON.stringify(input.metadata ?? {}), ctx.user_id]);
  return rows[0];
}

/** Transition a candidate to a new pipeline stage. 'hired' is NOT a final autonomous decision — it only
 *  records that a HUMAN hiring decision was taken elsewhere; the guard below refuses an unknown stage. */
export async function transitionCandidate(
  db: SqlExecutor, ctx: TenantContext, candidateId: string, toStage: string,
): Promise<CandidateRow> {
  requirePermission(ctx, "employee.write");
  if (!PIPELINE_STAGES.has(toStage)) throw Errors.validation(`invalid pipeline stage: ${toStage}`);
  const { rows } = await db.query<CandidateRow>(
    `update pierre_rt_recruitment_candidates set pipeline_stage=$3, updated_at=now(), version=version+1
     where company_id=$1 and id=$2 returning *`, [ctx.company_id, candidateId, toStage]);
  if (!rows[0]) throw Errors.notFound("Candidate not found");
  return rows[0];
}
