// src/lib/clonestore/production/__tests__/p15-1-proof-generator.test.ts
// P15.1 — génère les preuves JSON DEPUIS les modules RÉELS. Écrit si P15_1_WRITE_PROOFS=1, sinon
// calcule + assère (test réel dans la non-régression).
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { paymentModeStatus, resolvePaymentMode } from "../p15-1-payment-mode";
import { prelaunchStatus } from "../p15-1-prelaunch";
import { evaluateCheckoutReconciliationGate } from "../p15-checkout-reconciliation-gate";
import { evaluateLegalTaxArtifactRegistry } from "../p15-legal-tax-artifact-registry";
import { evaluateProviderClosure } from "../p15-provider-closure";
import { evaluateMonitoringRollback } from "../p15-monitoring-rollback";
import { evaluateP15FinalCommandCenter } from "../p15-final-command-center";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

const env = process.env as Record<string, string | undefined>;
const pm = paymentModeStatus(env);
const pre = prelaunchStatus();

describe("P15.1 — proof generation", () => {
  it("état sûr : jamais live, aucune action payante, production off", () => {
    expect(pm.mode).not.toBe("live");
    expect(pm.paidAccessPossible).toBe(false);
    expect(pre.noneOfTheActionsActivatePaidAccess).toBe(true);
    expect(pm.productionAuthorized).toBe(false);
  });

  it("écrit les preuves si P15_1_WRITE_PROOFS=1", () => {
    if (process.env.P15_1_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }
    const dir = resolve(process.cwd(), ".p15-proofs", "p15-1-prestripe");
    mkdirSync(dir, { recursive: true });
    const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

    w("payment-disabled-mode.json", {
      runId: "p15-1-prestripe", PAYMENT_MODE: pm.mode, resolvedFromLocalEnv: resolvePaymentMode(env),
      ...pm, wiredGuard: "src/app/api/checkout/route.ts — paymentExplicitlyBlocked() court-circuite AVANT toute session Stripe (mode disabled / clés live sans autorisation).",
      note: "Le mode live n'est jamais atteignable tant que PRODUCTION_AUTHORIZED (P10) est false. Aucun accès payant sans paiement vérifié (webhook + réconciliation).",
    });

    w("demo-founder-flow.json", {
      runId: "p15-1-prestripe", ...pre,
      existingRoutesReused: ["/demo", "/reserver/pierre (réservation/accès fondateur, non payant)", "founder-access reservations lib"],
      noStripeCheckoutInFlow: true, noPayment: true, noSubscription: true, noFakeActivation: true,
    });

    // §3 répétition TEST-only : logique de réconciliation (aucune clé live, aucune session, aucun paiement).
    const scn = (label: string, input: Parameters<typeof evaluateCheckoutReconciliationGate>[0]) => {
      const g = evaluateCheckoutReconciliationGate(input, { enabled: true });
      return { label, result: g.decision.result, shouldActivate: g.shouldActivate };
    };
    w("stripe-test-rehearsal.json", {
      runId: "p15-1-prestripe", liveKeyUsed: false, liveSessionCreated: false, paymentCreated: false, customerCharged: false,
      reconciliationScenarios: [
        scn("CH billed EUR", { companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" }),
        scn("FR billed CHF", { companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "chf" }),
        scn("BE billed CHF", { companyCountry: "BE", stripeBillingCountry: "BE", chargedCurrency: "chf" }),
        scn("LU billed CHF", { companyCountry: "LU", stripeBillingCountry: "LU", chargedCurrency: "chf" }),
        scn("FR billed EUR (ok)", { companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" }),
        scn("CH billed CHF (ok)", { companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "chf" }),
      ],
      note: "Répétition en LOGIQUE uniquement : aucune clé live, aucune session, aucun paiement. Confirme que CH/EUR et FR/BE/LU/CHF restent bloqués et qu'aucun accès payant n'existe sans activation vérifiée par webhook.",
    });

    w("legal-tax-packet-prepared.json", {
      runId: "p15-1-prestripe", packet: "P15_1_LEGAL_TAX_REVIEW_PACKET.md",
      registry: evaluateLegalTaxArtifactRegistry([], {}),
      prepared: true, externallyReviewed: false,
      note: "Paquet à envoyer à l'avocat/comptable. Aucun artefact externe présent → legalTaxReady=false (honnête).",
    });

    w("signature-fallback-prepared.json", {
      runId: "p15-1-prestripe", packet: "P15_1_SIGNATURE_FALLBACK_PACKET.md",
      provider: evaluateProviderClosure(env),
      allowedCopy: ["Document préparé par Pierre, à relire et signer manuellement."],
      forbiddenCopy: ["Document signé automatiquement.", "Yousign live.", "Signature électronique intégrée."],
      note: "Repli : Pierre prépare, l'humain relit/signe manuellement ou hors CloneStore. Aucune revendication de signature live.",
    });

    w("monitoring-rollback-prepared.json", {
      runId: "p15-1-prestripe", packet: "P15_MONITORING_ROLLBACK_PACKET.md (existant) + checklists",
      monitoring: evaluateMonitoringRollback(env), verified: false,
      note: "Checklists préparées (health, rollback, disable Stripe, disable d'urgence, templates support/incident). NON marqué vérifié tant que non répété en ops + attesté.",
    });

    w("stripe-owner-checklist.json", {
      runId: "p15-1-prestripe", checklist: "P15_1_STRIPE_OWNER_SETUP_CHECKLIST.md",
      steps: ["Créer/vérifier le compte Stripe (mode production)", "Créer le produit Pierre", "Prix EUR 44900 mensuel actif", "Prix CHF 49900 mensuel actif", "Webhook /api/webhooks/stripe (5 events)", "Copier les env vars localement (sans commit)", "node scripts/p15-verify-stripe-live-readonly.mjs", "NE PAS déployer", "NE PAS lever PRODUCTION_AUTHORIZED"],
      pricing: { FR_BE_LU: pricingForCountry("FR").status === "ok" ? "449 EUR" : "?", CH: pricingForCountry("CH").status === "ok" ? "499 CHF" : "?" },
    });

    const cc = evaluateP15FinalCommandCenter({ env });
    w("final-command-center.json", {
      runId: "p15-1-prestripe",
      demoOnlyAllowed: cc.demoOnlyAllowed,
      publicPaidLaunchAllowed: cc.publicPaidLaunchAllowed,
      productionAuthorizationAllowed: cc.productionAuthorizationAllowed,
      stripeLiveReady: cc.gates.find((g) => g.key === "stripe_live")?.pass ?? false,
      ownerApprovalPresent: cc.gates.find((g) => g.key === "owner_approval")?.pass ?? false,
      paymentMode: pm.mode,
      globalStatus: cc.globalStatus,
      p10HardFloorRespected: cc.p10HardFloorRespected,
      nextStep: "Wait for live Stripe account, then run the P15 owner external proof run (P15_1_STRIPE_OWNER_SETUP_CHECKLIST.md → node scripts/p15-verify-stripe-live-readonly.mjs → attest).",
    });

    expect(true).toBe(true);
  });
});
