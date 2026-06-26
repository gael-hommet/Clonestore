// src/lib/pierre/v1/templates.ts
// PHASE 8.3-B2 §7–§9 — template engine: lifecycle (draft→review→approved→published→
// deprecated→archived), a secure deterministic merge engine (namespace whitelist, NO
// JS/eval, prototype-pollution proof), and a generation context builder fed by the
// canonical services (tenant + site scoped, sensitive-filtered, deterministically hashed).

import { createHash } from "crypto";
import type { SqlExecutor } from "./sql";
import { newUuid, withUniqueViolationRetry } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission, hasPermission, canAccessSite } from "./rbac";
import { resolveFieldPolicy, type CustomFieldDefinition } from "./field-policies";
import { validateDocumentType, getDocumentTypePolicy } from "./document-types";
import { assertTemplateTransition, emitTemplateEvent } from "./template-state";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

// ── Merge engine ─────────────────────────────────────────────────────────────
export const ALLOWED_NAMESPACES = ["company", "employee", "employment", "contract", "site", "manager", "dates", "validated_custom_fields"] as const;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;
const VALID_PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/;

export type TemplateField = { field_key: string; label?: string; data_type?: string; required?: boolean; sensitive?: boolean; source_path?: string };
export type MergeResult = {
  rendered_text: string;
  missing_fields: string[];
  invalid_fields: string[];
  unknown_fields: string[];
  sensitive_fields_used: string[];
  template_content_hash: string;
  generation_context_hash: string;
  ready_for_preview: boolean;
  ready_for_final_generation: boolean;
};

