// P22 — governed PERFORMANCE service. Campaigns → participants → interviews → responses → summary
// (human-validated) → objectives/actions. Pierre prepares/organizes/tracks; it NEVER auto-decides a
// score, promotion, sanction or ranking, and never marks an interview completed without a validated
// summary. Real objects in pierre_rt_performance_*. SUCCESS_WITHOUT_EXPECTED_PERFORMANCE_OBJECT = FAIL.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type PerfMode = "brouillon" | "copilote" | "autonomie";
export type CampaignRow = { id: string; company_id: string; campaign_key: string; mode: string; status: string; population_count: number; completion_percent: number; version: number };

async function loadCampaign(db: SqlExecutor, ctx: TenantContext, id: string): Promise<CampaignRow> {
  const { rows } = await db.query<CampaignRow>(`select * from pierre_rt_performance_campaigns where company_id=$1 and id=$2`, [ctx.company_id, id]);
  if (!rows[0]) throw Errors.notFound("Campaign not found");
  return rows[0];
}

export async function createPerformanceCampaign(
  db: SqlExecutor, ctx: TenantContext,
  input: { campaign_key: string; title: string; campaign_type?: string; starts_on?: string | null; ends_on?: string | null; mode?: PerfMode; mission_id?: string | null; idempotency_key?: string | null },
): Promise<CampaignRow> {
  requirePermission(ctx, "employee.write");
  if (!input.campaign_key?.trim() || !input.title?.trim()) throw Errors.validation("campaign_key + title required");
  if (input.idempotency_key) {
    const ex = await db.query<CampaignRow>(`select * from pierre_rt_performance_campaigns where company_id=$1 and idempotency_key=$2`, [ctx.company_id, input.idempotency_key]);
    if (ex.rows[0]) return ex.rows[0];
  }
  const { rows } = await db.query<CampaignRow>(
    `insert into pierre_rt_performance_campaigns (id, company_id, mission_id, campaign_key, title, campaign_type, starts_on, ends_on, mode, status, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,'preparing',$9) returning *`,
    [ctx.company_id, input.mission_id ?? null, input.campaign_key, input.title, input.campaign_type ?? "annual_review", input.starts_on ?? null, input.ends_on ?? null, input.mode ?? "copilote", ctx.user_id]);
  return rows[0];
}

/** Add every active employee as a participant (idempotent), routed to their manager/site. */
export async function buildCampaignPopulation(db: SqlExecutor, ctx: TenantContext, campaignId: string): Promise<{ added: number; population: number }> {
  requirePermission(ctx, "employee.write");
  await loadCampaign(db, ctx, campaignId);
  const emps = (await db.query<{ id: string; manager_employee_id: string | null; site_id: string | null }>(
    `select id, manager_employee_id, site_id from pierre_rt_employees where company_id=$1 and status='active'`, [ctx.company_id])).rows;
  let added = 0;
  for (const e of emps) {
    const ins = await db.query<{ id: string }>(
      `insert into pierre_rt_performance_campaign_participants (id, company_id, campaign_id, employee_id, manager_employee_id, site_id, status)
       values (gen_random_uuid(),$1,$2,$3,$4,$5,'pending') on conflict (company_id, campaign_id, employee_id) do nothing returning id`,
      [ctx.company_id, campaignId, e.id, e.manager_employee_id, e.site_id]);
    if (ins.rows.length > 0) added += 1;
  }
  await db.query(`update pierre_rt_performance_campaigns set population_count=$3, status='in_progress', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, campaignId, emps.length]);
  return { added, population: emps.length };
}

export async function createPerformanceInterview(db: SqlExecutor, ctx: TenantContext, campaignId: string, participantId: string): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  const c = await loadCampaign(db, ctx, campaignId);
  const part = (await db.query<{ employee_id: string; manager_employee_id: string | null }>(`select employee_id, manager_employee_id from pierre_rt_performance_campaign_participants where company_id=$1 and id=$2 and campaign_id=$3`, [ctx.company_id, participantId, campaignId])).rows[0];
  if (!part) throw Errors.notFound("Participant not found");
  // Mode-aware initial status: brouillon=draft, copilote=prepared, autonomie=scheduled.
  const status = c.mode === "brouillon" ? "draft" : c.mode === "autonomie" ? "scheduled" : "prepared";
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_performance_interviews (id, company_id, campaign_id, participant_id, employee_id, manager_employee_id, interview_type, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7) returning id, status`,
    [ctx.company_id, campaignId, participantId, part.employee_id, part.manager_employee_id, c.campaign_key, status]);
  return rows[0];
}

