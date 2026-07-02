// src/lib/pierre/v1/files.ts
// PHASE 8.3 — FileService. Secure upload → integrity → scan → quarantine/clean.
// A file is downloadable/usable ONLY when upload_status='clean' AND scan_status='clean'.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";
import { getFileStorageProvider, assertSafeObjectKey, type FileStorageProvider, type SignedUpload } from "./file-storage";
import { getFileScanProvider, type FileScanProvider } from "./file-scan";
import { detectMime, isWhitelisted, maxSizeBytesFor, safeFilename, screenContent, extensionForMime, isDangerousFilename } from "./file-mime";
import { sha256 } from "./renderers";

export type FileRow = {
  id: string; company_id: string; storage_provider: string; bucket: string; object_key: string;
  original_filename: string | null; safe_filename: string | null; extension: string | null;
  declared_mime_type: string | null; detected_mime_type: string | null; size_bytes: number;
  sha256: string | null; encryption_status: string; upload_status: string; scan_status: string;
  quarantine_reason: string | null; uploaded_by_user_id: string | null; created_at: string;
  uploaded_at: string | null; scanned_at: string | null; deleted_at: string | null; version: number;
  declared_sha256: string | null; declared_size_bytes: number | null; upload_token: string | null; upload_expires_at: string | null;
};

type Deps = { storage?: FileStorageProvider; scanner?: FileScanProvider };

async function audit(db: SqlExecutor, ctx: TenantContext, fileId: string, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  await db.query(`insert into pierre_rt_document_access_log (id, company_id, file_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, fileId, ctx.user_id, action, JSON.stringify(detail)]);
}

async function loadFile(db: SqlExecutor, ctx: TenantContext, id: string): Promise<FileRow> {
  const { rows } = await db.query<FileRow>(`select * from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, id]);
  if (rows.length === 0) throw Errors.notFound("File not found");
  return rows[0];
}

export async function createUploadIntent(
  db: SqlExecutor, ctx: TenantContext,
  input: { declared_mime_type: string; original_filename: string; document_id?: string | null; version_id?: string | null; declared_sha256?: string | null; declared_size_bytes?: number | null },
  deps: Deps = {},
): Promise<{ file_id: string; upload: { storage_provider: string; bucket: string; object_key: string; max_size_bytes: number } }> {
  requirePermission(ctx, "file.upload");
  if (!isWhitelisted(input.declared_mime_type)) throw Errors.validation(`MIME type not allowed: ${input.declared_mime_type}`);
  if (isDangerousFilename(input.original_filename)) throw Errors.validation("Filename is not allowed");
  const storage = deps.storage ?? getFileStorageProvider();
  const { safe } = safeFilename(input.original_filename);
  // §5 — the storage extension comes from the VALIDATED declared MIME, never the filename.
  const extension = extensionForMime(input.declared_mime_type);
  const intent = await storage.createUploadIntent({ companyId: ctx.company_id, documentId: input.document_id ?? null, versionId: input.version_id ?? null, extension, maxSizeBytes: maxSizeBytesFor(input.declared_mime_type) });
  assertSafeObjectKey(intent.object_key, ctx.company_id);
  const id = newUuid();
  await db.query(
    `insert into pierre_rt_files (id, company_id, storage_provider, bucket, object_key, original_filename, safe_filename, extension, declared_mime_type, declared_sha256, declared_size_bytes, encryption_status, upload_status, scan_status, uploaded_by_user_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'provider_managed','initialized','pending',$12)`,
    [id, ctx.company_id, intent.storage_provider, intent.bucket, intent.object_key, input.original_filename, safe, extension, input.declared_mime_type, input.declared_sha256 ?? null, input.declared_size_bytes ?? null, ctx.user_id]);
  await audit(db, ctx, id, "file_upload_intent", { object_key_scoped: true });
  return { file_id: id, upload: intent };
}

// ── PHASE 8.3-B2F §4 — Supabase signed-upload contract ───────────────────────────
// The server owns every authoritative field: file_id, object_key, bucket, tenant, uploader,
// expected MIME/size, a short expiry and a single-use nonce. The client receives only a
// time-bounded signed PUT URL bound to ONE object key — it can never choose the bucket, the
// tenant, the object key, the status, or pass off an unscanned file as an artifact.
export type SignedUploadIntent = { file_id: string; object_key: string; signed_upload: SignedUpload; expires_at: string; upload_token: string };

