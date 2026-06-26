// src/lib/pierre/v1/gdpr.ts
// PHASE 8.2-C — GDPR / retention operations.
//
// Export (subject access), rectification (patchEmployee elsewhere), anonymization
// (pseudonymization preserving legally-required aggregates), legal hold, document
// erasure, and physical purge. Rules:
//  - legal_hold blocks anonymization AND purge.
//  - no purge before retention_until unless an explicit legal reason is given.
//  - sensitive export requires employee.sensitive.read.
//  - every operation is audited in pierre_rt_data_access_log; no sensitive VALUE
//    is ever written to a log.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission, canAccessSite, hasPermission } from "./rbac";
import { buildSearchText } from "./employee-search";

async function audit(db: SqlExecutor, ctx: TenantContext, subjectType: string, subjectId: string | null, action: string): Promise<void> {
  await db.query(`insert into pierre_rt_data_access_log (id, company_id, subject_type, subject_id, actor_user_id, action) values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, subjectType, subjectId, ctx.user_id, action]);
}

async function requireEmployeeInScope(db: SqlExecutor, ctx: TenantContext, id: string): Promise<{ id: string; site_id: string | null; legal_hold: boolean; retention_until: string | null; anonymized_at: string | null }> {
  const { rows } = await db.query<{ id: string; site_id: string | null; legal_hold: boolean; retention_until: string | null; anonymized_at: string | null }>(
    `select id, site_id, legal_hold, retention_until, anonymized_at from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, id]);
  if (rows.length === 0) throw Errors.notFound("Employee not found");
  if (!canAccessSite(ctx, rows[0].site_id)) throw Errors.forbidden("Employee out of site scope");
  return rows[0];
}

export async function exportEmployee(db: SqlExecutor, ctx: TenantContext, id: string): Promise<Record<string, unknown>> {
  requirePermission(ctx, "employee.read");
  await requireEmployeeInScope(db, ctx, id);
  const one = async (sql: string) => (await db.query(sql, [ctx.company_id, id])).rows;
  const employee = (await db.query(`select * from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, id])).rows[0];
  const out: Record<string, unknown> = {
    employee,
    employments: await one(`select * from pierre_rt_employee_employments where company_id=$1 and employee_id=$2`),
    contracts: await one(`select * from pierre_rt_employee_contracts where company_id=$1 and employee_id=$2`),
    contract_versions: (await db.query(`select v.* from pierre_rt_employee_contract_versions v join pierre_rt_employee_contracts c on c.id=v.contract_id where v.company_id=$1 and c.employee_id=$2`, [ctx.company_id, id])).rows,
    contact_methods: await one(`select * from pierre_rt_employee_contact_methods where company_id=$1 and employee_id=$2`),
    addresses: await one(`select * from pierre_rt_employee_addresses where company_id=$1 and employee_id=$2`),
    emergency_contacts: await one(`select * from pierre_rt_employee_emergency_contacts where company_id=$1 and employee_id=$2`),
    documents: await one(`select id, kind, title, sensitivity, created_at from pierre_rt_employee_documents where company_id=$1 and employee_id=$2`),
    absences: await one(`select * from pierre_rt_employee_absences where company_id=$1 and employee_id=$2`),
    notes: await one(`select id, sensitivity, created_at from pierre_rt_employee_notes where company_id=$1 and employee_id=$2`),
    tags: await one(`select tag from pierre_rt_employee_tags where company_id=$1 and employee_id=$2`),
    status_history: await one(`select * from pierre_rt_employee_status_history where company_id=$1 and employee_id=$2`),
    custom_fields: await one(`select field_key, field_value from pierre_rt_employee_custom_fields where company_id=$1 and employee_id=$2`),
  };
  // Sensitive categories are listed; VALUES included only with explicit permission.
  if (hasPermission(ctx, "employee.sensitive.read")) {
    out.sensitive = (await db.query(`select category, value_encrypted, encryption_strategy, created_at from pierre_rt_employee_sensitive_data where company_id=$1 and employee_id=$2`, [ctx.company_id, id])).rows;
    await db.query(`insert into pierre_rt_employee_sensitive_access_log (id, company_id, employee_id, category, actor_user_id) values ($1,$2,$3,'export',$4)`, [newUuid(), ctx.company_id, id, ctx.user_id]);
  } else {
    out.sensitive_categories = (await db.query(`select distinct category from pierre_rt_employee_sensitive_data where company_id=$1 and employee_id=$2`, [ctx.company_id, id])).rows.map((r: Record<string, unknown>) => r.category);
  }
  await audit(db, ctx, "employee", id, "employee_export");
  return out;
}

export async function exportCompany(db: SqlExecutor, ctx: TenantContext): Promise<Record<string, unknown>> {
  requirePermission(ctx, "gdpr.admin");
  const company = (await db.query(`select * from pierre_rt_companies where id=$1`, [ctx.company_id])).rows[0];
  const members = (await db.query(`select id, user_id, role, status, created_at from pierre_rt_members where company_id=$1`, [ctx.company_id])).rows;
  const sites = (await db.query(`select * from pierre_rt_sites where company_id=$1`, [ctx.company_id])).rows;
  const employees = (await db.query(`select id, first_name, last_name, status, site_id, created_at from pierre_rt_employees where company_id=$1`, [ctx.company_id])).rows;
  await audit(db, ctx, "company", ctx.company_id, "company_export");
  return { company, members, sites, employees, employee_count: employees.length };
}

export async function setLegalHold(db: SqlExecutor, ctx: TenantContext, id: string, on: boolean): Promise<void> {
  requirePermission(ctx, "gdpr.admin");
  await requireEmployeeInScope(db, ctx, id);
  await db.query(`update pierre_rt_employees set legal_hold=$3, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, id, on]);
  await audit(db, ctx, "employee", id, on ? "legal_hold_set" : "legal_hold_released");
}

