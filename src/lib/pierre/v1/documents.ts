// src/lib/pierre/v1/documents.ts
// PHASE 8.3 — DocumentService + DocumentVersionService + access/retention.
// A finalized version is immutable; a signed version is permanently immutable;
// any change creates a NEW version; approval is invalidated when a new version is
// created. Sensitive downloads require the sensitive permission and are audited.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission, hasPermission, canAccessSite } from "./rbac";
import { downloadFile, assertFileAttachable, type FileRow } from "./files";
import { getFileStorageProvider } from "./file-storage";
import { sha256 } from "./renderers";
import { emitDocumentEvent } from "./document-outbox";
import { normalizeSearch } from "./employee-search";
import { validateDocumentType, canRoleUseDocumentType } from "./document-types";
import { assertDocumentTypePolicy } from "./document-policy";
import { enforceDocumentGuard } from "./document-guard";

export type DocumentRow = {
  id: string; company_id: string; document_type: string; title: string; description: string | null;
  sensitivity: string; status: string; employee_id: string | null; site_id: string | null;
  contract_id: string | null; mission_id: string | null; task_id: string | null; owner_membership_id: string | null;
  current_version: number; retention_policy_key: string | null; retention_until: string | null; legal_hold: boolean;
  created_by: string | null; approved_by: string | null; approved_at: string | null; archived_at: string | null;
  deleted_at: string | null; created_at: string; updated_at: string; version: number;
};
export type DocumentVersionRow = {
  id: string; company_id: string; document_id: string; version_number: number;
  source_file_id: string | null; rendered_pdf_file_id: string | null; rendered_docx_file_id: string | null;
  content_hash: string | null; template_version_id: string | null; generation_context_hash: string | null;
  status: string; change_summary: string | null; created_by: string | null; reviewed_by: string | null; approved_by: string | null;
  created_at: string; finalized_at: string | null; signed_at: string | null; superseded_at: string | null;
};

const IMMUTABLE = new Set(["final", "signed"]);

async function audit(db: SqlExecutor, ctx: TenantContext, documentId: string | null, action: string, detail: Record<string, unknown> = {}, versionId?: string | null): Promise<void> {
  await db.query(`insert into pierre_rt_document_access_log (id, company_id, document_id, version_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6,$7)`,
    [newUuid(), ctx.company_id, documentId, versionId ?? null, ctx.user_id, action, JSON.stringify(detail)]);
}

async function loadDocument(db: SqlExecutor, ctx: TenantContext, id: string): Promise<DocumentRow> {
  const { rows } = await db.query<DocumentRow>(`select * from pierre_rt_documents where company_id=$1 and id=$2`, [ctx.company_id, id]);
  if (rows.length === 0 || rows[0].deleted_at) throw Errors.notFound("Document not found");
  if (rows[0].site_id && !canAccessSite(ctx, rows[0].site_id)) throw Errors.forbidden("Document out of site scope");
  return rows[0];
}

function requireDocRead(ctx: TenantContext, doc: DocumentRow): void {
  requirePermission(ctx, "document.read");
  if (doc.sensitivity !== "normal") requirePermission(ctx, "document.sensitive.read");
}