const UPLOAD_INTENT_MAX_TTL = 900;

export async function createSignedUploadIntent(
  db: SqlExecutor, ctx: TenantContext,
  input: { declared_mime_type: string; original_filename: string; document_id?: string | null; version_id?: string | null; declared_sha256?: string | null; declared_size_bytes?: number | null },
  deps: Deps = {},
): Promise<SignedUploadIntent> {
  requirePermission(ctx, "file.upload");
  if (!isWhitelisted(input.declared_mime_type)) throw Errors.validation(`MIME type not allowed: ${input.declared_mime_type}`);
  if (isDangerousFilename(input.original_filename)) throw Errors.validation("Filename is not allowed");
  const storage = deps.storage ?? getFileStorageProvider();
  const { safe } = safeFilename(input.original_filename);
  const extension = extensionForMime(input.declared_mime_type);
  const maxSize = maxSizeBytesFor(input.declared_mime_type);
  // Server-generated object key (PII-free, tenant-scoped). The client never supplies it.
  const intent = await storage.createUploadIntent({ companyId: ctx.company_id, documentId: input.document_id ?? null, versionId: input.version_id ?? null, extension, maxSizeBytes: maxSize });
  assertSafeObjectKey(intent.object_key, ctx.company_id);
  const ttl = Math.min(Number(process.env.FILE_UPLOAD_INTENT_TTL_SECONDS ?? "300"), UPLOAD_INTENT_MAX_TTL);
  const signed = await storage.issueSignedUpload(intent.object_key, { expirySeconds: ttl, maxSizeBytes: maxSize, contentType: input.declared_mime_type });
  const token = newUuid();
  const id = newUuid();
  await db.query(
    `insert into pierre_rt_files (id, company_id, storage_provider, bucket, object_key, original_filename, safe_filename, extension, declared_mime_type, declared_sha256, declared_size_bytes, encryption_status, upload_status, scan_status, upload_token, upload_expires_at, uploaded_by_user_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'provider_managed','initialized','pending',$12,$13,$14)`,
    [id, ctx.company_id, intent.storage_provider, intent.bucket, intent.object_key, input.original_filename, safe, extension, input.declared_mime_type, input.declared_sha256 ?? null, input.declared_size_bytes ?? null, token, signed.expires_at, ctx.user_id]);
  await audit(db, ctx, id, "file_signed_upload_intent", { object_key_scoped: true, ttl_seconds: ttl });
  return { file_id: id, object_key: intent.object_key, signed_upload: signed, expires_at: signed.expires_at, upload_token: token };
}

/**
 * Finalize a signed upload. The client has PUT the bytes to storage via the signed URL; the
 * server now verifies the intent (nonce, expiry, single-use), confirms the object is really
 * present, RE-READS it from storage and runs the full integrity + screen + scan pipeline.
 * A file becomes usable ONLY when upload_status=clean AND scan_status=clean. The object key,
 * tenant and uploader are taken from the server-side intent — never from the caller.
 */
