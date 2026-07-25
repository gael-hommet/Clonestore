// P22 — governed PRE-PAYROLL service. Collects/verifies/reconciles/structures/exports. Pierre is NOT a
// legal payroll engine and NEVER emits a DSN. Real business objects in pierre_rt_payroll_*. Variables
// keep their source (source_type+source_id) so a real absence maps to exactly one variable (no double
// collection). Anomalies are DETERMINISTIC rules over real SQL — no invented financial thresholds.
import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { sha256 } from "./renderers";
import { Errors } from "./errors";
import { requirePermission } from "./rbac";
import type { TenantContext } from "./tenant-context";

export type PayrollMode = "brouillon" | "copilote" | "autonomie";
export type PayrollPeriodRow = {
  id: string; company_id: string; period_key: string; starts_on: string; ends_on: string;
  population_count: number; status: string; mode: string; validation_id: string | null; version: number;
};

const ABSENCE_TO_VARIABLE: Record<string, string> = {
  conges_payes: "paid_leave", rtt: "paid_leave", maladie: "sick_leave", sans_solde: "absence", autre: "absence",
};

async function loadPeriod(db: SqlExecutor, ctx: TenantContext, id: string): Promise<PayrollPeriodRow> {
  const { rows } = await db.query<PayrollPeriodRow>(`select * from pierre_rt_payroll_periods where company_id=$1 and id=$2`, [ctx.company_id, id]);
  if (!rows[0]) throw Errors.notFound("Payroll period not found");
  return rows[0];
}