export async function createDocument(
  db: SqlExecutor, ctx: TenantContext,
  input: { document_type: string; title: string; description?: string; sensitivity?: string; employee_id?: string | null; site_id?: string | null; contract_id?: string | null; mission_id?: string | null; task_id?: string | null; links?: Array<{ link_type: string; target_id: string }> },
): Promise<DocumentRow> {
  requirePermission(ctx, "document.write");
  if (!input.title?.trim()) throw Errors.validation("title is required");
  // §6 — non-bypassable document-type registry: unknown types refused; role gated.
  let typePolicy;
  try { typePolicy = validateDocumentType(input.document_type); }
  catch { throw Errors.validation(`Unknown document type: ${input.document_type}`); }
  if (ctx.role_keys && ctx.role_keys.length > 0 && !canRoleUseDocumentType(ctx.role_keys, input.document_type)) {
    throw Errors.forbidden(`Role not permitted to create ${input.document_type}`);
  }
  const sensitivity = input.sensitivity ?? typePolicy.default_sensitivity;
  if (sensitivity !== "normal") requirePermission(ctx, "document.sensitive.write");
  // §14 — consolidated document-type policy enforcement (role + permission + sensitivity).
  assertDocumentTypePolicy({ action: "create", document_type: input.document_type, role_keys: ctx.role_keys ?? [], permissions: ctx.permissions, sensitivity: sensitivity === "normal" ? "normal" : "high" });
  if (input.site_id && !canAccessSite(ctx, input.site_id)) throw Errors.forbidden("Site out of scope");
  const id = newUuid();
  const search = normalizeSearch(`${input.title} ${input.document_type} ${input.description ?? ""}`);
  const { rows } = await db.query<DocumentRow>(
    `insert into pierre_rt_documents (id, company_id, document_type, title, description, sensitivity, status, employee_id, site_id, contract_id, mission_id, task_id, created_by, search_text)
     values ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11,$12,$13) returning *`,
    [id, ctx.company_id, input.document_type, input.title.trim(), input.description ?? null, sensitivity, input.employee_id ?? null, input.site_id ?? null, input.contract_id ?? null, input.mission_id ?? null, input.task_id ?? null, ctx.user_id, search]);
  for (const l of input.links ?? []) {
    await db.query(`insert into pierre_rt_document_links (id, company_id, document_id, link_type, target_id) values ($1,$2,$3,$4,$5) on conflict do nothing`, [newUuid(), ctx.company_id, id, l.link_type, l.target_id]);
  }
  if (input.employee_id) await db.query(`insert into pierre_rt_document_links (id, company_id, document_id, link_type, target_id) values ($1,$2,$3,'employee',$4) on conflict do nothing`, [newUuid(), ctx.company_id, id, input.employee_id]);
  await audit(db, ctx, id, "document_created", { document_type: input.document_type });
  return rows[0];
}

export async function createVersion(
  db: SqlExecutor, ctx: TenantContext, documentId: string,
  input: { source_file_id?: string | null; rendered_pdf_file_id?: string | null; rendered_docx_file_id?: string | null; content_hash?: string | null; template_version_id?: string | null; generation_context_hash?: string | null; change_summary?: string | null },
): Promise<DocumentVersionRow> {
  requirePermission(ctx, "document.write");
  const doc = await loadDocument(db, ctx, documentId);
  if (doc.status === "archived" || doc.deleted_at) throw Errors.conflict("Document is archived/deleted");
  // §14 — the document-type policy is enforced on every new version, not only at creation.
  assertDocumentTypePolicy({ action: "version", document_type: doc.document_type, role_keys: ctx.role_keys ?? [], permissions: ctx.permissions, sensitivity: doc.sensitivity === "normal" ? "normal" : "high" });
  // §9 — every attached file must pass the clean-file gate (same tenant, clean, hashed).
  for (const fid of [input.source_file_id, input.rendered_pdf_file_id, input.rendered_docx_file_id]) {
    if (fid) await assertFileAttachable(db, ctx, fid);
  }
  const next = doc.current_version + 1;
  // Supersede the previous head version (signed versions remain immutable but flagged superseded).
  if (doc.current_version > 0) {
    await db.query(`update pierre_rt_document_versions set superseded_at=now(), status=case when status in ('final') then 'superseded' else status end where company_id=$1 and document_id=$2 and version_number=$3`,
      [ctx.company_id, documentId, doc.current_version]);
  }
  const id = newUuid();
  const { rows } = await db.query<DocumentVersionRow>(
    `insert into pierre_rt_document_versions (id, company_id, document_id, version_number, source_file_id, rendered_pdf_file_id, rendered_docx_file_id, content_hash, template_version_id, generation_context_hash, status, change_summary, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12) returning *`,
    [id, ctx.company_id, documentId, next, input.source_file_id ?? null, input.rendered_pdf_file_id ?? null, input.rendered_docx_file_id ?? null, input.content_hash ?? null, input.template_version_id ?? null, input.generation_context_hash ?? null, input.change_summary ?? null, ctx.user_id]);
  // New version invalidates any prior approval on the document.
  await db.query(`update pierre_rt_documents set current_version=$3, status='draft', approved_by=null, approved_at=null, updated_at=now(), version=version+1 where company_id=$1 and id=$2`, [ctx.company_id, documentId, next]);
  await audit(db, ctx, documentId, "version_created", { version: next }, id);
  return rows[0];
}

