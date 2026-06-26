#!/usr/bin/env node
// BLOC FINAL §7 — smoke test email Resend. N'envoie JAMAIS à une liste client.
// Sans secrets → BLOCKED_EXTERNAL + runbook. Avec secrets → envoi de test contrôlé.
import { checkEmailEnv } from "./founder-env-checks.mjs";

const env = process.env;
const need = ["RESEND_API_KEY", "CLONESTORE_FOUNDER_EMAIL_FROM", "FOUNDER_EMAIL_SMOKE_RECIPIENT"];
const missing = need.filter((k) => !env[k]);

if (missing.length) {
  console.log("BLOCKED_EXTERNAL:");
  for (const m of missing) console.log(`- ${m} manquante`);
  console.log("\nRunbook opérateur :");
  console.log("  1. export RESEND_API_KEY=re_... CLONESTORE_FOUNDER_EMAIL_FROM='CloneStore <fondateur@votre-domaine>'");
  console.log("  2. export FOUNDER_EMAIL_SMOKE_RECIPIENT=vous@votre-domaine   # adresse de TEST, jamais une liste client");
  console.log("  3. export CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET=... CLONESTORE_FOUNDER_EMAIL_LINK_SECRET=...");
  console.log("  4. node scripts/smoke-founder-email.mjs");
  console.log("  5. vérifier réception + provider message id + idempotency key + lien de vérification + unsubscribe GET puis POST");
  process.exit(0);
}

for (const w of checkEmailEnv().warnings) console.log(`! ${w}`);

(async () => {
  const { Resend } = await import("resend");
  const client = new Resend(env.RESEND_API_KEY);
  const key = `founder-email:smoke:${Date.now()}`;
  try {
    const r = await client.emails.send({
      from: env.CLONESTORE_FOUNDER_EMAIL_FROM,
      to: env.FOUNDER_EMAIL_SMOKE_RECIPIENT,
      subject: "[SMOKE] Vérification Founder Access",
      html: "<p>Smoke test Founder Access (mode opérateur). Aucune action requise.</p>",
      text: "Smoke test Founder Access (mode opérateur).",
    }, { idempotencyKey: key });
    if (r.error) { console.error("[smoke-email] ÉCHEC :", r.error.message); process.exit(1); }
    console.log(`[smoke-email] OK — message id=${r.data?.id} idempotencyKey=${key}`);
    console.log("  Re-lancez avec la MÊME idempotencyKey pour vérifier la dédup (un seul envoi logique).");
    console.log("  Vérifiez ensuite le flow unsubscribe : GET (confirmation, aucune mutation) puis POST.");
    process.exit(0);
  } catch (e) { console.error("[smoke-email] ERREUR :", e.message); process.exit(1); }
})();
