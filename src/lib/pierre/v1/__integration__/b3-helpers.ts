// src/lib/pierre/v1/__integration__/b3-helpers.ts
// Shared B3 helpers (NOT a test file). Reaches `ready_for_signature` via the real B2G flow,
// and ingests a verified webhook event through the governed ingress function (ingress role).
import type { Harness } from "./harness";
import type { TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate, configureSignatory } from "./b2g-helpers";
import { buildObjectKey, type FileStorageProvider, type SignedUpload, type UploadIntent, type HeadResult, type ObjectKeyInput } from "../file-storage";
import * as C from "../contracts";

export { storageDeps, seedEmployee, publishContractTemplate, configureSignatory };

// In-memory storage — keeps EICAR/infected bytes off the host filesystem (the OS antivirus
// would otherwise delete an on-disk EICAR before a re-read). Deterministic.
export class InMemoryStorage implements FileStorageProvider {
  readonly name = "memory"; readonly bucket = "pierre-mem"; readonly isProduction = false;
  private store = new Map<string, Buffer>();
  async createUploadIntent(input: ObjectKeyInput & { maxSizeBytes: number }): Promise<UploadIntent> { return { storage_provider: this.name, bucket: this.bucket, object_key: buildObjectKey(input), max_size_bytes: input.maxSizeBytes }; }
  async issueSignedUpload(objectKey: string, opts: { expirySeconds: number; maxSizeBytes: number; contentType: string }): Promise<SignedUpload> { return { url: `mem://${objectKey}`, method: "PUT", object_key: objectKey, expires_at: new Date(Date.now() + opts.expirySeconds * 1000).toISOString(), max_size_bytes: opts.maxSizeBytes, token: "mem" }; }
  async upload(k: string, b: Buffer): Promise<void> { this.store.set(k, Buffer.from(b)); }
  async finalizeUpload(k: string): Promise<HeadResult> { return this.headObject(k); }
  async headObject(k: string): Promise<HeadResult> { const b = this.store.get(k); return { exists: !!b, size_bytes: b?.length ?? 0 }; }
  async objectExists(k: string): Promise<boolean> { return this.store.has(k); }
  async downloadBytes(k: string): Promise<Buffer> { const b = this.store.get(k); if (!b) throw new Error("not found"); return b; }
  async createSignedDownloadUrl(k: string, e: number): Promise<{ url: string; expires_at: string }> { return { url: `mem://${k}`, expires_at: new Date(Date.now() + Math.min(e, 300) * 1000).toISOString() }; }
  async deleteObject(k: string): Promise<void> { this.store.delete(k); }
  async copyObject(f: string, t: string): Promise<void> { this.store.set(t, await this.downloadBytes(f)); }
  async purgeAll(): Promise<void> { this.store.clear(); }
}

/** Build a contract all the way to `ready_for_signature` (with recipients prepared). */
export async function readyForSignatureContract(h: Harness, owner: TenantContext, sd: ReturnType<typeof storageDeps>, employeeId: string): Promise<string> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: employeeId, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  await C.approveContract(h.db, owner, c.id);
  await C.finalizeContract(h.db, owner, c.id);
  await C.prepareContractSignature(h.db, owner, c.id);
  return c.id;
}

/** Drive an already-created contract (or amendment) all the way to `signed` via the full B3 flow. */
export async function signExistingContract(
  h: Harness, owner: TenantContext, sdLike: { storage: import("../file-storage").FileStorageProvider; scanner: import("../file-scan").FileScanProvider },
  provider: import("../signature-provider").FakeSignatureProvider, contractId: string,
): Promise<{ signature_request_id: string }> {
  const S = await import("../signatures");
  const deps = { provider, storage: sdLike.storage, scanner: sdLike.scanner };
  await C.generateContract(h.db, owner, contractId, { field_values: { "employment.weekly_hours": "35" } }, deps);
  await C.submitContractForReview(h.db, owner, contractId);
  await C.approveContract(h.db, owner, contractId);
  await C.finalizeContract(h.db, owner, contractId);
  await C.prepareContractSignature(h.db, owner, contractId);
  const sub = await S.submitContractToSignatureProvider(h.db, owner, contractId, {}, deps);
  provider.__sign(sub.provider_request_id);
  await ingestWebhookEvent(h, owner.company_id, { provider: "fake_provider", eventId: `done-${sub.signature_request_id.slice(0, 8)}`, eventType: "request.completed", requestId: sub.signature_request_id });
  await S.processPendingSignatureEvents(h.db, owner, {}, deps);
  return { signature_request_id: sub.signature_request_id };
}

/** Ingest a verified webhook event through the governed ingress function (as the ingress role),
 *  exactly as the public webhook route would (after HMAC verification). Enqueues a signature event. */
export async function ingestWebhookEvent(h: Harness, company: string, input: { provider: string; eventId: string; eventType: string; requestId: string; payloadHash?: string; eventTime?: string | null }): Promise<{ status: string }> {
  await h.pg.exec("set role pierre_rt_webhook_ingress");
  await h.pg.query(`select set_config('app.allow_test_provider','true',false)`); // opt-in for the Fake provider
  try {
    const r = await h.pg.query(
      `select * from pierre_rt_ingest_signature_webhook($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.provider, input.eventId, input.eventType, input.payloadHash ?? "hash-" + input.eventId, 200, input.requestId, input.eventTime ?? null, true, null]);
    return { status: (r.rows[0] as { status: string }).status };
  } finally { await h.pg.exec("reset role"); }
}
