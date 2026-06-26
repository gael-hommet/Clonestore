// src/lib/pierre/v1/__integration__/p83-b2f-signed-upload-contract.itest.ts
// PHASE 8.3-B2F §4 — the signed-upload INTENT is owned by the server. The client receives a
// time-bounded signed PUT bound to ONE server-generated, tenant-scoped object key, plus a
// single-use nonce. The client never chooses the bucket, tenant, object key or status; a
// wrong token / wrong user / expired intent is refused at finalization.

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

describe("§4 signed-upload contract", () => {
  it("the server owns the object key (tenant-scoped, PII-free) and the signed URL targets exactly it", async () => {
    const intent = await Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "Hélène CDI.pdf" }, deps());
    expect(intent.object_key.startsWith(`companies/${h.companyA}/`)).toBe(true);
    expect(intent.object_key).not.toMatch(/helene|@|\s/i);
    expect(intent.signed_upload.object_key).toBe(intent.object_key);
    expect(intent.signed_upload.method).toBe("PUT");
    expect(intent.upload_token).toMatch(/[0-9a-f-]{36}/);
    // a short expiry is set
    expect(new Date(intent.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(intent.expires_at).getTime()).toBeLessThanOrEqual(Date.now() + 900 * 1000 + 2000);
    // the file row is initialized (not usable yet) and bound to this tenant + user
    const f = (await h.db.query<{ upload_status: string; uploaded_by_user_id: string; company_id: string }>(`select upload_status, uploaded_by_user_id, company_id from pierre_rt_files where id=$1`, [intent.file_id])).rows[0];
    expect(f).toMatchObject({ upload_status: "initialized", uploaded_by_user_id: owner.user_id, company_id: h.companyA });
  });

  it("finalization refuses a wrong nonce, a wrong user, and an expired intent", async () => {
    const intent = await Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf" }, deps());
    await storage.upload(intent.object_key, cleanPdf()); // simulate the client PUT
    // wrong token
    await expect(Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: "not-the-token" }, deps())).rejects.toMatchObject({ code: "forbidden" });
    // wrong user (same tenant, different user id) — uploader binding
    const otherUser: TenantContext = { ...owner, user_id: newUuid() };
    await expect(Files.finalizeSignedUpload(h.db, otherUser, intent.file_id, { upload_token: intent.upload_token }, deps())).rejects.toMatchObject({ code: "forbidden" });
    // expired intent
    await h.db.query(`update pierre_rt_files set upload_expires_at=now() - interval '1 hour' where id=$1`, [intent.file_id]);
    await expect(Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps())).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("a foreign tenant cannot finalize another tenant's intent (it is invisible)", async () => {
    const intent = await Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "a.pdf" }, deps());
    await storage.upload(intent.object_key, cleanPdf());
    const ownerB = await resolveTenantContext(h.db, { user_id: h.userB, company_id: h.companyB });
    await expect(Files.finalizeSignedUpload(h.db, ownerB, intent.file_id, { upload_token: intent.upload_token }, deps())).rejects.toMatchObject({ code: "not_found" });
  });
});
