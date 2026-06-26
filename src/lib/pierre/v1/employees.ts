// src/lib/pierre/v1/employees.ts
// PHASE 8.2 — Employee 360 production data model: repository + service.
//
// Tenant + RBAC + site scoped. Cursor pagination, version-safe, no unbounded
// reads. A 360 view aggregates the employee with recent events, documents
// (metadata only) and absences.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission, canAccessSite, siteScopeArray } from "./rbac";
import { buildSearchText } from "./employee-search";

export type EmployeeStatus = "candidate" | "onboarding" | "active" | "suspended" | "offboarding" | "left";
export type ContractType = "cdi" | "cdd" | "interim" | "stage" | "alternance" | "freelance" | "other";

export type EmployeeRow = {
  id: string; company_id: string; site_id: string | null; external_ref: string | null;
  first_name: string; last_name: string; email: string | null; phone: string | null;
  status: EmployeeStatus; contract_type: ContractType; role_title: string | null;
  manager_employee_id: string | null; sensitivity: string; hired_at: string | null;
  left_at: string | null; metadata: unknown; created_at: string; updated_at: string; archived_at: string | null;
  // PHASE 8.2 — extended identity / employment columns
  employee_number?: string | null; preferred_name?: string | null;
  professional_email?: string | null; personal_email?: string | null; preferred_language?: string | null;
  department?: string | null; team?: string | null; job_family?: string | null; cost_center?: string | null;
  location_mode?: string | null; seniority_date?: string | null; probation_end_date?: string | null;
  expected_end_date?: string | null; termination_date?: string | null; version?: number; search_text?: string | null;
  // PHASE 8.2-C — GDPR / retention
  retention_until?: string | null; legal_hold?: boolean; anonymized_at?: string | null;
};

function isoOf(v: unknown): string { return v instanceof Date ? v.toISOString() : new Date(v as string).toISOString(); }

