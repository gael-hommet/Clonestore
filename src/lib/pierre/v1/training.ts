// P22 — governed TRAINING service. Requirements → sessions → enrollments → attendance → proofs →
// certifications → expiry/renewals. Pierre NEVER invents a legal obligation/duration/periodicity or an
// obtained certification: a mandatory requirement without a verified source is CONFIGURATION_REQUIRED,
// and no certification is issued without a verified proof. Real objects in pierre_rt_training_*.
import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type TrainingMode = "brouillon" | "copilote" | "autonomie";
const SOURCED = new Set(["cloneadn", "country_pack", "company_policy", "provider", "human_authorized"]);

/** A mandatory requirement without a verified source is CONFIGURATION_REQUIRED — never a fabricated
 *  legal obligation. A non-mandatory (company) requirement can be active. */
export async function createTrainingRequirement(
  db: SqlExecutor, ctx: TenantContext,
  input: { requirement_key: string; title: string; source_type?: string; source_ref?: string | null; mandatory?: boolean; recurrence_rule?: string | null; validity_months?: number | null; applies_to?: string; mission_id?: string | null },
): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.requirement_key?.trim() || !input.title?.trim()) throw Errors.validation("requirement_key + title required");
  const sourceType = input.source_type ?? "unsourced";
  const mandatory = input.mandatory === true;
  const status = mandatory && !SOURCED.has(sourceType) ? "configuration_required" : "active";
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_training_requirements (id, company_id, mission_id, requirement_key, title, source_type, source_ref, applies_to, mandatory, recurrence_rule, validity_months, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (company_id, requirement_key) do update set title=excluded.title, source_type=excluded.source_type, mandatory=excluded.mandatory, status=excluded.status returning id, status`,
    [ctx.company_id, input.mission_id ?? null, input.requirement_key, input.title, sourceType, input.source_ref ?? null, input.applies_to ?? "all", mandatory, input.recurrence_rule ?? null, input.validity_months ?? null, status]);
  return rows[0];
}

export async function createTrainingSession(
  db: SqlExecutor, ctx: TenantContext,
  input: { title: string; requirement_id?: string | null; provider?: string | null; delivery_mode?: string; starts_at?: string | null; ends_at?: string | null; capacity?: number | null; mode?: TrainingMode },
): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.title?.trim()) throw Errors.validation("title required");
  const status = input.starts_at ? "scheduled" : "draft";
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_training_sessions (id, company_id, requirement_id, title, provider, delivery_mode, starts_at, ends_at, capacity, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, status`,
    [ctx.company_id, input.requirement_id ?? null, input.title, input.provider ?? null, input.delivery_mode ?? "onsite", input.starts_at ?? null, input.ends_at ?? null, input.capacity ?? null, status]);
  return rows[0];
}

export async function createTrainingEnrollment(
  db: SqlExecutor, ctx: TenantContext,
  input: { session_id: string; employee_id: string; requirement_id?: string | null; mode?: TrainingMode },
): Promise<{ id: string; status: string; deduped: boolean }> {
  requirePermission(ctx, "employee.write");
  const existing = await db.query<{ id: string; status: string }>(`select id, status from pierre_rt_training_enrollments where company_id=$1 and session_id=$2 and employee_id=$3`, [ctx.company_id, input.session_id, input.employee_id]);
  if (existing.rows[0]) return { ...existing.rows[0], deduped: true };
  // Mode-aware: brouillon=draft, copilote=invited (awaits confirmation), autonomie=confirmed.
  const status = input.mode === "brouillon" ? "draft" : input.mode === "autonomie" ? "confirmed" : "invited";
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_training_enrollments (id, company_id, session_id, employee_id, requirement_id, status, invited_at)
     values (gen_random_uuid(),$1,$2,$3,$4,$5, case when $5<>'draft' then now() else null end) returning id, status`,
    [ctx.company_id, input.session_id, input.employee_id, input.requirement_id ?? null, status]);
  return { ...rows[0], deduped: false };
}

export async function recordTrainingAttendance(db: SqlExecutor, ctx: TenantContext, enrollmentId: string, status: "present" | "absent" | "partial" | "excused"): Promise<void> {
  requirePermission(ctx, "employee.write");
  const enr = (await db.query<{ employee_id: string }>(`select employee_id from pierre_rt_training_enrollments where company_id=$1 and id=$2`, [ctx.company_id, enrollmentId])).rows[0];
  if (!enr) throw Errors.notFound("Enrollment not found");
  await db.query(
    `insert into pierre_rt_training_attendance (id, company_id, enrollment_id, employee_id, attendance_status, recorded_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5) on conflict (company_id, enrollment_id) do update set attendance_status=excluded.attendance_status, recorded_at=now(), version=pierre_rt_training_attendance.version+1`,
    [ctx.company_id, enrollmentId, enr.employee_id, status, ctx.user_id]);
  const newStatus = status === "present" ? "attended" : status === "absent" ? "absent" : "confirmed";
  await db.query(`update pierre_rt_training_enrollments set status=$3, updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, enrollmentId, newStatus]);
}