export async function finalizeSignedUpload(db: SqlExecutor, ctx: TenantContext, fileId: string, input: { upload_token: string }, deps: Deps = {}): Promise<FileRow> {
  requirePermission(ctx, "file.upload");
  const file = await loadFile(db, ctx, fileId); // tenant-scoped: a foreign tenant cannot even see it
  if (file.upload_status === "clean") return file; // idempotent success
  if (file.upload_status !== "initialized") throw Errors.conflict(`File is ${file.upload_status}`);
  // single-use nonce: a missing/forged token is refused
  if (!file.upload_token || !input.upload_token || file.upload_token !== input.upload_token) throw Errors.forbidden("Invalid or missing upload token");
  // uploader binding: only the intent's creator may finalize it
  if (file.uploaded_by_user_id && ctx.user_id && file.uploaded_by_user_id !== ctx.user_id) throw Errors.forbidden("Upload intent belongs to another user");
  if (file.upload_expires_at && Date.parse(file.upload_expires_at) < Date.now()) { await reject(db, ctx, fileId, "intent_expired"); throw Errors.validation("Upload intent has expired"); }

  const storage = deps.storage ?? getFileStorageProvider();
  const scanner = deps.scanner ?? getFileScanProvider();
  await db.query(`update pierre_rt_files set upload_status='verifying' where company_id=$1 and id=$2`, [ctx.company_id, fileId]);

  const head = await storage.headObject(file.object_key);
  if (!head.exists) { await reject(db, ctx, fileId, "object_missing"); throw Errors.validation("Uploaded object is not present in storage"); }
  const stored = await storage.downloadBytes(file.object_key);
  const actualSha = sha256(stored);
  const actualSize = stored.length;

  const verdict = await screenAndScan(stored, file.declared_mime_type, scanner);
  if (verdict.isClean) {
    // §2 — expected (declared by the client at intent time) vs actual (the real stored bytes).
    const expectedSha = file.declared_sha256 ?? actualSha;
    const expectedSize = file.declared_size_bytes ?? actualSize;
    // Number() coercion: declared_size_bytes is a BIGINT column → node-postgres returns it as a STRING, so a
    // naive `actualSize === expectedSize` (number === string) is always false against real Postgres (PGlite
    // returns a number, which is why this only surfaced live). Compare numeric values.
    const integrityOk = actualSha === expectedSha && Number(actualSize) === Number(expectedSize);
    await db.query(`insert into pierre_rt_file_integrity_checks (id, company_id, file_id, expected_sha256, actual_sha256, size_bytes, ok) values ($1,$2,$3,$4,$5,$6,$7)`,
      [newUuid(), ctx.company_id, fileId, expectedSha, actualSha, actualSize, integrityOk]);
    if (!integrityOk) {
      await db.query(`update pierre_rt_files set upload_status='rejected', scan_status='failed', quarantine_reason='integrity_mismatch', detected_mime_type=null, size_bytes=$3, sha256=$4, upload_token=null, upload_expires_at=null, uploaded_at=now() where company_id=$1 and id=$2`,
        [ctx.company_id, fileId, actualSize, actualSha]);
      await audit(db, ctx, fileId, "file_rejected", { reason: "integrity_mismatch", via: "signed_upload" });
      throw Errors.validation("Upload integrity check failed (size/hash mismatch)");
    }
  }
  await db.query(`insert into pierre_rt_file_scan_results (id, company_id, file_id, scanner, scan_status, signature, detail) values ($1,$2,$3,$4,$5,$6,$7)`,
    [newUuid(), ctx.company_id, fileId, verdict.scan.scanner, verdict.scan.scan_status, verdict.scan.signature ?? null, JSON.stringify(verdict.scan.detail)]);
  const { rows } = await db.query<FileRow>(
    `update pierre_rt_files set upload_status=$3, scan_status=$4, quarantine_reason=$5, detected_mime_type=$6, size_bytes=$7, sha256=$8, upload_token=null, upload_expires_at=null, uploaded_at=now(), scanned_at=now(), version=version+1
       where company_id=$1 and id=$2 returning *`,
    [ctx.company_id, fileId, verdict.isClean ? "clean" : "quarantined", verdict.scanStatus, verdict.reason, verdict.detectedMime, actualSize, actualSha]);
  await audit(db, ctx, fileId, verdict.isClean ? "file_clean" : "file_quarantined", { scan_status: verdict.scanStatus, reason: verdict.reason, via: "signed_upload" });
  return rows[0];
}

/** §2 — store bytes, RE-READ from storage, verify size+hash (expected vs actual, separate),
 *  detect MIME, screen, scan → clean or quarantine. Never records one value as both. */