/** Safe own-property path resolution. Never touches the prototype chain or functions. */
function safeGet(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = root;
  for (const p of parts) {
    if (FORBIDDEN_SEGMENTS.has(p)) return undefined;
    if (cur === null || typeof cur !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "function" ? undefined : cur;
}

export function canonicalize(value: unknown): string {
  const seen = new WeakSet();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = norm((v as Record<string, unknown>)[k]);
    return out;
  };
  return JSON.stringify(norm(value));
}

/**
 * Deterministic merge. `fieldSchema` declares the allowed/required/sensitive fields.
 * A field is rendered only if its namespace is allowed, its path is a safe own-property
 * path, and (when sensitive) the caller holds the sensitive permission. Missing values
 * are NEVER invented — they are reported and the placeholder is left intact.
 */
export function mergeTemplate(
  body: string, context: Record<string, unknown>, fieldSchema: TemplateField[],
  opts: { canReadSensitive: boolean; customDefs?: Map<string, CustomFieldDefinition> },
): MergeResult {
  const declared = new Map(fieldSchema.map((f) => [f.source_path ?? f.field_key, f]));
  const customDefs = opts.customDefs ?? new Map<string, CustomFieldDefinition>();
  const missing = new Set<string>(), invalid = new Set<string>(), unknown = new Set<string>(), sensitiveUsed = new Set<string>();
  const usedContext: Record<string, unknown> = {};
  const MASK = "[non disponible]";

  const rendered = body.replace(PLACEHOLDER, (_m, rawPath: string) => {
    const path = String(rawPath).trim();
    // (a) structural rejections → invalid, NEVER resolved.
    if (!VALID_PATH.test(path) || path.split(".").some((s) => FORBIDDEN_SEGMENTS.has(s))) { invalid.add(path); return `{{${path}}}`; }
    if (!(ALLOWED_NAMESPACES as readonly string[]).includes(path.split(".")[0])) { invalid.add(path); return `{{${path}}}`; }
    // (b) §1 — UNKNOWN (undeclared) fields are NEVER resolved. safeGet is not called.
    if (!declared.has(path)) { unknown.add(path); return `{{${path}}}`; }
    // (c) the declared path must also be a canonical/validated field; sensitivity is canonical.
    const policy = resolveFieldPolicy(path, customDefs);
    if (!policy) { invalid.add(path); return `{{${path}}}`; } // declared but not canonical → invalid
    if (policy.sensitivity === "sensitive" || policy.sensitivity === "restricted") {
      sensitiveUsed.add(path);
      if (!opts.canReadSensitive) { missing.add(path); return MASK; } // withheld, value never exposed
    }
    // (d) only now resolve.
    const val = safeGet(context, path);
    if (val === undefined || val === null || val === "") { missing.add(path); return `{{${path}}}`; }
    usedContext[path] = val;
    return String(val);
  });

  // Required-but-absent declared fields (only for canonical/declared paths).
  for (const f of fieldSchema) {
    const key = f.source_path ?? f.field_key;
    if (f.required && resolveFieldPolicy(key, customDefs)) { const v = safeGet(context, key); if (v === undefined || v === null || v === "") missing.add(key); }
  }

  const readyPreview = invalid.size === 0 && unknown.size === 0;
  const readyFinal = readyPreview && missing.size === 0;
  return {
    rendered_text: rendered,
    missing_fields: [...missing].sort(), invalid_fields: [...invalid].sort(), unknown_fields: [...unknown].sort(),
    sensitive_fields_used: [...sensitiveUsed].sort(),
    template_content_hash: sha(body),
    generation_context_hash: sha(canonicalize(usedContext)),
    ready_for_preview: readyPreview, ready_for_final_generation: readyFinal,
  };
}

// ── Generation context builder (canonical, tenant/site/permission filtered) ──
export type GenerationTargets = { employee_id?: string | null; contract_id?: string | null; site_id?: string | null };

export async function buildGenerationContext(db: SqlExecutor, ctx: TenantContext, targets: GenerationTargets): Promise<{ context: Record<string, unknown>; provenance: Record<string, string>; hash: string }> {
  const canSensitive = hasPermission(ctx, "employee.sensitive.read");
  const provenance: Record<string, string> = {};
  const company = (await db.query<Record<string, unknown>>(`select display_name, legal_name, slug, registration_number, vat_number, timezone, default_currency from pierre_rt_companies where id=$1`, [ctx.company_id])).rows[0] ?? {};
  provenance["company"] = "pierre_rt_companies";

  let employee: Record<string, unknown> = {}, employment: Record<string, unknown> = {}, site: Record<string, unknown> = {}, manager: Record<string, unknown> = {};
  if (targets.employee_id) {
    const emp = (await db.query<Record<string, unknown>>(`select * from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, targets.employee_id])).rows[0];
    if (!emp) throw Errors.notFound("Employee not found for context");
    if (!canAccessSite(ctx, emp.site_id as string | null)) throw Errors.forbidden("Employee out of site scope");
    // Non-sensitive identity/role fields only (compensation/medical are NOT injected here).
    employee = {
      first_name: emp.first_name, last_name: emp.last_name, preferred_name: emp.preferred_name, employee_number: emp.employee_number,
      professional_email: emp.professional_email, role_title: emp.role_title, department: emp.department, team: emp.team, job_family: emp.job_family,
      hired_at: emp.hired_at, seniority_date: emp.seniority_date,
    };
    provenance["employee"] = "pierre_rt_employees(360)";
    if (emp.site_id) { site = (await db.query<Record<string, unknown>>(`select name, code, city, country, address from pierre_rt_sites where company_id=$1 and id=$2`, [ctx.company_id, emp.site_id])).rows[0] ?? {}; provenance["site"] = "pierre_rt_sites"; }
    const em = (await db.query<Record<string, unknown>>(`select employment_type, weekly_hours, classification, start_date, site_id, manager_employee_id from pierre_rt_employee_employments where company_id=$1 and employee_id=$2 order by created_at desc limit 1`, [ctx.company_id, targets.employee_id])).rows[0];
    if (em) { employment = { employment_type: em.employment_type, weekly_hours: em.weekly_hours, classification: em.classification, start_date: em.start_date }; provenance["employment"] = "pierre_rt_employee_employments"; if (em.manager_employee_id) { const mgr = (await db.query<Record<string, unknown>>(`select first_name, last_name, role_title from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, em.manager_employee_id])).rows[0]; if (mgr) { manager = { first_name: mgr.first_name, last_name: mgr.last_name, role_title: mgr.role_title }; provenance["manager"] = "pierre_rt_employees"; } } }
  }
  let contract: Record<string, unknown> = {};
  if (targets.contract_id) { const c = (await db.query<Record<string, unknown>>(`select contract_type, status, current_version from pierre_rt_employee_contracts where company_id=$1 and id=$2`, [ctx.company_id, targets.contract_id])).rows[0]; if (c) { contract = c; provenance["contract"] = "pierre_rt_employee_contracts"; } }
  const customRows = targets.employee_id ? (await db.query<{ field_key: string; field_value: string | null }>(`select field_key, field_value from pierre_rt_employee_custom_fields where company_id=$1 and employee_id=$2`, [ctx.company_id, targets.employee_id])).rows : [];
  const validated_custom_fields: Record<string, unknown> = {}; for (const r of customRows) validated_custom_fields[r.field_key] = r.field_value;
  const now = new Date();
  const dates = { today: now.toISOString().slice(0, 10), year: String(now.getUTCFullYear()) };

  const context = { company, employee, employment, contract, site, manager, dates, validated_custom_fields };
  void canSensitive;
  return { context, provenance, hash: sha(canonicalize(context)) };
}

