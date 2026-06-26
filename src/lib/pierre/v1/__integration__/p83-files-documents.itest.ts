// src/lib/pierre/v1/__integration__/p83-files-documents.itest.ts
// PHASE 8.3 — files + documents spine, proven vs real Postgres (PGlite) + a real
// local filesystem storage provider. Covers §27.1 (files) + §27.2 (documents) +
// authorization. Storage is wiped after each test (cleanup proven).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { LocalFilesystemStorageProvider } from "../file-storage";
import { DeterministicTestScanProvider } from "../file-scan";
import { PdfRenderer } from "../renderers";
import * as Files from "../files";
import * as Docs from "../documents";

let h: Harness;
let storage: LocalFilesystemStorageProvider;
let owner: TenantContext;
const scanner = new DeterministicTestScanProvider();
const deps = () => ({ storage, scanner });

beforeEach(async () => {
  h = await createHarness();
  storage = new LocalFilesystemStorageProvider({ bucket: "pierre-test", baseDir: join(tmpdir(), `pierre-test-${newUuid()}`) });
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
});
afterEach(async () => { await storage.purgeAll(); await h.close(); });

const PDF = "application/pdf";
function cleanPdf(): Buffer { return PdfRenderer.render({ title: "Attestation", subtitle: "Acme", blocks: [{ lines: ["Ligne 1", "Ligne 2"] }] }).bytes; }
function fakePng(): Buffer { return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]); }
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

async function uploadClean(ctx = owner): Promise<Files.FileRow> {
  const { file_id } = await Files.createUploadIntent(h.db, ctx, { declared_mime_type: PDF, original_filename: "attestation.pdf" }, deps());
  return Files.finalizeUpload(h.db, ctx, file_id, cleanPdf(), deps());
}

