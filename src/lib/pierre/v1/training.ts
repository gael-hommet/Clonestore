// P22 — governed TRAINING service. Requirements → sessions → enrollments → attendance → proofs →
// certifications → expiry/renewals. Pierre NEVER invents a legal obligation/duration/periodicity or an
// obtained certification: a mandatory requirement without a verified source is CONFIGURATION_REQUIRED,
// and no certification is issued without a verified proof. Real objects in pierre_rt_training_*.
import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type TrainingMode = "brouillon" | "copilote" | "autonomie";
const SOURCED = new Set(["cloneadn", "country_pack", "company_policy", "provider", "human_authorized", "performance_action"]);

/** A REAL, active company policy — the concrete object a company_policy training source resolves against. */
export async function createCompanyPolicy(db: SqlExecutor, ctx: TenantContext, input: { policy_key: string; title: string; category?: string; status?: string }): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.policy_key?.trim() || !input.title?.trim()) throw Errors.validation("policy_key + title required");
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_company_policies (id, company_id, policy_key, title, category, status, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6)
     on conflict (company_id, policy_key) do update set title=excluded.title, category=excluded.category, status=excluded.status, updated_at=now(), version=pierre_rt_company_policies.version+1 returning id, status`,
    [ctx.company_id, input.policy_key, input.title, input.category ?? "hr", input.status ?? "active", ctx.user_id]);
  return rows[0];
}

/** A REAL, active training provider — the concrete object a provider training source resolves against. */
export async function registerTrainingProvider(db: SqlExecutor, ctx: TenantContext, input: { provider_key: string; name: string; status?: string }): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.provider_key?.trim() || !input.name?.trim()) throw Errors.validation("provider_key + name required");
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_training_providers (id, company_id, provider_key, name, status)
     values (gen_random_uuid(),$1,$2,$3,$4)
     on conflict (company_id, provider_key) do update set name=excluded.name, status=excluded.status, version=pierre_rt_training_providers.version+1 returning id, status`,
    [ctx.company_id, input.provider_key, input.name, input.status ?? "active"]);
  return rows[0];
}

/** A mandatory requirement without a verified source is CONFIGURATION_REQUIRED — never a fabricated
 *  legal obligation. A non-mandatory (company) requirement can be active. */
