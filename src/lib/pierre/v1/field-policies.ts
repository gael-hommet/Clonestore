// src/lib/pierre/v1/field-policies.ts
// PHASE 8.3-B2C §2 / B2E §11 — canonical merge-field policy registry. Sensitivity and
// eligibility come from HERE, never from the template author. A template cannot
// downgrade a sensitive field by declaring `"sensitive": false`. §11 completes the
// policy with the permission/role/document-type/provenance dimensions that the
// generation context and the document guard enforce.

export type FieldSensitivity = "normal" | "sensitive" | "restricted";
export type FieldPolicy = {
  path: string;
  data_type: "string" | "date" | "number" | "email";
  sensitivity: FieldSensitivity;
  source: string;
  allowed_for_preview: boolean;
  allowed_for_final: boolean;
  formatter?: "date_fr" | "upper" | "none";
  // §11 governance dimensions (all optional → default = unconstrained / derived):
  required_permissions_preview?: string[];   // perms required to render in a PREVIEW
  required_permissions_final?: string[];      // perms required to render in a FINAL document
  required_permissions_approve?: string[];    // perms required to APPROVE a template using the field
  allowed_roles?: string[];                   // if set, only these roles may use the field
  allowed_document_types?: string[];          // if set, the field is usable ONLY in these types
  denied_document_types?: string[];           // the field is NEVER usable in these types
  required_provenance?: string;               // value must come from this provenance to be final
};

function fp(path: string, over: Partial<FieldPolicy> = {}): FieldPolicy {
  const base: FieldPolicy = { path, data_type: "string", sensitivity: "normal", source: path.split(".")[0], allowed_for_preview: true, allowed_for_final: true, formatter: "none", ...over };
  // sensitivity implies a default permission floor unless explicitly overridden.
  if (base.sensitivity !== "normal" && !base.required_permissions_final) base.required_permissions_final = ["document.sensitive.read"];
  if (base.sensitivity === "restricted" && !base.required_permissions_preview) base.required_permissions_preview = ["document.sensitive.read"];
  return base;
}

export const FIELD_POLICIES: Record<string, FieldPolicy> = Object.fromEntries([
  fp("company.legal_name"), fp("company.display_name"), fp("company.slug"), fp("company.registration_number"), fp("company.vat_number"), fp("company.timezone"), fp("company.default_currency"),
  fp("employee.first_name"), fp("employee.last_name"), fp("employee.preferred_name"), fp("employee.employee_number"),
  fp("employee.professional_email", { data_type: "email" }), fp("employee.department"), fp("employee.team"), fp("employee.job_family"), fp("employee.role_title"),
  fp("employee.hired_at", { data_type: "date", formatter: "date_fr" }), fp("employee.seniority_date", { data_type: "date", formatter: "date_fr" }),
  fp("employment.start_date", { data_type: "date", formatter: "date_fr" }), fp("employment.end_date", { data_type: "date", formatter: "date_fr" }), fp("employment.weekly_hours", { data_type: "number" }), fp("employment.classification"), fp("employment.employment_type"), fp("employment.trial_period"),
  fp("contract.contract_type"), fp("contract.status"),
  // compensation is sensitive: never in a preview, final only with sensitive perm + payroll provenance.
  fp("compensation.base_salary", { data_type: "number", sensitivity: "sensitive", source: "compensation", allowed_for_preview: false, required_permissions_final: ["employee.sensitive.read"], required_provenance: "payroll_system", denied_document_types: ["work_certificate", "employee_certificate", "policy_acknowledgement"] }),
  fp("compensation.variable_pay", { data_type: "number", sensitivity: "sensitive", source: "compensation", allowed_for_preview: false, required_permissions_final: ["employee.sensitive.read"], required_provenance: "payroll_system", denied_document_types: ["work_certificate", "employee_certificate"] }),
  fp("site.name"), fp("site.code"), fp("site.city"), fp("site.country"), fp("site.address"),
  fp("manager.first_name"), fp("manager.last_name"), fp("manager.role_title"),
  fp("dates.today", { data_type: "date", formatter: "date_fr" }), fp("dates.year", { data_type: "number" }),
].map((p) => [p.path, p]));

