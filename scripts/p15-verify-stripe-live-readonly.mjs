// scripts/p15-verify-stripe-live-readonly.mjs
// P15 §3/§11 — Vérification Stripe LIVE STRICTEMENT read-only. NE crée AUCUN checkout/session/paiement/
// customer/subscription. N'imprime AUCUN secret (masqué). Critères identiques à verifyStripePrice (P11,
// unit-testé) : EUR 44900 eur mensuel actif ; CHF 49900 chf mensuel actif ; deux price ids DISTINCTS.
// Sans clés live → EXTERNAL_BLOCKED (honnête, jamais fake-ready). Écrit .p15-proofs/p15-run1/stripe-live-readiness.json
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const e = { ...process.env };
  const p = "C:/Users/homme/clonestore/.env.local";
  if (existsSync(p)) {
    for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(m[1] in e) || !e[m[1]]) e[m[1]] = v; }
    }
  }
  return e;
}
const mask = (v) => { if (!v) return "(absent)"; const s = String(v); return s.slice(0, 8) + "…" + (s.length > 12 ? s.slice(-4) : "") + ` (len=${s.length})`; };
const isLive = (v) => /^sk_live_|^rk_live_/.test(String(v || ""));
const isTest = (v) => /^sk_test_|^rk_test_/.test(String(v || ""));

const CRIT = { eur: { currency: "eur", unit_amount: 44900, interval: "month" }, chf: { currency: "chf", unit_amount: 49900, interval: "month" } };
function verifyPrice(price, which) {
  const c = CRIT[which]; const issues = [];
  const observed = { active: price?.active ?? null, currency: price?.currency ?? null, unit_amount: price?.unit_amount ?? null, interval: price?.recurring?.interval ?? null };
  if (!price) { issues.push("prix introuvable"); return { ok: false, issues, observed }; }
  if (price.active !== true) issues.push("non actif");
  if ((price.currency || "").toLowerCase() !== c.currency) issues.push(`devise ${c.currency} attendue`);
  if (price.unit_amount !== c.unit_amount) issues.push(`montant ${c.unit_amount} attendu`);
  if ((price.recurring?.interval ?? null) !== c.interval) issues.push(`intervalle ${c.interval} attendu`);
  if (price.recurring?.trial_period_days) issues.push("essai gratuit inattendu");
  return { ok: issues.length === 0, issues, observed };
}

const E = loadEnv();
const proofDir = resolve(process.cwd(), ".p15-proofs", "p15-run1");
mkdirSync(proofDir, { recursive: true });

const sk = E.STRIPE_SECRET_KEY;
const eurId = E.STRIPE_PRICE_PIERRE_EUR_MONTHLY || E.STRIPE_PRICE_PIERRE;
const chfId = E.STRIPE_PRICE_PIERRE_CHF_MONTHLY;
const out = {
  runId: "p15-run1", readonly: true, createdSession: false, createdPayment: false, createdCustomer: false,
  masked: { STRIPE_SECRET_KEY: mask(sk), STRIPE_WEBHOOK_SECRET: mask(E.STRIPE_WEBHOOK_SECRET), EUR_PRICE_ID: eurId ? "(configured)" : "(absent)", CHF_PRICE_ID: chfId ? "(configured)" : "(absent)" },
  mode: isLive(sk) ? "live" : isTest(sk) ? "test" : sk ? "unknown" : "absent",
  noCrossCurrencyFallback: !(eurId && chfId && eurId === chfId),
  eurPriceVerification: null, chfPriceVerification: null, verdict: "PENDING", blockers: [], note: "",
};

try {
  if (isTest(sk)) {
    out.verdict = "TEST_MODE_BLOCKED"; out.blockers.push("Clé Stripe TEST — jamais acceptée pour la readiness LIVE.");
  } else if (!isLive(sk)) {
    out.verdict = "EXTERNAL_BLOCKED"; out.blockers.push("Aucune clé Stripe LIVE locale — vérification impossible (EXTERNAL_BLOCKED, honnête, jamais fake-ready).");
  } else if (!eurId || !chfId) {
    out.verdict = "EXTERNAL_BLOCKED"; if (!eurId) out.blockers.push("STRIPE_PRICE_PIERRE_EUR_MONTHLY absent."); if (!chfId) out.blockers.push("STRIPE_PRICE_PIERRE_CHF_MONTHLY absent.");
  } else if (!out.noCrossCurrencyFallback) {
    out.verdict = "EXTERNAL_BLOCKED"; out.blockers.push("Un seul price id pour EUR et CHF — repli inter-devise interdit.");
  } else {
    // Dry-run READ-ONLY : prices.retrieve uniquement. AUCUNE création.
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(sk);
    const eurPrice = await stripe.prices.retrieve(eurId, { expand: ["product"] }).catch((e) => ({ __err: e?.message }));
    const chfPrice = await stripe.prices.retrieve(chfId, { expand: ["product"] }).catch((e) => ({ __err: e?.message }));
    out.eurPriceVerification = eurPrice?.__err ? { ok: false, issues: ["retrieve failed"], observed: {} } : verifyPrice(eurPrice, "eur");
    out.chfPriceVerification = chfPrice?.__err ? { ok: false, issues: ["retrieve failed"], observed: {} } : verifyPrice(chfPrice, "chf");
    const allOk = out.eurPriceVerification.ok && out.chfPriceVerification.ok && !!E.STRIPE_WEBHOOK_SECRET && out.noCrossCurrencyFallback;
    out.verdict = allOk ? "VERIFIED" : "EXTERNAL_BLOCKED";
    if (!out.eurPriceVerification.ok) out.blockers.push("Prix EUR invalide : " + out.eurPriceVerification.issues.join(" ; "));
    if (!out.chfPriceVerification.ok) out.blockers.push("Prix CHF invalide : " + out.chfPriceVerification.issues.join(" ; "));
    if (!E.STRIPE_WEBHOOK_SECRET) out.blockers.push("STRIPE_WEBHOOK_SECRET absent.");
  }
} catch (e) {
  out.verdict = "EXTERNAL_BLOCKED"; out.blockers.push("Erreur read-only : " + (e?.message ?? String(e)));
}

out.note = "READ-ONLY : aucun checkout/paiement/customer/subscription créé ; aucun secret imprimé. Critères EUR 44900/eur/month, CHF 49900/chf/month (verifyStripePrice unit-testé). Sans clés live → EXTERNAL_BLOCKED honnête.";
writeFileSync(resolve(proofDir, "stripe-live-readiness.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ verdict: out.verdict, mode: out.mode, blockers: out.blockers, masked: out.masked }, null, 2));
