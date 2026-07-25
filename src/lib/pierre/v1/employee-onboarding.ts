// P22 — governed EMPLOYEE onboarding service (a salaried arrival). Real business objects across
// pierre_rt_employee_onboarding_* (case/steps/requirements/assets/access/comms/calendar/followups).
// Generic: the default plan is the same engine for any arrival — no hard-coded response to one phrase.
// Mode-aware: brouillon prepares drafts only; copilote gates on validation; autonomie readies safe
// internal steps but STILL stops at the mandatory human validation (contract). No fake external effect.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type OnboardingMode = "brouillon" | "copilote" | "autonomie";
export type OnboardingCaseRow = {
  id: string; company_id: string; mission_id: string | null; employee_id: string | null;
  site_id: string | null; manager_employee_id: string | null; job_title: string | null;
  start_date: string | null; mode: string; status: string; progress_percent: number;
  blocking_reason: string | null; validation_id: string | null; version: number;
};

async function loadCase(db: SqlExecutor, ctx: TenantContext, id: string): Promise<OnboardingCaseRow> {
  const { rows } = await db.query<OnboardingCaseRow>(
    `select * from pierre_rt_employee_onboarding_cases where company_id=$1 and id=$2`, [ctx.company_id, id]);
  if (!rows[0]) throw Errors.notFound("Onboarding case not found");
  return rows[0];
}

export async function createEmployeeOnboardingCase(
  db: SqlExecutor, ctx: TenantContext,
  input: { mission_id?: string | null; employee_id?: string | null; site_id?: string | null; manager_employee_id?: string | null; job_title?: string | null; start_date?: string | null; mode?: OnboardingMode; idempotency_key?: string | null },
): Promise<OnboardingCaseRow> {
  requirePermission(ctx, "employee.write");
  const mode = input.mode ?? "copilote";
  // Idempotent on (company, idempotency_key): the same instruction+key yields ONE case.
  if (input.idempotency_key) {
    const existing = await db.query<OnboardingCaseRow>(
      `select * from pierre_rt_employee_onboarding_cases where company_id=$1 and idempotency_key=$2`, [ctx.company_id, input.idempotency_key]);
    if (existing.rows[0]) return existing.rows[0];
  }
  const { rows } = await db.query<OnboardingCaseRow>(
    `insert into pierre_rt_employee_onboarding_cases (id, company_id, mission_id, employee_id, site_id, manager_employee_id, job_title, start_date, mode, status, idempotency_key, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10) returning *`,
    [ctx.company_id, input.mission_id ?? null, input.employee_id ?? null, input.site_id ?? null, input.manager_employee_id ?? null, input.job_title ?? null, input.start_date ?? null, mode, input.idempotency_key ?? null, ctx.user_id]);
  return rows[0];
}

// The canonical default plan (generic, configurable via mode). Produces >=7 steps incl. >=1 validation
// step, plus requirements/assets/access/communications/calendar/followups. Statuses differ by mode so
// the SAME arrival yields genuinely different persisted effects per mode (not just different text).
const DEFAULT_STEPS: Array<{ key: string; category: string; label: string; owner: string; validation?: boolean; safe_internal?: boolean }> = [
  { key: "identity", category: "identity", label: "Vérifier l'identité et les coordonnées", owner: "pierre", safe_internal: true },
  { key: "contract", category: "contract", label: "Valider le contrat et la date d'entrée", owner: "hr", validation: true },
  { key: "documents", category: "documents", label: "Demander les pièces manquantes", owner: "pierre", safe_internal: true },
  { key: "access", category: "access", label: "Préparer les accès", owner: "it", safe_internal: true },
  { key: "equipment", category: "equipment", label: "Préparer le matériel", owner: "it", safe_internal: true },
  { key: "manager_intro", category: "manager", label: "Informer le manager et l'équipe", owner: "pierre", safe_internal: true },
  { key: "day_one_plan", category: "calendar", label: "Préparer le planning du premier jour", owner: "pierre", safe_internal: true },
  { key: "welcome", category: "communication", label: "Préparer le kit / message d'accueil", owner: "pierre", safe_internal: true },
  { key: "week_one", category: "week_one", label: "Organiser le suivi semaine 1", owner: "manager", safe_internal: true },
  { key: "month_one", category: "month_one", label: "Organiser le suivi mois 1", owner: "manager", safe_internal: true },
  { key: "probation", category: "probation", label: "Programmer la fin de période d'essai", owner: "hr", safe_internal: true },
];