/** A validated custom field definition (sensitivity is canonical, set by the company HR config). */
export type CustomFieldDefinition = {
  field_key: string; data_type: FieldPolicy["data_type"]; sensitivity: FieldSensitivity; active: boolean;
  allowed_document_types?: string[]; required_provenance?: string; label?: string;
};

/**
 * Resolve the canonical policy for a path. Known canonical paths come from the
 * registry; `validated_custom_fields.<key>` resolves from the supplied validated
 * definitions (sensitivity from the definition, NEVER from the template). Any other
 * path is unknown → not a renderable field.
 */
export function resolveFieldPolicy(path: string, customDefs: Map<string, CustomFieldDefinition> = new Map()): FieldPolicy | null {
  if (FIELD_POLICIES[path]) return FIELD_POLICIES[path];
  if (path.startsWith("validated_custom_fields.")) {
    const key = path.slice("validated_custom_fields.".length);
    const def = customDefs.get(key);
    if (!def || !def.active) return null;
    const sensitive = def.sensitivity !== "normal";
    return {
      path, data_type: def.data_type, sensitivity: def.sensitivity, source: "validated_custom_fields",
      allowed_for_preview: def.sensitivity !== "restricted", allowed_for_final: true,
      required_permissions_final: sensitive ? ["document.sensitive.read"] : undefined,
      required_permissions_preview: def.sensitivity === "restricted" ? ["document.sensitive.read"] : undefined,
      allowed_document_types: def.allowed_document_types && def.allowed_document_types.length > 0 ? def.allowed_document_types : undefined,
      required_provenance: def.required_provenance,
    };
  }
  return null;
}

export function isFieldSensitive(path: string, customDefs?: Map<string, CustomFieldDefinition>): boolean {
  const p = resolveFieldPolicy(path, customDefs);
  return !!p && (p.sensitivity === "sensitive" || p.sensitivity === "restricted");
}

export type FieldUsageStage = "preview" | "final" | "approve";
export type FieldUsageDecision = { allowed: boolean; reason_code?: string; required_permissions: string[] };

/**
 * §11 — decide whether a field may be used in a given document type / stage, with a
 * given permission set and (optional) role set. Pure & fail-closed: an unknown field
 * is refused. The caller (generation context / guard) enforces the decision.
 */
export function evaluateFieldUsage(
  path: string,
  ctx: { stage: FieldUsageStage; document_type: string; permissions: readonly string[]; roles?: readonly string[] },
  customDefs?: Map<string, CustomFieldDefinition>,
): FieldUsageDecision {
  const pol = resolveFieldPolicy(path, customDefs);
  if (!pol) return { allowed: false, reason_code: "unknown_field", required_permissions: [] };
  if (pol.denied_document_types?.includes(ctx.document_type)) return { allowed: false, reason_code: "field_denied_for_document_type", required_permissions: [] };
  if (pol.allowed_document_types && !pol.allowed_document_types.includes(ctx.document_type)) return { allowed: false, reason_code: "field_not_allowed_for_document_type", required_permissions: [] };
  if (pol.allowed_roles && ctx.roles && ctx.roles.length > 0 && !ctx.roles.some((r) => pol.allowed_roles!.includes(r))) return { allowed: false, reason_code: "field_role_not_permitted", required_permissions: [] };
  if (ctx.stage === "preview" && !pol.allowed_for_preview) return { allowed: false, reason_code: "field_not_allowed_in_preview", required_permissions: [] };
  if (ctx.stage === "final" && !pol.allowed_for_final) return { allowed: false, reason_code: "field_not_allowed_in_final", required_permissions: [] };
  const req = ctx.stage === "preview" ? pol.required_permissions_preview : ctx.stage === "approve" ? pol.required_permissions_approve : pol.required_permissions_final;
  const missing = (req ?? []).filter((p) => !ctx.permissions.includes(p));
  if (missing.length > 0) return { allowed: false, reason_code: "field_missing_permission", required_permissions: missing };
  return { allowed: true, required_permissions: [] };
}
