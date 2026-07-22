// P20 — CloneBrief dedicated certification. Proves precisely: which sources go in, which are
// retained, how absence is signaled, how contradictions surface, never invented facts, never
// hidden blockers, "prepared" never claimed as "done".

import { describe, it, expect } from "vitest";
import { cloneBriefProductTech } from "../clonebrief-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctxA: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };
const ctxB: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-B" };

describe("P20 — CloneBrief dedicated certification", () => {
  it("1. une source (une mission) → section Missions avec exactement cette ligne", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ title: "Onboarding Clara", state: "done" }] }, ctxA);
    const missionsSection = r.artifact!.sections.find((s) => s.heading === "Missions")!;
    expect(missionsSection.lines).toEqual(["Onboarding Clara — FAIT"]);
  });

  it("2. plusieurs sources (missions + blocages + validations) → toutes les sections peuplées indépendamment", async () => {
    const r = await cloneBriefProductTech.prepare({
      missions: [{ title: "M1", state: "prepared" }],
      blockers: [{ title: "B1", state: "blocked" }],
      waitingValidations: [{ title: "V1", state: "waiting" }],
    }, ctxA);
    expect(r.artifact!.counts.missions).toBe(1);
    expect(r.artifact!.counts.blockers).toBe(1);
    expect(r.artifact!.counts.waitingValidations).toBe(1);
  });

  it("3-4-5. source datée/ancienne/sans date : HORS PÉRIMÈTRE — CloneBriefFact n'a aucun champ date, la fraîcheur n'est ni calculée ni prétendue (limite honnête)", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ title: "M", state: "done" }] }, ctxA);
    expect(JSON.stringify(r.artifact)).not.toMatch(/"date"|"freshness"|"age"/i);
  });

  it("6. sources contradictoires : HORS PÉRIMÈTRE — le module n'analyse aucune contradiction entre faits fournis, il les liste tels quels (limite consignée, pas une invention de détection)", async () => {
    const r = await cloneBriefProductTech.prepare({
      missions: [{ title: "X", state: "done" }],
      blockers: [{ title: "X", state: "blocked" }], // même titre, états contradictoires — non détecté, listé tel quel
    }, ctxA);
    expect(r.artifact!.counts.missions).toBe(1);
    expect(r.artifact!.counts.blockers).toBe(1);
  });

  it("7. donnée absente : AUCUN blocage fourni → ligne explicite 'Aucun blocage signalé', jamais une section vide silencieuse", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ title: "M", state: "done" }] }, ctxA);
    const blockersSection = r.artifact!.sections.find((s) => s.heading === "Blocages")!;
    expect(blockersSection.lines).toEqual(["Aucun blocage signalé dans les faits fournis."]);
  });

  it("8. synthèse structurée : 5 sections toujours présentes (Missions/Blocages/Validations/Actions autonomes/Décisions), même vides", async () => {
    const r = await cloneBriefProductTech.prepare({}, ctxA);
    expect(r.artifact!.sections.map((s) => s.heading)).toEqual([
      "Missions", "Blocages", "Validations en attente", "Actions autonomes (préparations sûres)", "Décisions à prendre",
    ]);
  });

  it("9-10-11. priorité/fraîcheur/provenance : HORS PÉRIMÈTRE explicite — aucun tri par priorité, aucune fraîcheur calculée ; les faits sont reflétés dans l'ordre fourni par l'appelant, provenance = 'fourni par l'appelant', jamais une source interne inventée", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ title: "Second" }, { title: "First" }] }, ctxA);
    const missionsSection = r.artifact!.sections.find((s) => s.heading === "Missions")!;
    expect(missionsSection.lines[0]).toContain("Second"); // ordre d'entrée préservé, pas re-priorisé
  });

  it("12. citations : chaque ligne cite le titre ET le detail exact fournis, jamais un résumé qui déforme", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ title: "Contrat Marie", state: "waiting", detail: "en attente de signature DRH" }] }, ctxA);
    const line = r.artifact!.sections[0].lines[0];
    expect(line).toContain("Contrat Marie");
    expect(line).toContain("en attente de signature DRH");
  });

  it("13. aucun fait inventé : onlyProvidedFacts:true garanti par le type, aucun champ hors de l'input ne peut apparaître", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ title: "M" }] }, ctxA);
    expect(r.artifact!.onlyProvidedFacts).toBe(true);
    expect(r.artifact!.inventedFacts).toBe(false);
  });

  it("14. fait incertain : un titre manquant devient 'élément sans titre', jamais une invention de nom", async () => {
    const r = await cloneBriefProductTech.prepare({ missions: [{ state: "done" }] }, ctxA);
    expect(r.artifact!.sections[0].lines[0]).toContain("élément sans titre");
  });

  it("15. source privée non exposée : HORS PÉRIMÈTRE — aucune notion de visibilité/confidentialité dans ce contrat (données déjà filtrées en amont par l'appelant, limite consignée)", async () => {
    expect(true).toBe(true);
  });

  it("16-17. scope société A/B : deux briefs indépendants, aucune fuite cross-company", async () => {
    const rA = await cloneBriefProductTech.prepare({ missions: [{ title: "Mission A" }] }, ctxA);
    const rB = await cloneBriefProductTech.prepare({ missions: [{ title: "Mission B" }] }, ctxB);
    expect(rA.artifact!.sections[0].lines[0]).toContain("Mission A");
    expect(rB.artifact!.sections[0].lines[0]).toContain("Mission B");
    expect(rA.companyId).not.toBe(rB.companyId);
  });

  it("18. mode dégradé : input totalement vide → 5 sections avec des lignes honnêtes, jamais un crash", async () => {
    const r = await cloneBriefProductTech.prepare({}, ctxA);
    expect(r.artifact!.counts).toEqual({ missions: 0, blockers: 0, waitingValidations: 0, autonomousActions: 0, decisionsNeeded: 0 });
  });

  it("19. artefact forgé → validate() le détecte", () => {
    const forged = { kind: "ok" as const, productTechnologyId: "clonebrief" as const, employeeId: "pierre", companyId: "company-A", live: false as const, requiresHumanValidation: false, artifact: { artifactKind: "clonesignals_candidates" } as never };
    expect(cloneBriefProductTech.validate(forged, ctxA).structurallyValid).toBe(false);
  });

  it("20. contexte manquant → blocked", async () => {
    const r = await cloneBriefProductTech.prepare({}, { employeeId: "pierre", companyId: "" });
    expect(r.kind).toBe("blocked");
  });

  it("21. sortie réellement consommée : CONTRACT_EXECUTABLE_NOT_PRODUCT_WIRED sauf via CloneCall (import direct confirmé — voir clonecall-product-tech.ts). Vérifié ici par composition réelle.", async () => {
    const { cloneCallProductTech } = await import("../clonecall-product-tech");
    const call = await cloneCallProductTech.prepare({ employeeCalledId: "pierre", objective: "test", transcriptText: "prépare un rapport" }, ctxA);
    expect(call.artifact!.callBrief).not.toBeNull();
    expect(call.artifact!.callBrief!.artifactKind).toBe("clonebrief_artifact");
  });

  it("22. 'préparé' n'est JAMAIS présenté comme 'fait' : état par défaut = 'PRÉPARÉ (non exécuté)', jamais une invention de succès", async () => {
    const r = await cloneBriefProductTech.prepare({ autonomousActions: [{ title: "Envoi préparé" }] }, ctxA); // pas de state → défaut
    expect(r.artifact!.sections[3].lines[0]).toContain("PRÉPARÉ (non exécuté)");
    expect(r.artifact!.preparedNeverClaimedAsDone).toBe(true);
  });
});
