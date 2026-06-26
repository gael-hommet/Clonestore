// src/lib/pierre/v1/file-storage.ts
// PHASE 8.3 — FileStorageProvider abstraction. Private storage only. Object keys
// are generated server-side and contain NO PII (only uuids + extension). Two
// adapters: LocalFilesystemStorageProvider (TEST/LOCAL — under a temp dir outside
// /public, cleanup-able, NOT production) and SupabaseStorageProvider (production,
// PRIVATE bucket, very short signed URLs; disabled unless configured — never
// presented as verified without a real Supabase project).

import { randomUUID, createHash } from "crypto";
import { promises as fs } from "fs";
import { join, dirname, resolve, relative, isAbsolute } from "path";
import { tmpdir } from "os";

export type ObjectKeyInput = { companyId: string; documentId?: string | null; versionId?: string | null; extension: string };

/** Canonical, PII-free object key. */
export function buildObjectKey(input: ObjectKeyInput): string {
  const ext = (input.extension || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const rnd = randomUUID();
  if (input.documentId && input.versionId) {
    return `companies/${input.companyId}/documents/${input.documentId}/versions/${input.versionId}/${rnd}.${ext}`;
  }
  return `companies/${input.companyId}/staging/${rnd}.${ext}`;
}

/** Reject any key that could carry PII or escape its tenant prefix. */
export function assertSafeObjectKey(key: string, companyId: string): void {
  if (!key.startsWith(`companies/${companyId}/`)) throw new Error("object key is not scoped to the tenant");
  if (key.includes("..")) throw new Error("object key path traversal");
  // Only uuids, the fixed segment words, and a final {uuid}.{ext}. No emails/@, no spaces.
  if (/@|\s/.test(key)) throw new Error("object key contains forbidden characters");
}

export type UploadIntent = { storage_provider: string; bucket: string; object_key: string; max_size_bytes: number };
export type HeadResult = { exists: boolean; size_bytes: number };
// A signed upload grants the client a single-operation, time-bounded PUT to ONE object key.
export type SignedUpload = { url: string; method: "PUT"; object_key: string; expires_at: string; max_size_bytes: number; token?: string };

export interface FileStorageProvider {
  readonly name: string;
  readonly bucket: string;
  readonly isProduction: boolean;
  createUploadIntent(input: ObjectKeyInput & { maxSizeBytes: number }): Promise<UploadIntent>;
  /** A short-lived signed URL that lets the client upload to EXACTLY this object key. */
  issueSignedUpload(objectKey: string, opts: { expirySeconds: number; maxSizeBytes: number; contentType: string }): Promise<SignedUpload>;
  upload(objectKey: string, bytes: Buffer): Promise<void>;
  finalizeUpload(objectKey: string): Promise<HeadResult>;
  headObject(objectKey: string): Promise<HeadResult>;
  objectExists(objectKey: string): Promise<boolean>;
  downloadBytes(objectKey: string): Promise<Buffer>;
  createSignedDownloadUrl(objectKey: string, expirySeconds: number): Promise<{ url: string; expires_at: string }>;
  deleteObject(objectKey: string): Promise<void>;
  copyObject(fromKey: string, toKey: string): Promise<void>;
}

// ── Local / test adapter ─────────────────────────────────────────────────────
export class LocalFilesystemStorageProvider implements FileStorageProvider {
  readonly name = "local";
  readonly isProduction = false;
  readonly bucket: string;
  private baseDir: string;
  constructor(opts?: { bucket?: string; baseDir?: string }) {
    this.bucket = opts?.bucket ?? "pierre-local";
    // Deliberately OUTSIDE the app /public tree.
    this.baseDir = opts?.baseDir ?? process.env.PIERRE_LOCAL_STORAGE_DIR ?? join(tmpdir(), "pierre-local-storage");
  }
  private pathFor(objectKey: string): string {
    const root = resolve(this.baseDir, this.bucket);
    const full = resolve(root, objectKey);
    const rel = relative(root, full);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("path traversal blocked");
    return full;
  }
  async createUploadIntent(input: ObjectKeyInput & { maxSizeBytes: number }): Promise<UploadIntent> {
    const object_key = buildObjectKey(input);
    return { storage_provider: this.name, bucket: this.bucket, object_key, max_size_bytes: input.maxSizeBytes };
  }
  async issueSignedUpload(objectKey: string, opts: { expirySeconds: number; maxSizeBytes: number; contentType: string }): Promise<SignedUpload> {
    const expires = new Date(Date.now() + opts.expirySeconds * 1000).toISOString();
    // Local single-use PUT token (NOT a public/permanent URL); bound to the exact object key.
    const token = createHash("sha256").update(`${objectKey}|${expires}|PUT|${opts.contentType}|${process.env.PIERRE_LOCAL_STORAGE_SECRET ?? "local-dev"}`).digest("hex").slice(0, 32);
    return { url: `local-storage://${this.bucket}/${objectKey}?token=${token}&method=PUT&expires=${encodeURIComponent(expires)}`, method: "PUT", object_key: objectKey, expires_at: expires, max_size_bytes: opts.maxSizeBytes, token };
  }
  async upload(objectKey: string, bytes: Buffer): Promise<void> {
    const p = this.pathFor(objectKey);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, bytes);
  }
  async finalizeUpload(objectKey: string): Promise<HeadResult> { return this.headObject(objectKey); }
  async headObject(objectKey: string): Promise<HeadResult> {
    try { const st = await fs.stat(this.pathFor(objectKey)); return { exists: true, size_bytes: st.size }; }
    catch { return { exists: false, size_bytes: 0 }; }
  }
  async objectExists(objectKey: string): Promise<boolean> { return (await this.headObject(objectKey)).exists; }
  async downloadBytes(objectKey: string): Promise<Buffer> { return fs.readFile(this.pathFor(objectKey)); }
  async createSignedDownloadUrl(objectKey: string, expirySeconds: number): Promise<{ url: string; expires_at: string }> {
    const expires = new Date(Date.now() + expirySeconds * 1000).toISOString();
    // Local token (NOT a public/permanent URL): includes a short-lived HMAC-ish token.
    const token = createHash("sha256").update(`${objectKey}|${expires}|${process.env.PIERRE_LOCAL_STORAGE_SECRET ?? "local-dev"}`).digest("hex").slice(0, 24);
    return { url: `local-storage://${this.bucket}/${objectKey}?token=${token}&expires=${encodeURIComponent(expires)}`, expires_at: expires };
  }
  async deleteObject(objectKey: string): Promise<void> { try { await fs.unlink(this.pathFor(objectKey)); } catch { /* already gone */ } }
  async copyObject(fromKey: string, toKey: string): Promise<void> { await this.upload(toKey, await this.downloadBytes(fromKey)); }
  /** Test helper: wipe everything. */
  async purgeAll(): Promise<void> { try { await fs.rm(join(this.baseDir, this.bucket), { recursive: true, force: true }); } catch { /* noop */ } }
}