export async function createDefaultOnboardingPlan(db: SqlExecutor, ctx: TenantContext, caseId: string): Promise<{ steps: number; requirements: number; assets: number; access: number; communications: number; calendar: number; followups: number }> {
  requirePermission(ctx, "employee.write");
  const c = await loadCase(db, ctx, caseId);
  const mode = c.mode as OnboardingMode;

  // step status by mode: autonomie readies safe internal steps; others leave them pending.
  const safeStatus = mode === "autonomie" ? "ready" : "pending";
  let ord = 0;
  for (const s of DEFAULT_STEPS) {
    const status = s.validation ? "pending" : (s.safe_internal ? safeStatus : "pending");
    await db.query(
      `insert into pierre_rt_employee_onboarding_steps (id, company_id, case_id, step_key, category, label, step_ordinal, owner_type, status, required, validation_required)
       values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,true,$9) on conflict (company_id, case_id, step_key) do nothing`,
      [ctx.company_id, caseId, s.key, s.category, s.label, ord++, s.owner, status, s.validation === true]);
  }
  // requirements (blocking ones gate readiness)
  const reqs: Array<[string, string, boolean]> = [
    ["id_document", "Pièce d'identité", true], ["rib", "RIB", true], ["signed_contract", "Contrat signé", true], ["medical_cert", "Visite médicale", false],
  ];
  for (const [type, label, blocking] of reqs) {
    await db.query(
      `insert into pierre_rt_employee_onboarding_requirements (id, company_id, case_id, requirement_type, label, required, blocking, status, requested_at)
       values (gen_random_uuid(),$1,$2,$3,$4,true,$5,'requested',now()) on conflict (company_id, case_id, requirement_type) do nothing`,
      [ctx.company_id, caseId, type, label, blocking]);
  }
  // assets
  for (const [type, label] of [["laptop", "Ordinateur portable"], ["badge", "Badge d'accès"], ["phone", "Téléphone"]] as Array<[string, string]>) {
    await db.query(`insert into pierre_rt_employee_onboarding_assets (id, company_id, case_id, asset_type, label, owner, status) values (gen_random_uuid(),$1,$2,$3,$4,'it','planned')`, [ctx.company_id, caseId, type, label]);
  }
  // access intents — always start 'prepared' (never a fake provisioning without a provider)
  for (const [sys, lvl] of [["email", "standard"], ["hris", "employee"], ["building", "lyon"]] as Array<[string, string]>) {
    await db.query(`insert into pierre_rt_employee_onboarding_access_intents (id, company_id, case_id, system_key, access_level, status) values (gen_random_uuid(),$1,$2,$3,$4,'prepared')`, [ctx.company_id, caseId, sys, lvl]);
  }
  // communications — draft (brouillon), awaiting_validation (copilote), ready (autonomie) — never 'sent' here
  const commStatus = mode === "brouillon" ? "draft" : mode === "autonomie" ? "ready" : "awaiting_validation";
  for (const [ctype, recip, subj] of [["welcome_email", "employee", "Bienvenue"], ["manager_email", "manager", "Arrivée de votre nouvelle recrue"]] as Array<[string, string, string]>) {
    await db.query(`insert into pierre_rt_employee_onboarding_communications (id, company_id, case_id, communication_type, recipient, subject, status) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6)`, [ctx.company_id, caseId, ctype, recip, subj, commStatus]);
  }
  // calendar
  const calStatus = mode === "brouillon" ? "prepared" : mode === "autonomie" ? "ready" : "awaiting_validation";
  await db.query(`insert into pierre_rt_employee_onboarding_calendar_intents (id, company_id, case_id, event_type, title, status) values (gen_random_uuid(),$1,$2,'day_one','Premier jour',$3)`, [ctx.company_id, caseId, calStatus]);
  // followups
  for (const f of ["day_one", "week_one", "month_one", "probation_end"]) {
    await db.query(`insert into pierre_rt_employee_onboarding_followups (id, company_id, case_id, followup_type, status) values (gen_random_uuid(),$1,$2,$3,'scheduled')`, [ctx.company_id, caseId, f]);
  }

  // Case status by mode: brouillon stays 'preparing' (no external gate); copilote/autonomie go to
  // 'awaiting_validation' because the contract step is a mandatory human validation.
  const caseStatus = mode === "brouillon" ? "preparing" : "awaiting_validation";
  await db.query(`update pierre_rt_employee_onboarding_cases set status=$3, updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, caseId, caseStatus]);

  const count = async (t: string) => Number((await db.query<{ n: number }>(`select count(*)::int n from ${t} where company_id=$1 and case_id=$2`, [ctx.company_id, caseId])).rows[0].n);
  return {
    steps: await count("pierre_rt_employee_onboarding_steps"),
    requirements: await count("pierre_rt_employee_onboarding_requirements"),
    assets: await count("pierre_rt_employee_onboarding_assets"),
    access: await count("pierre_rt_employee_onboarding_access_intents"),
    communications: await count("pierre_rt_employee_onboarding_communications"),
    calendar: await count("pierre_rt_employee_onboarding_calendar_intents"),
    followups: await count("pierre_rt_employee_onboarding_followups"),
  };
}

export async function fulfillOnboardingRequirement(db: SqlExecutor, ctx: TenantContext, caseId: string, requirementType: string, fileId?: string | null): Promise<void> {
  requirePermission(ctx, "employee.write");
  const { rowCount } = await db.query(
    `update pierre_rt_employee_onboarding_requirements set status='received', received_at=now(), file_id=$4, version=version+1
     where company_id=$1 and case_id=$2 and requirement_type=$3`, [ctx.company_id, caseId, requirementType, fileId ?? null]) as unknown as { rowCount: number };
  void rowCount;
}

/** A blocking requirement still missing puts the case into awaiting_information (never a fake ready). */
export async function refreshOnboardingReadiness(db: SqlExecutor, ctx: TenantContext, caseId: string): Promise<OnboardingCaseRow> {
  requirePermission(ctx, "employee.write");
  const missing = Number((await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_employee_onboarding_requirements where company_id=$1 and case_id=$2 and blocking=true and status not in ('received','verified','waived')`,
    [ctx.company_id, caseId])).rows[0].n);
  const c = await loadCase(db, ctx, caseId);
  let status = c.status;
  if (missing > 0 && !["completed", "cancelled"].includes(c.status)) status = "awaiting_information";
  else if (missing === 0 && c.status === "awaiting_information") status = c.mode === "brouillon" ? "preparing" : "awaiting_validation";
  const blocking_reason = missing > 0 ? `${missing} blocking requirement(s) missing` : null;
  const { rows } = await db.query<OnboardingCaseRow>(
    `update pierre_rt_employee_onboarding_cases set status=$3, blocking_reason=$4, updated_at=now(), version=version+1 where company_id=$1 and id=$2 returning *`,
    [ctx.company_id, caseId, status, blocking_reason]);
  return rows[0];
}