export const EmployeeRepo = {
  async insert(db: SqlExecutor, companyId: string, e: Partial<EmployeeRow> & { first_name: string; last_name: string }): Promise<EmployeeRow> {
    const search = buildSearchText(e as never);
    const { rows } = await db.query<EmployeeRow>(
      `insert into pierre_rt_employees
         (id, company_id, site_id, external_ref, first_name, last_name, email, phone, status, contract_type, role_title, manager_employee_id, sensitivity, hired_at, metadata, search_text,
          employee_number, preferred_name, professional_email, personal_email, department, team, job_family)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) returning *`,
      [newUuid(), companyId, e.site_id ?? null, e.external_ref ?? null, e.first_name, e.last_name, e.email ?? null, e.phone ?? null,
       e.status ?? "active", e.contract_type ?? "cdi", e.role_title ?? null, e.manager_employee_id ?? null, e.sensitivity ?? "normal", e.hired_at ?? null, JSON.stringify(e.metadata ?? {}), search,
       e.employee_number ?? null, e.preferred_name ?? null, e.professional_email ?? null, e.personal_email ?? null, e.department ?? null, e.team ?? null, e.job_family ?? null]);
    await db.query(`insert into pierre_rt_employee_status_history (id, company_id, employee_id, prev_status, new_status) values ($1,$2,$3,$4,$5)`,
      [newUuid(), companyId, rows[0].id, null, rows[0].status]);
    return rows[0];
  },
  async addEmployment(db: SqlExecutor, companyId: string, employeeId: string, em: { employment_type: string; site_id?: string | null; manager_employee_id?: string | null; start_date?: string | null; weekly_hours?: number | null; classification?: string | null }): Promise<string> {
    const id = newUuid();
    await db.query(`insert into pierre_rt_employee_employments (id, company_id, employee_id, employment_type, site_id, manager_employee_id, start_date, weekly_hours, classification)
                    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, companyId, employeeId, em.employment_type, em.site_id ?? null, em.manager_employee_id ?? null, em.start_date ?? null, em.weekly_hours ?? null, em.classification ?? null]);
    return id;
  },
  async addContract(db: SqlExecutor, companyId: string, employeeId: string, contractType: string): Promise<string> {
    const id = newUuid();
    await db.query(`insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status, current_version) values ($1,$2,$3,$4,'draft',1)`,
      [id, companyId, employeeId, contractType]);
    await db.query(`insert into pierre_rt_employee_contract_versions (id, company_id, contract_id, version, status, effective_from) values ($1,$2,$3,1,'draft',now()::date)`,
      [newUuid(), companyId, id]);
    return id;
  },
  async newContractVersion(db: SqlExecutor, companyId: string, contractId: string): Promise<number> {
    const { rows } = await db.query<{ v: number }>(`select coalesce(max(version),0)+1 as v from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2`, [companyId, contractId]);
    const v = rows[0].v;
    await db.query(`insert into pierre_rt_employee_contract_versions (id, company_id, contract_id, version, status, effective_from) values ($1,$2,$3,$4,'draft',now()::date)`, [newUuid(), companyId, contractId, v]);
    await db.query(`update pierre_rt_employee_contracts set current_version=$3 where company_id=$1 and id=$2`, [companyId, contractId, v]);
    return v;
  },
  async addDocumentRequirement(db: SqlExecutor, companyId: string, employeeId: string, kind: string, mandatory: boolean): Promise<void> {
    await db.query(`insert into pierre_rt_employee_document_requirements (id, company_id, employee_id, kind, mandatory) values ($1,$2,$3,$4,$5)`,
      [newUuid(), companyId, employeeId, kind, mandatory]);
  },
  async byId(db: SqlExecutor, companyId: string, id: string): Promise<EmployeeRow | null> {
    const { rows } = await db.query<EmployeeRow>(`select * from pierre_rt_employees where company_id=$1 and id=$2`, [companyId, id]);
    return rows[0] ?? null;
  },
  /** Cursor pagination (created_at desc, id desc), site-scoped. */
  async list(db: SqlExecutor, companyId: string, opts: { limit: number; cursor?: string | null; scope?: string[] | null; status?: string | null }): Promise<{ items: EmployeeRow[]; next_cursor: string | null }> {
    const limit = Math.max(1, Math.min(100, opts.limit));
    const params: unknown[] = [companyId];
    let where = `company_id = $1 and archived_at is null`;
    if (opts.scope) { params.push(opts.scope); where += ` and site_id = any($${params.length})`; }
    if (opts.status) { params.push(opts.status); where += ` and status = $${params.length}`; }
    if (opts.cursor) {
      const [c, cid] = opts.cursor.split("|");
      params.push(c); params.push(cid);
      where += ` and (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(limit + 1);
    const { rows } = await db.query<EmployeeRow>(
      `select * from pierre_rt_employees where ${where} order by created_at desc, id desc limit $${params.length}`, params);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const next = rows.length > limit ? `${isoOf(last.created_at)}|${last.id}` : null;
    return { items, next_cursor: next };
  },
  async addEvent(db: SqlExecutor, companyId: string, employeeId: string, e: { type: string; actor_type?: string; actor_id?: string; metadata?: Record<string, unknown> }): Promise<void> {
    await db.query(`insert into pierre_rt_employee_events (id, company_id, employee_id, type, actor_type, actor_id, metadata)
                    values ($1,$2,$3,$4,$5,$6,$7)`,
      [newUuid(), companyId, employeeId, e.type, e.actor_type ?? "user", e.actor_id ?? null, JSON.stringify(e.metadata ?? {})]);
  },
  async addDocument(db: SqlExecutor, companyId: string, employeeId: string, d: { kind: string; title: string; storage_ref?: string; sensitivity?: string }): Promise<void> {
    await db.query(`insert into pierre_rt_employee_documents (id, company_id, employee_id, kind, title, storage_ref, sensitivity)
                    values ($1,$2,$3,$4,$5,$6,$7)`,
      [newUuid(), companyId, employeeId, d.kind, d.title, d.storage_ref ?? null, d.sensitivity ?? "normal"]);
  },
  async addAbsence(db: SqlExecutor, companyId: string, employeeId: string, a: { type: string; start_date: string; end_date: string; status?: string }): Promise<void> {
    await db.query(`insert into pierre_rt_employee_absences (id, company_id, employee_id, type, start_date, end_date, status)
                    values ($1,$2,$3,$4,$5,$6,$7)`,
      [newUuid(), companyId, employeeId, a.type, a.start_date, a.end_date, a.status ?? "requested"]);
  },
  async recent(db: SqlExecutor, companyId: string, employeeId: string) {
    const events = (await db.query(`select type, actor_type, occurred_at, metadata from pierre_rt_employee_events where company_id=$1 and employee_id=$2 order by occurred_at desc limit 20`, [companyId, employeeId])).rows;
    const documents = (await db.query(`select kind, title, sensitivity, created_at from pierre_rt_employee_documents where company_id=$1 and employee_id=$2 order by created_at desc limit 20`, [companyId, employeeId])).rows;
    const absences = (await db.query(`select type, start_date, end_date, status from pierre_rt_employee_absences where company_id=$1 and employee_id=$2 order by start_date desc limit 20`, [companyId, employeeId])).rows;
    return { events, documents, absences };
  },
};

export async function createEmployee(db: SqlExecutor, ctx: TenantContext, input: Partial<EmployeeRow> & { first_name: string; last_name: string }): Promise<EmployeeRow> {
  requirePermission(ctx, "employee.write");
  if (!input.first_name?.trim() || !input.last_name?.trim()) throw Errors.validation("first_name and last_name are required");
  if (input.site_id && !canAccessSite(ctx, input.site_id)) throw Errors.forbidden("Site out of scope");
  const created = await EmployeeRepo.insert(db, ctx.company_id, input);
  await EmployeeRepo.addEvent(db, ctx.company_id, created.id, { type: "employee_created", actor_type: "user", actor_id: ctx.user_id });
  return created;
}

export async function listEmployees(db: SqlExecutor, ctx: TenantContext, q: { limit?: number; cursor?: string | null; status?: string | null }): Promise<{ items: EmployeeRow[]; next_cursor: string | null }> {
  requirePermission(ctx, "employee.read");
  return EmployeeRepo.list(db, ctx.company_id, { limit: q.limit ?? 20, cursor: q.cursor ?? null, scope: siteScopeArray(ctx), status: q.status ?? null });
}

export async function getEmployee360(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "employee.read");
  const emp = await EmployeeRepo.byId(db, ctx.company_id, id);
  if (!emp) throw Errors.notFound("Employee not found");
  if (!canAccessSite(ctx, emp.site_id)) throw Errors.forbidden("Employee out of site scope");
  const recent = await EmployeeRepo.recent(db, ctx.company_id, id);
  return { employee: emp, ...recent };
}