export async function openPayrollPeriod(
  db: SqlExecutor, ctx: TenantContext,
  input: { period_key: string; starts_on: string; ends_on: string; mission_id?: string | null; mode?: PayrollMode; idempotency_key?: string | null },
): Promise<PayrollPeriodRow> {
  requirePermission(ctx, "payroll_prep.write");
  if (!input.period_key?.trim()) throw Errors.validation("period_key is required");
  if (input.ends_on < input.starts_on) throw Errors.validation("ends_on must be on or after starts_on");
  if (input.idempotency_key) {
    const ex = await db.query<PayrollPeriodRow>(`select * from pierre_rt_payroll_periods where company_id=$1 and idempotency_key=$2`, [ctx.company_id, input.idempotency_key]);
    if (ex.rows[0]) return ex.rows[0];
  }
  const pop = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='active'`, [ctx.company_id])).rows[0].n);
  const { rows } = await db.query<PayrollPeriodRow>(
    `insert into pierre_rt_payroll_periods (id, company_id, mission_id, period_key, starts_on, ends_on, population_count, status, mode, opened_by, idempotency_key)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,'collecting',$7,$8,$9) returning *`,
    [ctx.company_id, input.mission_id ?? null, input.period_key, input.starts_on, input.ends_on, pop, input.mode ?? "copilote", ctx.user_id, input.idempotency_key ?? null]);
  return rows[0];
}

/** REAL collection: each absence overlapping the period → exactly one payroll variable, source-linked to
 *  that absence (source_type='absence', source_id=absence_id). Idempotent via the unique constraint. */
export async function collectVariablesFromAbsences(db: SqlExecutor, ctx: TenantContext, periodId: string): Promise<{ created: number }> {
  requirePermission(ctx, "payroll_prep.write");
  const p = await loadPeriod(db, ctx, periodId);
  const absences = (await db.query<{ id: string; employee_id: string; type: string; start_date: string; end_date: string }>(
    `select a.id, a.employee_id, a.type, a.start_date, a.end_date
       from pierre_rt_employee_absences a
      where a.company_id=$1 and a.start_date <= $3 and a.end_date >= $2`,
    [ctx.company_id, p.starts_on, p.ends_on])).rows;
  let created = 0;
  for (const a of absences) {
    const varType = ABSENCE_TO_VARIABLE[a.type] ?? "absence";
    const needsEvidence = a.type === "maladie"; // a sick leave requires a justificatif
    const ins = await db.query<{ id: string }>(
      `insert into pierre_rt_payroll_variables (id, company_id, period_id, employee_id, variable_type, source_type, source_id, starts_on, ends_on, status, validation_required, created_by)
       values (gen_random_uuid(),$1,$2,$3,$4,'absence',$5,$6,$7,$8,$9,$10)
       on conflict (company_id, period_id, employee_id, variable_type, source_id) do nothing returning id`,
      [ctx.company_id, periodId, a.employee_id, varType, a.id, a.start_date, a.end_date, needsEvidence ? "needs_evidence" : "collected", needsEvidence, ctx.user_id]);
    if (ins.rows.length > 0) {
      created += 1;
      if (needsEvidence) {
        await db.query(
          `insert into pierre_rt_payroll_variable_evidence (id, company_id, period_id, variable_id, employee_id, evidence_type, required, status, requested_at)
           select gen_random_uuid(),$1,$2,v.id,$3,'sick_leave_certificate',true,'requested',now()
             from pierre_rt_payroll_variables v where v.company_id=$1 and v.period_id=$2 and v.source_id=$4 and v.variable_type=$5`,
          [ctx.company_id, periodId, a.employee_id, a.id, varType]);
      }
    }
  }
  return { created };
}

export async function createPayrollVariable(
  db: SqlExecutor, ctx: TenantContext, periodId: string,
  input: { employee_id: string; variable_type: string; quantity?: number | null; amount?: number | null; starts_on?: string | null; ends_on?: string | null; source_type?: string; source_id?: string | null; validation_required?: boolean },
): Promise<{ id: string; status: string }> {
  requirePermission(ctx, "payroll_prep.write");
  const p = await loadPeriod(db, ctx, periodId);
  if (["completed", "cancelled", "transmitted"].includes(p.status)) throw Errors.conflict("Period is closed");
  const { rows } = await db.query<{ id: string; status: string }>(
    `insert into pierre_rt_payroll_variables (id, company_id, period_id, employee_id, variable_type, source_type, source_id, quantity, amount, starts_on, ends_on, status, validation_required, created_by)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'collected',$11,$12) returning id, status`,
    [ctx.company_id, periodId, input.employee_id, input.variable_type, input.source_type ?? "manual", input.source_id ?? null, input.quantity ?? null, input.amount ?? null, input.starts_on ?? null, input.ends_on ?? null, input.validation_required === true, ctx.user_id]);
  return rows[0];
}

export async function attachPayrollEvidence(db: SqlExecutor, ctx: TenantContext, variableId: string, fileId?: string | null): Promise<void> {
  requirePermission(ctx, "payroll_prep.write");
  await db.query(`update pierre_rt_payroll_variable_evidence set status='received', received_at=now(), file_id=$3, version=version+1 where company_id=$1 and variable_id=$2 and status in ('missing','requested')`, [ctx.company_id, variableId, fileId ?? null]);
  await db.query(`update pierre_rt_payroll_variables set status='collected', updated_at=now(), version=version+1 where company_id=$1 and id=$2 and status='needs_evidence'`, [ctx.company_id, variableId]);
}

export async function validatePayrollVariable(db: SqlExecutor, ctx: TenantContext, variableId: string): Promise<void> {
  requirePermission(ctx, "payroll_prep.write");
  await db.query(`update pierre_rt_payroll_variables set status='validated', updated_at=now(), version=version+1 where company_id=$1 and id=$2 and status in ('collected')`, [ctx.company_id, variableId]);
}

/** DETERMINISTIC anomaly detection over real SQL — no invented thresholds. Idempotent (dedup_key). */
export async function detectPayrollAnomalies(db: SqlExecutor, ctx: TenantContext, periodId: string): Promise<{ created: number }> {
  requirePermission(ctx, "payroll_prep.write");
  const p = await loadPeriod(db, ctx, periodId);
  let created = 0;
  const add = async (type: string, dedup: string, employeeId: string | null, variableId: string | null, severity: string, description: string, from: string): Promise<void> => {
    const ins = await db.query<{ id: string }>(
      `insert into pierre_rt_payroll_anomalies (id, company_id, period_id, employee_id, variable_id, anomaly_type, severity, description, detected_from, dedup_key)
       values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (company_id, period_id, dedup_key) do nothing returning id`,
      [ctx.company_id, periodId, employeeId, variableId, type, severity, description, from, dedup]);
    if (ins.rows.length > 0) created += 1;
  };
  // 1. missing_evidence — a variable needing evidence not yet received.
  for (const v of (await db.query<{ id: string; employee_id: string }>(
    `select id, employee_id from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and status='needs_evidence'`, [ctx.company_id, periodId])).rows) {
    await add("missing_evidence", `missing_evidence:${v.id}`, v.employee_id, v.id, "high", "Justificatif obligatoire manquant", "variable.status=needs_evidence");
  }
  // 2. invalid_date_range — ends_on < starts_on.
  for (const v of (await db.query<{ id: string; employee_id: string }>(
    `select id, employee_id from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and starts_on is not null and ends_on is not null and ends_on < starts_on`, [ctx.company_id, periodId])).rows) {
    await add("invalid_date_range", `invalid_date_range:${v.id}`, v.employee_id, v.id, "high", "Date de fin antérieure à la date de début", "variable.ends_on<starts_on");
  }
  // 3. absence_without_variable — an absence overlapping the period with no collected variable.
  for (const a of (await db.query<{ id: string; employee_id: string }>(
    `select a.id, a.employee_id from pierre_rt_employee_absences a
      where a.company_id=$1 and a.start_date <= $3 and a.end_date >= $2
        and not exists (select 1 from pierre_rt_payroll_variables v where v.company_id=$1 and v.period_id=$4 and v.source_id=a.id)`,
    [ctx.company_id, p.starts_on, p.ends_on, periodId])).rows) {
    await add("absence_without_variable", `absence_without_variable:${a.id}`, a.employee_id, null, "warning", "Absence sans variable de paie correspondante", "absence not collected");
  }
  return { created };
}

export async function computePayrollReadiness(db: SqlExecutor, ctx: TenantContext, periodId: string): Promise<PayrollPeriodRow> {
  requirePermission(ctx, "payroll_prep.write");
  const p = await loadPeriod(db, ctx, periodId);
  const openAnoms = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_anomalies where company_id=$1 and period_id=$2 and status='open' and severity in ('high','critical')`, [ctx.company_id, periodId])).rows[0].n);
  const missingEvidence = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and status='needs_evidence'`, [ctx.company_id, periodId])).rows[0].n);
  const pendingValidation = Number((await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and validation_required=true and status<>'validated'`, [ctx.company_id, periodId])).rows[0].n);
  let status = p.status;
  if (["completed", "cancelled", "transmitted", "exported", "transmission_prepared", "reconciling"].includes(p.status)) return p;
  if (missingEvidence > 0) status = "awaiting_information";
  else if (openAnoms > 0 || pendingValidation > 0) status = "awaiting_validation";
  else status = "ready_to_export";
  const { rows } = await db.query<PayrollPeriodRow>(`update pierre_rt_payroll_periods set status=$3, updated_at=now(), version=version+1 where company_id=$1 and id=$2 returning *`, [ctx.company_id, periodId, status]);
  return rows[0];
}

