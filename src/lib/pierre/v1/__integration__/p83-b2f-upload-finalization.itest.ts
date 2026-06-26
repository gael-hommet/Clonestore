// src/lib/pierre/v1/__integration__/p83-b2f-upload-finalization.itest.ts
// PHASE 8.3-B2F §4 — finalization verifies the REAL stored object: present, size+hash vs the
// declared values, MIME, screen + malware scan. A file becomes usable ONLY when
// upload_status=clean AND scan_status=clean; an absent object, an infected file, or a
// size/hash mismatch never yields a usable artifact.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { sha256 } from "../renderers";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { buildObjectKey, type FileStorageProvider, type SignedUpload, type UploadIntent, type HeadResult, type ObjectKeyInput } from "../file-storage";
import { DeterministicTestScanProvider } from "../file-scan";
import { PdfRenderer } from "../renderers";
import * as Files from "../files";

// In-memory storage: the signed-upload model reads bytes back FROM storage to scan them, and
// a real on-disk EICAR file is deleted by the host antivirus before that re-read. Keeping the
// bytes in memory makes the malware-quarantine path deterministic and disk-free.
class InMemoryStorageProvider implements FileStorageProvider {
  readonly name = "memory"; readonly bucket = "pierre-mem"; readonly isProduction = false;
  private store = new Map<string, Buffer>();
  async createUploadIntent(input: ObjectKeyInput & { maxSizeBytes: number }): Promise<UploadIntent> {
    return { storage_provider: this.name, bucket: this.bucket, object_key: buildObjectKey(input), max_size_bytes: input.maxSizeBytes };
  }
  async issueSignedUpload(objectKey: string, opts: { expirySeconds: number; maxSizeBytes: number; contentType: string }): Promise<SignedUpload> {
    return { url: `mem://${objectKey}`, method: "PUT", object_key: objectKey, expires_at: new Date(Date.now() + opts.expirySeconds * 1000).toISOString(), max_size_bytes: opts.maxSizeBytes, token: "mem-token" };
  }
  async upload(objectKey: string, bytes: Buffer): Promise<void> { this.store.set(objectKey, Buffer.from(bytes)); }
  async finalizeUpload(objectKey: string): Promise<HeadResult> { return this.headObject(objectKey); }
  async headObject(objectKey: string): Promise<HeadResult> { const b = this.store.get(objectKey); return { exists: !!b, size_bytes: b?.length ?? 0 }; }
  async objectExists(objectKey: string): Promise<boolean> { return this.store.has(objectKey); }
  async downloadBytes(objectKey: string): Promise<Buffer> { const b = this.store.get(objectKey); if (!b) throw new Error("not found"); return b; }
  async createSignedDownloadUrl(objectKey: string, expirySeconds: number): Promise<{ url: string; expires_at: string }> { return { url: `mem://${objectKey}`, expires_at: new Date(Date.now() + Math.min(expirySeconds, 300) * 1000).toISOString() }; }
  async deleteObject(objectKey: string): Promise<void> { this.store.delete(objectKey); }
  async copyObject(fromKey: string, toKey: string): Promise<void> { this.store.set(toKey, await this.downloadBytes(fromKey)); }
}

let h: Harness; let storage: InMemoryStorageProvider; let owner: TenantContext;
const scanner = new DeterministicTestScanProvider();
const deps = () => ({ storage, scanner });
const PDF = "application/pdf";
const cleanPdf = () => PdfRenderer.render({ title: "T", blocks: [{ lines: ["a"] }] }).bytes;
const EICAR = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");

beforeEach(async () => {
  h = await createHarness();
  storage = new InMemoryStorageProvider();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
});
afterEach(async () => { await h.close(); });

async function intentFor(mime = PDF, declared?: { sha?: string; size?: number }) {
  return Files.createSignedUploadIntent(h.db, owner, { declared_mime_type: mime, original_filename: "a.pdf", declared_sha256: declared?.sha ?? null, declared_size_bytes: declared?.size ?? null }, deps());
}

describe("§4 signed-upload finalization", () => {
  it("a clean upload finalizes to clean and becomes attachable", async () => {
    const bytes = cleanPdf();
    const intent = await intentFor(PDF, { sha: sha256(bytes), size: bytes.length });
    await storage.upload(intent.object_key, bytes); // client PUT via the signed URL
    const file = await Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps());
    expect(file.upload_status).toBe("clean");
    expect(file.scan_status).toBe("clean");
    expect(file.sha256).toBe(sha256(bytes));
    // usable: passes the attachment gate
    await expect(Files.assertFileAttachable(h.db, owner, intent.file_id)).resolves.toBeTruthy();
  });

  it("an infected upload is quarantined and never usable", async () => {
    const intent = await intentFor();
    await storage.upload(intent.object_key, EICAR);
    const file = await Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps());
    expect(file.upload_status).not.toBe("clean");
    expect(file.scan_status).not.toBe("clean");
    await expect(Files.assertFileAttachable(h.db, owner, intent.file_id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("a size/hash mismatch vs the declared values is rejected", async () => {
    const real = cleanPdf();
    // declare a DIFFERENT (wrong) hash/size than what gets uploaded
    const intent = await intentFor(PDF, { sha: sha256(Buffer.from("something else")), size: real.length + 999 });
    await storage.upload(intent.object_key, real);
    await expect(Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps())).rejects.toMatchObject({ code: "validation_failed" });
    const f = (await h.db.query<{ upload_status: string }>(`select upload_status from pierre_rt_files where id=$1`, [intent.file_id])).rows[0];
    expect(f.upload_status).toBe("rejected");
  });

  it("finalizing without an uploaded object is refused (no usable artifact from thin air)", async () => {
    const intent = await intentFor();
    // no storage.upload — the client never PUT the bytes
    await expect(Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps())).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("finalization is idempotent once the file is clean", async () => {
    const bytes = cleanPdf();
    const intent = await intentFor(PDF, { sha: sha256(bytes), size: bytes.length });
    await storage.upload(intent.object_key, bytes);
    const a = await Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps());
    const b = await Files.finalizeSignedUpload(h.db, owner, intent.file_id, { upload_token: intent.upload_token }, deps());
    expect(a.id).toBe(b.id);
    expect(b.upload_status).toBe("clean");
  });
});
