// src/lib/pierre/v1/contracts.ts
// PHASE 8.3-B2G §4–§9 — the Pierre CONTRACT engine. Governed, tenant-safe, permissioned,
// traceable, transactional, fail-closed. Reuses the strict generation context, field/document
// policies, document + file services, renderers, readiness engine and contract state machine —
// it builds NONE of those anew. Storage is not transactional with Postgres, so a generation
// renders + persists artifacts first and COMPENSATES (deletes the objects) if the DB step fails.

import type { SqlExecutor } from "./sql";
import { newUuid, withUniqueViolationRetry } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";
import { validateContractType, getContractPolicy, canRoleCreateContract, canRoleApproveContract, type ContractPolicy } from "./contract-policies";
import { evaluateContractReadiness, type ContractAction, type ContractReadiness } from "./contract-readiness";
import { providerLevelForPolicy } from "./signature-security";
import { assertContractTransition, emitContractEvent } from "./contract-state";
import { buildContractRenderModel, renderContractPdf, renderContractDocx, canonicalContractHash } from "./contract-render-model";
import { compileContractTemplate } from "./contract-template-compiler";
import { buildStrictGenerationContext } from "./generation-context";
import { getPublishedTemplateVersion } from "./templates";
import { createDocument, createVersion, submitForReview as submitDocForReview, approveVersion as approveDocVersion, finalizeVersion as finalizeDocVersion } from "./documents";
import { createUploadIntent, finalizeUpload } from "./files";
import { getFileStorageProvider, type FileStorageProvider } from "./file-storage";
import { sha256 } from "./renderers";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** FAIL-CLOSED contract role check (R1.2): absent/empty/unknown role set is refused. */
function assertContractRole(ctx: TenantContext, type: string, kind: "create" | "approve"): void {
  const roles = ctx.role_keys;
  if (!roles || roles.length === 0) throw Errors.forbidden("No role assigned for this contract action");
  const ok = kind === "create" ? canRoleCreateContract(roles, type) : canRoleApproveContract(roles, type);
  if (!ok) throw Errors.forbidden(`Role not permitted to ${kind} contract ${type}`);
}

export type ContractRow = {
  id: string; company_id: string; employee_id: string; contract_type: string; status: string;
  workflow_status: string; current_version: number; document_id: string | null; parent_contract_id: string | null;
  approved_by: string | null; approved_at: string | null; signed_at: string | null; created_at: string;
};
export type ContractVersionRow = {
  id: string; company_id: string; contract_id: string; version: number; effective_from: string | null; effective_to: string | null;
  status: string; workflow_status: string; template_version_id: string | null; document_id: string | null; document_version_id: string | null;
  content_hash: string | null; canonical_hash: string | null; pdf_hash: string | null; docx_hash: string | null;
  template_fingerprint: string | null; approved_fingerprint: string | null; signature_status: string; created_at: string;
};
type Deps = {
  storage?: FileStorageProvider; scanner?: import("./file-scan").FileScanProvider; now?: string;
  // R1.10 — TEST-ONLY controlled failpoints. `failBeforeCommit` throws after the artifacts
  // are persisted but before the DB link commits (to prove compensation). `failCompensation`
  // additionally makes the cleanup throw (to prove the primary error survives + is audited).
  __failBeforeCommit?: boolean; __failCompensation?: boolean;
};
const nowIso = (deps: Deps) => deps.now ?? new Date().toISOString();

