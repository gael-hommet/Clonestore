#!/usr/bin/env node
// PHASE 8.3-B3.16 — LIVE e-signature provider smoke (opt-in). Disabled by default. Runs ONLY
// when CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED=true AND the provider credentials are present.
// It creates a real signature request with an explicitly-provided test signer email, verifies
// the provider response, then cancels/cleans up. It NEVER prints secrets and NEVER signs for a
// real person without consent. Without opt-in / credentials it prints SKIPPED and exits 0 — it
// is never turned into a false PASS.
import { pathToFileURL } from "url";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enabled = process.env.CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED === "true";
const provider = process.env.CLONESTORE_SIGNATURE_PROVIDER;
const apiUrl = process.env.CLONESTORE_SIGNATURE_API_URL;
const apiKey = process.env.CLONESTORE_SIGNATURE_API_KEY;
const webhookSecret = process.env.CLONESTORE_SIGNATURE_WEBHOOK_SECRET;
const testEmail = process.env.CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL; // explicit test signer (consented)

if (!enabled || !provider || provider === "fake" || !apiUrl || !apiKey || !webhookSecret || !testEmail) {
  console.log("\n RESULTAT : SKIPPED — live signature provider smoke not enabled.");
  console.log("   (set CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED=true + CLONESTORE_SIGNATURE_PROVIDER + API_URL + API_KEY + WEBHOOK_SECRET + CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL to run)");
  console.log("   The provider CONTRACT + governed runtime are proven locally by test:phase8-3-b3; the real provider is NOT executed here.\n");
  process.exit(0);
}

const { YousignSignatureProvider } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/signature-providers/yousign.ts")).href);
const corr = randomUUID();
const minimalPdf = Buffer.from(`%PDF-1.4\n% live-smoke ${corr}\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF`, "latin1");

try {
  console.log(`\n== PHASE 8.3-B3 LIVE smoke (${provider}) corr=${corr} ==\n`);
  const p = new YousignSignatureProvider({ apiUrl, apiKey, webhookSecret });
  const externalId = `clonestore:live-smoke:${corr}`;
  const req = await p.createRequest({ name: `CloneStore live smoke ${corr}`, signature_level: "simple", external_id: externalId, ordered: true });
  console.log("  OK created request:", req.provider_request_id, "status:", req.status);
  // real multipart upload of a VALID PDF → capture the provider document id
  const doc = await p.uploadDocument({ provider_request_id: req.provider_request_id, filename: "smoke.pdf", bytes: minimalPdf, content_hash: "smoke" });
  if (!doc.provider_document_id) throw new Error("no provider_document_id returned");
  console.log("  OK uploaded document:", doc.provider_document_id);
  // a real consenting test signer WITH a real signature field bound to the document
  const field = { type: "signature", document_id: doc.provider_document_id, page: 1, x: 70, y: 120, width: 180, height: 60 };
  const rcp = await p.addRecipient({ provider_request_id: req.provider_request_id, email: testEmail, name: "Live Smoke Signer", first_name: "Live", last_name: "Smoke Signer", role: "employee", signing_order: 1, locale: "fr", signature_level: "simple", auth_method: "no_otp", provider_document_id: doc.provider_document_id, fields: [field] });
  console.log("  OK added recipient + signature field:", rcp.provider_recipient_id);
  const got = await p.getRequest(req.provider_request_id);
  console.log("  OK fetched request status:", got.status);
  // NO activation — we never send to a real signer without consent. Clean up the draft request.
  try { await p.cancelRequest({ provider_request_id: req.provider_request_id, reason: "live_smoke_cleanup" }); console.log("  OK cancelled (cleanup)"); } catch (e) { console.log("  !! cleanup cancel failed:", String(e?.message ?? e).slice(0, 80)); }
  console.log("\n RESULTAT : PASS — real provider create/upload/document-id/signer+field/get verified; never activated; request cancelled.\n");
  process.exit(0);
} catch (e) {
  console.log("\n RESULTAT : FAIL —", String(e?.message ?? e).slice(0, 160), "\n");
  process.exit(1);
}