async function loadVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<DocumentVersionRow> {
  const { rows } = await db.query<DocumentVersionRow>(`select * from pierre_rt_document_versions where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  if (rows.length === 0) throw Errors.notFound("Version not found");
  return rows[0];
}
function assertMutable(v: DocumentVersionRow): void { if (IMMUTABLE.has(v.status)) throw Errors.conflict(`Version is ${v.status} and immutable`); }

export async function submitForReview(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<DocumentVersionRow> {
  requirePermission(ctx, "document.write");
  const v = await loadVersion(db, ctx, versionId); assertMutable(v);
  await db.query(`update pierre_rt_document_versions set status='under_review' where company_id=$1 and id=$2`, [ctx.company_id, versionId]);
  await db.query(`update pierre_rt_documents set status='under_review', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, v.document_id]);
  await audit(db, ctx, v.document_id, "submitted_for_review", {}, versionId);
  await emitDocumentEvent(db, ctx, "document.ready_for_review", v.document_id, { version_id: versionId });
  return { ...v, status: "under_review" };
}

export async function requestChanges(db: SqlExecutor, ctx: TenantContext, versionId: string, note?: string): Promise<DocumentVersionRow> {
  requirePermission(ctx, "document.approve");
  const v = await loadVersion(db, ctx, versionId); assertMutable(v);
  await db.query(`update pierre_rt_document_versions set status='changes_requested', reviewed_by=$3 where company_id=$1 and id=$2`, [ctx.company_id, versionId, ctx.user_id]);
  await db.query(`update pierre_rt_documents set status='changes_requested', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, v.document_id]);
  await audit(db, ctx, v.document_id, "changes_requested", { note: note ?? null }, versionId);
  return { ...v, status: "changes_requested" };
}

export async function approveVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<DocumentVersionRow> {
  requirePermission(ctx, "document.approve");
  const v = await loadVersion(db, ctx, versionId); assertMutable(v);
  const docA = await loadDocument(db, ctx, v.document_id);
  assertDocumentTypePolicy({ action: "approve", document_type: docA.document_type, role_keys: ctx.role_keys ?? [], permissions: ctx.permissions, sensitivity: docA.sensitivity === "normal" ? "normal" : "high" });
  await db.query(`update pierre_rt_document_versions set status='approved', approved_by=$3 where company_id=$1 and id=$2`, [ctx.company_id, versionId, ctx.user_id]);
  await db.query(`update pierre_rt_documents set status='approved', approved_by=$3, approved_at=now(), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, v.document_id, ctx.user_id]);
  await audit(db, ctx, v.document_id, "version_approved", {}, versionId);
  await emitDocumentEvent(db, ctx, "document.approved", v.document_id, { version_id: versionId });
  return { ...v, status: "approved" };
}

