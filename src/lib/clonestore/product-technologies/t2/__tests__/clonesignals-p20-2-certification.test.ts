// src/lib/clonestore/product-technologies/t2/__tests__/clonesignals-p20-2-certification.test.ts
// P20.2 — CloneSignals real certification (LOT A: independent, local, no remote provider, no
// conflict with C1.8 or P20.1). Exercises the REAL contract wrapper (defineProductTechnologyContract)
// through cloneSignalsProductTech.prepare/validate/audit — not a description, a live execution.

import { describe, it, expect } from "vitest";
import { cloneSignalsProductTech } from "../clonesignals-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctxA: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };
const ctxB: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-B" };

describe("P20.2 — CloneSignals certification", () => {
  it("A. chemin nominal : entrée valide → candidats corrects, needs_validation (jamais un effet direct)", async () => {
    const result = await cloneSignalsProductTech.prepare(
      { missionId: "m1", waitingValidationSinceHours: 50, deadlineInHours: 6 },
      ctxA,
    );
    expect(result.kind).toBe("needs_validation");
    const artifact = result.artifact!;
    expect(artifact.artifactKind).toBe("clonesignals_candidates");
    expect(artifact.candidates.length).toBe(2);
    expect(artifact.candidates.some((c) => c.signalKind === "validation_late")).toBe(true);
    expect(artifact.candidates.some((c) => c.signalKind === "deadline_approaching" && c.proposedAction === "escalate")).toBe(true);
    expect(artifact.liveSchedulerUsed).toBe(false);
    expect(artifact.cronCreated).toBe(false);
    expect(artifact.notificationSentLive).toBe(false);
  });

  it("B. entrée invalide/vide : aucune exception, 0 candidat, jamais un effet partiel", async () => {
    const result = await cloneSignalsProductTech.prepare({}, ctxA);
    expect(result.kind).toBe("needs_validation");
    expect(result.artifact!.candidates).toEqual([]);
  });

  it("C. contexte manquant (companyId absent) → blocked fail-closed, jamais un faux succès", async () => {
    const result = await cloneSignalsProductTech.prepare(
      { missionId: "m1" },
      { employeeId: "pierre", companyId: "" },
    );
    expect(result.kind).toBe("blocked");
    expect(result.blockedReason).toBeTruthy();
  });

  it("D. intention d'effet live détectée dans l'input (backstop T1 réutilisé) → blocked, jamais exécuté", async () => {
    const result = await cloneSignalsProductTech.prepare(
      { missionId: "m1", live: true } as never,
      ctxA,
    );
    expect(result.kind).toBe("blocked");
  });

  it("E. idempotence structurelle : deux appels identiques produisent le même verdict de candidats (pas de double effet, aucun état muté)", async () => {
    const input = { missionId: "m1", missionIdleHours: 130 };
    const r1 = await cloneSignalsProductTech.prepare(input, ctxA);
    const r2 = await cloneSignalsProductTech.prepare(input, ctxA);
    expect(r1.artifact!.candidates).toEqual(r2.artifact!.candidates);
  });

  it("F. isolation tenant : le missionId d'une société n'est jamais mélangé avec une autre (ctx companyId distinct, artefacts indépendants)", async () => {
    const rA = await cloneSignalsProductTech.prepare({ missionId: "m-A", waitingValidationSinceHours: 200 }, ctxA);
    const rB = await cloneSignalsProductTech.prepare({ missionId: "m-B", waitingValidationSinceHours: 10 }, ctxB);
    expect(rA.artifact!.missionId).toBe("m-A");
    expect(rB.artifact!.missionId).toBe("m-B");
    expect(rA.companyId).toBe("company-A");
    expect(rB.companyId).toBe("company-B");
    // société B n'a pas atteint le seuil (10h < 48h) — aucun candidat, jamais un repli sur les données de A.
    expect(rB.artifact!.candidates.length).toBe(0);
  });

  it("G. données sensibles : le detail d'un candidat n'expose jamais de secret/token, uniquement les faits fournis", async () => {
    const result = await cloneSignalsProductTech.prepare({ missionId: "m1", missingDocuments: ["contrat.pdf"] }, ctxA);
    const text = JSON.stringify(result.artifact);
    expect(text).not.toMatch(/api[_-]?key|secret|password|bearer/i);
  });

  it("H. gouvernance : validate() exige toujours une validation humaine (requiresValidation:true déclaré au contrat)", () => {
    expect(cloneSignalsProductTech.requiresValidation).toBe(true);
  });

  it("I. audit : audit() produit une entrée exploitable pour CHAQUE résultat (y compris blocked)", async () => {
    const blocked = await cloneSignalsProductTech.prepare({ missionId: "m1" }, { employeeId: "pierre", companyId: "" });
    const entry = cloneSignalsProductTech.audit(blocked, { employeeId: "pierre", companyId: "" });
    expect(entry.resultKind).toBe("blocked");
    expect(entry.live).toBe(false);
    expect(entry.note.length).toBeGreaterThan(0);
  });

  it("J. validation structurelle : validate() détecte un artefact forgé (artifactKind étranger)", () => {
    const forged = {
      kind: "ok" as const, productTechnologyId: "clonesignals" as const, employeeId: "pierre", companyId: "company-A",
      live: false as const, requiresHumanValidation: false,
      artifact: { artifactKind: "cloneos_mission_plan", candidates: [] } as never,
    };
    const report = cloneSignalsProductTech.validate(forged, ctxA);
    expect(report.structurallyValid).toBe(false);
  });
});