// ── §27.1 Files ──────────────────────────────────────────────────────────────
describe("§27.1 files", () => {
  it("upload intent → tenant-safe, PII-free object key", async () => {
    const { upload } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "Hélène Émard CDI.pdf" }, deps());
    expect(upload.object_key.startsWith(`companies/${h.companyA}/`)).toBe(true);
    expect(upload.object_key).not.toMatch(/helene|emard|@|\s/i);
    expect(upload.object_key).toMatch(/\.pdf$/);
  });

  it("clean PDF → upload_status clean, scan clean, sha256 + detected mime set", async () => {
    const f = await uploadClean();
    expect(f.upload_status).toBe("clean");
    expect(f.scan_status).toBe("clean");
    expect(f.detected_mime_type).toBe(PDF);
    expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fake MIME (declared pdf, bytes png) → quarantined mime_mismatch", async () => {
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "x.pdf" }, deps());
    const f = await Files.finalizeUpload(h.db, owner, file_id, fakePng(), deps());
    expect(f.upload_status).toBe("quarantined");
    expect(f.quarantine_reason).toBe("mime_mismatch");
  });

  it("EICAR → infected + quarantined; not downloadable", async () => {
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "v.pdf" }, deps());
    const f = await Files.finalizeUpload(h.db, owner, file_id, Buffer.from(EICAR, "latin1"), deps());
    expect(f.upload_status).toBe("quarantined");
    expect(f.scan_status).toBe("infected");
    await expect(Files.downloadFile(h.db, owner, file_id, deps())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("oversize → quarantined", async () => {
    const prev = process.env.FILE_MAX_SIZE_MB; process.env.FILE_MAX_SIZE_MB = "0.0001"; // ~105 bytes (below any PDF)
    try {
      const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "big.pdf" }, deps());
      const f = await Files.finalizeUpload(h.db, owner, file_id, cleanPdf(), deps());
      expect(f.upload_status).toBe("quarantined");
      expect(f.quarantine_reason).toBe("oversize");
    } finally { if (prev === undefined) delete process.env.FILE_MAX_SIZE_MB; else process.env.FILE_MAX_SIZE_MB = prev; }
  });

  it("download before clean is refused; a clean file downloads with matching bytes", async () => {
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf" }, deps());
    await expect(Files.downloadFile(h.db, owner, file_id, deps())).rejects.toMatchObject({ code: "forbidden" }); // initialized
    await Files.finalizeUpload(h.db, owner, file_id, cleanPdf(), deps());
    const dl = await Files.downloadFile(h.db, owner, file_id, deps());
    expect(dl.bytes.equals(cleanPdf())).toBe(true);
  });

  it("cross-tenant file is invisible", async () => {
    const f = await uploadClean();
    const ctxB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    await expect(Files.getFile(h.db, ctxB, f.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("short-lived signed URL (not a public/permanent URL)", async () => {
    const f = await uploadClean();
    const out = await Files.createSignedDownloadUrl(h.db, owner, f.id, deps());
    expect(out.url).toContain("token=");
    expect(new Date(out.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(300_000 + 1000);
  });

  it("integrity check passes for an intact file", async () => {
    const f = await uploadClean();
    const r = await Files.verifyFileIntegrity(h.db, owner, f.id, deps());
    expect(r.ok).toBe(true);
    expect(r.actual).toBe(f.sha256);
  });
});

// ── §27.2 Documents ──────────────────────────────────────────────────────────
describe("§27.2 documents", () => {
  async function makeDocWithVersion() {
    const f = await uploadClean();
    const doc = await Docs.createDocument(h.db, owner, { document_type: "work_certificate", title: "Attestation de travail", employee_id: null });
    const v = await Docs.createVersion(h.db, owner, doc.id, { rendered_pdf_file_id: f.id });
    return { f, doc, v };
  }

  it("create → draft v0; version 1 then version 2 (prior superseded)", async () => {
    const { doc, v } = await makeDocWithVersion();
    expect(doc.status).toBe("draft");
    expect(v.version_number).toBe(1);
    const f2 = await uploadClean();
    const v2 = await Docs.createVersion(h.db, owner, doc.id, { rendered_pdf_file_id: f2.id });
    expect(v2.version_number).toBe(2);
    const prev = await h.db.query<{ superseded_at: string | null }>(`select superseded_at from pierre_rt_document_versions where id=$1`, [v.id]);
    expect(prev.rows[0].superseded_at).toBeTruthy();
  });

  it("review → approve → finalize makes the version immutable", async () => {
    const { doc, v } = await makeDocWithVersion();
    await Docs.submitForReview(h.db, owner, v.id);
    await Docs.approveVersion(h.db, owner, v.id);
    const fin = await Docs.finalizeVersion(h.db, owner, v.id);
    expect(fin.status).toBe("final");
    expect(fin.content_hash).toMatch(/^[a-f0-9]{64}$/);
    const docRow = await h.db.query<{ status: string }>(`select status from pierre_rt_documents where id=$1`, [doc.id]);
    expect(docRow.rows[0].status).toBe("published");
    // immutable: cannot submit/approve a final version
    await expect(Docs.submitForReview(h.db, owner, v.id)).rejects.toMatchObject({ code: "conflict" });
    await expect(Docs.approveVersion(h.db, owner, v.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("a new version invalidates a prior approval", async () => {
    const { doc, v } = await makeDocWithVersion();
    await Docs.submitForReview(h.db, owner, v.id);
    await Docs.approveVersion(h.db, owner, v.id);
    let d = await h.db.query<{ status: string; approved_by: string | null }>(`select status, approved_by from pierre_rt_documents where id=$1`, [doc.id]);
    expect(d.rows[0].status).toBe("approved");
    const f2 = await uploadClean();
    await Docs.createVersion(h.db, owner, doc.id, { rendered_pdf_file_id: f2.id });
    d = await h.db.query(`select status, approved_by from pierre_rt_documents where id=$1`, [doc.id]);
    expect(d.rows[0].status).toBe("draft");
    expect(d.rows[0].approved_by).toBeNull();
  });

  it("a file inside a finalized version cannot be deleted", async () => {
    const { f, v } = await makeDocWithVersion();
    await Docs.submitForReview(h.db, owner, v.id);
    await Docs.approveVersion(h.db, owner, v.id);
    await Docs.finalizeVersion(h.db, owner, v.id);
    await expect(Files.deleteFile(h.db, owner, f.id, deps())).rejects.toMatchObject({ code: "conflict" });
  });

  it("finalized document download is audited; integrity verifies", async () => {
    const { doc, v } = await makeDocWithVersion();
    await Docs.submitForReview(h.db, owner, v.id);
    await Docs.approveVersion(h.db, owner, v.id);
    await Docs.finalizeVersion(h.db, owner, v.id);
    const dl = await Docs.downloadDocument(h.db, owner, doc.id, { format: "pdf" }, deps());
    expect(dl.bytes.length).toBeGreaterThan(0);
    const log = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_access_log where document_id=$1 and action='document_download'`, [doc.id]);
    expect(log.rows[0].n).toBe(1);
    const ok = await Docs.verifyDocumentIntegrity(h.db, owner, doc.id, 1, deps());
    expect(ok.ok).toBe(true);
  });

  it("sensitive document download requires the sensitive permission", async () => {
    const f = await uploadClean();
    const doc = await Docs.createDocument(h.db, owner, { document_type: "disciplinary_document", title: "Avertissement", sensitivity: "high" });
    const v = await Docs.createVersion(h.db, owner, doc.id, { rendered_pdf_file_id: f.id });
    await Docs.submitForReview(h.db, owner, v.id);
    await Docs.approveVersion(h.db, owner, v.id);
    await Docs.finalizeVersion(h.db, owner, v.id);
    // viewer-with-doc.read-only (no sensitive) is denied
    const reader: TenantContext = { ...owner, permissions: ["document.read", "file.read"] };
    await expect(Docs.downloadDocument(h.db, reader, doc.id, { format: "pdf" }, deps())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("archive blocked under legal hold; soft delete of a signed doc blocked", async () => {
    const { doc } = await makeDocWithVersion();
    await h.db.query(`update pierre_rt_documents set legal_hold=true where id=$1`, [doc.id]);
    await expect(Docs.archiveDocument(h.db, owner, doc.id)).rejects.toMatchObject({ code: "conflict" });
    await h.db.query(`update pierre_rt_documents set legal_hold=false, status='signed' where id=$1`, [doc.id]);
    await expect(Docs.softDeleteDocument(h.db, owner, doc.id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("employee link is created relationally", async () => {
    const emp = (await h.db.query<{ id: string }>(`insert into pierre_rt_employees (id, company_id, first_name, last_name, search_text) values ($1,$2,'A','B','a b') returning id`, [newUuid(), h.companyA])).rows[0];
    const doc = await Docs.createDocument(h.db, owner, { document_type: "employment_contract", title: "CDI", employee_id: emp.id });
    const link = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_document_links where document_id=$1 and link_type='employee' and target_id=$2`, [doc.id, emp.id]);
    expect(link.rows[0].n).toBe(1);
  });
});

// ── Authorization ────────────────────────────────────────────────────────────
describe("authorization", () => {
  it("a member without document.write cannot create a document; without file.upload cannot upload", async () => {
    const viewer: TenantContext = { ...owner, role: "viewer", permissions: ["document.read", "file.read"] };
    await expect(Docs.createDocument(h.db, viewer, { document_type: "generic_hr_document", title: "X" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(Files.createUploadIntent(h.db, viewer, { declared_mime_type: PDF, original_filename: "x.pdf" }, deps())).rejects.toMatchObject({ code: "forbidden" });
  });
});