/** Finalize → immutable. Requires approval + a content hash (the rendered artifact). */
export async function finalizeVersion(db: SqlExecutor, ctx: TenantContext, versionId: string): Promise<DocumentVersionRow> {
  requirePermission(ctx, "document.approve");
  const v = await loadVersion(db, ctx, versionId);
  if (v.status === "final" || v.status === "signed") return v;
  if (v.status !== "approved") throw Errors.conflict("Only an approved version can be finalized");
  const docF = await loadDocument(db, ctx, v.document_id);
  assertDocumentTypePolicy({ action: "finalize", document_type: docF.document_type, role_keys: ctx.role_keys ?? [], permissions: ctx.permissions, sensitivity: docF.sensitivity === "normal" ? "normal" : "high" });
  // P16D — RE-VÉRIFIER la propreté des artefacts AU MOMENT DE LA FINALISATION, pas seulement à
  // l'attachement. `assertFileAttachable` était appelé dans createVersion, mais `rescanFile()`
  // peut re-qualifier un fichier `clean` → `quarantined`/`infected` APRÈS coup (nouvelle base de
  // signatures). Sans ce contrôle, un artefact rétro-mis-en-quarantaine devenait `final` +
  // document `published` + événement `document.signature_ready` — « généré » valant « prêt à
  // signer » sur un fichier infecté. downloadDocument re-vérifiait déjà (cf. §15) ; la
  // finalisation, elle, ne le faisait pas. Une preuve de propreté PÉRIMÉE n'est pas une preuve.
  for (const fid of [v.rendered_pdf_file_id, v.rendered_docx_file_id, v.source_file_id]) {
    if (fid) await assertFileAttachable(db, ctx, fid);
  }
  if (!v.content_hash && !v.rendered_pdf_file_id) throw Errors.validation("A final version requires a content hash / rendered artifact");
  // If no explicit content hash, derive it from the rendered PDF file's sha256.
  let hash = v.content_hash;
  if (!hash && v.rendered_pdf_file_id) {
    const f = await db.query<{ sha256: string | null }>(`select sha256 from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, v.rendered_pdf_file_id]);
    hash = f.rows[0]?.sha256 ?? null;
  }
  if (!hash) throw Errors.validation("Could not determine content hash for the final version");
  await db.query(`update pierre_rt_document_versions set status='final', content_hash=$3, finalized_at=now() where company_id=$1 and id=$2`, [ctx.company_id, versionId, hash]);
  await db.query(`update pierre_rt_documents set status='published', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, v.document_id]);
  await audit(db, ctx, v.document_id, "version_finalized", { content_hash: hash }, versionId);
  await emitDocumentEvent(db, ctx, "document.signature_ready", v.document_id, { version_id: versionId });
  return { ...v, status: "final", content_hash: hash };
}

export async function archiveDocument(db: SqlExecutor, ctx: TenantContext, id: string): Promise<void> {
  requirePermission(ctx, "document.archive");
  const doc = await loadDocument(db, ctx, id);
  if (doc.legal_hold) throw Errors.conflict("Document under legal hold");
  await db.query(`update pierre_rt_documents set status='archived', archived_at=now(), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, id]);
  await audit(db, ctx, id, "document_archived", {});
}
export async function restoreDocument(db: SqlExecutor, ctx: TenantContext, id: string): Promise<void> {
  requirePermission(ctx, "document.archive");
  await loadDocument(db, ctx, id);
  await db.query(`update pierre_rt_documents set status='draft', archived_at=null, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, id]);
  await audit(db, ctx, id, "document_restored", {});
}
export async function softDeleteDocument(db: SqlExecutor, ctx: TenantContext, id: string): Promise<void> {
  requirePermission(ctx, "document.archive");
  const doc = await loadDocument(db, ctx, id);
  if (doc.legal_hold) throw Errors.conflict("Document under legal hold");
  if (doc.status === "signed") throw Errors.conflict("Signed documents can only be removed via a governed legal procedure");
  await db.query(`update pierre_rt_documents set deleted_at=now(), status='deleted', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, id]);
  await audit(db, ctx, id, "document_soft_deleted", {});
}

export async function getDocument(db: SqlExecutor, ctx: TenantContext, id: string): Promise<{ document: DocumentRow; versions: DocumentVersionRow[]; links: Array<{ link_type: string; target_id: string | null }> }> {
  const doc = await loadDocument(db, ctx, id);
  requireDocRead(ctx, doc);
  const versions = (await db.query<DocumentVersionRow>(`select * from pierre_rt_document_versions where company_id=$1 and document_id=$2 order by version_number asc`, [ctx.company_id, id])).rows;
  const links = (await db.query<{ link_type: string; target_id: string | null }>(`select link_type, target_id from pierre_rt_document_links where company_id=$1 and document_id=$2`, [ctx.company_id, id])).rows;
  return { document: doc, versions, links };
}

export async function listDocumentHistory(db: SqlExecutor, ctx: TenantContext, id: string): Promise<Array<{ action: string; actor_user_id: string | null; occurred_at: string; version_id: string | null }>> {
  const doc = await loadDocument(db, ctx, id); requireDocRead(ctx, doc);
  return (await db.query(`select action, actor_user_id, occurred_at, version_id from pierre_rt_document_access_log where company_id=$1 and document_id=$2 order by occurred_at desc limit 200`, [ctx.company_id, id])).rows as never;
}

export async function getDocumentAccessLog(db: SqlExecutor, ctx: TenantContext, id: string) {
  requirePermission(ctx, "audit.read");
  await loadDocument(db, ctx, id);
  return (await db.query(`select action, actor_user_id, occurred_at, file_id, version_id, detail from pierre_rt_document_access_log where company_id=$1 and document_id=$2 order by occurred_at desc limit 200`, [ctx.company_id, id])).rows;
}

/** Download the rendered artifact of a version. Sensitive → sensitive permission + audit. */
export async function downloadDocument(db: SqlExecutor, ctx: TenantContext, documentId: string, opts: { version_number?: number; format?: "pdf" | "docx" } = {}, deps: { storage?: import("./file-storage").FileStorageProvider } = {}): Promise<{ bytes: Buffer; file: FileRow }> {
  const doc = await loadDocument(db, ctx, documentId);
  requireDocRead(ctx, doc);
  const vn = opts.version_number ?? doc.current_version;
  const v = (await db.query<DocumentVersionRow>(`select * from pierre_rt_document_versions where company_id=$1 and document_id=$2 and version_number=$3`, [ctx.company_id, documentId, vn])).rows[0];
  if (!v) throw Errors.notFound("Version not found");
  const fileId = opts.format === "docx" ? v.rendered_docx_file_id : v.rendered_pdf_file_id;
  if (!fileId) throw Errors.notFound("No rendered artifact for this format/version");
  // §14 — document-type read policy (role + sensitivity).
  assertDocumentTypePolicy({ action: "download", document_type: doc.document_type, role_keys: ctx.role_keys ?? [], permissions: ctx.permissions, sensitivity: doc.sensitivity === "normal" ? "normal" : "high" });
  // §15 — enforce the documentary guard on the REAL file/scan state: a rendered artifact
  // that is no longer clean (e.g. retro-quarantined) is refused at download time.
  const fstat = (await db.query<{ upload_status: string; scan_status: string }>(`select upload_status, scan_status from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, fileId])).rows[0];
  enforceDocumentGuard({
    action: "download", document_type: doc.document_type, sensitivity: doc.sensitivity === "normal" ? "normal" : "high",
    file_status: fstat?.upload_status, scan_status: fstat?.scan_status, permissions: ctx.permissions,
  });
  await audit(db, ctx, documentId, "document_download", { version: vn, format: opts.format ?? "pdf", sensitive: doc.sensitivity !== "normal" }, v.id);
  return downloadFile(db, ctx, fileId, deps);
}