// ── Template lifecycle services ──────────────────────────────────────────────
export type TemplateRow = { id: string; company_id: string; key: string; name: string; document_type: string; locale: string; jurisdiction: string; status: string; active_version: number | null; version: number };
export type TemplateVersionRow = { id: string; company_id: string; template_id: string; version_number: number; body: string | null; renderer: string; field_schema: TemplateField[]; status: string; content_hash: string | null; schema_hash: string | null; approved_fingerprint: string | null; locale: string; jurisdiction: string; approved_by: string | null };

// §5 — the approval is bound to a fingerprint covering content, schema, renderer,
// document type, locale and jurisdiction. Any change invalidates the approval.
export type TemplateApprovalFingerprint = { template_version_id: string; content_hash: string; schema_hash: string; renderer: string; document_type: string; locale: string; jurisdiction: string };
const schemaHash = (schema: TemplateField[]) => sha(canonicalize(schema ?? []));
function computeFingerprint(v: TemplateVersionRow, documentType: string): TemplateApprovalFingerprint {
  return { template_version_id: v.id, content_hash: sha(v.body ?? ""), schema_hash: schemaHash(v.field_schema), renderer: v.renderer, document_type: documentType, locale: v.locale, jurisdiction: v.jurisdiction };
}
const fingerprintHash = (fp: TemplateApprovalFingerprint) => sha(canonicalize(fp));

function validateFieldSchema(schema: unknown): TemplateField[] {
  if (!Array.isArray(schema)) throw Errors.validation("field_schema must be an array");
  const out: TemplateField[] = [];
  for (const f of schema as TemplateField[]) {
    if (!f.field_key || typeof f.field_key !== "string") throw Errors.validation("field_key required");
    const key = f.source_path ?? f.field_key;
    if (!VALID_PATH.test(key) || key.split(".").some((s) => FORBIDDEN_SEGMENTS.has(s))) throw Errors.validation(`invalid field path: ${key}`);
    if (!(ALLOWED_NAMESPACES as readonly string[]).includes(key.split(".")[0])) throw Errors.validation(`field namespace not allowed: ${key}`);
    out.push({ field_key: f.field_key, label: f.label, data_type: f.data_type ?? "string", required: !!f.required, sensitive: !!f.sensitive, source_path: f.source_path });
  }
  return out;
}

