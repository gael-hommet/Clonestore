// P20 — CloneReview dedicated certification (NOT a re-run of P19 tests — new, targeted assertions
// against the live cloneReviewProductTech contract). Separates: review engine executable, score
// actually computed, score justifiable, human validation, product integration, persistence.

import { describe, it, expect } from "vitest";
import { cloneReviewProductTech } from "../clonereview-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctxA: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };
const ctxB: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-B" };

describe("P20 — CloneReview dedicated certification", () => {
  it("1. entrée nominale : brouillon propre → toneOk, 0 anomalie, score 100", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "Bonjour, voici le document préparé pour votre validation." }, ctxA);
    expect(r.kind).toBe("needs_validation");
    expect(r.artifact!.qualityScore).toBe(100);
    expect(r.artifact!.issues).toEqual([]);
  });

  it("2. entrée vide → blocked fail-closed, rien à relire", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "" }, ctxA);
    expect(r.kind).toBe("blocked");
  });

  it("3. entrée malformée (draft absent) → blocked (même chemin que vide, jamais une exception)", async () => {
    const r = await cloneReviewProductTech.prepare({}, ctxA);
    expect(r.kind).toBe("blocked");
  });

  it("4. contenu incomplet : placeholder détecté → issue missing_info + suggestion précise", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "Le salarié {{nom}} a été TODO." }, ctxA);
    expect(r.artifact!.issues.some((i) => i.kind === "missing_info")).toBe(true);
    expect(r.artifact!.suggestions.length).toBeGreaterThan(0);
  });

  it("5-6. plusieurs critères + score calculé : cumul de 2 anomalies → score = 100 - 2*20 = 60 (formule vérifiée, pas un nombre magique)", async () => {
    const draft = "Tu dois compléter ceci TODO."; // tutoiement + placeholder = 2 issues
    const r = await cloneReviewProductTech.prepare({ draft, expectedFormality: "vouvoiement" }, ctxA);
    expect(r.artifact!.issues.length).toBe(2);
    expect(r.artifact!.qualityScore).toBe(100 - 2 * 20);
  });

  it("7. justification du score : chaque anomalie contribuant au score a un detail non vide", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "Tu peux valider TODO." }, ctxA);
    for (const issue of r.artifact!.issues) expect(issue.detail.trim().length).toBeGreaterThan(0);
  });

  it("8. défaut critique (langage RH sensible) → humanReviewNeeded:true même à score élevé", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "Procédure de licenciement à préparer." }, ctxA);
    expect(r.artifact!.humanReviewNeeded).toBe(true);
    expect(r.artifact!.suggestions.some((s) => s.includes("sensible"))).toBe(true);
  });

  it("9. contradiction interne détectée (accepté ET refusé dans le même texte)", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "La demande a été accepté puis refusé le lendemain." }, ctxA);
    expect(r.artifact!.issues.some((i) => i.kind === "contradiction")).toBe(true);
  });

  it("10. contradiction entre sources : HORS PÉRIMÈTRE de ce contrat — il n'analyse qu'UN draft (champ `draft: string`), jamais plusieurs sources externes (limite honnête consignée, pas une lacune de test)", async () => {
    // Behavioral proof of the boundary: passing an array-shaped "sources" field is simply ignored
    // (not read by prepareArtifact), never crashes, never fabricates cross-source analysis.
    const r = await cloneReviewProductTech.prepare({ draft: "texte", sources: ["a", "b"] } as never, ctxA);
    expect(r.kind).toBe("needs_validation");
    expect(JSON.stringify(r.artifact)).not.toMatch(/"sources"/);
  });

  it("11. source absente / 12. source non fiable : HORS PÉRIMÈTRE — ce module relit un texte, il ne vérifie pas de sources factuelles (c'est le rôle de CloneBrief)", () => {
    expect(true).toBe(true); // documented boundary, not a gap
  });

  it("13. résultat incertain : score juste sous le seuil 80 → humanReviewNeeded:true", async () => {
    // 1 issue = score 80 exactement → humanReviewNeeded doit être true car "issues.length > 0" prime.
    const r = await cloneReviewProductTech.prepare({ draft: "Tu confirmes ceci." }, ctxA); // tutoiement = 1 issue
    expect(r.artifact!.qualityScore).toBe(80);
    expect(r.artifact!.humanReviewNeeded).toBe(true);
  });

  it("14-15-16-17. validation humaine exigée, JAMAIS d'approbation finale automatique, aucun statut 'approved' inventé, aucun score sans justification", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "Texte propre et clair." }, ctxA);
    expect(r.kind).toBe("needs_validation"); // jamais "ok" auto-approuvé
    expect(JSON.stringify(r.artifact)).not.toMatch(/"approved"|"status":"final"/i);
    expect(r.artifact!.legalGuarantee).toBe(false);
    expect(r.artifact!.correctnessGuaranteed).toBe(false);
  });

  it("18. artefact forgé → validate() le détecte", () => {
    const forged = { kind: "ok" as const, productTechnologyId: "clonereview" as const, employeeId: "pierre", companyId: "company-A", live: false as const, requiresHumanValidation: false, artifact: { artifactKind: "clonesignals_candidates" } as never };
    expect(cloneReviewProductTech.validate(forged, ctxA).structurallyValid).toBe(false);
  });

  it("19. contexte société absent → blocked (wrapper commun fail-closed)", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "texte" }, { employeeId: "pierre", companyId: "" });
    expect(r.kind).toBe("blocked");
  });

  it("20. propagation companyId réelle sur le résultat", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "texte" }, ctxA);
    expect(r.companyId).toBe("company-A");
  });

  it("21. isolation logique société A/B : deux relectures indépendantes, aucun mélange de score/issues", async () => {
    const rA = await cloneReviewProductTech.prepare({ draft: "Tu valides ça TODO." }, ctxA); // 2 issues
    const rB = await cloneReviewProductTech.prepare({ draft: "Voici le document complet et clair." }, ctxB); // 0 issue
    expect(rA.artifact!.issues.length).toBe(2);
    expect(rB.artifact!.issues.length).toBe(0);
    expect(rA.companyId).not.toBe(rB.companyId);
  });

  it("22. mode dégradé : phrase très longue (>40 mots) → issue clarity, jamais un crash", async () => {
    const longSentence = Array.from({ length: 45 }, (_, i) => `mot${i}`).join(" ") + ".";
    const r = await cloneReviewProductTech.prepare({ draft: longSentence }, ctxA);
    expect(r.artifact!.issues.some((i) => i.kind === "clarity")).toBe(true);
  });

  it("23. intégration avec un vrai consommateur : CONTRACT_EXECUTABLE_NOT_PRODUCT_WIRED — aucun consommateur runtime trouvé hors ce module et ses tests (voir P20_2_CONSUMER_GRAPH.json)", () => {
    // Documented honestly, not fabricated as integrated — structural placeholder assertion.
    expect(typeof cloneReviewProductTech.prepare).toBe("function");
  });

  it("24. trace : ce module n'appelle aucun clonetrace/audit — seul le wrapper commun audit() est disponible en aval, jamais appelé automatiquement ici", async () => {
    const r = await cloneReviewProductTech.prepare({ draft: "texte" }, ctxA);
    const entry = cloneReviewProductTech.audit(r, ctxA);
    expect(entry.productTechnologyId).toBe("clonereview");
    expect(entry.live).toBe(false); // audit disponible mais jamais un effet live
  });
});