export async function verifyDocumentIntegrity(db: SqlExecutor, ctx: TenantContext, documentId: string, versionNumber: number, deps: { storage?: import("./file-storage").FileStorageProvider } = {}): Promise<{ ok: boolean; content_hash: string | null; file_sha: string | null }> {
  const doc = await loadDocument(db, ctx, documentId); requireDocRead(ctx, doc);
  const v = (await db.query<DocumentVersionRow>(`select * from pierre_rt_document_versions where company_id=$1 and document_id=$2 and version_number=$3`, [ctx.company_id, documentId, versionNumber])).rows[0];
  if (!v) throw Errors.notFound("Version not found");
  if (!v.rendered_pdf_file_id) return { ok: !!v.content_hash, content_hash: v.content_hash, file_sha: null };
  // P16E §5 (F25) — this is a FILE-integrity check: do the bytes actually in storage still match
  // the hash recorded WHEN THE FILE WAS RENDERED (pierre_rt_files.sha256)? The previous code
  // compared the version's `content_hash` — which for a CONTRACT version is the CANONICAL model
  // hash, not the PDF bytes hash — against the PDF bytes, so it could NEVER return ok:true for a
  // contract-generated version (two different hashes). Compare the file's recorded sha256 to the
  // recomputed bytes sha256; `content_hash` is still returned for reference (approval binding).
  const f = (await db.query<{ object_key: string; sha256: string | null }>(`select object_key, sha256 from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, v.rendered_pdf_file_id])).rows[0];
  const storage = deps.storage ?? getFileStorageProvider();
  const actual = f ? sha256(await storage.downloadBytes(f.object_key)) : null;
  const ok = !!f?.sha256 && f.sha256 === actual;
  await audit(db, ctx, documentId, "integrity_verified", { ok }, v.id);
  return { ok, content_hash: v.content_hash, file_sha: actual };
}

export { hasPermission };
