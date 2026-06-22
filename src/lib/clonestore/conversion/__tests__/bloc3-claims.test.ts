import { describe, it, expect } from "vitest";
import { CLAIMS_REGISTRY, buildEvidenceMatrix, listClaimsByStatus } from "../claims-registry";
import { lintSurfaceCopy } from "../claims-linter";

describe("BLOC 3 — claims registry", () => {
  it("toutes les claims VERIFIED_PRODUCT_FACT ont au moins une pièce d'evidence", () => {
    for (const c of Object.values(CLAIMS_REGISTRY)) {
      if (c.status === "VERIFIED_PRODUCT_FACT") {
        expect(c.evidence.length).toBeGreaterThan(0);
        expect(c.authorizedText.length).toBeGreaterThan(0);
      }
    }
  });

  it("buildEvidenceMatrix retourne 6 entrées", () => {
    expect(buildEvidenceMatrix().length).toBe(6);
  });

  it("liste les claims pending", () => {
    const pending = listClaimsByStatus("PENDING_CLONESTORE_PRODUCT_VERIFICATION");
    // company_adaptation est conservé pending tant que l'Empreinte produit n'est pas
    // entièrement reflétée dans la démo publique.
    expect(pending.map((c) => c.id)).toContain("company_adaptation");
  });
});

describe("BLOC 3 — claims linter", () => {
  it("détecte une fausse promesse temporelle", () => {
    const report = lintSurfaceCopy({ surface: "landing", text: "Pierre prépare votre RH en deux minutes." });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "FAKE_DURATION_PROMISE")).toBe(true);
  });

  it("détecte une garantie", () => {
    const report = lintSurfaceCopy({ surface: "pricing", text: "Satisfaction garantie pour vos équipes RH." });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "FAKE_GUARANTEE")).toBe(true);
  });

  it("détecte un faux 100% automatique", () => {
    const r = lintSurfaceCopy({ surface: "demo", text: "Pierre est 100% automatique sur l'absentéisme." });
    expect(r.issues.some((i) => i.code === "FAKE_FULL_AUTOMATION")).toBe(true);
  });

  it("détecte un ROI inventé", () => {
    const r = lintSurfaceCopy({ surface: "result", text: "+42% de productivité RH constatés." });
    expect(r.issues.some((i) => i.code === "FAKE_ROI")).toBe(true);
  });

  it("détecte une certification ISO non prouvée", () => {
    const r = lintSurfaceCopy({ surface: "landing", text: "Solution certifiée ISO 27001 et conforme HDS." });
    expect(r.issues.some((i) => i.code === "FAKE_CERTIFICATION")).toBe(true);
  });

  it("détecte un drift de prix", () => {
    const r = lintSurfaceCopy({ surface: "pricing", text: "Découvrez Pierre à 499 € /mois." });
    expect(r.issues.some((i) => i.code === "PRICE_DRIFT")).toBe(true);
  });

  it("accepte un texte propre 449 €", () => {
    const r = lintSurfaceCopy({
      surface: "pricing",
      text: "Pierre — 449 € HT/mois. Validation humaine obligatoire pour les actes sensibles.",
      referencedClaimIds: ["pierre_price_449", "human_validation"],
    });
    expect(r.ok).toBe(true);
  });

  it("refuse une claim sur une surface où elle n'est pas autorisée", () => {
    const r = lintSurfaceCopy({
      surface: "checkout_copy",
      text: "Pierre s'adapte à votre entreprise.",
      referencedClaimIds: ["company_adaptation"],
    });
    expect(r.issues.some((i) => i.code === "CLAIM_NOT_ALLOWED_ON_SURFACE")).toBe(true);
  });
});