export async function recordPerformanceResponse(
  db: SqlExecutor, ctx: TenantContext, interviewId: string,
  input: { respondent_type: "employee" | "manager" | "hr"; question_key: string; response: string; visibility?: "restricted" | "shared" },
): Promise<void> {
  requirePermission(ctx, "employee.write");
  const iv = (await db.query(`select 1 from pierre_rt_performance_interviews where company_id=$1 and id=$2`, [ctx.company_id, interviewId])).rows[0];
  if (!iv) throw Errors.notFound("Interview not found");
  await db.query(
    `insert into pierre_rt_performance_responses (id, company_id, interview_id, respondent_type, respondent_id, question_key, response, visibility)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7)
     on conflict (company_id, interview_id, respondent_type, question_key) do update set response=excluded.response, submitted_at=now(), version=pierre_rt_performance_responses.version+1`,
    [ctx.company_id, interviewId, input.respondent_type, ctx.user_id, input.question_key, input.response, input.visibility ?? "restricted"]);
}

/** Build a summary FROM the recorded responses. Not a decision — a structured, human-validated draft. */
export async function buildPerformanceSummary(db: SqlExecutor, ctx: TenantContext, interviewId: string): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  const responses = (await db.query<{ respondent_type: string; question_key: string; response: string }>(`select respondent_type, question_key, response from pierre_rt_performance_responses where company_id=$1 and interview_id=$2`, [ctx.company_id, interviewId])).rows;
  if (responses.length === 0) throw Errors.validation("no responses to summarize");
  const structured = { responses_count: responses.length, by_respondent: responses.reduce((acc: Record<string, number>, r) => { acc[r.respondent_type] = (acc[r.respondent_type] ?? 0) + 1; return acc; }, {}) };
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_performance_summaries (id, company_id, interview_id, structured_summary, status)
     values (gen_random_uuid(),$1,$2,$3::jsonb,'draft')
     on conflict (company_id, interview_id) do update set structured_summary=excluded.structured_summary, status='draft', version=pierre_rt_performance_summaries.version+1 returning id, status`,
    [ctx.company_id, interviewId, JSON.stringify(structured)]);
  await db.query(`update pierre_rt_performance_interviews set status='under_review', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, interviewId]);
  return rows[0];
}

export async function validatePerformanceSummary(db: SqlExecutor, ctx: TenantContext, interviewId: string): Promise<void> {
  requirePermission(ctx, "employee.write");
  const upd = await db.query<{ id: string }>(`update pierre_rt_performance_summaries set status='validated', version=version+1 where company_id=$1 and interview_id=$2 and status in ('draft','awaiting_validation') returning id`, [ctx.company_id, interviewId]);
  if (upd.rows.length === 0) throw Errors.conflict("No summary to validate");
  await db.query(`update pierre_rt_performance_interviews set status='awaiting_validation', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, interviewId]);
}

/** An interview completes ONLY with responses AND a validated summary — never auto-completed. */
export async function completePerformanceInterview(db: SqlExecutor, ctx: TenantContext, interviewId: string): Promise<{ completed: boolean }> {
  requirePermission(ctx, "employee.write");
  const validated = (await db.query(`select 1 from pierre_rt_performance_summaries where company_id=$1 and interview_id=$2 and status='validated'`, [ctx.company_id, interviewId])).rows[0];
  if (!validated) throw Errors.conflict("Cannot complete: summary not validated");
  await db.query(`update pierre_rt_performance_interviews set status='completed', completed_at=now(), updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, interviewId]);
  return { completed: true };
}