export async function createTemplate(db: SqlExecutor, ctx: TenantContext, input: { key: string; name: string; document_type: string; locale?: string; jurisdiction?: string }): Promise<TemplateRow> {
  requirePermission(ctx, "template.write");
  if (!input.key?.trim() || !input.name?.trim()) throw Errors.validation("key and name are required");
  // §3 — document type must be known and allow templated rendering.
  let policy;
  try { policy = validateDocumentType(input.document_type); } catch { throw Errors.validation(`Unknown document type: ${input.document_type}`); }
  if (policy.allowed_renderers.length === 0) throw Errors.validation(`Document type ${input.document_type} does not allow templates`);
  const { rows } = await db.query<TemplateRow>(
    `insert into pierre_rt_document_templates (id, company_id, key, name, document_type, locale, jurisdiction, status, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,'draft',$8) returning *`,
    [newUuid(), ctx.company_id, input.key.trim(), input.name.trim(), input.document_type, input.locale ?? "fr-FR", input.jurisdiction ?? "FR", ctx.user_id]);
  await emitTemplateEvent(db, ctx, "template.created", { template_id: rows[0].id, status_after: "draft" });
  return rows[0];
}

export async function createTemplateVersion(db: SqlExecutor, ctx: TenantContext, templateId: string, input: { body: string; renderer?: "pdf" | "docx" | "both"; field_schema: TemplateField[] }): Promise<TemplateVersionRow> {
  requirePermission(ctx, "template.write");
  // §6/§9 — atomic version allocation under a row lock, with a BOUNDED retry on a unique
  // violation as a safety net if two writers still race the (template, version_number) key.
  return withUniqueViolationRetry(() => db.transaction(async (tx) => {
    const t = (await tx.query<TemplateRow>(`select * from pierre_rt_document_templates where company_id=$1 and id=$2 for update`, [ctx.company_id, templateId])).rows[0];
    if (!t) throw Errors.notFound("Template not found");
    const policy = getDocumentTypePolicy(t.document_type);
    const renderer = input.renderer ?? "pdf";
    // §3 — renderer must be allowed by the document type; each field must be canonical.
    if (policy) {
      const wanted = renderer === "both" ? ["pdf", "docx"] : [renderer];
      if (!wanted.every((r) => policy.allowed_renderers.includes(r as "pdf" | "docx"))) throw Errors.validation(`Renderer ${renderer} not allowed for ${t.document_type}`);
    }
    const schema = validateFieldSchema(input.field_schema);
    for (const f of schema) { const key = f.source_path ?? f.field_key; if (!resolveFieldPolicy(key)) throw Errors.validation(`Field not in the canonical policy registry: ${key}`); }
    const next = (await tx.query<{ n: number }>(`select coalesce(max(version_number),0)+1 n from pierre_rt_document_template_versions where company_id=$1 and template_id=$2`, [ctx.company_id, templateId])).rows[0].n;
    const { rows } = await tx.query<TemplateVersionRow>(
      `insert into pierre_rt_document_template_versions (id, company_id, template_id, version_number, body, renderer, field_schema, status, content_hash, schema_hash, locale, jurisdiction, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12) returning *`,
      [newUuid(), ctx.company_id, templateId, next, input.body, renderer, JSON.stringify(schema), sha(input.body), schemaHash(schema), t.locale, t.jurisdiction, ctx.user_id]);
    await emitTemplateEvent(tx, ctx, "template.version_created", { template_id: templateId, version_id: rows[0].id, status_after: "draft" });
    return rows[0];
  }));
}

