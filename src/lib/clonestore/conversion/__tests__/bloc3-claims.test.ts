import { describe, it, expect } from "vitest";
import { CLAIMS_REGISTRY, auditClaims, buildEvidenceMatrix, isActivatable, isShadowAllowed, claimAllowedOnSurface } from "../claims-registry";
import { lintContent, lintReport } from "../claims-linter";

describe("BLOC 3 — claims registry (conforme LeadForge db9b166)", () => {
  it("8 claims exactes (alignées avec _SEED_CLAIMS Python)", () => {
    expect(Object.keys(CLAIMS_REGISTRY).sort()).toEqual([
      "company_adaptation",
      "demo_timing",
      "human_validation",
      "pierre_is_role",
      "price_monthly",
      "recurring_work",
      "traceability",
      "volume_estimate",
    ]);
  });

  it("price_monthly = VERIFIED_PRICE, activatable en real", () => {
    expect(CLAIMS_REGISTRY.price_monthly.status).toBe("VERIFIED_PRICE");
    expect(isActivatable("price_monthly")).toBe(true);
    expect(isShadowAllowed("price_monthly")).toBe(true);
  });

  it("volume_estimate = ASSUMPTION_REQUIRES_DISCLOSURE, activatable", () => {
    expect(CLAIMS_REGISTRY.volume_estimate.status).toBe("ASSUMPTION_REQUIRES_DISCLOSURE");
    expect(isActivatable("volume_estimate")).toBe(true);
  });

  it("pierre_is_role/human_validation/traceability/company_adaptation/recurring_work = PENDING_CLONESTORE_PRODUCT_VERIFICATION", () => {
    for (const id of ["pierre_is_role", "human_validation", "traceability", "company_adaptation", "recurring_work"] as const) {
      expect(CLAIMS_REGISTRY[id].status).toBe("PENDING_CLONESTORE_PRODUCT_VERIFICATION");
      expect(isActivatable(id)).toBe(false);
      expect(isShadowAllowed(id)).toBe(true);
    }
  });

  it("demo_timing = PENDING_DEMO_TIMING_MEASUREMENT, non activatable", () => {
    expect(CLAIMS_REGISTRY.demo_timing.status).toBe("PENDING_DEMO_TIMING_MEASUREMENT");
    expect(isActivatable("demo_timing")).toBe(false);
  });

  it("claimAllowedOnSurface respecte SURFACE_ALLOWED_CLAIMS", () => {
    expect(claimAllowedOnSurface("price_monthly", "pricing")).toBe(true);
    expect(claimAllowedOnSurface("volume_estimate", "pricing")).toBe(false);
    expect(claimAllowedOnSurface("volume_estimate", "diagnostic")).toBe(true);
    expect(claimAllowedOnSurface("company_adaptation", "demo")).toBe(true);
  });

  it("buildEvidenceMatrix expose tous les attributs LeadForge", () => {
    const matrix = buildEvidenceMatrix();
    expect(matrix.length).toBe(8);
    const price = matrix.find((m) => m.claimId === "price_monthly")!;
    expect(price.realActivatable).toBe(true);
    expect(price.shadowAllowed).toBe(true);
  });

  it("auditClaims retourne les bons counts par statut", () => {
    const audit = auditClaims();
    expect(audit.total).toBe(8);
    expect(audit.realActivatableIds).toEqual(["price_monthly", "volume_estimate"]);
    expect(audit.pendingProductIds.length).toBe(5);
    expect(audit.pendingTimingIds).toEqual(["demo_timing"]);
  });
});

describe("BLOC 3 — claims linter (conforme claims.py:lint_content)", () => {
  it("détecte certification ISO", () => {
    const issues = lintContent({ text: "Solution certifiée ISO 27001" });
    expect(issues).toContain("fake_certification");
  });

  it("détecte ROI inventé", () => {
    const issues = lintContent({ text: "+42% de productivité RH garanti" });
    expect(issues.some((i) => i.startsWith("guaranteed_roi") || i === "guaranteed_roi")).toBe(true);
  });

  it("détecte 100% autonome", () => {
    const issues = lintContent({ text: "Pierre est 100% autonome" });
    expect(issues).toContain("fully_autonomous");
  });

  it("détecte fausse urgence / discount", () => {
    expect(lintContent({ text: "Offre limitée — dépêchez-vous !" })).toContain("artificial_urgency");
    expect(lintContent({ text: "Essai gratuit 7 jours" })).toContain("invented_discount");
  });

  it("détecte prix divergent (199€/mois)", () => {
    const issues = lintContent({ text: "Pierre à 199€/mois" });
    expect(issues.some((i) => i === "wrong_price:199")).toBe(true);
  });

  it("accepte le prix correct 449 €/mois", () => {
    const issues = lintContent({ text: "Pierre à 449 €/mois" });
    expect(issues.some((i) => i.startsWith("wrong_price"))).toBe(false);
  });

  it("mode real_activation refuse les claims pending", () => {
    const r = lintReport({
      text: "Pierre s'adapte à votre entreprise (CloneADN).",
      claimIds: ["company_adaptation"],
      mode: "real_activation",
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.startsWith("non_activatable_claim:company_adaptation"))).toBe(true);
  });

  it("mode shadow accepte les claims pending", () => {
    const r = lintReport({
      text: "Pierre s'adapte à votre entreprise.",
      claimIds: ["company_adaptation"],
      mode: "shadow",
    });
    expect(r.ok).toBe(true);
  });
});
