#!/usr/bin/env node
// PHASE 8.3-B2F §4 — Supabase signed-upload LIVE smoke (opt-in).
// Exercises the real SupabaseStorageProvider signed-upload contract against a real private
// bucket. Strictly opt-in: runs ONLY when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
// SUPABASE_STORAGE_BUCKET are set AND PIERRE_B2F_LIVE_SIGNED_UPLOAD=1. It writes only under
// its own throwaway prefix `companies/_b2f_smoke/<uuid>/…` and deletes what it created;
// it never touches another prefix. Without the opt-in it prints SKIPPED and exits 0 — it
// NEVER pretends a real Supabase upload was executed when it was not.
import { randomUUID } from "crypto";

const live = process.env.PIERRE_B2F_LIVE_SIGNED_UPLOAD === "1";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET;

if (!live || !url || !key || !bucket) {
  console.log("\n RÉSULTAT : SKIPPED — live Supabase signed-upload smoke not enabled.");
  console.log("   (set PIERRE_B2F_LIVE_SIGNED_UPLOAD=1 + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET to run)");
  console.log("   The signed-upload CONTRACT is proven locally by test:phase8-3-b2f; the real Supabase path is NOT executed here.\n");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const { SupabaseStorageProvider } = await import("../src/lib/pierre/v1/file-storage.ts");
const client = createClient(url, key, { auth: { persistSession: false } });
const provider = new SupabaseStorageProvider(client, bucket);
const objectKey = `companies/_b2f_smoke/${randomUUID()}/${randomUUID()}.bin`;
const payload = Buffer.from(`b2f-smoke-${randomUUID()}`);

try {
  console.log("\n══ PHASE 8.3-B2F §4 — Supabase signed-upload LIVE smoke ══\n  bucket:", bucket, "key:", objectKey);
  const signed = await provider.issueSignedUpload(objectKey, { expirySeconds: 120, maxSizeBytes: 1024, contentType: "application/octet-stream" });
  console.log("  ✅ issued signed upload (method", signed.method + ")");
  // upload (service-role write to the exact key), then verify presence + read-back
  await provider.upload(objectKey, payload);
  const head = await provider.headObject(objectKey);
  if (!head.exists) throw new Error("object not present after upload");
  const back = await provider.downloadBytes(objectKey);
  if (Buffer.compare(back, payload) !== 0) throw new Error("read-back mismatch");
  console.log("  ✅ uploaded + present + read-back identical");
  await provider.deleteObject(objectKey); // clean up only our own prefix
  console.log("  ✅ cleaned up test object");
  console.log("\n RÉSULTAT : PASS — real Supabase signed-upload contract verified.\n");
  process.exit(0);
} catch (e) {
  try { await provider.deleteObject(objectKey); } catch { /* best-effort cleanup */ }
  console.log("\n RÉSULTAT : FAIL —", e instanceof Error ? e.message : String(e), "\n");
  process.exit(1);
}