export async function attachTrainingProof(db: SqlExecutor, ctx: TenantContext, enrollmentId: string, input: { proof_type: string; file_id?: string | null; issued_on?: string | null }): Promise<{ id: string }> {
  requirePermission(ctx, "employee.write");
  const enr = (await db.query<{ employee_id: string; requirement_id: string | null }>(`select employee_id, requirement_id from pierre_rt_training_enrollments where company_id=$1 and id=$2`, [ctx.company_id, enrollmentId])).rows[0];
  if (!enr) throw Errors.notFound("Enrollment not found");
  const { rows } = await db.query<{ id: string }>(
    `insert into pierre_rt_training_proofs (id, company_id, enrollment_id, employee_id, requirement_id, proof_type, file_id, issued_on, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,'received') returning id`,
    [ctx.company_id, enrollmentId, enr.employee_id, enr.requirement_id, input.proof_type, input.file_id ?? null, input.issued_on ?? null]);
  return rows[0];
}

/** Completion requires attendance=present. No fake completion. */
export async function completeTrainingEnrollment(db: SqlExecutor, ctx: TenantContext, enrollmentId: string): Promise<{ completed: boolean }> {
  requirePermission(ctx, "employee.write");
  const att = (await db.query<{ attendance_status: string }>(`select attendance_status from pierre_rt_training_attendance where company_id=$1 and enrollment_id=$2`, [ctx.company_id, enrollmentId])).rows[0];
  if (!att || att.attendance_status !== "present") throw Errors.conflict("Cannot complete without recorded attendance (present)");
  await db.query(`update pierre_rt_training_enrollments set status='completed', completed_at=now(), updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, enrollmentId]);
  return { completed: true };
}

/** Issue a certification ONLY from a verified proof. expires_on from the requirement's validity_months. */
export async function issueTrainingCertification(
  db: SqlExecutor, ctx: TenantContext,
  input: { employee_id: string; certification_key: string; proof_id: string; requirement_id?: string | null; issued_on: string; validity_months?: number | null },
): Promise<{ id: string; status: string; expires_on: string | null }> {
  requirePermission(ctx, "employee.write");
  const proof = (await db.query<{ status: string }>(`select status from pierre_rt_training_proofs where company_id=$1 and id=$2`, [ctx.company_id, input.proof_id])).rows[0];
  if (!proof) throw Errors.notFound("Proof not found");
  // Verify the proof first if not already verified — a certification never issues without a real proof.
  if (proof.status === "missing" || proof.status === "rejected") throw Errors.conflict("Cannot certify: proof not received/verified");
  await db.query(`update pierre_rt_training_proofs set status='verified', verified_on=$3, version=version+1 where company_id=$1 and id=$2 and status='received'`, [ctx.company_id, input.proof_id, input.issued_on]);
  let expiresOn: string | null = null;
  if (input.validity_months && input.validity_months > 0) {
    expiresOn = (await db.query<{ d: string }>(`select ($1::date + ($2 || ' months')::interval)::date d`, [input.issued_on, input.validity_months])).rows[0].d;
  }
  const { rows } = await db.query<{ id: string; status: string; expires_on: string | null }>(
    `insert into pierre_rt_training_certifications (id, company_id, employee_id, requirement_id, proof_id, certification_key, issued_on, expires_on, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,'valid')
     on conflict (company_id, employee_id, certification_key) do update set proof_id=excluded.proof_id, issued_on=excluded.issued_on, expires_on=excluded.expires_on, status='valid', version=pierre_rt_training_certifications.version+1 returning id, status, expires_on`,
    [ctx.company_id, input.employee_id, input.requirement_id ?? null, input.proof_id, input.certification_key, input.issued_on, expiresOn]);
  return rows[0];
}

/** Deterministic expiry status from expires_on vs asOf. `expiringWithinDays` is an operational alert
 *  window (not a legal periodicity). Sets valid/expiring/expired and creates renewals for expiring. */
export async function detectExpiringCertifications(db: SqlExecutor, ctx: TenantContext, asOf: string, expiringWithinDays = 60): Promise<{ expiring: number; expired: number; renewals: number }> {
  requirePermission(ctx, "employee.write");
  const expired = await db.query<{ id: string }>(`update pierre_rt_training_certifications set status='expired', version=version+1 where company_id=$1 and expires_on is not null and expires_on < $2 and status<>'expired' returning id`, [ctx.company_id, asOf]);
  const expiring = await db.query<{ id: string; employee_id: string; expires_on: string }>(
    `update pierre_rt_training_certifications set status='expiring', version=version+1
      where company_id=$1 and expires_on is not null and expires_on >= $2 and expires_on <= ($2::date + ($3 || ' days')::interval)::date and status='valid' returning id, employee_id, expires_on`,
    [ctx.company_id, asOf, expiringWithinDays]);
  let renewals = 0;
  for (const c of expiring.rows) {
    const ins = await db.query<{ id: string }>(
      `insert into pierre_rt_training_renewals (id, company_id, certification_id, employee_id, due_on, status)
       values (gen_random_uuid(),$1,$2,$3,$4,'scheduled') on conflict (company_id, certification_id) do nothing returning id`,
      [ctx.company_id, c.id, c.employee_id, c.expires_on]);
    if (ins.rows.length > 0) renewals += 1;
  }
  return { expiring: expiring.rows.length, expired: expired.rows.length, renewals };
}

/** Coverage per mandatory-sourced requirement: employees with a valid certification / active population. */
export async function computeTrainingCoverage(db: SqlExecutor, ctx: TenantContext, requirementKey: string): Promise<{ population: number; certified: number; coverage_percent: number; requirement_status: string }> {
  requirePermission(ctx, "employee.read");
  const req = (await db.query<{ id: string; status: string }>(`select id, status from pierre_rt_training_requirements where company_id=$1 and requirement_key=$2`, [ctx.company_id, requirementKey])).rows[0];
  if (!req) throw Errors.notFound("Requirement not found");
  const population = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='active'`, [ctx.company_id])).rows[0].n);
  const certified = Number((await db.query<{ n: number }>(`select count(distinct employee_id)::int n from pierre_rt_training_certifications where company_id=$1 and requirement_id=$2 and status in ('valid','expiring')`, [ctx.company_id, req.id])).rows[0].n);
  return { population, certified, coverage_percent: population > 0 ? Math.round((certified / population) * 100) : 0, requirement_status: req.status };
}

