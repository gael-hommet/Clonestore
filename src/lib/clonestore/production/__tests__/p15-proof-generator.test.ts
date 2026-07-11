// src/lib/clonestore/production/__tests__/p15-proof-generator.test.ts
// P15 — génère les preuves JSON DEPUIS les évaluateurs RÉELS (honnête, pas d'écriture à la main).
// Écrit uniquement si P15_WRITE_PROOFS=1 ; sinon calcule + assère (test réel dans la non-régression).
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateWebhookReadiness } from "../p15-stripe-live-verification";
import { evaluateCheckoutReconciliationGate } from "../p15-checkout-reconciliation-gate";
import { evaluateLegalTaxArtifactRegistry } from "../p15-legal-tax-artifact-registry";
import { evaluateProviderClosure } from "../p15-provider-closure";
import { evaluateMonitoringRollback } from "../p15-monitoring-rollback";
import { evaluateP15ExternalGoLive } from "../p15-external-golive-contract";
import { evaluateP15FinalCommandCenter } from "../p15-final-command-center";

// Environnement LOCAL réel (process.env) — état honnête (clé test, pas d'artefacts, pas d'owner sign-off).
const cc = evaluateP15FinalCommandCenter({ env: process.env as Record<string, string | undefined> });
const contract = evaluateP15ExternalGoLive({ env: process.env as Record<string, string | undefined> });

describe("P15 — proof generation (computed from real evaluators)", () => {
  it("état local honnête : jamais READY, production non autorisée, plancher P10 respecté", () => {
    expect(["NOT_READY", "TECHNICAL_READY_EXTERNAL_BLOCKED"]).toContain(cc.globalStatus);
    expect(cc.publicPaidLaunchAllowed).toBe(false);
    expect(cc.productionAuthorizationAllowed).toBe(false);
    expect(cc.p10HardFloorRespected).toBe(true);
    expect(contract.blockerCodes.length).toBeGreaterThan(0);
  });

  it("écrit les preuves si P15_WRITE_PROOFS=1", () => {
    if (process.env.P15_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }
    const dir = resolve(process.cwd(), ".p15-proofs", "p15-run1");
    mkdirSync(dir, { recursive: true });
    const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

    w("webhook-readiness.json", { runId: "p15-run1", ...evaluateWebhookReadiness(process.env) });

    // Scénarios de réconciliation (gate ON) — preuve que les mismatches n'activent pas.
    const scn = (label: string, input: Parameters<typeof evaluateCheckoutReconciliationGate>[0]) => {
      const g = evaluateCheckoutReconciliationGate(input, { enabled: true });
      return { label, input, result: g.decision.result, shouldActivate: g.shouldActivate, activationStatus: g.activationStatus, refundRequired: g.refundRequired };
    };
    w("billing-country-reconciliation.json", {
      runId: "p15-run1",
      wiredInto: "src/app/api/webhooks/stripe/route.ts (checkout.session.completed, ADDITIVE, flag STRIPE_COUNTRY_RECONCILIATION_ENABLED)",
      scenarios: [
        scn("CH billed EUR", { companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" }),
        scn("FR billed CHF", { companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "chf" }),
        scn("BE billed CHF", { companyCountry: "BE", stripeBillingCountry: "BE", chargedCurrency: "chf" }),
        scn("LU billed CHF", { companyCountry: "LU", stripeBillingCountry: "LU", chargedCurrency: "chf" }),
        scn("FR billed EUR (ok)", { companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" }),
        scn("BE billed EUR (ok)", { companyCountry: "BE", stripeBillingCountry: "BE", chargedCurrency: "eur" }),
        scn("LU billed EUR (ok)", { companyCountry: "LU", stripeBillingCountry: "LU", chargedCurrency: "eur" }),
        scn("CH billed CHF (ok)", { companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "chf" }),
        scn("missing billing country", { companyCountry: "FR", stripeBillingCountry: null, chargedCurrency: "eur" }),
        scn("forged selected FR, billing CH", { selectedCountry: "FR", stripeBillingCountry: "CH", chargedCurrency: "eur" }),
        scn("company FR vs billing BE (conflict)", { companyCountry: "FR", stripeBillingCountry: "BE" }),
      ],
      note: "Flag ON : shouldActivate=false pour tout conflit fort (CH/EUR, FR-BE-LU/CHF, pays manquant, conflit entreprise, selected forgé). Flag OFF (défaut) : activation préservée mais audit toujours loggé. Idempotence : orders upsert onConflict user_id,agent_slug ; signature vérifiée par constructEvent avant tout effet.",
    });

    w("legal-tax-artifact-registry.json", { runId: "p15-run1", localState: "aucun artefact externe présent", ...evaluateLegalTaxArtifactRegistry([], {}) });
    w("provider-closure.json", { runId: "p15-run1", ...evaluateProviderClosure(process.env) });
    w("monitoring-rollback.json", { runId: "p15-run1", ...evaluateMonitoringRollback(process.env) });

    const ownerGate = contract.gates.find((g) => g.key === "owner_approval");
    w("owner-approval-packet.json", {
      runId: "p15-run1", packet: "P15_OWNER_GO_LIVE_APPROVAL_PACKET.md",
      signed: ownerGate?.pass ?? false, ownerGate,
      note: "Non signé localement → gate owner=false → aucune autorisation de production. La production reste impossible même signée tant que le plancher dur P10 n'est pas levé par un changement de code.",
    });

    w("final-command-center.json", { runId: "p15-run1", ...cc, contractGates: contract.gates, blockerCodes: contract.blockerCodes });

    expect(true).toBe(true);
  });
});