export async function createTrainingRequirement(
  db: SqlExecutor, ctx: TenantContext,
  input: { requirement_key: string; title: string; source_type?: string; source_ref?: string | null; mandatory?: boolean; recurrence_rule?: string | null; validity_months?: number | null; applies_to?: string; mission_id?: string | null; proof_required?: boolean },
): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.requirement_key?.trim() || !input.title?.trim()) throw Errors.validation("requirement_key + title required");
  const sourceType = input.source_type ?? "unsourced";
  const mandatory = input.mandatory === true;
  // A mandatory requirement is NOT active until its source is validated (validateTrainingRequirementSource):
  // unsourced ⇒ configuration_required; sourced-but-unverified ⇒ configuration_required until validated.
  const status = mandatory && !SOURCED.has(sourceType) ? "configuration_required" : mandatory ? "configuration_required" : "active";
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_training_requirements (id, company_id, mission_id, requirement_key, title, source_type, source_ref, applies_to, mandatory, recurrence_rule, validity_months, proof_required, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (company_id, requirement_key) do update set title=excluded.title, source_type=excluded.source_type, mandatory=excluded.mandatory, proof_required=excluded.proof_required, status=excluded.status returning id, status`,
    [ctx.company_id, input.mission_id ?? null, input.requirement_key, input.title, sourceType, input.source_ref ?? null, input.applies_to ?? "all", mandatory, input.recurrence_rule ?? null, input.validity_months ?? null, input.proof_required === true, status]);
  return rows[0];
}

/** REAL source validation. A mandatory requirement becomes 'active' ONLY when its declared source_ref
 *  resolves to a REAL tenant object of the declared source_type (not merely a non-empty string), and a
 *  durable verification record is persisted. A missing/unresolved source ⇒ configuration_required. */
export async function validateTrainingRequirementSource(db: SqlExecutor, ctx: TenantContext, requirementKey: string): Promise<{ status: string; reason: string; source_id: string | null }> {
  requirePermission(ctx, "employee.write");
  const req = (await db.query<{ id: string; source_type: string; source_ref: string | null; mandatory: boolean }>(
    `select id, source_type, source_ref, mandatory from pierre_rt_training_requirements where company_id=$1 and requirement_key=$2`, [ctx.company_id, requirementKey])).rows[0];
  if (!req) throw Errors.notFound("Requirement not found");
  const ref = req.source_ref;
  let ok = false; let reason = "unsourced"; let sourceId: string | null = null; let sourceVersion: string | null = null;

  if (ref) {
    if (req.source_type === "performance_action") {
      // The action item must exist in the tenant AND its action plan must be status='validated'
      // (which is only reachable through the canonical approval chain — see performance.ts).
      const r = (await db.query<{ id: string; v: number }>(
        `select ap.id, ap.version v from pierre_rt_performance_action_items ai
           join pierre_rt_performance_action_plans ap on ap.id=ai.plan_id and ap.company_id=ai.company_id
          where ai.company_id=$1 and ai.id=$2 and ap.status='validated'`, [ctx.company_id, ref])).rows[0];
      ok = !!r; sourceId = r?.id ?? null; sourceVersion = r ? String(r.v) : null;
      reason = ok ? "performance_action: action item linked to a validated action plan" : "action missing or its plan not validated";
    } else if (req.source_type === "company_policy") {
      // A REAL, active company policy in this tenant (matched by policy_key or id) — a string is not a source.
      const r = (await db.query<{ id: string; v: number }>(`select id, version v from pierre_rt_company_policies where company_id=$1 and (policy_key=$2 or id::text=$2) and status='active'`, [ctx.company_id, ref])).rows[0];
      ok = !!r; sourceId = r?.id ?? null; sourceVersion = r ? String(r.v) : null;
      reason = ok ? "company_policy: active policy resolved" : "no active company policy matches source_ref";
    } else if (req.source_type === "country_pack") {
      // A REAL, active country config (pack) bound to this tenant (matched by pack_key, country_code, or id).
      const r = (await db.query<{ id: string; v: number }>(`select id, version v from pierre_rt_country_configs where company_id=$1 and (pack_key=$2 or country_code=$2 or id::text=$2) and status='active'`, [ctx.company_id, ref])).rows[0];
      ok = !!r; sourceId = r?.id ?? null; sourceVersion = r ? String(r.v) : null;
      reason = ok ? "country_pack: active country config resolved" : "no active country pack bound to this tenant matches source_ref";
    } else if (req.source_type === "provider") {
      // A REAL, active training provider configured for this tenant.
      const r = (await db.query<{ id: string; v: number }>(`select id, version v from pierre_rt_training_providers where company_id=$1 and (provider_key=$2 or id::text=$2) and status='active'`, [ctx.company_id, ref])).rows[0];
      ok = !!r; sourceId = r?.id ?? null; sourceVersion = r ? String(r.v) : null;
      reason = ok ? "provider: active provider resolved" : "no active provider matches source_ref";
    } else if (req.source_type === "human_authorized") {
      // A REAL persisted, approved human authorization (a pierre_rt_validations decision that targets THIS
      // requirement) — actor + timestamp + reason are on the validation row.
      const r = (await db.query<{ id: string; decided_at: string | null }>(
        `select id, decided_at from pierre_rt_validations where company_id=$1 and status='approved' and risk_context->>'kind'='training_source' and risk_context->>'requirement_id'=$2 limit 1`, [ctx.company_id, req.id])).rows[0];
      ok = !!r; sourceId = r?.id ?? null; sourceVersion = null;
      reason = ok ? "human_authorized: approved human decision resolved" : "no approved human authorization targets this requirement";
    } else if (req.source_type === "cloneadn") {
      // No CloneADN rule registry exists as a persisted SQL object yet — honestly NOT verifiable here.
      ok = false; reason = "cloneadn registry not available as a persisted object (configuration_required)";
    }
  }

  const status = ok ? "active" : (req.mandatory ? "configuration_required" : "active");
  await db.query(`update pierre_rt_training_requirements set status=$3, version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, req.id, status]);
  // Persist a DURABLE source verification record (proof that the check ran and what it resolved to).
  const vstatus = ok ? "verified" : (ref ? "not_found" : "unverified");
  await db.query(
    `insert into pierre_rt_training_source_verifications (id, company_id, requirement_id, source_type, source_id, source_version, status, reason, evidence_ref, verified_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (company_id, requirement_id) do update set source_type=excluded.source_type, source_id=excluded.source_id, source_version=excluded.source_version, status=excluded.status, reason=excluded.reason, evidence_ref=excluded.evidence_ref, verified_by=excluded.verified_by, verified_at=now()`,
    [ctx.company_id, req.id, req.source_type, sourceId, sourceVersion, vstatus, reason, ref ?? null, ctx.user_id]);
  return { status, reason, source_id: sourceId };
}