// ── Production adapter (Supabase Storage, PRIVATE bucket) ─────────────────────
// Implemented to the real @supabase/supabase-js storage API. Disabled unless the
// bucket + service key are configured. NEVER presented as verified here.
export class SupabaseStorageProvider implements FileStorageProvider {
  readonly name = "supabase";
  readonly isProduction = true;
  readonly bucket: string;
  // duck-typed client so we don't hard-couple the import path in tests
  private client: { storage: { from(b: string): {
    upload(path: string, body: Buffer, opts?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
    createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    createSignedUploadUrl(path: string): Promise<{ data: { signedUrl: string; token: string; path: string } | null; error: unknown }>;
    download(path: string): Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> } | null; error: unknown }>;
    remove(paths: string[]): Promise<{ data: unknown; error: unknown }>;
    list(prefix: string): Promise<{ data: Array<{ name: string }> | null; error: unknown }>;
    copy(from: string, to: string): Promise<{ data: unknown; error: unknown }>;
  } } };
  constructor(client: SupabaseStorageProvider["client"], bucket: string) { this.client = client; this.bucket = bucket; }
  async createUploadIntent(input: ObjectKeyInput & { maxSizeBytes: number }): Promise<UploadIntent> {
    return { storage_provider: this.name, bucket: this.bucket, object_key: buildObjectKey(input), max_size_bytes: input.maxSizeBytes };
  }
  async issueSignedUpload(objectKey: string, opts: { expirySeconds: number; maxSizeBytes: number; contentType: string }): Promise<SignedUpload> {
    // Real Supabase API: a one-time signed PUT URL bound to EXACTLY this path. The bucket is
    // private; the URL targets only `objectKey` and cannot list or overwrite another object.
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(objectKey);
    if (error || !data) throw new Error("signed upload url failed");
    return { url: data.signedUrl, method: "PUT", object_key: objectKey, token: data.token, expires_at: new Date(Date.now() + opts.expirySeconds * 1000).toISOString(), max_size_bytes: opts.maxSizeBytes };
  }
  async upload(objectKey: string, bytes: Buffer): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(objectKey, bytes, { upsert: false, contentType: "application/octet-stream" });
    if (error) throw new Error("storage upload failed");
  }
  async finalizeUpload(objectKey: string): Promise<HeadResult> { return this.headObject(objectKey); }
  async headObject(objectKey: string): Promise<HeadResult> {
    const dir = objectKey.split("/").slice(0, -1).join("/");
    const name = objectKey.split("/").slice(-1)[0];
    const { data } = await this.client.storage.from(this.bucket).list(dir);
    const hit = (data ?? []).find((o) => o.name === name);
    return { exists: !!hit, size_bytes: 0 };
  }
  async objectExists(objectKey: string): Promise<boolean> { return (await this.headObject(objectKey)).exists; }
  async downloadBytes(objectKey: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(objectKey);
    if (error || !data) throw new Error("storage download failed");
    return Buffer.from(await data.arrayBuffer());
  }
  async createSignedDownloadUrl(objectKey: string, expirySeconds: number): Promise<{ url: string; expires_at: string }> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(objectKey, Math.min(expirySeconds, 300));
    if (error || !data) throw new Error("signed url failed");
    return { url: data.signedUrl, expires_at: new Date(Date.now() + Math.min(expirySeconds, 300) * 1000).toISOString() };
  }
  async deleteObject(objectKey: string): Promise<void> { await this.client.storage.from(this.bucket).remove([objectKey]); }
  async copyObject(fromKey: string, toKey: string): Promise<void> { const { error } = await this.client.storage.from(this.bucket).copy(fromKey, toKey); if (error) throw new Error("copy failed"); }
}