export async function finalizeUpload(db: SqlExecutor, ctx: TenantContext, fileId: string, bytes: Buffer, deps: Deps = {}): Promise<FileRow> {
  requirePermission(ctx, "file.upload");
  const file = await loadFile(db, ctx, fileId);
  if (file.upload_status === "clean") return file; // idempotent retry
  if (!["initialized", "uploading", "uploaded", "verifying", "quarantined", "rejected"].includes(file.upload_status)) throw Errors.conflict(`File is ${file.upload_status}`);
  const storage = deps.storage ?? getFileStorageProvider();
  const scanner = deps.scanner ?? getFileScanProvider();

  await db.query(`update pierre_rt_files set upload_status='uploading' where company_id=$1 and id=$2`, [ctx.company_id, fileId]);
  await storage.upload(file.object_key, bytes);

  const head = await storage.finalizeUpload(file.object_key);
  if (!head.exists) { await reject(db, ctx, fileId, "upload_incomplete"); throw Errors.validation("Upload not present in storage"); }

  // Screen + scan the RECEIVED bytes first (never trust, then re-read). Malicious/
  // mismatched files are quarantined here without a re-read.
  const verdict = await screenAndScan(bytes, file.declared_mime_type, scanner);
  let actualSha = sha256(bytes);
  let actualSize = bytes.length;

  // §2 — for files that pass screening, verify storage fidelity by RE-READING the bytes
  // from the provider and comparing EXPECTED vs a freshly computed ACTUAL (distinct
  // sources, recorded separately). Tamper/truncation/wrong-bytes ⇒ rejected.
  if (verdict.isClean) {
    const expectedSha = file.declared_sha256 ?? sha256(bytes);
    const expectedSize = file.declared_size_bytes ?? bytes.length;
    const stored = await storage.downloadBytes(file.object_key);
    actualSha = sha256(stored);
    actualSize = stored.length;
    // Number() coercion: declared_size_bytes (BIGINT) is returned as a STRING by node-postgres against real
    // Postgres, so a bare number===string comparison always fails live (PGlite returns a number). Compare numerically.
    const integrityOk = actualSha === expectedSha && Number(actualSize) === Number(expectedSize);
    await db.query(`insert into pierre_rt_file_integrity_checks (id, company_id, file_id, expected_sha256, actual_sha256, size_bytes, ok) values ($1,$2,$3,$4,$5,$6,$7)`,
      [newUuid(), ctx.company_id, fileId, expectedSha, actualSha, actualSize, integrityOk]);
    if (!integrityOk) {
      await db.query(`update pierre_rt_files set upload_status='rejected', scan_status='failed', quarantine_reason='integrity_mismatch', detected_mime_type=null, size_bytes=$3, sha256=$4, uploaded_at=now() where company_id=$1 and id=$2`,
        [ctx.company_id, fileId, actualSize, actualSha]);
      await audit(db, ctx, fileId, "file_rejected", { reason: "integrity_mismatch" });
      throw Errors.validation("Upload integrity check failed (size/hash mismatch)");
    }
  }

  await db.query(`insert into pierre_rt_file_scan_results (id, company_id, file_id, scanner, scan_status, signature, detail) values ($1,$2,$3,$4,$5,$6,$7)`,
    [newUuid(), ctx.company_id, fileId, verdict.scan.scanner, verdict.scan.scan_status, verdict.scan.signature ?? null, JSON.stringify(verdict.scan.detail)]);
  const { rows } = await db.query<FileRow>(
    `update pierre_rt_files set upload_status=$3, scan_status=$4, quarantine_reason=$5, detected_mime_type=$6, size_bytes=$7, sha256=$8, uploaded_at=now(), scanned_at=now(), version=version+1
       where company_id=$1 and id=$2 returning *`,
    [ctx.company_id, fileId, verdict.isClean ? "clean" : "quarantined", verdict.scanStatus, verdict.reason, verdict.detectedMime, actualSize, actualSha]);
  await audit(db, ctx, fileId, verdict.isClean ? "file_clean" : "file_quarantined", { scan_status: verdict.scanStatus, reason: verdict.reason });
  return rows[0];
}

