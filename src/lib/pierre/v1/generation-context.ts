// src/lib/pierre/v1/generation-context.ts
// PHASE 8.3-B2E §13 — STRICT generation context. The context loaded for a document is
// built from ONLY the fields the template actually requested — never a blanket dump of
// the employee record. Every referenced entity (employee / site / contract / manager)
// is verified to belong to the active tenant AND to be coherent with the employee; a
// cross-tenant or mismatched reference is refused (fail-closed). Sensitivity is
// resolved from the canonical field registry, never inferred from the data.

import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { canAccessSite } from "./rbac";
import { resolveFieldPolicy, type CustomFieldDefinition } from "./field-policies";
import { loadValidatedCustomFieldsForGeneration } from "./custom-fields";

export type StrictGenerationInput = {
  document_type: string;
  employee_id: string;
  site_id?: string | null;
  contract_id?: string | null;
  requested_fields: string[];     // canonical paths + validated_custom_fields.<key>
  provenance?: Record<string, string>;
  // Caller-supplied authoritative values for specific canonical paths (e.g. a contract's
  // effective dates / weekly hours). Still validated: a path not in the canonical registry
  // is refused regardless. Used by the contract layer to inject employment/date fields.
  extra_values?: Record<string, string | null>;
};

export type StrictGenerationContext = {
  document_type: string;
  employee_id: string;
  site_id: string | null;
  contract_id: string | null;
  values: Record<string, string | null>;       // ONLY the requested fields
  sensitive_fields: string[];                    // requested fields that are sensitive/restricted
  custom_field_keys: string[];
};

type EmployeeRow = { id: string; company_id: string; site_id: string | null; first_name: string | null; last_name: string | null; email: string | null; role_title: string | null; hired_at: string | null; manager_employee_id: string | null };
type CompanyRow = { id: string; name: string | null; slug: string | null };
type SiteRow = { id: string; company_id: string; name: string | null; code: string | null };

const splitKey = (path: string) => path.split(".")[0];

/**
 * Build a strict, tenant-verified generation context. Only the requested fields are
 * loaded and resolved; the referenced site/contract are verified to belong to the
 * tenant and the employee. Unknown fields and cross-tenant references are refused.
 */
export async function buildStrictGenerationContext(db: SqlExecutor, ctx: TenantContext, input: StrictGenerationInput): Promise<StrictGenerationContext> {
  const requested = Array.from(new Set(input.requested_fields));
  // 0 — every requested field must resolve to a canonical policy (fail-closed).
  const customKeys: string[] = [];
  for (const path of requested) {
    if (path.startsWith("validated_custom_fields.")) { customKeys.push(path.slice("validated_custom_fields.".length)); continue; }
    if (!resolveFieldPolicy(path)) throw Errors.validation(`Field not in canonical registry: ${path}`);
  }

  // 1 — employee must belong to the active tenant.
  const emp = (await db.query<EmployeeRow>(`select id, company_id, site_id, first_name, last_name, email, role_title, hired_at, manager_employee_id from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, input.employee_id])).rows[0];
  if (!emp) throw Errors.notFound("Employee not found in this tenant");
  if (emp.site_id && !canAccessSite(ctx, emp.site_id)) throw Errors.forbidden("Employee out of site scope");

  // 2 — site reference: same tenant + coherent with the employee + within scope.
  let site: SiteRow | null = null;
  const siteId = input.site_id ?? emp.site_id;
  if (siteId) {
    site = (await db.query<SiteRow>(`select id, company_id, name, code from pierre_rt_sites where company_id=$1 and id=$2`, [ctx.company_id, siteId])).rows[0] ?? null;
    if (!site) throw Errors.validation("Referenced site does not belong to this tenant");
    if (input.site_id && emp.site_id && input.site_id !== emp.site_id) throw Errors.validation("Referenced site is not the employee's site");
    if (!canAccessSite(ctx, site.id)) throw Errors.forbidden("Site out of scope");
  }

  // 3 — contract reference: same tenant AND the employee's own contract.
  if (input.contract_id) {
    const c = (await db.query<{ id: string; employee_id: string }>(`select id, employee_id from pierre_rt_employee_contracts where company_id=$1 and id=$2`, [ctx.company_id, input.contract_id])).rows[0];
    if (!c) throw Errors.validation("Referenced contract does not belong to this tenant");
    if (c.employee_id !== emp.id) throw Errors.validation("Referenced contract is not the employee's contract");
  }

  // 4 — only the requested sources are loaded.
  const sources = new Set(requested.map(splitKey));
  let company: CompanyRow | null = null;
  if (sources.has("company")) company = (await db.query<CompanyRow>(`select id, name, slug from pierre_rt_companies where id=$1`, [ctx.company_id])).rows[0] ?? null;
  let manager: EmployeeRow | null = null;
  if (sources.has("manager") && emp.manager_employee_id) manager = (await db.query<EmployeeRow>(`select id, company_id, site_id, first_name, last_name, email, role_title, hired_at, manager_employee_id from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, emp.manager_employee_id])).rows[0] ?? null;

  const canonical: Record<string, string | null> = {
    "company.legal_name": company?.name ?? null, "company.display_name": company?.name ?? null, "company.slug": company?.slug ?? null,
    "employee.first_name": emp.first_name, "employee.last_name": emp.last_name, "employee.professional_email": emp.email, "employee.role_title": emp.role_title, "employee.hired_at": emp.hired_at,
    "manager.first_name": manager?.first_name ?? null, "manager.last_name": manager?.last_name ?? null, "manager.role_title": manager?.role_title ?? null,
    "site.name": site?.name ?? null, "site.code": site?.code ?? null,
    "dates.today": new Date().toISOString().slice(0, 10), "dates.year": String(new Date().getUTCFullYear()),
  };

  // 5 — validated custom fields (only the requested keys; values validated; tenant-bound).
  const resolvedCustom = await loadValidatedCustomFieldsForGeneration(db, ctx, emp.id, customKeys, { provenance: input.provenance });
  const customMap = new Map(resolvedCustom.map((r) => [r.field_key, r]));

  const values: Record<string, string | null> = {};
  const sensitive: string[] = [];
  for (const path of requested) {
    const pol = resolveFieldPolicy(path);
    if (path.startsWith("validated_custom_fields.")) {
      const key = path.slice("validated_custom_fields.".length);
      const rc = customMap.get(key);
      values[path] = rc?.value ?? null;
      if (rc && rc.sensitivity !== "normal") sensitive.push(path);
      continue;
    }
    // canonical: caller-supplied authoritative value (validated above) wins; else the value we
    // actually loaded; unmapped canonical paths resolve to null.
    if (input.extra_values && Object.prototype.hasOwnProperty.call(input.extra_values, path)) values[path] = input.extra_values[path];
    else values[path] = Object.prototype.hasOwnProperty.call(canonical, path) ? canonical[path] : null;
    if (pol && pol.sensitivity !== "normal") sensitive.push(path);
  }

  return {
    document_type: input.document_type, employee_id: emp.id, site_id: site?.id ?? null,
    contract_id: input.contract_id ?? null, values, sensitive_fields: sensitive, custom_field_keys: customKeys,
  };
}