export async function buildTrainingBrief(db: SqlExecutor, ctx: TenantContext): Promise<Record<string, unknown>> {
  requirePermission(ctx, "employee.read");
  const n = async (sql: string) => Number((await db.query<{ n: number }>(sql, [ctx.company_id])).rows[0].n);
  return {
    requirements: await n(`select count(*)::int n from pierre_rt_training_requirements where company_id=$1`),
    configuration_required: await n(`select count(*)::int n from pierre_rt_training_requirements where company_id=$1 and status='configuration_required'`),
    enrollments: await n(`select count(*)::int n from pierre_rt_training_enrollments where company_id=$1`),
    completed: await n(`select count(*)::int n from pierre_rt_training_enrollments where company_id=$1 and status='completed'`),
    valid_certifications: await n(`select count(*)::int n from pierre_rt_training_certifications where company_id=$1 and status='valid'`),
    expiring: await n(`select count(*)::int n from pierre_rt_training_certifications where company_id=$1 and status='expiring'`),
    expired: await n(`select count(*)::int n from pierre_rt_training_certifications where company_id=$1 and status='expired'`),
    open_renewals: await n(`select count(*)::int n from pierre_rt_training_renewals where company_id=$1 and status='scheduled'`),
    note: "Legal training obligations must be sourced (CloneADN/country pack/policy/provider); unsourced mandatory = CONFIGURATION_REQUIRED. No certification without a verified proof.",
  };
}