/** All screening layers + scanner over the REAL stored bytes. fail-closed. */
async function screenAndScan(stored: Buffer, declaredMime: string | null, scanner: FileScanProvider): Promise<{ isClean: boolean; reason: string | null; scanStatus: string; detectedMime: string; scan: import("./file-scan").ScanResult }> {
  const size = stored.length;
  const detected = detectMime(stored);
  const limit = maxSizeBytesFor(declaredMime ?? detected.mime ?? "application/octet-stream");
  let reason: string | null = null;
  if (size > limit) reason = "oversize";
  else if (declaredMime && detected.mime !== "application/octet-stream" && declaredMime !== detected.mime) reason = "mime_mismatch";
  else if (!isWhitelisted(detected.mime)) reason = "type_not_allowed";
  else { const screen = screenContent(stored, detected); if (!screen.ok) reason = screen.reason ?? "screen_failed"; }
  const scan = await scanner.scan(stored, { declaredMime, sizeBytes: size });
  const scanClean = scan.scan_status === "clean";
  const isClean = !reason && scanClean;
  const scanStatus = isClean ? "clean" : (scanClean ? "suspicious" : scan.scan_status);
  if (!isClean && !reason) reason = scan.signature ?? scan.scan_status;
  return { isClean, reason, scanStatus, detectedMime: detected.mime, scan };
}

async function reject(db: SqlExecutor, ctx: TenantContext, fileId: string, reason: string): Promise<void> {
  await db.query(`update pierre_rt_files set upload_status='rejected', quarantine_reason=$3 where company_id=$1 and id=$2`, [ctx.company_id, fileId, reason]);
}

export async function getFile(db: SqlExecutor, ctx: TenantContext, id: string): Promise<FileRow> {
  requirePermission(ctx, "file.read");
  return loadFile(db, ctx, id);
}

function assertUsable(file: FileRow): void {
  if (file.upload_status !== "clean" || file.scan_status !== "clean") throw Errors.forbidden(`File not available (status ${file.upload_status}/${file.scan_status})`);
  if (file.deleted_at) throw Errors.notFound("File deleted");
}

export async function downloadFile(db: SqlExecutor, ctx: TenantContext, id: string, deps: Deps = {}): Promise<{ bytes: Buffer; file: FileRow }> {
  requirePermission(ctx, "file.read");
  const file = await loadFile(db, ctx, id);
  assertUsable(file);
  const storage = deps.storage ?? getFileStorageProvider();
  const bytes = await storage.downloadBytes(file.object_key);
  await audit(db, ctx, id, "file_download", {});
  return { bytes, file };
}

export async function createSignedDownloadUrl(db: SqlExecutor, ctx: TenantContext, id: string, deps: Deps = {}): Promise<{ url: string; expires_at: string }> {
  requirePermission(ctx, "file.read");
  const file = await loadFile(db, ctx, id);
  assertUsable(file);
  const storage = deps.storage ?? getFileStorageProvider();
  const expiry = Number(process.env.FILE_SIGNED_URL_TTL_SECONDS ?? "120");
  const out = await storage.createSignedDownloadUrl(file.object_key, Math.min(expiry, 300));
  await audit(db, ctx, id, "file_signed_url", { expires_at: out.expires_at });
  return out;
}

/** §3 — fail-closed rescan: replays presence + size + hash + MIME + declared/detected +
 *  double-extension + screening + scanner. Promotes to clean ONLY if every layer is clean. */
export async function rescanFile(db: SqlExecutor, ctx: TenantContext, id: string, deps: Deps = {}): Promise<FileRow> {
  requirePermission(ctx, "file.quarantine.manage");
  const file = await loadFile(db, ctx, id);
  if (file.deleted_at) throw Errors.notFound("File deleted");
  const storage = deps.storage ?? getFileStorageProvider();
  const scanner = deps.scanner ?? getFileScanProvider();
  if (!(await storage.objectExists(file.object_key))) { await reject(db, ctx, id, "object_missing"); throw Errors.validation("Object missing in storage"); }
  const bytes = await storage.downloadBytes(file.object_key);

  // Integrity vs the recorded hash.
  let reason: string | null = null;
  if (file.sha256 && sha256(bytes) !== file.sha256) reason = "integrity_mismatch";
  if (!reason && isDangerousFilename(file.original_filename ?? "")) reason = "dangerous_filename";
  const verdict = await screenAndScan(bytes, file.declared_mime_type, scanner);
  await db.query(`insert into pierre_rt_file_scan_results (id, company_id, file_id, scanner, scan_status, signature, detail) values ($1,$2,$3,$4,$5,$6,$7)`,
    [newUuid(), ctx.company_id, id, verdict.scan.scanner, verdict.scan.scan_status, verdict.scan.signature ?? null, JSON.stringify(verdict.scan.detail)]);
  const finalReason = reason ?? verdict.reason;
  const clean = !finalReason && verdict.isClean;
  const { rows } = await db.query<FileRow>(
    `update pierre_rt_files set scan_status=$3, upload_status=$4, quarantine_reason=$5, detected_mime_type=$6, scanned_at=now() where company_id=$1 and id=$2 returning *`,
    [ctx.company_id, id, clean ? "clean" : (finalReason && reason ? "rejected" : verdict.scanStatus), clean ? "clean" : "quarantined", finalReason, verdict.detectedMime]);
  await audit(db, ctx, id, "file_rescan", { scan_status: verdict.scanStatus, reason: finalReason, promoted: clean });
  return rows[0];
}

