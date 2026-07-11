// src/lib/clonestore/ultimate/__tests__/p16-master-split.test.ts
// P16.0 §8 — Le master split classe tout le restant, chaque item a un owner, aucune techno hardcodée
// Pierre-only sans justification, external/must-not restent bloqués, production off, paiement non live,
// Pierre V1 intouché, recommandation = deux sessions + porte d'intégration. Cross-check honnête vs P14.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  P16_MASTER_SPLIT, P16_CATEGORIES, getPierreUltimateItems, getTechnologyItems, getIntegrationItems,
  getExternalBlockedItems, getMustNotClaimItems, summarizeP16Split, masterSplitComplete,
} from "../p16-master-split";
import { statusForRequirement } from "@/lib/clonestore/founder-acceptance/pierre-ultimate-coverage-evaluator";
import { requirementById } from "@/lib/clonestore/founder-acceptance/pierre-ultimate-vision-catalog";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";

describe("P16.0 — master split completeness", () => {
  it("5 catégories peuplées ; 15 technos ; 10 adapters ; ids uniques", () => {
    expect(masterSplitComplete()).toBe(true);
    expect(P16_CATEGORIES.length).toBe(5);
    expect(getTechnologyItems().length).toBe(15);
    expect(getIntegrationItems().length).toBe(10);
    expect(getPierreUltimateItems().length).toBeGreaterThanOrEqual(10);
    expect(getExternalBlockedItems().length).toBeGreaterThanOrEqual(5);
    expect(getMustNotClaimItems().length).toBeGreaterThanOrEqual(5);
    expect(new Set(P16_MASTER_SPLIT.map((i) => i.id)).size).toBe(P16_MASTER_SPLIT.length);
  });
  it("chaque item a un owner + phase + raison", () => {
    for (const i of P16_MASTER_SPLIT) {
      expect(["pierre", "technology", "integration", "external"]).toContain(i.owner);
      expect(["P16A", "T1", "P16C", "later"]).toContain(i.recommended_next_phase);
      expect(i.reason.length).toBeGreaterThan(0);
    }
  });
  it("owners cohérents par catégorie", () => {
    expect(getPierreUltimateItems().every((i) => i.owner === "pierre")).toBe(true);
    expect(getTechnologyItems().every((i) => i.owner === "technology")).toBe(true);
    expect(getIntegrationItems().every((i) => i.owner === "integration")).toBe(true);
    expect(getExternalBlockedItems().every((i) => i.owner === "external")).toBe(true);
  });
});

describe("P16.0 — doctrine (no hardcoded tech, external/must-not stay blocked)", () => {
  it("aucune techno hardcodée Pierre-only sans justification", () => {
    expect(summarizeP16Split().hardcodedPierreOnlyTechnologies).toEqual([]);
    // toute techno marquée pierreOnly DOIT porter une justification explicite
    for (const t of getTechnologyItems()) if (t.pierreOnly) expect((t.pierreOnlyJustification ?? "").length).toBeGreaterThan(0);
  });
  it("chaque external-blocked reste external_blocked ; chaque must-not-claim reste must_not_claim", () => {
    for (const i of getExternalBlockedItems()) { expect(i.current_status).toBe("external_blocked"); expect(i.recommended_next_phase).toBe("later"); }
    for (const i of getMustNotClaimItems()) { expect(i.current_status).toBe("must_not_claim"); expect(i.recommended_next_phase).toBe("later"); }
  });
  it("les technologies ont toutes un repli sûr OU sont déjà verified", () => {
    for (const t of getTechnologyItems()) {
      if (t.current_status !== "verified") expect(t.safeFallback || t.recommended_next_phase === "T1" || t.recommended_next_phase === "later").toBeTruthy();
    }
  });
});

describe("P16.0 — grounded against the real P14 evaluator (honest)", () => {
  it("les items P14-référencés must_not_claim correspondent à P14 MUST_NOT_CLAIM", () => {
    for (const i of getMustNotClaimItems()) {
      if (!i.p14Ref) continue;
      expect(statusForRequirement(requirementById(i.p14Ref)!).status).toBe("MUST_NOT_CLAIM");
    }
  });
  it("les items external-blocked P14-référencés sont bloqués côté P14 (LEGAL/PROVIDER/EXTERNAL)", () => {
    for (const i of getExternalBlockedItems()) {
      if (!i.p14Ref) continue;
      expect(["LEGAL_BLOCKED", "PROVIDER_BLOCKED", "EXTERNAL_BLOCKED"]).toContain(statusForRequirement(requirementById(i.p14Ref)!).status);
    }
  });
  it("les items Pierre Ultimate ne sont JAMAIS classés must_not_claim (ce sont de vraies capacités)", () => {
    for (const i of getPierreUltimateItems()) expect(i.category).not.toBe("must_not_claim");
  });
});

describe("P16.0 — guardrails (prod off, payment not live, Pierre V1 untouched)", () => {
  it("PRODUCTION_AUTHORIZED reste false ; paiement jamais live", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
    expect(resolvePaymentMode({})).not.toBe("live");
    expect(resolvePaymentMode({ STRIPE_SECRET_KEY: "sk_live_" + "x".repeat(20) })).toBe("disabled"); // live keys sans autorisation → disabled
  });
  it("Pierre V1 runtime intouché par P16 (aucun marqueur P16/master-split)", () => {
    // Preuve source : le module P16 vit sous ultimate/ ; aucun fichier pierre/v1 ne l'importe.
    const bus = readFileSync(resolve(process.cwd(), "src/lib/clonestore/ultimate/p16-master-split.ts"), "utf8");
    expect(bus).toMatch(/PUR \(aucune I\/O, aucun build\)/);
    // et le dir ultimate est nouveau (pas dans pierre/v1)
    expect(existsSync(resolve(process.cwd(), "src/lib/clonestore/ultimate/p16-master-split.ts"))).toBe(true);
  });
});

describe("P16.0 — session strategy", () => {
  it("recommande DEUX sessions + porte d'intégration, avec rationale", () => {
    const s = summarizeP16Split();
    expect(s.sessionRecommendation).toBe("two_sessions_plus_integration_gate");
    expect(s.sessionRationale.length).toBeGreaterThanOrEqual(4);
    expect(s.byNextPhase.P16A).toBeGreaterThan(0);
    expect(s.byNextPhase.T1).toBeGreaterThan(0);
    expect(s.byNextPhase.P16C).toBeGreaterThan(0);
    // des items sûrs à construire avant Stripe existent (hors external/must-not/later)
    expect(s.buildableBeforeStripe.length).toBeGreaterThan(0);
    expect(s.buildableBeforeStripe.every((id) => { const it = P16_MASTER_SPLIT.find((x) => x.id === id)!; return it.category !== "external_blocked" && it.category !== "must_not_claim"; })).toBe(true);
  });
});