async function loadContract(db: SqlExecutor, ctx: TenantContext, id: string, forUpdate = false): Promise<ContractRow> {
  const { rows } = await db.query<ContractRow>(`select * from pierre_rt_employee_contracts where company_id=$1 and id=$2${forUpdate ? " for update" : ""}`, [ctx.company_id, id]);
  if (rows.length === 0) throw Errors.notFound("Contract not found");
  return rows[0];
}
async function headVersion(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<ContractVersionRow> {
  const { rows } = await db.query<ContractVersionRow>(`select * from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2 order by version desc limit 1`, [ctx.company_id, contractId]);
  if (rows.length === 0) throw Errors.notFound("Contract has no version");
  return rows[0];
}
function templateFingerprint(tv: { id: string; content_hash: string | null; schema_hash: string | null } | null): string | null {
  return tv ? `${tv.id}:${tv.content_hash ?? ""}:${tv.schema_hash ?? ""}` : null;
}
/** Coerce a DB date value (PGlite returns `date` columns as JS Date) to a 'YYYY-MM-DD' string. */
function dateStr(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  const s = String(x);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// ── Creation ────────────────────────────────────────────────────────────────────
export async function createGovernedContract(
  db: SqlExecutor, ctx: TenantContext,
  // R1.1 — the normal creation path NEVER accepts a parent: only createContractAmendment may
  // set parent_contract_id. The DTO has no parent field; a forged body cannot reach the DB.
  input: { employee_id: string; contract_type: string; effective_from: string; effective_to?: string | null },
): Promise<ContractRow> {
  requirePermission(ctx, "document.write");
  const policy = (() => { try { return validateContractType(input.contract_type); } catch { throw Errors.validation(`Unknown contract type: ${input.contract_type}`); } })();
  assertContractRole(ctx, input.contract_type, "create"); // R1.2 fail-closed
  if (policy.sensitivity !== "normal") requirePermission(ctx, "document.sensitive.write");
  // employee must belong to the active tenant
  const emp = (await db.query<{ id: string }>(`select id from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, input.employee_id])).rows[0];
  if (!emp) throw Errors.validation("Employee not found in this tenant");
  return db.transaction(async (tx) => {
    const id = newUuid();
    const { rows } = await tx.query<ContractRow>(
      `insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status, workflow_status, current_version, parent_contract_id)
       values ($1,$2,$3,$4,'draft','draft',1,null) returning *`,
      [id, ctx.company_id, input.employee_id, input.contract_type]);
    await tx.query(
      `insert into pierre_rt_employee_contract_versions (id, company_id, contract_id, version, status, workflow_status, effective_from, effective_to)
       values ($1,$2,$3,1,'draft','draft',$4,$5)`,
      [newUuid(), ctx.company_id, id, input.effective_from, input.effective_to ?? null]);
    await emitContractEvent(tx, ctx, "contract.created", { contract_id: id, status_after: "draft" });
    await emitContractEvent(tx, ctx, "contract.version_created", { contract_id: id, status_after: "draft" });
    return rows[0];
  });
}

export async function createContractVersion(db: SqlExecutor, ctx: TenantContext, contractId: string, input: { effective_from: string; effective_to?: string | null }): Promise<ContractVersionRow> {
  requirePermission(ctx, "document.write");
  return withUniqueViolationRetry(() => db.transaction(async (tx) => {
    const c = await loadContract(tx, ctx, contractId, true);
    // R1.7 — a new version is only allowed while the contract is genuinely modifiable. A
    // contract that is final / ready / submitted / in_progress / signed / superseded /
    // archived must NOT acquire a fresh draft head. `approved` must be reopened via
    // request-changes first; `final`+ require an amendment. This guarantees no contract is
    // `final` while its current version is `draft`.
    const MUTABLE = ["draft", "changes_requested"];
    if (!MUTABLE.includes(c.workflow_status)) {
      throw Errors.conflict(c.workflow_status === "approved"
        ? "Reopen the contract (request-changes) before creating a new version"
        : `Contract in status '${c.workflow_status}' cannot get a new version — create an amendment instead`);
    }
    const next = (await tx.query<{ n: number }>(`select coalesce(max(version),0)+1 n from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2`, [ctx.company_id, contractId])).rows[0].n;
    const { rows } = await tx.query<ContractVersionRow>(
      `insert into pierre_rt_employee_contract_versions (id, company_id, contract_id, version, status, workflow_status, effective_from, effective_to) values ($1,$2,$3,$4,'draft','draft',$5,$6) returning *`,
      [newUuid(), ctx.company_id, contractId, next, input.effective_from, input.effective_to ?? null]);
    // reset to draft so the contract is never left in a non-draft state with a draft head;
    // prior approvals are bound to the old version and no longer count for the new head.
    const to = c.workflow_status === "changes_requested" ? "draft" : c.workflow_status;
    if (to !== c.workflow_status) await tx.query(`update pierre_rt_employee_contracts set current_version=$3, workflow_status=$4 where company_id=$1 and id=$2`, [ctx.company_id, contractId, next, to]);
    else await tx.query(`update pierre_rt_employee_contracts set current_version=$3 where company_id=$1 and id=$2`, [ctx.company_id, contractId, next]);
    await emitContractEvent(tx, ctx, "contract.version_created", { contract_id: contractId, version_id: rows[0].id, status_before: c.workflow_status, status_after: "draft" });
    return rows[0];
  }));
}

// ── Readiness evidence resolution ─────────────────────────────────────────────────
async function resolveReadiness(
  db: SqlExecutor, ctx: TenantContext, c: ContractRow, version: ContractVersionRow, policy: ContractPolicy | null,
  action: ContractAction, renderer: "pdf" | "docx", fieldValues: Record<string, string | null>,
): Promise<{ readiness: ContractReadiness; templateVersion: Awaited<ReturnType<typeof getPublishedTemplateVersion>>; context: Awaited<ReturnType<typeof buildStrictGenerationContext>> | null; fingerprint: string | null }> {
  const emp = (await db.query<{ id: string; site_id: string | null }>(`select id, site_id from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, c.employee_id])).rows[0];
  let templateVersion: Awaited<ReturnType<typeof getPublishedTemplateVersion>> = null;
  let templateId: string | null = null;
  if (policy?.requires_template) {
    const t = (await db.query<{ id: string }>(`select id from pierre_rt_document_templates where company_id=$1 and document_type=$2 and status='published' order by created_at desc limit 1`, [ctx.company_id, policy.document_type])).rows[0];
    templateId = t?.id ?? null;
    if (templateId) templateVersion = await getPublishedTemplateVersion(db, ctx, templateId);
  }
  const fingerprint = templateFingerprint(templateVersion);

  let context: Awaited<ReturnType<typeof buildStrictGenerationContext>> | null = null;
  if (emp && policy) {
    const extra: Record<string, string | null> = { "employment.start_date": dateStr(version.effective_from), "employment.end_date": dateStr(version.effective_to), ...fieldValues };
    const requested = Array.from(new Set([...policy.required_fields, ...policy.conditional_fields, ...Object.keys(fieldValues)]));
    try { context = await buildStrictGenerationContext(db, ctx, { document_type: policy.document_type, employee_id: c.employee_id, site_id: emp.site_id, contract_id: c.id, requested_fields: requested, extra_values: extra }); }
    catch { context = null; }
  }

  // approvals valid for the CURRENT fingerprint + canonical hash
  const validAppr = (await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_contract_approvals where company_id=$1 and contract_version_id=$2 and decision='approved' and (template_fingerprint is not distinct from $3) and (content_hash is not distinct from $4)`,
    [ctx.company_id, version.id, version.template_fingerprint, version.canonical_hash])).rows[0].n;

  // artifact state from the linked document version's rendered pdf
  let artifact: { present: boolean; upload_status?: string | null; scan_status?: string | null } | null = null;
  if (version.document_version_id) {
    const f = (await db.query<{ upload_status: string; scan_status: string }>(
      `select f.upload_status, f.scan_status from pierre_rt_document_versions dv join pierre_rt_files f on f.id=dv.rendered_pdf_file_id and f.company_id=dv.company_id where dv.company_id=$1 and dv.id=$2`,
      [ctx.company_id, version.document_version_id])).rows[0];
    artifact = f ? { present: true, upload_status: f.upload_status, scan_status: f.scan_status } : { present: false };
  }
  const doc = c.document_id ? (await db.query<{ legal_hold: boolean }>(`select legal_hold from pierre_rt_documents where company_id=$1 and id=$2`, [ctx.company_id, c.document_id])).rows[0] : null;

  const readiness = evaluateContractReadiness({
    requested_action: action, policy, workflow_status: c.workflow_status,
    employee_ok: !!emp, site_coherent: true, contract_matches_employee: true,
    template: templateVersion ? { published: templateVersion.status === "published", document_type: policy!.document_type, allowed_renderers: (templateVersion.renderer === "both" ? ["pdf", "docx"] : [templateVersion.renderer]) as Array<"pdf" | "docx"> } : (policy?.requires_template ? null : { published: true, document_type: policy?.document_type ?? "", allowed_renderers: ["pdf", "docx"] }),
    context, renderer, permissions: ctx.permissions, role_keys: ctx.role_keys ?? [],
    required_approvals: policy?.required_approvals ?? 1, approvals_valid: validAppr,
    template_fingerprint_current: fingerprint, template_fingerprint_approved: version.template_fingerprint,
    document_content_hash: version.canonical_hash, approved_content_hash: version.approved_fingerprint ? version.canonical_hash : version.content_hash,
    artifact, legal_hold: !!doc?.legal_hold, is_latest_version: version.version === c.current_version,
    signed_or_superseded: ["signed", "superseded", "archived"].includes(c.workflow_status),
  });
  return { readiness, templateVersion, context, fingerprint };
}

export async function checkContractReadiness(db: SqlExecutor, ctx: TenantContext, contractId: string, action: ContractAction, renderer: "pdf" | "docx" = "pdf", fieldValues: Record<string, string | null> = {}): Promise<ContractReadiness> {
  requirePermission(ctx, "document.read");
  const c = await loadContract(db, ctx, contractId);
  const v = await headVersion(db, ctx, contractId);
  const policy = getContractPolicy(c.contract_type);
  const { readiness } = await resolveReadiness(db, ctx, c, v, policy, action, renderer, fieldValues);
  await emitContractEvent(db, ctx, "contract.readiness_checked", { contract_id: contractId, version_id: v.id, status_after: c.workflow_status, reason: readiness.ready ? "ready" : readiness.blockers.join(",") });
  return readiness;
}

// ── Generation (renders + persists artifacts, then atomic DB link, with compensation) ──
export type ContractGenerationResult = { contract_id: string; version_id: string; document_id: string; document_version_id: string; canonical_hash: string; pdf_hash: string | null; docx_hash: string | null; page_count: number };

export async function generateContract(
  db: SqlExecutor, ctx: TenantContext, contractId: string,
  input: { renderers?: Array<"pdf" | "docx">; field_values?: Record<string, string | null> } = {}, deps: Deps = {},
): Promise<ContractGenerationResult> {
  requirePermission(ctx, "document.write");
  const storage = deps.storage ?? getFileStorageProvider();
  const fieldValues = input.field_values ?? {};
  const wantRenderers = input.renderers ?? ["pdf", "docx"];

  // 1. load + validate (no lock yet — rendering is side-effect-free)
  const c = await loadContract(db, ctx, contractId);
  const policy = validateContractType(c.contract_type);
  if (policy.sensitivity !== "normal") requirePermission(ctx, "document.sensitive.write");
  const version = await headVersion(db, ctx, contractId);
  const primaryRenderer = wantRenderers[0] ?? "pdf";
  const { readiness, templateVersion, context, fingerprint } = await resolveReadiness(db, ctx, c, version, policy, "generate", primaryRenderer, fieldValues);
  if (!readiness.ready || !context) {
    await emitContractEvent(db, ctx, "contract.generation_blocked", { contract_id: contractId, version_id: version.id, status_after: c.workflow_status, reason: readiness.blockers.join(",") || "no_context" });
    throw Errors.validation(`Contract not ready for generation: ${readiness.blockers.join(", ")}`);
  }

  // 2. R1.3 — compile the PUBLISHED template body into the contractual clauses. An unknown
  // template variable fails closed; hardcoded content never silently replaces the template.
  if (policy.requires_template && !templateVersion) throw Errors.validation("No published template for this contract type");
  const compiled = compileContractTemplate(templateVersion?.body ?? null, templateVersion?.field_schema ?? [], context);
  if (compiled.unknown_fields.length > 0) {
    await emitContractEvent(db, ctx, "contract.generation_blocked", { contract_id: contractId, version_id: version.id, status_after: c.workflow_status, reason: `unknown_template_fields:${compiled.unknown_fields.join(",")}` });
    throw Errors.validation(`Template references unknown/forbidden fields: ${compiled.unknown_fields.join(", ")}`);
  }
  const model = buildContractRenderModel({ policy, context, compiled, reference: `${contractId.slice(0, 8)}-v${version.version}`, version: version.version, is_final: false, generated_at: nowIso(deps) });
  const canonical = canonicalContractHash(model);
  const pdf = wantRenderers.includes("pdf") ? renderContractPdf(model) : null;
  const docx = wantRenderers.includes("docx") ? renderContractDocx(model) : null;

  // 3. persist artifacts as CLEAN files (storage + scan). NOT in the DB tx → compensate on failure.
  const createdFiles: string[] = [];
  let pdfFileId: string | null = null, docxFileId: string | null = null;
  try {
    if (pdf) {
      const intent = await createUploadIntent(db, ctx, { declared_mime_type: "application/pdf", original_filename: `contract-${version.version}.pdf`, declared_sha256: sha256(pdf.bytes), declared_size_bytes: pdf.bytes.length }, deps);
      await storage.upload((await fileObjectKey(db, ctx, intent.file_id)), pdf.bytes);
      const f = await finalizeUpload(db, ctx, intent.file_id, pdf.bytes, deps);
      if (f.upload_status !== "clean" || f.scan_status !== "clean") throw Errors.validation("Rendered PDF failed the clean gate");
      pdfFileId = intent.file_id; createdFiles.push(intent.file_id);
    }
    if (docx) {
      const intent = await createUploadIntent(db, ctx, { declared_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", original_filename: `contract-${version.version}.docx`, declared_sha256: sha256(docx.bytes), declared_size_bytes: docx.bytes.length }, deps);
      await storage.upload((await fileObjectKey(db, ctx, intent.file_id)), docx.bytes);
      const f = await finalizeUpload(db, ctx, intent.file_id, docx.bytes, deps);
      if (f.upload_status !== "clean" || f.scan_status !== "clean") throw Errors.validation("Rendered DOCX failed the clean gate");
      docxFileId = intent.file_id; createdFiles.push(intent.file_id);
    }

    // R1.10 — controlled failpoint AFTER artifacts persisted, BEFORE the DB link commits.
    if (deps.__failBeforeCommit) throw new Error("injected failure before commit");

    // 4. atomic DB link: document + document version + contract version + events
    return await db.transaction(async (tx) => {
      const locked = await loadContract(tx, ctx, contractId, true);
      if (["signed", "superseded", "archived"].includes(locked.workflow_status)) throw Errors.conflict("Contract is not mutable");
      await emitContractEvent(tx, ctx, "contract.generation_started", { contract_id: contractId, version_id: version.id, status_after: locked.workflow_status });
      let documentId = locked.document_id;
      if (!documentId) {
        const doc = await createDocument(tx, ctx, { document_type: policy.document_type, title: `${policy.label} — ${model.employee_name}`, sensitivity: policy.sensitivity, employee_id: c.employee_id, contract_id: contractId });
        documentId = doc.id;
        await tx.query(`update pierre_rt_employee_contracts set document_id=$3 where company_id=$1 and id=$2`, [ctx.company_id, contractId, documentId]);
      }
      const dv = await createVersion(tx, ctx, documentId, { rendered_pdf_file_id: pdfFileId, rendered_docx_file_id: docxFileId, content_hash: canonical, template_version_id: templateVersion?.id ?? null, generation_context_hash: canonical, change_summary: `contract v${version.version}` });
      await tx.query(
        `update pierre_rt_employee_contract_versions set document_id=$3, document_version_id=$4, template_version_id=$5, content_hash=$6, canonical_hash=$6, pdf_hash=$7, docx_hash=$8, template_fingerprint=$9 where company_id=$1 and id=$2`,
        [ctx.company_id, version.id, documentId, dv.id, templateVersion?.id ?? null, canonical, pdf ? sha256(pdf.bytes) : null, docx ? sha256(docx.bytes) : null, fingerprint]);
      await emitContractEvent(tx, ctx, "contract.generated", { contract_id: contractId, version_id: version.id, document_id: documentId, status_after: locked.workflow_status, fingerprint });
      return { contract_id: contractId, version_id: version.id, document_id: documentId, document_version_id: dv.id, canonical_hash: canonical, pdf_hash: pdf ? sha256(pdf.bytes) : null, docx_hash: docx ? sha256(docx.bytes) : null, page_count: pdf?.page_count ?? 1 };
    });
  } catch (e) {
    // COMPENSATION: the storage objects are not transactional with Postgres. Best-effort remove
    // the orphaned artifacts so a failed generation never leaves a usable file behind. If the
    // compensation itself fails, the PRIMARY error still propagates and the incident is audited.
    const compensationErrors: string[] = [];
    for (const fid of createdFiles) {
      try {
        const ok = (await db.query<{ object_key: string }>(`select object_key from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, fid])).rows[0];
        if (deps.__failCompensation) throw new Error("injected compensation failure");
        if (ok) await storage.deleteObject(ok.object_key);
        await db.query(`update pierre_rt_files set upload_status='deleted', deleted_at=now() where company_id=$1 and id=$2`, [ctx.company_id, fid]);
      } catch (ce) { compensationErrors.push(`${fid}:${ce instanceof Error ? ce.message : String(ce)}`); }
    }
    if (compensationErrors.length > 0) {
      // audit the technical incident (best-effort); never a false success.
      try { await emitContractEvent(db, ctx, "contract.generation_blocked", { contract_id: contractId, status_after: "draft", reason: `storage_compensation_failed:${compensationErrors.length}` }); } catch { /* best-effort */ }
    }
    throw e;
  }
}
async function fileObjectKey(db: SqlExecutor, ctx: TenantContext, fileId: string): Promise<string> {
  const r = (await db.query<{ object_key: string }>(`select object_key from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, fileId])).rows[0];
  if (!r) throw Errors.notFound("File intent not found");
  return r.object_key;
}

// ── Workflow transitions ──────────────────────────────────────────────────────────
async function transition(db: SqlExecutor, ctx: TenantContext, contractId: string, to: string, event: Parameters<typeof emitContractEvent>[2], opts: { perm: string; versionStatus?: string } ): Promise<ContractRow> {
  requirePermission(ctx, opts.perm);
  return db.transaction(async (tx) => {
    const c = await loadContract(tx, ctx, contractId, true);
    assertContractTransition(c.workflow_status, to);
    const { rows } = await tx.query<ContractRow>(`update pierre_rt_employee_contracts set workflow_status=$3 where company_id=$1 and id=$2 returning *`, [ctx.company_id, contractId, to]);
    if (opts.versionStatus) await tx.query(`update pierre_rt_employee_contract_versions set workflow_status=$4 where company_id=$1 and contract_id=$2 and version=$3`, [ctx.company_id, contractId, c.current_version, opts.versionStatus]);
    await emitContractEvent(tx, ctx, event, { contract_id: contractId, status_before: c.workflow_status, status_after: to });
    return rows[0];
  });
}

export const submitContractForReview = (db: SqlExecutor, ctx: TenantContext, id: string) => transition(db, ctx, id, "under_review", "contract.review_requested", { perm: "document.write" });
export const requestContractChanges = (db: SqlExecutor, ctx: TenantContext, id: string) => transition(db, ctx, id, "changes_requested", "contract.changes_requested", { perm: "document.approve" });

export async function approveContract(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<ContractRow> {
  requirePermission(ctx, "document.approve");
  return db.transaction(async (tx) => {
    const c = await loadContract(tx, ctx, contractId, true);
    assertContractRole(ctx, c.contract_type, "approve"); // R1.2 fail-closed
    assertContractTransition(c.workflow_status, "approved");
    const v = await headVersion(tx, ctx, contractId);
    if (!v.canonical_hash) throw Errors.conflict("Contract has not been generated yet");
    // record an APPROVAL bound to the current fingerprint + canonical hash (append-only)
    await tx.query(
      `insert into pierre_rt_contract_approvals (id, company_id, contract_id, contract_version_id, document_version_id, approver_user_id, decision, template_fingerprint, content_hash, correlation_id)
       values ($1,$2,$3,$4,$5,$6,'approved',$7,$8,$9)`,
      [newUuid(), ctx.company_id, contractId, v.id, v.document_version_id, ctx.user_id, v.template_fingerprint, v.canonical_hash, ctx.correlation_id ?? null]);
    await tx.query(`update pierre_rt_employee_contract_versions set approved_fingerprint=$3, approved_at=now() where company_id=$1 and id=$2`, [ctx.company_id, v.id, v.template_fingerprint]);
    const { rows } = await tx.query<ContractRow>(`update pierre_rt_employee_contracts set workflow_status='approved', approved_by=$3, approved_at=now() where company_id=$1 and id=$2 returning *`, [ctx.company_id, contractId, ctx.user_id]);
    await emitContractEvent(tx, ctx, "contract.approved", { contract_id: contractId, version_id: v.id, status_before: c.workflow_status, status_after: "approved", fingerprint: v.template_fingerprint });
    return rows[0];
  });
}

export async function finalizeContract(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<ContractRow> {
  requirePermission(ctx, "document.approve");
  const pre = await loadContract(db, ctx, contractId);
  const v0 = await headVersion(db, ctx, contractId);
  const policy = getContractPolicy(pre.contract_type);
  const { readiness } = await resolveReadiness(db, ctx, pre, v0, policy, "finalize", "pdf", {});
  if (!readiness.ready) {
    await emitContractEvent(db, ctx, "contract.generation_blocked", { contract_id: contractId, version_id: v0.id, status_after: pre.workflow_status, reason: readiness.blockers.join(",") });
    if (readiness.blockers.includes("template_fingerprint_drift") || readiness.blockers.includes("document_hash_drift")) {
      // invalidate the stale approval explicitly (audited) and refuse
      await db.transaction(async (tx) => {
        await emitContractEvent(tx, ctx, "contract.approval_invalidated", { contract_id: contractId, version_id: v0.id, status_after: pre.workflow_status, reason: "content_drift_since_approval" });
      });
    }
    throw Errors.conflict(`Contract not ready to finalize: ${readiness.blockers.join(", ")}`);
  }
  return db.transaction(async (tx) => {
    const c = await loadContract(tx, ctx, contractId, true);
    assertContractRole(ctx, c.contract_type, "approve"); // R1.2 fail-closed
    assertContractTransition(c.workflow_status, "final");
    const v = await headVersion(tx, ctx, contractId);
    if (!v.document_version_id) throw Errors.conflict("Contract has no generated document version");
    // R1.4 — the REAL document version must pass the governed document workflow (which runs
    // document policy + guard). The contract can only become final once the document is final.
    await driveDocumentVersionToFinal(tx, ctx, v.document_version_id);
    const dvStatus = (await tx.query<{ status: string }>(`select status from pierre_rt_document_versions where company_id=$1 and id=$2`, [ctx.company_id, v.document_version_id])).rows[0]?.status;
    if (dvStatus !== "final" && dvStatus !== "signed") throw Errors.conflict("Underlying document version is not finalized");
    await tx.query(`update pierre_rt_employee_contract_versions set workflow_status='final', status='final' where company_id=$1 and id=$2`, [ctx.company_id, v.id]);
    const { rows } = await tx.query<ContractRow>(`update pierre_rt_employee_contracts set workflow_status='final' where company_id=$1 and id=$2 returning *`, [ctx.company_id, contractId]);
    await emitContractEvent(tx, ctx, "contract.finalized", { contract_id: contractId, version_id: v.id, document_id: c.document_id, status_after: "final", fingerprint: v.template_fingerprint });
    return rows[0];
  });
}

/** R1.4 — drive a document version through the governed document workflow to `final`. */
async function driveDocumentVersionToFinal(tx: SqlExecutor, ctx: TenantContext, documentVersionId: string): Promise<void> {
  const cur = (await tx.query<{ status: string }>(`select status from pierre_rt_document_versions where company_id=$1 and id=$2`, [ctx.company_id, documentVersionId])).rows[0];
  if (!cur) throw Errors.notFound("Document version not found");
  if (cur.status === "final" || cur.status === "signed") return;
  if (cur.status === "draft") await submitDocForReview(tx, ctx, documentVersionId);
  await approveDocVersion(tx, ctx, documentVersionId);   // enforces document policy (assertDocumentTypePolicy approve)
  await finalizeDocVersion(tx, ctx, documentVersionId);  // requires 'approved' + a content hash / rendered artifact
}

export type SignatureRecipient = { role: string; email: string; name: string; signing_order: number; phone_number: string | null };
export type SignaturePreparation = { contract_id: string; signature_request_id: string; signature_level: string; idempotent: boolean; recipients: SignatureRecipient[] };

/** R1.5/R2.2 — resolve the REAL signers from real, tenant-scoped data (employee + company
 *  signatory). The phone is read from the tenant's own records (never invented, never another
 *  tenant's). Fail closed if any required email is absent. */
async function resolveSignatureRecipients(db: SqlExecutor, ctx: TenantContext, c: ContractRow): Promise<SignatureRecipient[]> {
  const emp = (await db.query<{ email: string | null; first_name: string | null; last_name: string | null; phone: string | null }>(`select email, first_name, last_name, phone from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, c.employee_id])).rows[0];
  if (!emp || !emp.email || !EMAIL_RE.test(emp.email)) throw Errors.validation("Employee signer has no valid email — cannot prepare signature");
  const co = (await db.query<{ signatory_email: string | null; signatory_name: string | null; signatory_phone: string | null; legal_name: string | null; name: string | null }>(`select signatory_email, signatory_name, signatory_phone, legal_name, name from pierre_rt_companies where id=$1`, [ctx.company_id])).rows[0];
  if (!co || !co.signatory_email || !EMAIL_RE.test(co.signatory_email)) throw Errors.validation("Employer signatory email is not configured — cannot prepare signature");
  return [
    { role: "employer", email: co.signatory_email, name: co.signatory_name ?? co.legal_name ?? co.name ?? "Employeur", signing_order: 1, phone_number: co.signatory_phone ?? null },
    { role: "employee", email: emp.email, name: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || "Salarié", signing_order: 2, phone_number: emp.phone ?? null },
  ];
}

