// src/lib/pierre/v1/__integration__/p83-foundation-hardening.itest.ts
// PHASE 8.3-B — foundation hardening proven vs real Postgres + local FS:
// real post-upload integrity (§2), rescan fail-closed (§3), tenant-safe FKs (§8),
// attachment gate (§9), webhook RLS isolation (§1), fail-closed provider (§6).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { withTenantTransaction } from "../tenant-tx";
import { LocalFilesystemStorageProvider, resolveFileStorageProvider, assertProductionStorageReady } from "../file-storage";
import { DeterministicTestScanProvider, type FileScanProvider } from "../file-scan";
import { PdfRenderer, DocxRenderer } from "../renderers";
import * as Files from "../files";
import * as Docs from "../documents";

let h: Harness; let storage: LocalFilesystemStorageProvider; let owner: TenantContext;
const scanner = new DeterministicTestScanProvider();
const PDF = "application/pdf";
const cleanPdf = () => PdfRenderer.render({ title: "X", blocks: [{ lines: ["l"] }] }).bytes;

beforeEach(async () => {
  h = await createHarness();
  storage = new LocalFilesystemStorageProvider({ bucket: "pierre-test", baseDir: join(tmpdir(), `pierre-h-${newUuid()}`) });
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
});
afterEach(async () => { await storage.purgeAll(); await h.close(); });

// A provider that corrupts bytes on read-back (storage tampering / wrong bytes).
class TamperOnRead extends LocalFilesystemStorageProvider {
  constructor(base: LocalFilesystemStorageProvider, private mode: "append" | "truncate") { super({ bucket: "pierre-test", baseDir: (base as unknown as { baseDir: string }).baseDir }); }
  async downloadBytes(key: string): Promise<Buffer> {
    const b = await super.downloadBytes(key);
    return this.mode === "append" ? Buffer.concat([b, Buffer.from("X")]) : b.subarray(0, b.length - 1);
  }
}

describe("§2 real post-upload integrity", () => {
  it("storage that returns altered bytes → rejected (hash mismatch)", async () => {
    const tamper = new TamperOnRead(storage, "append");
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf" }, { storage: tamper, scanner });
    await expect(Files.finalizeUpload(h.db, owner, file_id, cleanPdf(), { storage: tamper, scanner })).rejects.toMatchObject({ code: "validation_failed" });
    const f = await Files.getFile(h.db, owner, file_id);
    expect(f.upload_status).toBe("rejected");
    expect(f.quarantine_reason).toBe("integrity_mismatch");
    // expected and actual were recorded SEPARATELY and differ
    const chk = await h.db.query<{ expected_sha256: string; actual_sha256: string; ok: boolean }>(`select expected_sha256, actual_sha256, ok from pierre_rt_file_integrity_checks where file_id=$1 order by checked_at desc limit 1`, [file_id]);
    expect(chk.rows[0].ok).toBe(false);
    expect(chk.rows[0].expected_sha256).not.toBe(chk.rows[0].actual_sha256);
  });

  it("truncated read-back → rejected (size + hash mismatch)", async () => {
    const trunc = new TamperOnRead(storage, "truncate");
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "b.pdf" }, { storage: trunc, scanner });
    await expect(Files.finalizeUpload(h.db, owner, file_id, cleanPdf(), { storage: trunc, scanner })).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("§3 rescan is fail-closed (layers beat a clean scanner)", () => {
  it("a clean-scanner but mime-mismatched file stays quarantined on rescan", async () => {
    const alwaysClean: FileScanProvider = { name: "always_clean", available: true, async scan() { return { scanner: "always_clean", scan_status: "clean", signature: null, detail: {} }; } };
    const docxBytes = DocxRenderer.render({ title: "X", blocks: [{ lines: ["l"] }] }).bytes;
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "c.pdf" }, { storage, scanner: alwaysClean });
    const f = await Files.finalizeUpload(h.db, owner, file_id, docxBytes, { storage, scanner: alwaysClean });
    expect(f.upload_status).toBe("quarantined"); // mime_mismatch despite clean scanner
    const r = await Files.rescanFile(h.db, owner, file_id, { storage, scanner: alwaysClean });
    expect(r.upload_status).toBe("quarantined"); // rescan cannot promote
    expect(r.quarantine_reason).toBe("mime_mismatch");
  });
});

describe("§9 clean-file attachment gate", () => {
  it("a quarantined file cannot be attached to a document version", async () => {
    const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "q.pdf" }, { storage, scanner });
    await Files.finalizeUpload(h.db, owner, file_id, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), { storage, scanner }); // png-as-pdf → quarantined
    const doc = await Docs.createDocument(h.db, owner, { document_type: "generic_hr_document", title: "D" });
    await expect(Docs.createVersion(h.db, owner, doc.id, { rendered_pdf_file_id: file_id })).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("§8 tenant-safe foreign references", () => {
  it("a document in tenant A cannot reference an employee of tenant B", async () => {
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    void ownerB;
    const empB = (await h.db.query<{ id: string }>(`insert into pierre_rt_employees (id, company_id, first_name, last_name, search_text) values ($1,$2,'B','B','b') returning id`, [newUuid(), h.companyB])).rows[0];
    await expect(h.db.query(
      `insert into pierre_rt_documents (id, company_id, document_type, title, status, employee_id) values ($1,$2,'employment_contract','X','draft',$3)`,
      [newUuid(), h.companyA, empB.id],
    )).rejects.toThrow();
  });
});

describe("§1 webhook ingress isolation", () => {
  it("a tenant (pierre_rt_app) cannot read the webhook table; the service role can", async () => {
    await h.db.query(`insert into pierre_rt_signature_webhooks (id, provider, provider_event_id, verified, status) values ($1,'local_sandbox',$2,false,'received')`, [newUuid(), `evt-${newUuid()}`]);
    // service/superuser role sees it
    const svc = await h.db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_webhooks`);
    expect(svc.rows[0].n).toBeGreaterThanOrEqual(1);
    // the application role (pierre_rt_app) has no grant + deny policy → cannot select
    await expect(withTenantTransaction(h.db, { company_id: h.companyA, user_id: "u" }, (tx) => tx.query(`select count(*) from pierre_rt_signature_webhooks`))).rejects.toBeTruthy();
  });
});

describe("§6 fail-closed storage provider", () => {
  it("production/supabase requested without complete config → throws (no silent FS fallback)", () => {
    const keys = ["FILE_STORAGE_PROVIDER", "SUPABASE_STORAGE_BUCKET", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"];
    const prev: Record<string, string | undefined> = {}; for (const k of keys) prev[k] = process.env[k];
    try {
      process.env.FILE_STORAGE_PROVIDER = "supabase"; delete process.env.SUPABASE_STORAGE_BUCKET; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_KEY;
      expect(() => assertProductionStorageReady()).toThrow();
      expect(() => resolveFileStorageProvider()).toThrow();
      // local is always available without external config
      expect(resolveFileStorageProvider({ forceLocal: true }).isProduction).toBe(false);
    } finally { for (const k of keys) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
  });
});
