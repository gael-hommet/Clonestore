// Modèle de valeur v2 — sanity : dérivations, gradation, claims-safe, provenance 10 M€.
import { describe, it, expect } from "vitest";
import {
  missionShock, annualValue, scenarioValue, absorptionFactors, modelUpperBound,
  VALUE_REFERENCES, VOLUME_PROFILES, DEFAULT_PROFILE_ID,
} from "@/lib/demo/presentation/value-model";
import { evaluateClaimSafety } from "@/lib/clonestore/founder-acceptance/pierre-commercial-truth-matrix";

describe("value-model v2", () => {
  it("choc mission : 11 h 35 déclarées → 12 min d'attention (arrival-full)", () => {
    const s = missionShock();
    expect(s.scenario.id).toBe("arrival-full");
    expect(s.manualMinutes).toBe(695);
    expect(s.attentionMinutes).toBe(12);
    expect(s.ratio).toBeGreaterThan(50);
  });
  it("facteurs en gradation stricte draft < partagé < gouverné", () => {
    const f = absorptionFactors();
    expect(f.draft).toBeGreaterThan(0);
    expect(f.copilot).toBeGreaterThan(f.draft);
    expect(f.governed).toBeGreaterThan(f.copilot);
  });
  it("groupe multi-sites (défaut) : capacité libérée > 1 M€/an, net gouverné > 1 M€/an", () => {
    expect(DEFAULT_PROFILE_ID).toBe("groupe");
    const a = annualValue("groupe");
    expect(a.capacity.recoverableAnnualMinor).toBeGreaterThan(100_000_000); // > 1 M€ (centimes)
    const gov = a.perReference.find((v) => v.reference === "governed")!;
    expect(gov.netValueMinor).toBeGreaterThan(100_000_000);
    expect(gov.recoveredMinutesYear).toBeGreaterThan(200_000); // > 3 300 h/an
    expect(a.pain.total).toBeGreaterThan(1_000);
  });
  it("provenance du ~10 M€ : borne du modèle = 10,2 M€/an (curseurs aux maxima)", () => {
    const u = modelUpperBound();
    expect(u.recoverableAnnualMinor).toBe(1_020_000_000); // 10 200 000 € en centimes
  });
  it("chaque profil produit une gradation temps monotone par référence", () => {
    for (const p of VOLUME_PROFILES) {
      const a = annualValue(p.id);
      const [elite, draft, shared, governed] = a.perReference.map((v) => v.humanMinutesYear);
      expect(draft).toBeLessThan(elite);
      expect(shared).toBeLessThan(draft);
      expect(governed).toBeLessThanOrEqual(shared);
    }
  });
  it("scenarioValue : arrival-full 695→12, amendments 715→62", () => {
    expect(scenarioValue("arrival-full")!.views[0].humanMinutes).toBe(695);
    expect(scenarioValue("arrival-full")!.views[3].humanMinutes).toBe(12);
    expect(scenarioValue("amendments")!.views[0].humanMinutes).toBe(715);
    expect(scenarioValue("amendments")!.views[3].humanMinutes).toBe(62);
  });
  it("libellés publics jamais interdits (dont « Exécution partagée », pas « Copilote »)", () => {
    for (const r of VALUE_REFERENCES) {
      expect(evaluateClaimSafety(r.label).safety, r.label).not.toBe("forbidden");
      expect(evaluateClaimSafety(r.sub).safety, r.sub).not.toBe("forbidden");
    }
  });
});