export async function anonymizeEmployee(db: SqlExecutor, ctx: TenantContext, id: string): Promise<void> {
  requirePermission(ctx, "gdpr.admin");
  const emp = await requireEmployeeInScope(db, ctx, id);
  if (emp.legal_hold) throw Errors.conflict("Employee is under legal hold; anonymization blocked");
  if (emp.anonymized_at) return; // idempotent
  await db.transaction(async (tx) => {
    const pseudo = `#${id.slice(0, 8)}`;
    const search = buildSearchText({ first_name: "anonymise", last_name: pseudo });
    await tx.query(
      `update pierre_rt_employees set first_name='Anonymisé', last_name=$3, preferred_name=null, email=null, phone=null,
         professional_email=null, personal_email=null, employee_number=null, external_ref=null,
         search_text=$4, anonymized_at=now(), status='left', archived_at=coalesce(archived_at, now()), updated_at=now()
       where company_id=$1 and id=$2`, [ctx.company_id, id, pseudo, search]);
    // Erase directly-identifying satellites; keep legally-required aggregates (employments, contracts, status history).
    for (const t of ["pierre_rt_employee_contact_methods", "pierre_rt_employee_addresses", "pierre_rt_employee_emergency_contacts", "pierre_rt_employee_sensitive_data", "pierre_rt_employee_custom_fields"]) {
      await tx.query(`delete from ${t} where company_id=$1 and employee_id=$2`, [ctx.company_id, id]);
    }
    await tx.query(`update pierre_rt_employee_notes set body='[anonymized]' where company_id=$1 and employee_id=$2`, [ctx.company_id, id]);
    await audit(tx, ctx, "employee", id, "employee_anonymized");
  });
}

export async function deleteDocument(db: SqlExecutor, ctx: TenantContext, employeeId: string, documentId: string): Promise<void> {
  requirePermission(ctx, "document.write");
  const emp = await requireEmployeeInScope(db, ctx, employeeId);
  if (emp.legal_hold) throw Errors.conflict("Employee is under legal hold; document erasure blocked");
  const { rows } = await db.query(`delete from pierre_rt_employee_documents where company_id=$1 and employee_id=$2 and id=$3 returning id`, [ctx.company_id, employeeId, documentId]);
  if (rows.length === 0) throw Errors.notFound("Document not found");
  await audit(db, ctx, "document", documentId, "document_deleted");
}

export async function purgeEmployee(db: SqlExecutor, ctx: TenantContext, id: string, opts: { legal_reason?: string | null } = {}): Promise<void> {
  requirePermission(ctx, "gdpr.admin");
  const emp = await requireEmployeeInScope(db, ctx, id);
  if (emp.legal_hold) throw Errors.conflict("Employee is under legal hold; purge blocked");
  if (emp.retention_until) {
    const future = new Date(emp.retention_until).getTime() > Date.now();
    if (future && !opts.legal_reason) throw Errors.conflict("Retention period not elapsed; provide legal_reason to override");
  }
  // Audit BEFORE the physical delete (data_access_log is not cascade-deleted).
  await audit(db, ctx, "employee", id, opts.legal_reason ? `employee_purged:${opts.legal_reason}` : "employee_purged");
  await db.query(`delete from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, id]);
}

export async function dataAccessAudit(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number } = {}) {
  requirePermission(ctx, "audit.read");
  const lim = Math.max(1, Math.min(200, opts.limit ?? 100));
  return (await db.query(
    `select subject_type, subject_id, actor_user_id, action, occurred_at from pierre_rt_data_access_log
      where company_id=$1 order by occurred_at desc limit $2`, [ctx.company_id, lim])).rows;
}