async function loadVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<TemplateVersionRow> {
  const { rows } = await db.query<TemplateVersionRow>(`select * from pierre_rt_document_template_versions where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  if (rows.length === 0) throw Errors.notFound("Template version not found");
  return rows[0];
}

/** §7 — internal validation WITHOUT extra RBAC (callable by approval, which already
 *  checked template.approve). The public wrapper additionally requires template.read. */
function validateTemplateVersionInternal(v: TemplateVersionRow): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!v.body || v.body.trim().length === 0) issues.push("empty_body");
  try { validateFieldSchema(v.field_schema); } catch (e) { issues.push(e instanceof Error ? e.message : "schema_invalid"); }
  const declared = new Set((v.field_schema ?? []).map((f) => f.source_path ?? f.field_key));
  for (const f of v.field_schema ?? []) { const key = f.source_path ?? f.field_key; if (!resolveFieldPolicy(key)) issues.push(`non_canonical_field:${key}`); }
  for (const m of (v.body ?? "").matchAll(PLACEHOLDER)) { const p = m[1].trim(); if (VALID_PATH.test(p) && !declared.has(p)) issues.push(`undeclared_field:${p}`); }
  return { ok: issues.length === 0, issues };
}

export async function validateTemplateVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<{ ok: boolean; issues: string[] }> {
  requirePermission(ctx, "template.read");
  return validateTemplateVersionInternal(await loadVersion(db, ctx, versionId));
}

export async function submitTemplateForReview(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<void> {
  requirePermission(ctx, "template.write");
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "review_required");
  await db.query(`update pierre_rt_document_template_versions set status='review_required' where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  await emitTemplateEvent(db, ctx, "template.review_requested", { template_id: v.template_id, version_id: versionId, status_before: v.status, status_after: "review_required" });
}

export async function requestTemplateChanges(db: SqlExecutor, ctx: TenantContext, versionId: string, reason?: string): Promise<void> {
  requirePermission(ctx, "template.approve");
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "changes_requested");
  await db.query(`update pierre_rt_document_template_versions set status='changes_requested' where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  await emitTemplateEvent(db, ctx, "template.changes_requested", { template_id: v.template_id, version_id: versionId, status_before: v.status, status_after: "changes_requested", reason: reason ?? null });
}

/** changes_requested → draft (resume editing). */
export async function resumeTemplateDraft(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<void> {
  requirePermission(ctx, "template.write");
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "draft");
  await db.query(`update pierre_rt_document_template_versions set status='draft' where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
}

async function templateOf(db: SqlExecutor, ctx: TenantContext, templateId: string): Promise<TemplateRow> {
  const t = (await db.query<TemplateRow>(`select * from pierre_rt_document_templates where company_id=$1 and id=$2`, [ctx.company_id, templateId])).rows[0];
  if (!t) throw Errors.notFound("Template not found");
  return t;
}

export async function approveTemplateVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<void> {
  requirePermission(ctx, "template.approve"); // §7 — approve does NOT require template.read
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "approved");
  const val = validateTemplateVersionInternal(v);
  if (!val.ok) throw Errors.validation(`Template version invalid: ${val.issues.join(", ")}`);
  const t = await templateOf(db, ctx, v.template_id);
  // §5 — bind the approval to a fingerprint of the exact content/schema/renderer/type/locale.
  const fp = fingerprintHash(computeFingerprint(v, t.document_type));
  // §7 — state + approval + audit + CloneTrace + outbox are ATOMIC.
  await db.transaction(async (tx) => {
    await tx.query(`update pierre_rt_document_template_versions set status='approved', approved_by=$3, approved_at=now(), approved_fingerprint=$4 where company_id=$1 and id=$2`, [ctx.company_id, versionId, ctx.user_id, fp]);
    await tx.query(`insert into pierre_rt_template_approvals (id, company_id, template_version_id, approver_user_id, decision, note) values ($1,$2,$3,$4,'approved',$5)`, [newUuid(), ctx.company_id, versionId, ctx.user_id, fp]);
    await emitTemplateEvent(tx, ctx, "template.approved", { template_id: v.template_id, version_id: versionId, status_before: v.status, status_after: "approved", fingerprint: fp, new_fingerprint: fp });
  });
}

