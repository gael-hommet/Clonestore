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

// ── Full-workflow objects (P22 depth) ────────────────────────────────────────────────────
export type ApplicationRow = { id: string; company_id: string; candidate_id: string; status: string; consent: boolean; version: number };
export type InterviewRow = { id: string; company_id: string; candidate_id: string; interview_type: string; status: string; scheduled_at: string | null; version: number };
export type FeedbackRow = { id: string; company_id: string; interview_id: string; recommendation: string; version: number };
export type OfferRow = { id: string; company_id: string; candidate_id: string; role_title: string; status: string; version: number };

async function assertCandidate(db: SqlExecutor, ctx: TenantContext, candidateId: string): Promise<void> {
  const { rows } = await db.query(`select 1 from pierre_rt_recruitment_candidates where company_id=$1 and id=$2`, [ctx.company_id, candidateId]);
  if (!rows[0]) throw Errors.notFound("Candidate not found");
}

export async function createApplication(
  db: SqlExecutor, ctx: TenantContext,
  input: { candidate_id: string; requisition_id?: string | null; mission_id?: string | null; source?: string | null; cv_file_id?: string | null; consent?: boolean },
): Promise<ApplicationRow> {
  requirePermission(ctx, "employee.write");
  await assertCandidate(db, ctx, input.candidate_id);
  const { rows } = await db.query<ApplicationRow>(
    `insert into pierre_rt_recruitment_applications (id, company_id, candidate_id, requisition_id, mission_id, source, cv_file_id, consent, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [ctx.company_id, input.candidate_id, input.requisition_id ?? null, input.mission_id ?? null, input.source ?? null, input.cv_file_id ?? null, input.consent ?? false, ctx.user_id]);
  return rows[0];
}

export async function prepareInterview(
  db: SqlExecutor, ctx: TenantContext,
  input: { candidate_id: string; requisition_id?: string | null; mission_id?: string | null; interview_type?: string; scheduled_at?: string | null; participants?: unknown[]; guide_ref?: string | null },
): Promise<InterviewRow> {
  requirePermission(ctx, "employee.write");
  await assertCandidate(db, ctx, input.candidate_id);
  const status = input.scheduled_at ? "scheduled" : "prepared";
  const { rows } = await db.query<InterviewRow>(
    `insert into pierre_rt_recruitment_interviews (id, company_id, candidate_id, requisition_id, mission_id, interview_type, scheduled_at, participants, guide_ref, status, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) returning *`,
    [ctx.company_id, input.candidate_id, input.requisition_id ?? null, input.mission_id ?? null, input.interview_type ?? "phone", input.scheduled_at ?? null, JSON.stringify(input.participants ?? []), input.guide_ref ?? null, status, ctx.user_id]);
  return rows[0];
}

/** Record interview feedback. The recommendation is ADVISORY — it never auto-decides; the final hire/
 *  reject decision stays human. Protected-characteristic criteria are not accepted (rejected upstream). */
export async function recordFeedback(
  db: SqlExecutor, ctx: TenantContext,
  input: { interview_id: string; candidate_id: string; recommendation?: string; criteria?: Record<string, unknown>; reservations?: string | null },
): Promise<FeedbackRow> {
  requirePermission(ctx, "employee.write");
  const rec = input.recommendation ?? "no_decision";
  if (!["no_decision", "advance", "hold", "decline"].includes(rec)) throw Errors.validation(`invalid recommendation: ${rec}`);
  const { rows: iv } = await db.query(`select 1 from pierre_rt_recruitment_interviews where company_id=$1 and id=$2`, [ctx.company_id, input.interview_id]);
  if (!iv[0]) throw Errors.notFound("Interview not found");
  const { rows } = await db.query<FeedbackRow>(
    `insert into pierre_rt_recruitment_feedback (id, company_id, interview_id, candidate_id, author_user_id, recommendation, criteria, reservations, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,$7,$4) returning *`,
    [ctx.company_id, input.interview_id, input.candidate_id, ctx.user_id, rec, JSON.stringify(input.criteria ?? {}), input.reservations ?? null]);
  return rows[0];
}

/** Prepare an offer. It starts 'draft' and is NEVER auto-sent — sending requires a separate human
 *  validation (submitOfferForValidation → approve → send). Compensation is a proposal, not a decision. */
export async function prepareOffer(
  db: SqlExecutor, ctx: TenantContext,
  input: { candidate_id: string; role_title: string; requisition_id?: string | null; mission_id?: string | null; proposed_comp?: Record<string, unknown>; contract_type?: string | null; document_id?: string | null },
): Promise<OfferRow> {
  requirePermission(ctx, "employee.write");
  await assertCandidate(db, ctx, input.candidate_id);
  if (!input.role_title?.trim()) throw Errors.validation("role_title is required");
  const { rows } = await db.query<OfferRow>(
    `insert into pierre_rt_recruitment_offers (id, company_id, candidate_id, requisition_id, mission_id, role_title, proposed_comp, contract_type, document_id, status, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,$7,$8,'draft',$9) returning *`,
    [ctx.company_id, input.candidate_id, input.requisition_id ?? null, input.mission_id ?? null, input.role_title, JSON.stringify(input.proposed_comp ?? {}), input.contract_type ?? null, input.document_id ?? null, ctx.user_id]);
  return rows[0];
}

export async function submitOfferForValidation(db: SqlExecutor, ctx: TenantContext, offerId: string, validationId?: string | null): Promise<OfferRow> {
  requirePermission(ctx, "employee.write");
  const { rows } = await db.query<OfferRow>(
    `update pierre_rt_recruitment_offers set status='awaiting_validation', validation_id=$3, updated_at=now(), version=version+1
     where company_id=$1 and id=$2 and status='draft' returning *`, [ctx.company_id, offerId, validationId ?? null]);
  if (!rows[0]) throw Errors.conflict("Offer not in a submittable state");
  return rows[0];
}