export async function completeOnboardingStep(db: SqlExecutor, ctx: TenantContext, caseId: string, stepKey: string): Promise<void> {
  requirePermission(ctx, "employee.write");
  await db.query(`update pierre_rt_employee_onboarding_steps set status='completed', completed_at=now(), version=version+1 where company_id=$1 and case_id=$2 and step_key=$3`, [ctx.company_id, caseId, stepKey]);
  await computeOnboardingProgress(db, ctx, caseId);
}

export async function computeOnboardingProgress(db: SqlExecutor, ctx: TenantContext, caseId: string): Promise<number> {
  requirePermission(ctx, "employee.read");
  const total = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_onboarding_steps where company_id=$1 and case_id=$2 and required=true`, [ctx.company_id, caseId])).rows[0].n);
  const done = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_onboarding_steps where company_id=$1 and case_id=$2 and required=true and status='completed'`, [ctx.company_id, caseId])).rows[0].n);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  await db.query(`update pierre_rt_employee_onboarding_cases set progress_percent=$3, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, caseId, pct]);
  return pct;
}

export async function getEmployeeOnboardingCase(db: SqlExecutor, ctx: TenantContext, caseId: string): Promise<{ onboarding: OnboardingCaseRow; steps: unknown[]; requirements: unknown[]; blockers: unknown[] }> {
  requirePermission(ctx, "employee.read");
  const onboarding = await loadCase(db, ctx, caseId);
  const steps = (await db.query(`select step_key, category, status, validation_required from pierre_rt_employee_onboarding_steps where company_id=$1 and case_id=$2 order by step_ordinal`, [ctx.company_id, caseId])).rows;
  const requirements = (await db.query(`select requirement_type, status, blocking from pierre_rt_employee_onboarding_requirements where company_id=$1 and case_id=$2`, [ctx.company_id, caseId])).rows;
  const blockers = (await db.query(`select requirement_type from pierre_rt_employee_onboarding_requirements where company_id=$1 and case_id=$2 and blocking=true and status not in ('received','verified','waived')`, [ctx.company_id, caseId])).rows;
  return { onboarding, steps, requirements, blockers };
}