export async function prepareContractSignature(db: SqlExecutor, ctx: TenantContext, contractId: string, opts: { idempotency_key?: string } = {}): Promise<SignaturePreparation> {
  requirePermission(ctx, "document.approve");
  const pre = await loadContract(db, ctx, contractId);
  const policy = validateContractType(pre.contract_type);
  const v0 = await headVersion(db, ctx, contractId);
  const idem = opts.idempotency_key ?? `contract-sig:${contractId}:${v0.id}`;

  return db.transaction(async (tx) => {
    const c = await loadContract(tx, ctx, contractId, true);
    const v = await headVersion(tx, ctx, contractId);
    // R1.6 — idempotency FIRST: an existing request for this key is returned as-is (no
    // re-transition, no duplicate recipients), regardless of the current workflow status.
    const existing = (await tx.query<{ id: string; approved_content_hash: string | null }>(`select id, approved_content_hash from pierre_rt_signature_requests where company_id=$1 and idempotency_key=$2`, [ctx.company_id, idem])).rows[0];
    if (existing) {
      if (v.canonical_hash && existing.approved_content_hash && existing.approved_content_hash !== v.canonical_hash) throw Errors.conflict("Idempotency key reused with different content");
      const recips = (await tx.query<{ role: string; email: string; name: string; signing_order: number; phone_number: string | null }>(`select role, email, name, signing_order, phone_number from pierre_rt_signature_recipients where company_id=$1 and signature_request_id=$2 order by signing_order`, [ctx.company_id, existing.id])).rows;
      return { contract_id: contractId, signature_request_id: existing.id, signature_level: policy.signature_level, idempotent: true, recipients: recips };
    }

    // not idempotent → must be genuinely ready, and the REAL document version must be final.
    const { readiness } = await resolveReadiness(tx, ctx, c, v, policy, "prepare_signature", "pdf", {});
    if (!readiness.signature_ready || !readiness.ready) throw Errors.conflict(`Contract not ready for signature: ${readiness.blockers.join(", ")}`);
    if (!c.document_id || !v.document_version_id) throw Errors.conflict("Contract has no finalized document version");
    const dvStatus = (await tx.query<{ status: string }>(`select status from pierre_rt_document_versions where company_id=$1 and id=$2`, [ctx.company_id, v.document_version_id])).rows[0]?.status;
    if (dvStatus !== "final" && dvStatus !== "signed") throw Errors.conflict("Underlying document version is not finalized");
    assertContractTransition(c.workflow_status, "ready_for_signature");

    const recipients = await resolveSignatureRecipients(tx, ctx, c); // R1.5 fail-closed
    const reqId = newUuid();
    // R3.1 — the request signature level is the CANONICAL provider level for the policy. NO
    // downgrade: `advanced` → AES, `qualified` → QES. The adaptation layer never weakens the
    // policy. (`none` is not used by any contract policy; defensively map to acknowledgement.)
    const dbLevel = providerLevelForPolicy(policy.signature_level) ?? "acknowledgement";
    await tx.query(
      `insert into pierre_rt_signature_requests (id, company_id, document_id, document_version_id, provider, signature_level, status, approval_status, approved_content_hash, idempotency_key, created_by)
       values ($1,$2,$3,$4,'local_sandbox',$5,'ready','approved',$6,$7,$8)`,
      [reqId, ctx.company_id, c.document_id, v.document_version_id, dbLevel, v.canonical_hash, idem, ctx.user_id]);
    for (const r of recipients) {
      await tx.query(`insert into pierre_rt_signature_recipients (id, company_id, signature_request_id, name, email, role, signing_order, phone_number, status) values ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
        [newUuid(), ctx.company_id, reqId, r.name, r.email, r.role, r.signing_order, r.phone_number]);
    }
    await tx.query(`update pierre_rt_employee_contracts set workflow_status='ready_for_signature' where company_id=$1 and id=$2`, [ctx.company_id, contractId]);
    await tx.query(`update pierre_rt_employee_contract_versions set signature_status='ready' where company_id=$1 and id=$2`, [ctx.company_id, v.id]);
    await emitContractEvent(tx, ctx, "contract.signature_prepared", { contract_id: contractId, version_id: v.id, document_id: c.document_id, status_after: "ready_for_signature", fingerprint: v.template_fingerprint });
    return { contract_id: contractId, signature_request_id: reqId, signature_level: policy.signature_level, idempotent: false, recipients };
  });
}

// ── Amendments ─────────────────────────────────────────────────────────────────────
// R1.14 — the ONLY structured effects an amendment may carry into activation. Anything outside
// this allowlist (free clauses, narrative text) is NEVER interpreted or applied.
export const AMENDMENT_EFFECT_ALLOWLIST = ["employment.role_title", "employment.weekly_hours", "employment.salary", "employment.site_id", "employment.effective_from", "employment.effective_to"] as const;
export function pickAllowedAmendmentEffects(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of AMENDMENT_EFFECT_ALLOWLIST) {
    const v = (raw as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") out[k] = String(v).trim();
  }
  return out;
}

export async function createContractAmendment(
  db: SqlExecutor, ctx: TenantContext, parentContractId: string,
  input: { reason: string; effective_from: string; effective_to?: string | null; idempotency_key?: string; effects?: Record<string, string | null> },
): Promise<ContractRow> {
  requirePermission(ctx, "document.write");
  const parent = await loadContract(db, ctx, parentContractId); // tenant-scoped: cross-tenant parent is invisible
  const policy = validateContractType(parent.contract_type);
  assertContractRole(ctx, parent.contract_type, "create"); // R1.2 fail-closed
  if (!input.reason?.trim()) throw Errors.validation("An amendment reason is required");
  if (!policy.amendment_allowed) throw Errors.conflict("This contract type does not allow amendments");
  if (parent.workflow_status === "signed" && !policy.amendment_allowed_after_signature) throw Errors.conflict("Amendment not allowed after signature for this type");
  if (parent.workflow_status === "cancelled") throw Errors.conflict("Cannot amend a cancelled contract");
  if (parent.parent_contract_id) throw Errors.conflict("Cannot amend an amendment (no amendment chains)");
  // R1.8 — the human reason and the technical idempotency key are stored SEPARATELY. The key
  // has a real tenant-scoped DB unique constraint (v15); the audit carries the HUMAN reason.
  const reason = input.reason.trim();
  const idem = (input.idempotency_key ?? `amendment:${parentContractId}:${input.effective_from}:${sha256(Buffer.from(reason))}`).slice(0, 200);
  const findExisting = async (q: SqlExecutor) => (await q.query<ContractRow>(`select * from pierre_rt_employee_contracts where company_id=$1 and parent_contract_id=$2 and amendment_idempotency_key=$3`, [ctx.company_id, parentContractId, idem])).rows[0];
  const pre = await findExisting(db);
  if (pre) return pre;
  try {
    return await db.transaction(async (tx) => {
      const id = newUuid();
      const effects = pickAllowedAmendmentEffects(input.effects); // allowlisted only — never free clauses
      const { rows } = await tx.query<ContractRow>(
        `insert into pierre_rt_employee_contracts (id, company_id, employee_id, contract_type, status, workflow_status, current_version, parent_contract_id, amendment_reason, amendment_idempotency_key, amendment_effects)
         values ($1,$2,$3,$4,'draft','draft',1,$5,$6,$7,$8) returning *`,
        [id, ctx.company_id, parent.employee_id, parent.contract_type, parentContractId, reason, idem, JSON.stringify(effects)]);
      await tx.query(
        `insert into pierre_rt_employee_contract_versions (id, company_id, contract_id, version, status, workflow_status, effective_from, effective_to) values ($1,$2,$3,1,'draft','draft',$4,$5)`,
        [newUuid(), ctx.company_id, id, input.effective_from, input.effective_to ?? null]);
      await emitContractEvent(tx, ctx, "contract.amendment_created", { contract_id: id, status_after: "draft", reason, correlation_id: ctx.correlation_id ?? null });
      return rows[0];
    });
  } catch (e) {
    // a concurrent same-key insert lost the race on the unique constraint → return the winner
    const after = await findExisting(db);
    if (after) return after;
    throw e;
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────────────
export async function getContract(db: SqlExecutor, ctx: TenantContext, id: string): Promise<{ contract: ContractRow; versions: ContractVersionRow[] }> {
  requirePermission(ctx, "document.read");
  const contract = await loadContract(db, ctx, id);
  const versions = (await db.query<ContractVersionRow>(`select * from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2 order by version asc`, [ctx.company_id, id])).rows;
  return { contract, versions };
}
export async function listContractHistory(db: SqlExecutor, ctx: TenantContext, id: string): Promise<Array<{ event: string; status_before: string | null; status_after: string | null; occurred_at: string }>> {
  requirePermission(ctx, "audit.read");
  await loadContract(db, ctx, id);
  return (await db.query(`select event, status_before, status_after, occurred_at from pierre_rt_contract_audit where company_id=$1 and contract_id=$2 order by occurred_at asc`, [ctx.company_id, id])).rows as never;
}