export async function createPerformanceObjective(db: SqlExecutor, ctx: TenantContext, input: { employee_id: string; title: string; interview_id?: string | null; campaign_id?: string | null; success_criteria?: string | null; due_on?: string | null }): Promise<{ id: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.title?.trim()) throw Errors.validation("title required");
  const { rows } = await db.query<{ id: string }>(
    `insert into pierre_rt_performance_objectives (id, company_id, employee_id, interview_id, campaign_id, title, success_criteria, due_on, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,'open') returning id`,
    [ctx.company_id, input.employee_id, input.interview_id ?? null, input.campaign_id ?? null, input.title, input.success_criteria ?? null, input.due_on ?? null]);
  return rows[0];
}

export async function createPerformanceActionItem(db: SqlExecutor, ctx: TenantContext, input: { employee_id?: string | null; interview_id?: string | null; campaign_id?: string | null; action: string; owner?: string | null; due_on?: string | null; plan_key?: string | null }): Promise<{ id: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.action?.trim()) throw Errors.validation("action required");
  const { rows } = await db.query<{ id: string }>(
    `insert into pierre_rt_performance_action_items (id, company_id, employee_id, interview_id, campaign_id, plan_key, action, owner, due_on, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,'open') returning id`,
    [ctx.company_id, input.employee_id ?? null, input.interview_id ?? null, input.campaign_id ?? null, input.plan_key ?? null, input.action, input.owner ?? null, input.due_on ?? null]);
  return rows[0];
}

/** Deterministic overdue detection: open action items past their due date. */
export async function detectOverduePerformanceItems(db: SqlExecutor, ctx: TenantContext, asOf: string): Promise<{ overdue: number }> {
  requirePermission(ctx, "employee.write");
  const upd = await db.query<{ id: string }>(`update pierre_rt_performance_action_items set status='overdue', version=version+1 where company_id=$1 and status='open' and due_on is not null and due_on < $2 returning id`, [ctx.company_id, asOf]);
  return { overdue: upd.rows.length };
}

export async function computePerformanceCampaignProgress(db: SqlExecutor, ctx: TenantContext, campaignId: string): Promise<number> {
  requirePermission(ctx, "employee.read");
  const total = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_performance_interviews where company_id=$1 and campaign_id=$2`, [ctx.company_id, campaignId])).rows[0].n);
  const done = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_performance_interviews where company_id=$1 and campaign_id=$2 and status='completed'`, [ctx.company_id, campaignId])).rows[0].n);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  await db.query(`update pierre_rt_performance_campaigns set completion_percent=$3, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, campaignId, pct]);
  return pct;
}

export async function buildPerformanceBrief(db: SqlExecutor, ctx: TenantContext, campaignId: string): Promise<Record<string, unknown>> {
  requirePermission(ctx, "employee.read");
  const c = await loadCampaign(db, ctx, campaignId);
  const n = async (sql: string) => Number((await db.query<{ n: number }>(sql, [ctx.company_id, campaignId])).rows[0].n);
  return {
    campaign_key: c.campaign_key, population: c.population_count,
    interviews: await n(`select count(*)::int n from pierre_rt_performance_interviews where company_id=$1 and campaign_id=$2`),
    completed_interviews: await n(`select count(*)::int n from pierre_rt_performance_interviews where company_id=$1 and campaign_id=$2 and status='completed'`),
    objectives: await n(`select count(*)::int n from pierre_rt_performance_objectives where company_id=$1 and campaign_id=$2`),
    open_actions: await n(`select count(*)::int n from pierre_rt_performance_action_items where company_id=$1 and campaign_id=$2 and status in ('open','overdue')`),
    completion_percent: c.completion_percent,
    note: "Pierre prepares and tracks; final performance/promotion/sanction decisions remain human.",
  };
}