/**
 * §9 — clean-file attachment gate. A file may be associated with a document/version
 * ONLY if it is the same tenant, clean, scanned clean, not deleted, has a hash, and a
 * compatible MIME (when a target type is given). Throws otherwise.
 */
export async function assertFileAttachable(db: SqlExecutor, ctx: TenantContext, fileId: string, opts: { allowedMime?: string[] } = {}): Promise<FileRow> {
  const { rows } = await db.query<FileRow>(`select * from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, fileId]);
  if (rows.length === 0) throw Errors.validation("File not found in this tenant"); // cross-tenant ⇒ invisible ⇒ rejected
  const f = rows[0];
  if (f.deleted_at) throw Errors.conflict("File is deleted");
  if (f.upload_status !== "clean" || f.scan_status !== "clean") throw Errors.conflict(`File is not clean (${f.upload_status}/${f.scan_status})`);
  if (!f.sha256) throw Errors.conflict("File has no integrity hash");
  if (opts.allowedMime && opts.allowedMime.length > 0 && f.detected_mime_type && !opts.allowedMime.includes(f.detected_mime_type)) throw Errors.validation(`File type ${f.detected_mime_type} not compatible`);
  return f;
}

export async function verifyFileIntegrity(db: SqlExecutor, ctx: TenantContext, id: string, deps: Deps = {}): Promise<{ ok: boolean; expected: string | null; actual: string }> {
  requirePermission(ctx, "file.read");
  const file = await loadFile(db, ctx, id);
  const storage = deps.storage ?? getFileStorageProvider();
  const bytes = await storage.downloadBytes(file.object_key);
  const actual = sha256(bytes);
  const ok = file.sha256 === actual;
  await db.query(`insert into pierre_rt_file_integrity_checks (id, company_id, file_id, expected_sha256, actual_sha256, size_bytes, ok) values ($1,$2,$3,$4,$5,$6,$7)`,
    [newUuid(), ctx.company_id, id, file.sha256, actual, bytes.length, ok]);
  return { ok, expected: file.sha256, actual };
}

export async function deleteFile(db: SqlExecutor, ctx: TenantContext, id: string, deps: Deps = {}): Promise<void> {
  requirePermission(ctx, "file.delete");
  const file = await loadFile(db, ctx, id);
  // A file referenced by a signed/final document version cannot be deleted here.
  const ref = await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_document_versions v
       where v.company_id=$1 and (v.rendered_pdf_file_id=$2 or v.rendered_docx_file_id=$2 or v.source_file_id=$2)
         and v.status in ('final','signed')`, [ctx.company_id, id]);
  if (ref.rows[0].n > 0) throw Errors.conflict("File is part of a finalized/signed version and cannot be deleted");
  // Legal hold on a linked document blocks deletion.
  const held = await db.query<{ n: number }>(
    `select count(*)::int n from pierre_rt_document_versions v join pierre_rt_documents d on d.id=v.document_id
       where v.company_id=$1 and (v.rendered_pdf_file_id=$2 or v.rendered_docx_file_id=$2 or v.source_file_id=$2) and d.legal_hold=true`, [ctx.company_id, id]);
  if (held.rows[0].n > 0) throw Errors.conflict("Linked document is under legal hold");
  const storage = deps.storage ?? getFileStorageProvider();
  await storage.deleteObject(file.object_key);
  await db.query(`update pierre_rt_files set upload_status='deleted', deleted_at=now() where company_id=$1 and id=$2`, [ctx.company_id, id]);
  await audit(db, ctx, id, "file_deleted", {});
}