/** Generate a real export from the period's non-excluded variables: one row per variable, row_count +
 *  content hash. Never fabricates rows. When no provider is configured the caller keeps it downloadable
 *  but transmission stays unavailable (INTEGRATION_UNAVAILABLE) — never a fake transmission. */
export async function generatePayrollExport(db: SqlExecutor, ctx: TenantContext, periodId: string, format: "csv" | "xlsx" | "canonical_json" = "csv"): Promise<{ export_id: string; row_count: number; hash: string; status: string }> {
  requirePermission(ctx, "payroll_prep.write");
  const period = await loadPeriod(db, ctx, periodId);
  const vars = (await db.query<{ id: string; employee_id: string; variable_type: string; quantity: string | null; amount: string | null; starts_on: string | null; ends_on: string | null }>(
    `select id, employee_id, variable_type, quantity, amount, starts_on, ends_on from pierre_rt_payroll_variables
      where company_id=$1 and period_id=$2 and status in ('collected','validated') order by employee_id, variable_type`, [ctx.company_id, periodId])).rows;
  const hash = sha256(Buffer.from(JSON.stringify(vars)));
  const exportId = newUuid();
  // Mode-aware export state (a real persisted difference): brouillon stays a draft; copilote awaits a
  // human validation before transmission; autonomie readies it (validated) but STILL never transmits
  // here — transmission requires an explicit prepare + a provider (no fake transmission in any mode).
  const exportStatus = period.mode === "brouillon" ? "draft" : period.mode === "autonomie" ? "validated" : "awaiting_validation";
  await db.query(
    `insert into pierre_rt_payroll_exports (id, company_id, period_id, format, status, row_count, hash, generated_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`, [exportId, ctx.company_id, periodId, format, exportStatus, vars.length, hash, ctx.user_id]);
  let ord = 0;
  for (const v of vars) {
    await db.query(
      `insert into pierre_rt_payroll_export_rows (id, company_id, export_id, employee_id, payload, row_ordinal)
       values (gen_random_uuid(),$1,$2,$3,$4::jsonb,$5)`,
      [ctx.company_id, exportId, v.employee_id, JSON.stringify({ variable_type: v.variable_type, quantity: v.quantity, amount: v.amount, starts_on: v.starts_on, ends_on: v.ends_on }), ord++]);
  }
  await db.query(`update pierre_rt_payroll_periods set status='exported', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, periodId]);
  return { export_id: exportId, row_count: vars.length, hash, status: exportStatus };
}

/** Reconcile a provider return (test provider). Dedup on provider_event_id (no double webhook). A
 *  rejection reopens a provider_rejection anomaly. Pierre NEVER claims a DSN was sent. */
export async function reconcilePayrollProviderReturn(
  db: SqlExecutor, ctx: TenantContext, periodId: string,
  input: { export_id?: string | null; provider: string; provider_event_id: string; result_status: "accepted" | "partially_rejected" | "rejected"; accepted_rows?: number; rejected_rows?: number; errors?: unknown[] },
): Promise<{ reconciliation_id: string; applied: boolean; deduped: boolean }> {
  requirePermission(ctx, "payroll_prep.write");
  const existing = await db.query<{ id: string }>(`select id from pierre_rt_payroll_reconciliations where company_id=$1 and period_id=$2 and provider_event_id=$3`, [ctx.company_id, periodId, input.provider_event_id]);
  if (existing.rows[0]) return { reconciliation_id: existing.rows[0].id, applied: false, deduped: true };
  const id = newUuid();
  await db.query(
    `insert into pierre_rt_payroll_reconciliations (id, company_id, period_id, export_id, provider, provider_event_id, result_status, accepted_rows, rejected_rows, errors, applied_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now())`,
    [id, ctx.company_id, periodId, input.export_id ?? null, input.provider, input.provider_event_id, input.result_status, input.accepted_rows ?? 0, input.rejected_rows ?? 0, JSON.stringify(input.errors ?? [])]);
  if (input.result_status !== "accepted") {
    await db.query(
      `insert into pierre_rt_payroll_anomalies (id, company_id, period_id, anomaly_type, severity, description, detected_from, dedup_key)
       values (gen_random_uuid(),$1,$2,'provider_rejection','high',$3,'provider_return',$4) on conflict (company_id, period_id, dedup_key) do nothing`,
      [ctx.company_id, periodId, `Provider ${input.provider} a rejeté ${input.rejected_rows ?? 0} ligne(s)`, `provider_rejection:${input.provider_event_id}`]);
    await db.query(`update pierre_rt_payroll_periods set status='reconciling', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, periodId]);
  } else {
    await db.query(`update pierre_rt_payroll_periods set status='completed', updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, periodId]);
  }
  return { reconciliation_id: id, applied: true, deduped: false };
}

/** Factual brief — every number comes from SQL, none invented. */
export async function buildPayrollBrief(db: SqlExecutor, ctx: TenantContext, periodId: string): Promise<Record<string, unknown>> {
  requirePermission(ctx, "payroll_prep.read");
  const p = await loadPeriod(db, ctx, periodId);
  const n = async (sql: string, params: unknown[]) => Number((await db.query<{ n: number }>(sql, params)).rows[0].n);
  const totalVars = await n(`select count(*)::int n from pierre_rt_payroll_variables where company_id=$1 and period_id=$2`, [ctx.company_id, periodId]);
  const completeEmployees = await n(`select count(distinct employee_id)::int n from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and status in ('collected','validated')`, [ctx.company_id, periodId]);
  const missingEvidence = await n(`select count(*)::int n from pierre_rt_payroll_variables where company_id=$1 and period_id=$2 and status='needs_evidence'`, [ctx.company_id, periodId]);
  const openAnomalies = await n(`select count(*)::int n from pierre_rt_payroll_anomalies where company_id=$1 and period_id=$2 and status='open'`, [ctx.company_id, periodId]);
  const exportRows = await n(`select coalesce(max(row_count),0)::int n from pierre_rt_payroll_exports where company_id=$1 and period_id=$2`, [ctx.company_id, periodId]);
  return {
    period_key: p.period_key, population: p.population_count, status: p.status,
    total_variables: totalVars, employees_with_variables: completeEmployees,
    missing_evidence: missingEvidence, open_anomalies: openAnomalies, export_rows: exportRows,
    next_action: missingEvidence > 0 ? "collect missing evidence" : openAnomalies > 0 ? "resolve anomalies / obtain validation" : "validate and export",
    dsn_note: "Pierre prepares pre-payroll only; the legal calculation and DSN remain with the payroll provider/human.",
  };
}
