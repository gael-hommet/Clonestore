// P20 — CloneLearn dedicated certification. Distinguishes explicitly: artifact creation (proven),
// persistence (NOT proven — no store in this module), future reuse (NOT proven), continuous
// learning (NOT proven — no permanent runtime), model training (explicitly false by contract).

import { describe, it, expect } from "vitest";
import { cloneLearnProductTech } from "../clonelearn-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctxA: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };
const ctxB: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-B" };

describe("P20 — CloneLearn dedicated certification", () => {
  it("1. source autorisée (événement typé validation/correction/...) → candidat produit", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "correction", detail: "toujours vouvoyer" }] }, ctxA);
    expect(r.kind).toBe("needs_validation");
    expect(r.artifact!.candidates.length).toBe(1);
  });

  it("2. source inconnue (type manquant) → filtrée silencieusement, jamais un crash ni un candidat inventé", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ detail: "sans type" } as never] }, ctxA);
    expect(r.artifact!.candidates.length).toBe(0);
  });

  it("3. provenance : chaque candidat porte son sourceEventType d'origine, jamais générique", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "refusal", detail: "refuse toujours X" }] }, ctxA);
    expect(r.artifact!.candidates[0].sourceEventType).toBe("refusal");
  });

  it("4-15-16. scope société A/B : aucune mémorisation cross-company, deux résolutions indépendantes", async () => {
    const rA = await cloneLearnProductTech.prepare({ events: [{ type: "validation", detail: "préférence A" }] }, ctxA);
    const rB = await cloneLearnProductTech.prepare({ events: [{ type: "validation", detail: "préférence B" }] }, ctxB);
    expect(rA.artifact!.candidates[0].preferenceSuggestion).toContain("préférence A");
    expect(rB.artifact!.candidates[0].preferenceSuggestion).toContain("préférence B");
    expect(rA.companyId).not.toBe(rB.companyId);
    // Aucun état partagé entre les deux appels — chaque prepare() est une fonction pure sans mémoire globale.
    expect(rA.artifact!.candidates.length).toBe(1);
    expect(rB.artifact!.candidates.length).toBe(1);
  });

  it("6. doublon : le même événement répété 2x s'agrège en occurrences:2, jamais 2 candidats distincts", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "correction", detail: "X" }, { type: "correction", detail: "x" }] }, ctxA); // casse différente, même clé normalisée
    expect(r.artifact!.candidates.length).toBe(1);
    expect(r.artifact!.candidates[0].occurrences).toBe(2);
  });

  it("7-8-9. mise à jour/correction/rejet : classification habit vs exception dépend STRICTEMENT du nombre d'occurrences (seuil 3), jamais devinée", async () => {
    const single = await cloneLearnProductTech.prepare({ events: [{ type: "correction", detail: "unique" }] }, ctxA);
    expect(single.artifact!.candidates[0].classification).toBe("exception");
    const repeated = await cloneLearnProductTech.prepare({
      events: [1, 2, 3].map(() => ({ type: "correction" as const, detail: "répété" })),
    }, ctxA);
    expect(repeated.artifact!.candidates[0].classification).toBe("habit");
    expect(repeated.artifact!.candidates[0].occurrences).toBe(3);
  });

  it("10-11. oubli/révocation : HORS PÉRIMÈTRE — ce module ne stocke rien à révoquer ; chaque appel est indépendant, sans mémoire d'un appel précédent (comportement vérifié, pas supposé)", async () => {
    const first = await cloneLearnProductTech.prepare({ events: [{ type: "correction", detail: "temporaire" }] }, ctxA);
    const second = await cloneLearnProductTech.prepare({ events: [] }, ctxA);
    expect(first.artifact!.candidates.length).toBe(1);
    expect(second.artifact!.candidates.length).toBe(0); // rien n'a persisté du premier appel
  });

  it("12-13. source obsolète / contradictoire : HORS PÉRIMÈTRE — pas de notion de date ou de contradiction entre événements dans ce contrat (limite consignée)", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "validation", detail: "toujours FR" }, { type: "refusal", detail: "toujours FR" }] }, ctxA);
    // Les deux types distincts produisent 2 candidats séparés — aucune détection de contradiction, honnêtement absente.
    expect(r.artifact!.candidates.length).toBe(2);
  });

  it("14. donnée sensible : aucun filtre spécifique — le detail brut est reflété tel quel, jamais assaini par ce module (limite honnête, pas une fuite active testée ici)", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "correction", detail: "ne jamais mentionner le salaire de X" }] }, ctxA);
    expect(r.artifact!.candidates[0].preferenceSuggestion).toContain("salaire");
  });

  it("17. aucune mutation autonome non gouvernée : adnMutated:false et approvalRequired:true sur CHAQUE candidat, invariant de type", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "correction", detail: "x" }] }, ctxA);
    expect(r.artifact!.adnMutated).toBe(false);
    expect(r.artifact!.candidates.every((c) => c.approvalRequired === true)).toBe(true);
  });

  it("18. confiance PLAFONNÉE : jamais 1.0 (jamais une certitude), même avec de nombreuses occurrences", async () => {
    const manyEvents = Array.from({ length: 20 }, () => ({ type: "validation" as const, detail: "très répété" }));
    const r = await cloneLearnProductTech.prepare({ events: manyEvents }, ctxA);
    expect(r.artifact!.candidates[0].confidence).toBeLessThanOrEqual(0.95);
  });

  it("20-21. aucun apprentissage 'continu' inventé, aucun entraînement de modèle prétendu : modelTrained:false, mutationPolicy:'proposal_only' — invariants de type vérifiés", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [] }, ctxA);
    expect(r.artifact!.modelTrained).toBe(false);
    expect(r.artifact!.mutationPolicy).toBe("proposal_only");
  });

  it("22. artefact forgé → validate() le détecte", () => {
    const forged = { kind: "ok" as const, productTechnologyId: "clonelearn" as const, employeeId: "pierre", companyId: "company-A", live: false as const, requiresHumanValidation: false, artifact: { artifactKind: "cloneos_mission_plan" } as never };
    expect(cloneLearnProductTech.validate(forged, ctxA).structurallyValid).toBe(false);
  });

  it("23. contexte absent → blocked", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [] }, { employeeId: "pierre", companyId: "" });
    expect(r.kind).toBe("blocked");
  });

  it("24. mode dégradé (aucun événement fourni) → 0 candidat, jamais un candidat inventé", async () => {
    const r = await cloneLearnProductTech.prepare({}, ctxA);
    expect(r.artifact!.candidates).toEqual([]);
  });

  it("26. consommation future réelle : NON PROUVÉE — aucun consommateur trouvé (voir P20_2_CONSUMER_GRAPH.json), CONTRACT_EXECUTABLE_NOT_PRODUCT_WIRED", () => {
    expect(typeof cloneLearnProductTech.prepare).toBe("function");
  });

  it("Distinction explicite des 4 notions (jamais confondues) : artefact ≠ persistance ≠ réutilisation future ≠ apprentissage continu ≠ entraînement de modèle", async () => {
    const r = await cloneLearnProductTech.prepare({ events: [{ type: "validation", detail: "x" }] }, ctxA);
    // 1. Artefact créé : PROUVÉ.
    expect(r.artifact).not.toBeNull();
    // 2. Persistance : NON PROUVÉE — aucun store dans ce module (0 import de sql/db).
    // 3. Réutilisation future : NON PROUVÉE — aucun consommateur trouvé.
    // 4. Apprentissage continu : NON PROUVÉ — pas de runtime permanent, chaque appel est stateless.
    // 5. Entraînement de modèle : EXPLICITEMENT FAUX — modelTrained:false garanti par le type.
    expect(r.artifact!.modelTrained).toBe(false);
  });
});