// ── PHASE 8.2-C — full Employee 360 service surface ──────────────────────────
const PATCHABLE_EMP = new Set([
  "first_name", "last_name", "preferred_name", "email", "phone", "professional_email", "personal_email",
  "role_title", "department", "team", "job_family", "cost_center", "location_mode", "employee_number",
  "manager_employee_id", "seniority_date", "probation_end_date", "expected_end_date", "hired_at", "contract_type",
]);

async function loadEmployeeScoped(db: SqlExecutor, ctx: TenantContext, id: string): Promise<EmployeeRow> {
  const emp = await EmployeeRepo.byId(db, ctx.company_id, id);
  if (!emp) throw Errors.notFound("Employee not found");
  if (!canAccessSite(ctx, emp.site_id)) throw Errors.forbidden("Employee out of site scope");
  return emp;
}

export async function patchEmployee(db: SqlExecutor, ctx: TenantContext, id: string, patch: Record<string, unknown>, version: number): Promise<EmployeeRow> {
  requirePermission(ctx, "employee.write");
  const cur = await loadEmployeeScoped(db, ctx, id);
  // Site move respects scope on both source and destination.
  if (patch.site_id !== undefined && patch.site_id !== cur.site_id) {
    if (patch.site_id && !canAccessSite(ctx, String(patch.site_id))) throw Errors.forbidden("Destination site out of scope");
  }
  const sets: string[] = [];
  const params: unknown[] = [ctx.company_id, id, version];
  const merged: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (PATCHABLE_EMP.has(k) || k === "site_id") { params.push(v); sets.push(`${k} = $${params.length}`); merged[k] = v; }
  }
  if (sets.length === 0) throw Errors.validation("No patchable employee fields provided");
  // Rebuild the normalized search index from the merged row.
  params.push(buildSearchText(merged as never));
  sets.push(`search_text = $${params.length}`);
  const { rows } = await db.query<EmployeeRow>(
    `update pierre_rt_employees set ${sets.join(", ")}, version = version + 1, updated_at = now()
       where company_id = $1 and id = $2 and version = $3 returning *`, params);
  if (rows.length === 0) throw Errors.versionConflict();
  await EmployeeRepo.addEvent(db, ctx.company_id, id, { type: "employee_updated", actor_type: "user", actor_id: ctx.user_id, metadata: { fields: Object.keys(patch) } });
  return rows[0];
}