export async function createTrainingPlan(db: SqlExecutor, ctx: TenantContext, input: { plan_key: string; title: string; mode?: TrainingMode; mission_id?: string | null; idempotency_key?: string | null }): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "employee.write");
  if (!input.plan_key?.trim() || !input.title?.trim()) throw Errors.validation("plan_key + title required");
  if (input.idempotency_key) {
    const ex = await db.query<{ id: string; status: string }>(`select id, status from pierre_rt_training_plans where company_id=$1 and idempotency_key=$2`, [ctx.company_id, input.idempotency_key]);
    if (ex.rows[0]) return ex.rows[0];
  }
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_training_plans (id, company_id, mission_id, plan_key, title, mode, status, idempotency_key, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,'draft',$6,$7) returning id, status`,
    [ctx.company_id, input.mission_id ?? null, input.plan_key, input.title, input.mode ?? "copilote", input.idempotency_key ?? null, ctx.user_id]);
  return rows[0];
}

export async function addTrainingPlanItem(db: SqlExecutor, ctx: TenantContext, planId: string, input: { requirement_id?: string | null; source_type?: string; source_ref?: string | null; priority?: string; session_id?: string | null }): Promise<{ id: string }> {
  requirePermission(ctx, "employee.write");
  const { rows } = await db.query<{ id: string }>(
    `insert into pierre_rt_training_plan_items (id, company_id, plan_id, requirement_id, source_type, source_ref, priority, session_id, status)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,'open') returning id`,
    [ctx.company_id, planId, input.requirement_id ?? null, input.source_type ?? "company_policy", input.source_ref ?? null, input.priority ?? "normal", input.session_id ?? null]);
  return rows[0];
}

/** A plan cannot complete while a required item stays open/blocked. */
export async function completeTrainingPlan(db: SqlExecutor, ctx: TenantContext, planId: string): Promise<{ completed: boolean; open_items: number }> {
  requirePermission(ctx, "employee.write");
  const openItems = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_training_plan_items where company_id=$1 and plan_id=$2 and status in ('open','in_progress','blocked')`, [ctx.company_id, planId])).rows[0].n);
  if (openItems > 0) throw Errors.conflict(`Cannot complete plan: ${openItems} item(s) still open`);
  await db.query(`update pierre_rt_training_plans set status='completed', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, planId]);
  return { completed: true, open_items: 0 };
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

/** A proof is verified by a SEPARATE, permissioned, traced action — never implicitly during issuance. */
export async function verifyTrainingProof(db: SqlExecutor, ctx: TenantContext, proofId: string, verifiedOn: string): Promise<{ status: string }> {
  requirePermission(ctx, "employee.write");
  const upd = await db.query<{ status: string }>(`update pierre_rt_training_proofs set status='verified', verified_on=$3, version=version+1 where company_id=$1 and id=$2 and status='received' returning status`, [ctx.company_id, proofId, verifiedOn]);
  if (upd.rows.length === 0) throw Errors.conflict("Proof not in a verifiable (received) state");
  return upd.rows[0];
}

/** Completion requires attendance=present AND, when proof is required, a VERIFIED proof. Otherwise the
 *  honest outcome is NEEDS_INFORMATION (missing) or under_review (received-but-unverified) — never a
 *  fake completion. */
export async function completeTrainingEnrollment(db: SqlExecutor, ctx: TenantContext, enrollmentId: string): Promise<{ completed: boolean; blocker?: string }> {
  requirePermission(ctx, "employee.write");
  const enr = (await db.query<{ requirement_id: string | null; session_id: string }>(`select requirement_id, session_id from pierre_rt_training_enrollments where company_id=$1 and id=$2`, [ctx.company_id, enrollmentId])).rows[0];
  if (!enr) throw Errors.notFound("Enrollment not found");
  const att = (await db.query<{ attendance_status: string }>(`select attendance_status from pierre_rt_training_attendance where company_id=$1 and enrollment_id=$2`, [ctx.company_id, enrollmentId])).rows[0];
  if (!att || att.attendance_status !== "present") throw Errors.conflict("Cannot complete without recorded attendance (present)");
  // proof_required from the requirement OR the session.
  const proofRequired = Number((await db.query<{ n: number }>(
    `select (coalesce((select proof_required from pierre_rt_training_requirements where company_id=$1 and id=$2),false)
             or coalesce((select proof_required from pierre_rt_training_sessions where company_id=$1 and id=$3),false))::int n`,
    [ctx.company_id, enr.requirement_id, enr.session_id])).rows[0].n) === 1;
  if (proofRequired) {
    const proof = (await db.query<{ status: string }>(`select status from pierre_rt_training_proofs where company_id=$1 and enrollment_id=$2 order by created_at desc limit 1`, [ctx.company_id, enrollmentId])).rows[0];
    if (!proof) { await db.query(`update pierre_rt_training_enrollments set status='blocked', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, enrollmentId]); return { completed: false, blocker: "NEEDS_INFORMATION: proof required and missing" }; }
    if (proof.status !== "verified") return { completed: false, blocker: "under_review: proof received but not verified" };
  }
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
  // The proof MUST already be verified by the separate verifyTrainingProof action — issuance never
  // self-verifies (that merge was too permissive and is now a hard refusal).
  if (proof.status !== "verified") throw Errors.conflict("Cannot certify: proof must be VERIFIED first (training.proof.verify)");
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

