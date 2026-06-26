#!/usr/bin/env node
// BLOC FINAL §6 — smoke test Stripe (mode TEST). Vérifie le Price/Product réels si les
// secrets test sont présents ; sinon imprime BLOCKED_EXTERNAL + le runbook opérateur.
// Ne déclenche JAMAIS de paiement live automatique.
import { writeFileSync } from "fs";
import { checkStripeEnv } from "./founder-env-checks.mjs";

const env = process.env;
const need = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PIERRE"];
const missing = need.filter((k) => !env[k]);

if (missing.length) {
  console.log("BLOCKED_EXTERNAL:");
  for (const m of missing) console.log(`- ${m} manquante`);
  console.log("\nRunbook opérateur (mode test) :");
  console.log("  1. export STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PRICE_PIERRE=price_... [STRIPE_PRODUCT_PIERRE=prod_...]");
  console.log("  2. node scripts/smoke-founder-stripe-testmode.mjs   # vérifie Price=44900/EUR/month + produit Pierre");
  console.log("  3. stripe listen --forward-to <APP_URL>/api/webhooks/stripe   # dans un terminal");
  console.log("  4. créer un checkout test pour une réservation confirmée (founder_reservation_id en metadata)");
  console.log("  5. vérifier l'activation, rejouer l'event (aucun doublon), annuler l'abonnement (sortie du MRR)");
  process.exit(0);
}

const ck = checkStripeEnv();
for (const w of ck.warnings) console.log(`! ${w}`);

(async () => {
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const proof = { timestamp: new Date().toISOString(), mode: env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test", checks: {} };
  let bad = 0;
  const ok = (n, c, d = "") => { if (c) console.log(`  ✓ ${n} ${d}`); else { console.error(`  ✗ ${n} ${d}`); bad++; } proof.checks[n] = c; };
  try {
    const price = await stripe.prices.retrieve(env.STRIPE_PRICE_PIERRE, { expand: ["product"] });
    ok("price.amount=44900", price.unit_amount === 44900, `(${price.unit_amount})`);
    ok("price.currency=eur", price.currency === "eur", `(${price.currency})`);
    ok("price.interval=month", price.recurring?.interval === "month", `(${price.recurring?.interval})`);
    if (env.STRIPE_PRODUCT_PIERRE) {
      const pid = typeof price.product === "string" ? price.product : price.product?.id;
      ok("product=Pierre", pid === env.STRIPE_PRODUCT_PIERRE, `(${pid})`);
    }
    proof.price_id = price.id;
  } catch (e) { console.error("[smoke-stripe] ERREUR :", e.message); bad++; }
  writeFileSync("founder-stripe-smoke-proof.local.json", JSON.stringify(proof, null, 2));
  console.log(`\n[smoke-stripe] ${bad === 0 ? "OK" : "ÉCHEC"} — preuve : founder-stripe-smoke-proof.local.json`);
  console.log("  (checkout + webhook + replay + cancel = étapes opérateur via Stripe CLI, voir docs/operator/PHASE_E_PRODUCTION_ACTIVATION.md)");
  process.exit(bad === 0 ? 0 : 1);
})();
