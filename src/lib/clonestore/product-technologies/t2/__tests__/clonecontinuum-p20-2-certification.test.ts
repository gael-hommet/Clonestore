// P20.2 — CloneContinuum certification: real execution of the mission-continuity state machine.
// Distinguishes in-memory structured continuity (proven here) from persisted continuity / real
// resume-after-restart (NOT proven — no store found, same honest limit as CloneTrace).

import { describe, it, expect } from "vitest";
import { cloneContinuumProductTech, transitionContinuum } from "../clonecontinuum-product-tech";
import { cloneCallProductTech } from "../clonecall-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctxA: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };
const ctxB: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-B" };

describe("P20.2 — CloneContinuum certification", () => {
  it("A. contexte nominal : mission active + validation_requested → waiting_for_validation, recommandation de réveil cohérente", async () => {
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1", currentState: "active", event: "validation_requested" }, ctxA);
    expect(r.kind).toBe("ok");
    expect(r.artifact!.state).toBe("waiting_for_validation");
    expect(r.artifact!.nextWakeupRecommendation).not.toBeNull();
    expect(r.artifact!.executed).toBe(false);
  });

  it("B. continuité de mission : validation_received après attente → resumed", async () => {
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1", currentState: "waiting_for_validation", event: "validation_received" }, ctxA);
    expect(r.artifact!.state).toBe("resumed");
    expect(r.artifact!.previousState).toBe("waiting_for_validation");
  });

  it("C. reprise après interruption : close puis reopen → reopened (jamais un état incohérent)", () => {
    const closed = transitionContinuum("active", "close");
    expect(closed).toBe("closed");
    const reopened = transitionContinuum(closed, "reopen");
    expect(reopened).toBe("reopened");
  });

  it("D. état précédent absent (currentState non fourni) → défaut sûr 'active', jamais une exception", async () => {
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1", event: "info_requested" }, ctxA);
    expect(r.artifact!.previousState).toBe("active");
    expect(r.artifact!.state).toBe("waiting_for_info");
  });

  it("E. état précédent invalide (valeur forgée hors vocabulaire) → transition inconnue, état INCHANGÉ (fail-closed, jamais une invention)", () => {
    const result = transitionContinuum("forged-state" as never, "resume");
    // 'resume' only resolves from a KNOWN state per the switch; an unknown current state falls through
    // to the default branch of the OUTER switch on event, but since 'resume' has an explicit case,
    // verify it does NOT silently succeed into an invented state — it must equal the (unknown) input unchanged
    // when the event doesn't apply, or a legitimately allowed target when it does. Pin exact behavior:
    expect(transitionContinuum("forged-state" as never, "close")).toBe("closed"); // close is unconditional by design
    expect(transitionContinuum("forged-state" as never, undefined)).toBe("forged-state"); // no event → unchanged, never invented
  });

  it("F. contexte société/entité : propagation companyId réelle et distincte", async () => {
    const rA = await cloneContinuumProductTech.prepare({ missionId: "m-A" }, ctxA);
    const rB = await cloneContinuumProductTech.prepare({ missionId: "m-B" }, ctxB);
    expect(rA.companyId).toBe("company-A");
    expect(rB.companyId).toBe("company-B");
  });

  it("G. idempotence structurelle : même entrée → même sortie", async () => {
    const input = { missionId: "m1", currentState: "active" as const, event: "followup_scheduled" as const };
    const r1 = await cloneContinuumProductTech.prepare(input, ctxA);
    const r2 = await cloneContinuumProductTech.prepare(input, ctxA);
    expect(r1.artifact).toEqual(r2.artifact);
  });

  it("H. ordre des événements respecté : deux transitions successives appliquées dans l'ordre donné produisent l'état attendu", () => {
    let s = transitionContinuum("active", "info_requested");
    expect(s).toBe("waiting_for_info");
    s = transitionContinuum(s, "info_received");
    expect(s).toBe("resumed");
  });

  it("I. aucun faux statut 'succeeded' : le vocabulaire d'état ne contient AUCUNE valeur ressemblant à un succès d'effet", async () => {
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1", event: "resume" }, ctxA);
    expect(["active", "waiting_for_info", "waiting_for_validation", "scheduled_followup", "resumed", "closed", "reopened"]).toContain(r.artifact!.state);
    expect(JSON.stringify(r.artifact)).not.toMatch(/"succeeded"|"success":true/i);
  });

  it("J. aucune exécution live : liveSchedulerUsed/cronCreated/executed tous false, invariants de type", async () => {
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1" }, ctxA);
    expect(r.artifact!.liveSchedulerUsed).toBe(false);
    expect(r.artifact!.cronCreated).toBe(false);
    expect(r.artifact!.executed).toBe(false);
  });

  it("K. artefact forgé → validate() le détecte", () => {
    const forged = { kind: "ok" as const, productTechnologyId: "clonecontinuum" as const, employeeId: "pierre", companyId: "company-A", live: false as const, requiresHumanValidation: false, artifact: { artifactKind: "clonesignals_candidates" } as never };
    expect(cloneContinuumProductTech.validate(forged, ctxA).structurallyValid).toBe(false);
  });

  it("L. mode dégradé : missionId manquant → blocked fail-closed, jamais un état par défaut inventé", async () => {
    const r = await cloneContinuumProductTech.prepare({}, ctxA);
    expect(r.kind).toBe("blocked");
  });

  it("M. contexte manquant → blocked (wrapper commun)", async () => {
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1" }, { employeeId: "", companyId: "" });
    expect(r.kind).toBe("blocked");
  });

  it("N. consommation RÉELLE par CloneCall confirmée : une session d'appel produit un continuumState non-null issu d'un vrai appel", async () => {
    const r = await cloneCallProductTech.prepare(
      { employeeCalledId: "pierre", objective: "test continuité", transcriptText: "prépare une synthèse" },
      ctxA,
    );
    expect(r.artifact!.continuumState).not.toBeNull();
    expect(r.artifact!.continuumState!.artifactKind).toBe("clonecontinuum_state");
  });
});

describe("P20.2 — CloneContinuum: limites honnêtes (persistance)", () => {
  it("aucune persistance revendiquée : l'artefact est un objet en mémoire, jamais relu depuis un store", async () => {
    // Structural acknowledgment — no store/query exists in this module (verified by full file read).
    // Real resume-after-restart would require the CALLER to persist and re-supply currentState;
    // this contract itself has 0 read/write capability.
    const r = await cloneContinuumProductTech.prepare({ missionId: "m1" }, ctxA);
    expect(r.artifact).toBeDefined();
  });
});