/** SQL-computed training report. Document rendering is NOT wired — reported as RENDERER_ACTIVATION_PENDING. */
export async function generateTrainingReport(db: SqlExecutor, ctx: TenantContext): Promise<Record<string, unknown>> {
  requirePermission(ctx, "employee.read");
  const brief = await buildTrainingBrief(db, ctx);
  const byReqStatus = (await db.query<{ status: string; n: number }>(
    `select status, count(*)::int n from pierre_rt_training_requirements where company_id=$1 group by status`, [ctx.company_id])).rows;
  return { computed_from: "sql", metrics: brief, requirements_by_status: byReqStatus, document: null, document_status: "RENDERER_ACTIVATION_PENDING" };
}

/** Honest invitation/reminder channel: recipients computed for real, but there is no messaging
 *  integration wired here so delivery is INTEGRATION_UNAVAILABLE — never a fake "invitations sent". */
export async function sendTrainingInvitations(db: SqlExecutor, ctx: TenantContext, sessionId: string): Promise<{ recipients: number; delivered: number; status: string }> {
  requirePermission(ctx, "employee.write");
  const recipients = Number((await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_training_enrollments where company_id=$1 and session_id=$2 and status in ('invited','confirmed')`, [ctx.company_id, sessionId])).rows[0].n);
  return { recipients, delivered: 0, status: "INTEGRATION_UNAVAILABLE" };
}