async function changeStatus(db: SqlExecutor, ctx: TenantContext, id: string, newStatus: EmployeeStatus, eventType: string): Promise<EmployeeRow> {
  const cur = await loadEmployeeScoped(db, ctx, id);
  if (cur.status === newStatus) return cur;
  const { rows } = await db.query<EmployeeRow>(
    `update pierre_rt_employees set status = $3, ${newStatus === "left" ? "archived_at = now()," : "archived_at = null,"} version = version + 1, updated_at = now()
       where company_id = $1 and id = $2 returning *`, [ctx.company_id, id, newStatus]);
  await db.query(`insert into pierre_rt_employee_status_history (id, company_id, employee_id, prev_status, new_status, actor_user_id) values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, id, cur.status, newStatus, ctx.user_id]);
  await EmployeeRepo.addEvent(db, ctx.company_id, id, { type: eventType, actor_type: "user", actor_id: ctx.user_id });
  return rows[0];
}

export async function archiveEmployee(db: SqlExecutor, ctx: TenantContext, id: string): Promise<EmployeeRow> {
  requirePermission(ctx, "employee.archive");
  const cur = await loadEmployeeScoped(db, ctx, id);
  if (cur.legal_hold) { /* archive allowed; purge is what legal hold blocks */ }
  return changeStatus(db, ctx, id, "left", "employee_archived");
}

export async function reactivateEmployee(db: SqlExecutor, ctx: TenantContext, id: string): Promise<EmployeeRow> {
  requirePermission(ctx, "employee.write");
  const cur = await loadEmployeeScoped(db, ctx, id);
  if (cur.anonymized_at) throw Errors.conflict("Anonymized employees cannot be reactivated");
  return changeStatus(db, ctx, id, "active", "employee_reactivated");
}

export async function employeeTimeline(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "employee.read");
  await loadEmployeeScoped(db, ctx, id);
  const events = (await db.query<{ type: string; actor_type: string; occurred_at: string; metadata: unknown }>(
    `select type, actor_type, occurred_at, metadata from pierre_rt_employee_events where company_id=$1 and employee_id=$2`, [ctx.company_id, id])).rows
    .map((e) => ({ kind: "event", type: e.type, actor_type: e.actor_type, at: isoOf(e.occurred_at), metadata: e.metadata }));
  const status = (await db.query<{ prev_status: string | null; new_status: string; occurred_at: string }>(
    `select prev_status, new_status, occurred_at from pierre_rt_employee_status_history where company_id=$1 and employee_id=$2`, [ctx.company_id, id])).rows
    .map((s) => ({ kind: "status", type: `status:${s.prev_status ?? "—"}→${s.new_status}`, actor_type: "system", at: isoOf(s.occurred_at), metadata: { prev: s.prev_status, next: s.new_status } }));
  return [...events, ...status].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 100);
}

export async function listContracts(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "employee.read");
  await loadEmployeeScoped(db, ctx, id);
  const contracts = (await db.query(`select id, contract_type, status, current_version, created_at from pierre_rt_employee_contracts where company_id=$1 and employee_id=$2 order by created_at asc`, [ctx.company_id, id])).rows;
  const out = [];
  for (const c of contracts as Array<{ id: string }>) {
    const versions = (await db.query(`select version, status, effective_from, effective_to, signature_status from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2 order by version asc`, [ctx.company_id, c.id])).rows;
    out.push({ ...c, versions });
  }
  return out;
}

export async function createContract(db: SqlExecutor, ctx: TenantContext, id: string, contractType: string): Promise<string> {
  requirePermission(ctx, "employee.write");
  await loadEmployeeScoped(db, ctx, id);
  const valid = ["CDI_FULL_TIME","CDI_PART_TIME","CDD","CDD_REPLACEMENT","CDD_TEMPORARY_INCREASE","APPRENTICESHIP","PROFESSIONAL_TRAINING","INTERNSHIP","SEASONAL","TEMPORARY","OTHER"];
  if (!valid.includes(contractType)) throw Errors.validation(`Invalid contract_type: ${contractType}`);
  const cid = await EmployeeRepo.addContract(db, ctx.company_id, id, contractType);
  await EmployeeRepo.addEvent(db, ctx.company_id, id, { type: "contract_created", actor_type: "user", actor_id: ctx.user_id, metadata: { contract_type: contractType } });
  return cid;
}

export async function addContractVersion(db: SqlExecutor, ctx: TenantContext, id: string, contractId: string): Promise<number> {
  requirePermission(ctx, "employee.write");
  await loadEmployeeScoped(db, ctx, id);
  const owns = await db.query(`select 1 from pierre_rt_employee_contracts where company_id=$1 and id=$2 and employee_id=$3`, [ctx.company_id, contractId, id]);
  if (owns.rows.length === 0) throw Errors.notFound("Contract not found for employee");
  const v = await EmployeeRepo.newContractVersion(db, ctx.company_id, contractId);
  await EmployeeRepo.addEvent(db, ctx.company_id, id, { type: "contract_version_added", actor_type: "user", actor_id: ctx.user_id, metadata: { contract_id: contractId, version: v } });
  return v;
}

export async function listDocuments(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "document.read");
  await loadEmployeeScoped(db, ctx, id);
  return (await db.query(`select id, kind, title, sensitivity, created_at from pierre_rt_employee_documents where company_id=$1 and employee_id=$2 order by created_at desc`, [ctx.company_id, id])).rows;
}

export async function listAbsences(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "absence.read");
  await loadEmployeeScoped(db, ctx, id);
  return (await db.query(`select id, type, start_date, end_date, status from pierre_rt_employee_absences where company_id=$1 and employee_id=$2 order by start_date desc`, [ctx.company_id, id])).rows;
}

export async function createAbsence(db: SqlExecutor, ctx: TenantContext, id: string, a: { type: string; start_date: string; end_date: string; status?: string }): Promise<void> {
  requirePermission(ctx, "absence.write");
  await loadEmployeeScoped(db, ctx, id);
  if (!a.type || !a.start_date || !a.end_date) throw Errors.validation("type, start_date, end_date are required");
  if (a.end_date < a.start_date) throw Errors.validation("end_date must be on or after start_date");
  await EmployeeRepo.addAbsence(db, ctx.company_id, id, a);
  await EmployeeRepo.addEvent(db, ctx.company_id, id, { type: "absence_requested", actor_type: "user", actor_id: ctx.user_id, metadata: { type: a.type } });
}

export async function employeeMissions(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "employee.read");
  await loadEmployeeScoped(db, ctx, id);
  return (await db.query(
    `select m.id, m.status, m.summary, m.risk, m.created_at from pierre_rt_employee_missions em
       join pierre_rt_missions m on m.id = em.mission_id and m.company_id = em.company_id
      where em.company_id=$1 and em.employee_id=$2 order by m.created_at desc limit 50`, [ctx.company_id, id])).rows;
}

export async function employeeTasks(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "task.read");
  await loadEmployeeScoped(db, ctx, id);
  return (await db.query(
    `select t.id, t.type, t.status, t.objective, t.risk from pierre_rt_employee_tasks et
       join pierre_rt_tasks t on t.id = et.task_id and t.company_id = et.company_id
      where et.company_id=$1 and et.employee_id=$2 order by t.created_at desc limit 100`, [ctx.company_id, id])).rows;
}

export async function employeeAccessLog(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "audit.read");
  await loadEmployeeScoped(db, ctx, id);
  return (await db.query(
    `select category, actor_user_id, accessed_at from pierre_rt_employee_sensitive_access_log
      where company_id=$1 and employee_id=$2 order by accessed_at desc limit 100`, [ctx.company_id, id])).rows;
}