let localSingleton: LocalFilesystemStorageProvider | null = null;
function getLocal(): LocalFilesystemStorageProvider { if (!localSingleton) localSingleton = new LocalFilesystemStorageProvider(); return localSingleton; }

/** Default local/test provider (back-compat). Tests inject their own instance. */
export function getFileStorageProvider(): FileStorageProvider { return getLocal(); }

function isRuntimeProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.PIERRE_RUNTIME_ENV !== "local";
}
export function isProductionStorageConfigured(): boolean {
  return process.env.FILE_STORAGE_PROVIDER === "supabase" && !!process.env.SUPABASE_STORAGE_BUCKET;
}

/** Fail-closed: production MUST have a fully-configured private Supabase bucket; never
 *  silently fall back to the filesystem. */
export function assertProductionStorageReady(): void {
  if (process.env.FILE_STORAGE_PROVIDER !== "supabase") throw new Error("production storage must be FILE_STORAGE_PROVIDER=supabase");
  if (!process.env.SUPABASE_STORAGE_BUCKET) throw new Error("SUPABASE_STORAGE_BUCKET is not set");
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) throw new Error("Supabase service key is not set");
  if (process.env.SUPABASE_STORAGE_PUBLIC === "true") throw new Error("storage bucket must be PRIVATE");
}

/**
 * Resolve the storage provider for a runtime context. In test/local → local. In
 * production with Supabase configured → Supabase (built by the supplied factory).
 * In production without complete config → throws (no silent filesystem fallback).
 */
export function resolveFileStorageProvider(opts: { forceLocal?: boolean; supabaseFactory?: () => FileStorageProvider } = {}): FileStorageProvider {
  if (opts.forceLocal || process.env.FILE_STORAGE_PROVIDER === "local") return getLocal();
  if (process.env.FILE_STORAGE_PROVIDER === "supabase" || isRuntimeProduction()) {
    assertProductionStorageReady();
    if (!opts.supabaseFactory) throw new Error("Supabase storage requested but no client factory was provided");
    const p = opts.supabaseFactory();
    if (!p.isProduction) throw new Error("production resolution must return a production provider");
    return p;
  }
  // Non-production default.
  return getLocal();
}

/** Read-only health check (no writes). */
export async function storageHealthCheck(provider: FileStorageProvider): Promise<{ ok: boolean; provider: string; production: boolean }> {
  try { await provider.objectExists(`companies/_health/${randomUUID()}.bin`); return { ok: true, provider: provider.name, production: provider.isProduction }; }
  catch { return { ok: false, provider: provider.name, production: provider.isProduction }; }
}