export async function publishTemplateVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<void> {
  requirePermission(ctx, "template.approve");
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "published");
  const t = await templateOf(db, ctx, v.template_id);
  // §3/§5 — recompute the fingerprint; any drift since approval EXPLICITLY invalidates the
  // approval (→ changes_requested), records old/new fingerprint + reason, audited + outbox.
  const current = fingerprintHash(computeFingerprint(v, t.document_type));
  if (!v.approved_fingerprint || v.approved_fingerprint !== current) {
    // §4 — invalidation is COMMITTED (audit persists) then publication is blocked; old/new
    // fingerprints recorded as SEPARATE columns, not a concatenated string.
    await db.transaction(async (tx) => {
      await tx.query(`update pierre_rt_document_template_versions set status='changes_requested', approved_by=null, approved_fingerprint=null where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
      await emitTemplateEvent(tx, ctx, "template.approval_invalidated", { template_id: v.template_id, version_id: versionId, status_before: "approved", status_after: "changes_requested", reason: "content_drift_since_approval", old_fingerprint: v.approved_fingerprint, new_fingerprint: current });
    });
    throw Errors.conflict("Approval invalidated: template content changed since approval");
  }
  // §7 — published transition + audit + CloneTrace + outbox are ATOMIC.
  await db.transaction(async (tx) => {
    await tx.query(`update pierre_rt_document_template_versions set status='published', published_at=now() where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
    await tx.query(`update pierre_rt_document_templates set status='published', active_version=$3, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, v.template_id, v.version_number]);
    await emitTemplateEvent(tx, ctx, "template.published", { template_id: v.template_id, version_id: versionId, status_before: "approved", status_after: "published", fingerprint: current, new_fingerprint: current });
  });
}

export async function deprecateTemplateVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<void> {
  requirePermission(ctx, "template.approve");
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "deprecated");
  await db.query(`update pierre_rt_document_template_versions set status='deprecated' where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  await db.query(`update pierre_rt_document_templates set status='deprecated' where company_id=$1 and id=$2 and active_version=$3`, [ctx.company_id, v.template_id, v.version_number]);
  await emitTemplateEvent(db, ctx, "template.deprecated", { template_id: v.template_id, version_id: versionId, status_before: "published", status_after: "deprecated" });
}

export async function archiveTemplateVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<void> {
  requirePermission(ctx, "template.approve");
  const v = await loadVersion(db, ctx, versionId);
  assertTemplateTransition(v.status, "archived");
  await db.query(`update pierre_rt_document_template_versions set status='archived' where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  await emitTemplateEvent(db, ctx, "template.archived", { template_id: v.template_id, version_id: versionId, status_before: "deprecated", status_after: "archived" });
}

export async function archiveTemplate(db: SqlExecutor, ctx: TenantContext, templateId: string): Promise<void> {
  requirePermission(ctx, "template.approve");
  await db.query(`update pierre_rt_document_templates set status='archived', archived_at=now() where company_id=$1 and id=$2`, [ctx.company_id, templateId]);
  await emitTemplateEvent(db, ctx, "template.archived", { template_id: templateId });
}

export async function getPublishedTemplateVersion(db: SqlExecutor, ctx: TenantContext, templateId: string): Promise<TemplateVersionRow | null> {
  const t = (await db.query<TemplateRow>(`select active_version from pierre_rt_document_templates where company_id=$1 and id=$2 and status='published'`, [ctx.company_id, templateId])).rows[0];
  if (!t?.active_version) return null;
  return (await db.query<TemplateVersionRow>(`select * from pierre_rt_document_template_versions where company_id=$1 and template_id=$2 and version_number=$3 and status='published'`, [ctx.company_id, templateId, t.active_version])).rows[0] ?? null;
}

/** Preview rendering (merge only; not a final generation). */
export async function renderTemplatePreview(db: SqlExecutor, ctx: TenantContext, versionId: string, targets: GenerationTargets): Promise<MergeResult & { provenance: Record<string, string> }> {
  requirePermission(ctx, "template.read");
  const v = await loadVersion(db, ctx, versionId);
  const { context, provenance } = await buildGenerationContext(db, ctx, targets);
  const merged = mergeTemplate(v.body ?? "", context, v.field_schema ?? [], { canReadSensitive: hasPermission(ctx, "employee.sensitive.read") });
  await emitTemplateEvent(db, ctx, "template.preview_rendered", { template_id: v.template_id, version_id: versionId, reason: merged.ready_for_final_generation ? "ready" : "incomplete" });
  return { ...merged, provenance };
}
