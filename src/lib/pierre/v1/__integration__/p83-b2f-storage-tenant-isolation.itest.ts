// src/lib/pierre/v1/__integration__/p83-b2f-storage-tenant-isolation.itest.ts
// PHASE 8.3-B2F §4/§5 — storage isolation. Object keys are tenant-prefixed and PII-free; a
// non-clean file is never downloadable; a signed download URL is short-lived; a foreign
// tenant can neither see nor download another tenant's file.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { LocalFilesystemStorageProvider, assertSafeObjectKey, buildObjectKey } from "../file-storage";
import { DeterministicTestScanProvider } from "../file-scan";
import { PdfRenderer } from "../renderers";
import { sha256 } from "../renderers";
import * as Files from "../files";

let h: Harness; let storage: LocalFilesystemStorageProvider; let owner: TenantContext;
const scanner = new DeterministicTestScanProvider();
const deps = () => ({ storage, scanner });
const PDF = "application/pdf";
const cleanPdf = () => PdfRenderer.render({ title: "T", blocks: [{ lines: ["a"] }] }).bytes;

beforeEach(async () => {
  h = await createHarness();
  storage = new LocalFilesystemStorageProvider({ bucket: "pierre-test", baseDir: join(tmpdir(), `pierre-b2f-${newUuid()}`) });
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
});
afterEach(async () => { await storage.purgeAll(); await h.close(); });

describe("§4/§5 storage tenant isolation", () => {
  it("object keys are tenant-scoped and reject cross-tenant / traversal / PII", () => {
    const key = buildObjectKey({ companyId: h.companyA, extension: "pdf" });
    expect(() => assertSafeObjectKey(key, h.companyA)).not.toThrow();
    expect(() => assertSafeObjectKey(key, h.companyB)).toThrow(/not scoped/);
    expect(() => assertSafeObjectKey(`companies/${h.companyA}/../escape.pdf`, h.companyA)).toThrow(/traversal/);
    expect(() => assertSafeObjectKey(`companies/${h.companyA}/jean@x.com.pdf`, h.companyA)).toThrow(/forbidden/);
  });

  it("a non-clean (initialized) file cannot be downloaded", async () => {
    const intent = await Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf" }, deps());
    // never uploaded/finalized → still 'initialized'
    await expect(Files.downloadFile(h.db, owner, intent.file_id, deps())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a clean file yields a short-lived signed download URL (<= 300s)", async () => {
    const bytes = cleanPdf();
    const intent = await Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf", declared_sha256: sha256(bytes), declared_size_bytes: bytes.length }, deps());
    await storage.upload(intent.object_key, bytes);
    await Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps());
    const signed = await Files.createSignedDownloadUrl(h.db, owner, intent.file_id, deps());
    const ttlMs = new Date(signed.expires_at).getTime() - Date.now();
    expect(ttlMs).toBeLessThanOrEqual(300 * 1000 + 2000);
    expect(ttlMs).toBeGreaterThan(0);
    expect(signed.url).not.toMatch(/public/i);
  });

  it("a foreign tenant can neither see nor download another tenant's clean file", async () => {
    const bytes = cleanPdf();
    const intent = await Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf", declared_sha256: sha256(bytes), declared_size_bytes: bytes.length }, deps());
    await storage.upload(intent.object_key, bytes);
    await Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps());
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    await expect(Files.getFile(h.db, ownerB, intent.file_id)).rejects.toMatchObject({ code: "not_found" });
    await expect(Files.downloadFile(h.db, ownerB, intent.file_id, deps())).rejects.toMatchObject({ code: "not_found" });
  });
});
