// src/lib/pierre/v1/custom-fields.ts
// PHASE 8.3-B2E §12 — canonical custom field DEFINITIONS service. The company HR
// configuration is the single source of truth for a custom field's data type,
// sensitivity, allowed document types and provenance requirement. Templates may only
// REFERENCE a definition; they can never set its sensitivity. The per-employee VALUES
// live in pierre_rt_employee_custom_fields and are validated against the definition
// before they can ever enter a generation context.

import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";
import type { CustomFieldDefinition, FieldSensitivity } from "./field-policies";

export type CustomFieldDefinitionRow = {
  company_id: string; field_key: string; label: string; data_type: CustomFieldDefinition["data_type"];
  sensitivity: FieldSensitivity; active: boolean; allowed_document_types: string[]; required_provenance: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};

const KEY_RE = /^[a-z][a-z0-9_]{1,48}$/;
const DATA_TYPES = new Set(["string", "date", "number", "email"]);
const SENSITIVITIES = new Set(["normal", "sensitive", "restricted"]);

/** Define (or update) a canonical custom field. Requires company.write — HR config, not template authoring. */
export async function defineCustomField(
  db: SqlExecutor, ctx: TenantContext,
  input: { field_key: string; label: string; data_type?: CustomFieldDefinition["data_type"]; sensitivity?: FieldSensitivity; active?: boolean; allowed_document_types?: string[]; required_provenance?: string | null },
): Promise<CustomFieldDefinitionRow> {
  requirePermission(ctx, "company.write");
  const key = input.field_key?.trim();
  if (!key || !KEY_RE.test(key)) throw Errors.validation("Invalid custom field key (snake_case, 2-49 chars)");
  if (!input.label?.trim()) throw Errors.validation("label is required");
  const data_type = input.data_type ?? "string";
  const sensitivity = input.sensitivity ?? "normal";
  if (!DATA_TYPES.has(data_type)) throw Errors.validation(`Invalid data_type: ${data_type}`);
  if (!SENSITIVITIES.has(sensitivity)) throw Errors.validation(`Invalid sensitivity: ${sensitivity}`);
  const { rows } = await db.query<CustomFieldDefinitionRow>(
    `insert into pierre_rt_custom_field_definitions (company_id, field_key, label, data_type, sensitivity, active, allowed_document_types, required_provenance, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (company_id, field_key) do update set label=excluded.label, data_type=excluded.data_type, sensitivity=excluded.sensitivity, active=excluded.active, allowed_document_types=excluded.allowed_document_types, required_provenance=excluded.required_provenance, updated_at=now()
     returning *`,
    [ctx.company_id, key, input.label.trim(), data_type, sensitivity, input.active ?? true, input.allowed_document_types ?? [], input.required_provenance ?? null, ctx.user_id]);
  return rows[0];
}

function toDef(r: CustomFieldDefinitionRow): CustomFieldDefinition {
  return { field_key: r.field_key, data_type: r.data_type, sensitivity: r.sensitivity, active: r.active, allowed_document_types: r.allowed_document_types ?? undefined, required_provenance: r.required_provenance ?? undefined, label: r.label };
}

/** Load every canonical definition for the tenant as a Map (the merge engine / guard consume this). */
export async function loadValidatedCustomFieldDefinitions(db: SqlExecutor, ctx: TenantContext): Promise<Map<string, CustomFieldDefinition>> {
  const { rows } = await db.query<CustomFieldDefinitionRow>(`select * from pierre_rt_custom_field_definitions where company_id=$1`, [ctx.company_id]);
  return new Map(rows.map((r) => [r.field_key, toDef(r)]));
}

/** Validate ONE value against its canonical definition. Returns the normalized value or throws. */
export function validateCustomFieldValue(def: CustomFieldDefinition, value: string | null): string | null {
  if (value === null || value === "") return null;
  switch (def.data_type) {
    case "number": if (!/^-?\d+(\.\d+)?$/.test(value)) throw Errors.validation(`custom field ${def.field_key} is not a number`); return value;
    case "date": if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value))) throw Errors.validation(`custom field ${def.field_key} is not a date`); return value;
    case "email": if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw Errors.validation(`custom field ${def.field_key} is not an email`); return value;
    default: return value;
  }
}

export type ResolvedCustomField = { field_key: string; value: string | null; sensitivity: FieldSensitivity; provenance_ok: boolean };

/**
 * §12/§13 — load ONLY the requested custom field keys for one employee, validating each
 * value against its canonical definition. Inactive or undefined keys are refused (a
 * template can never smuggle an undefined field into a document). The result feeds the
 * strict generation context. `provenance` (optional) lets the caller assert that a
 * value carrying a required_provenance was sourced from the right system.
 */
export async function loadValidatedCustomFieldsForGeneration(
  db: SqlExecutor, ctx: TenantContext, employeeId: string, requestedKeys: string[],
  opts: { provenance?: Record<string, string> } = {},
): Promise<ResolvedCustomField[]> {
  if (requestedKeys.length === 0) return [];
  const defs = await loadValidatedCustomFieldDefinitions(db, ctx);
  const { rows } = await db.query<{ field_key: string; field_value: string | null }>(
    `select field_key, field_value from pierre_rt_employee_custom_fields where company_id=$1 and employee_id=$2 and field_key = any($3)`,
    [ctx.company_id, employeeId, requestedKeys]);
  const values = new Map(rows.map((r) => [r.field_key, r.field_value]));
  const out: ResolvedCustomField[] = [];
  for (const key of requestedKeys) {
    const def = defs.get(key);
    if (!def) throw Errors.validation(`Unknown custom field: ${key}`);
    if (!def.active) throw Errors.validation(`Custom field is inactive: ${key}`);
    const value = validateCustomFieldValue(def, values.get(key) ?? null);
    const provenance_ok = !def.required_provenance || opts.provenance?.[key] === def.required_provenance;
    out.push({ field_key: key, value, sensitivity: def.sensitivity, provenance_ok });
  }
  return out;
}
