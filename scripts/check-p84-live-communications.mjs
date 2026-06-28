#!/usr/bin/env node
// PHASE 8.4.25 — LIVE communication provider smoke (opt-in). Disabled by default. Runs ONLY when
// CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED=true AND the provider credentials + an explicit
// consented test recipient are present. It sends ONE clearly-marked transactional TEST email to the
// explicitly-provided test address, captures the provider message id, and (when possible) checks the
// provider status. It NEVER sends to a real customer, NEVER prints secrets, and NEVER reuses a stored
// address. Without opt-in / credentials it prints SKIPPED and exits 0 — never a false PASS.
import { pathToFileURL } from "url";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enabled = process.env.CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED === "true";
const provider = process.env.CLONESTORE_COMMUNICATION_PROVIDER ?? process.env.EMAIL_PROVIDER;
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.CLONESTORE_EMAIL_FROM ?? process.env.CLONESTORE_FOUNDER_EMAIL_FROM;
const testTo = process.env.CLONESTORE_COMMUNICATION_TEST_RECIPIENT; // explicit, consented test address
const consent = process.env.CLONESTORE_COMMUNICATION_TEST_CONSENT === "true"; // explicit operator consent

if (!enabled || provider !== "resend" || !apiKey || !from || !testTo || !consent) {
  console.log("\n RESULTAT : SKIPPED — live communication smoke not enabled.");
  console.log("   (set CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED=true + CLONESTORE_COMMUNICATION_PROVIDER=resend + RESEND_API_KEY +");
  console.log("    CLONESTORE_EMAIL_FROM + CLONESTORE_COMMUNICATION_TEST_RECIPIENT + CLONESTORE_COMMUNICATION_TEST_CONSENT=true to run)");
  console.log("   The provider HTTP CONTRACT + governed delivery runtime are proven locally by test:phase8-4; the real provider is NOT executed here.\n");
  process.exit(0);
}

const { ResendEmailProvider } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/communication-providers/resend.ts")).href);
const corr = randomUUID();
try {
  console.log(`\n== PHASE 8.4 LIVE communication smoke (resend) corr=${corr} ==\n`);
  const p = new ResendEmailProvider({ apiKey });
  const sent = await p.sendEmail({
    idempotencyKey: `p84-smoke:${corr}`,
    from, to: testTo, replyTo: null,
    subject: `[TEST CloneStore] Smoke communication ${corr.slice(0, 8)}`,
    plainText: `Ceci est un email de TEST CloneStore (smoke P8.4). Aucune action requise. Ref ${corr}.`,
    html: `<p>Ceci est un email de <strong>TEST</strong> CloneStore (smoke P8.4). Aucune action requise.</p><p>Ref ${corr}.</p>`,
    tags: { smoke: "p84", corr },
  });
  if (!sent.providerMessageId) throw new Error("no provider message id returned");
  console.log("  OK sent test email, provider message id:", sent.providerMessageId);
  try { const st = await p.getMessage(sent.providerMessageId); console.log("  OK provider status:", st.status); } catch (e) { console.log("  !! status check unavailable:", String(e?.message ?? e).slice(0, 80)); }
  console.log("\n RESULTAT : PASS — real provider accepted a clearly-marked TEST email to the consented test address (message id captured).\n");
  process.exit(0);
} catch (e) {
  console.log("\n RESULTAT : FAIL —", String(e?.message ?? e).slice(0, 160), "\n");
  process.exit(1);
}
