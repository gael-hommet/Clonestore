#!/usr/bin/env node
// scripts/p87-storage-proof.mjs — P8.7.3 REAL Supabase Storage proof (private bucket + signed-URL round-trip).
// Proves: bucket exists & PRIVATE → upload synthetic object → public access REFUSED → 60s signed URL →
// download via signed URL → SHA-256 matches → delete → object gone. Synthetic data only (no customer data),
// never prints a secret, writes a redacted report to .p87-proofs/step3/storage-proof.json. Fail-closed.
// Requires --apply to write; dry-run otherwise. TLS is verified normally (this sandbox's intercepting proxy is
// worked around by the caller via NODE_TLS_REJECT_UNAUTHORIZED for diagnostics only).
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";
import { createHash, randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");
const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "pierre-private-documents";
function refuse(m) { process.stderr.write(`\n[p87-storage] REFUSED — ${m}\n`); process.exit(2); }
if (!URL_BASE) refuse("NEXT_PUBLIC_SUPABASE_URL required");
if (!SRK) refuse("SUPABASE_SERVICE_ROLE_KEY required");
const log = (m) => process.stderr.write(`[p87-storage] ${m}\n`);
const H = { authorization: `Bearer ${SRK}`, apikey: SRK };
const api = (p) => `${URL_BASE}/storage/v1${p}`;
const proofDir = join(ROOT, ".p87-proofs", "step3");
mkdirSync(proofDir, { recursive: true });

async function main() {
  const report = { phase: "P8.7.3", domain: "storage", bucket: BUCKET, steps: {}, ok: false };
  // 1) bucket exists + private (use the LIST endpoint; single-bucket GET returns 400 for a missing bucket).
  const listBuckets = async () => { const r = await fetch(api(`/bucket`), { headers: H }); if (!r.ok) throw new Error(`bucket list failed http ${r.status}`); return await r.json(); };
  const findBucket = (list) => (Array.isArray(list) ? list : []).find((b) => b.name === BUCKET || b.id === BUCKET);
  let entry = findBucket(await listBuckets());
  if (!entry) {
    if (!APPLY) { log(`DRY RUN — bucket '${BUCKET}' absent; would create PRIVATE + run round-trip. No writes.`); report.steps.bucket = "WOULD_CREATE"; writeReport(report); process.exit(0); }
    const c = await fetch(api(`/bucket`), { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
    if (!c.ok) throw new Error(`bucket create failed http ${c.status}`);
    entry = findBucket(await listBuckets());
  }
  if (!entry) throw new Error("bucket not found after create");
  if (entry.public !== false) throw new Error("bucket is PUBLIC — refuse (must be private)");
  report.steps.bucket = "PRIVATE_OK";
  if (!APPLY) { log("DRY RUN — bucket present & private; would run upload/sign/download/delete. No writes."); writeReport(report); process.exit(0); }

  // 2) synthetic upload
  const path = `p87-step3-proof/${randomUUID()}.txt`;
  const content = `P8.7.3 STORAGE PROOF ${randomUUID()} — synthetic, no customer data`;
  const localHash = createHash("sha256").update(content).digest("hex");
  const up = await fetch(api(`/object/${BUCKET}/${path}`), { method: "POST", headers: { ...H, "content-type": "text/plain", "x-upsert": "true" }, body: content });
  if (!up.ok) throw new Error(`upload failed http ${up.status}`);
  report.steps.upload = "OK";

  // 3) public access MUST be refused (private bucket)
  const pub = await fetch(api(`/object/public/${BUCKET}/${path}`));
  report.steps.public_access_refused = (pub.status === 200) ? "LEAK" : `REFUSED_${pub.status}`;
  if (pub.status === 200) throw new Error("PUBLIC access to a private-bucket object SUCCEEDED — leak, refuse");

  // 4) 60s signed URL + download + hash match
  const s = await fetch(api(`/object/sign/${BUCKET}/${path}`), { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
  if (!s.ok) throw new Error(`sign failed http ${s.status}`);
  const signed = (await s.json()).signedURL;
  if (!signed) throw new Error("no signedURL returned");
  report.steps.signed_url = "OK_60s";
  const dl = await fetch(`${URL_BASE}/storage/v1${signed}`);
  if (!dl.ok) throw new Error(`signed download failed http ${dl.status}`);
  const remoteHash = createHash("sha256").update(Buffer.from(await dl.arrayBuffer())).digest("hex");
  report.steps.hash_match = remoteHash === localHash ? "MATCH" : "MISMATCH";
  if (remoteHash !== localHash) throw new Error("downloaded hash != uploaded hash");

  // 5) delete + confirm gone
  const del = await fetch(api(`/object/${BUCKET}/${path}`), { method: "DELETE", headers: H });
  if (!del.ok) throw new Error(`delete failed http ${del.status}`);
  const gone = await fetch(`${URL_BASE}/storage/v1${signed}`);
  report.steps.deleted_and_gone = gone.status === 200 ? "STILL_PRESENT" : `GONE_${gone.status}`;
  if (gone.status === 200) throw new Error("object still downloadable after delete");

  report.ok = Object.values(report.steps).every((v) => /OK|PRIVATE_OK|REFUSED_|MATCH|GONE_/.test(v));
  writeReport(report);
  log(`storage proof complete: ok=${report.ok} (bucket private, upload, public refused, signed 60s, hash match, deleted+gone)`);
  process.exit(report.ok ? 0 : 1);
}
function writeReport(r) { writeFileSync(join(proofDir, "storage-proof.json"), JSON.stringify(r, null, 2)); }
main().catch((e) => { process.stderr.write(`[p87-storage] ERROR: ${e.message}\n`); process.exit(1); });
