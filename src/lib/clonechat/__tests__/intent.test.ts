import { describe, it, expect } from "vitest";
import { classifyIntent, extractEntities, isPublicAllowed } from "../intent";

describe("CloneChat — classification d'intention déterministe", () => {
  const cases: Array<[string, string]> = [
    ["Crée une mission pour préparer le contrat CDI de Marie", "create_mission"],
    ["Prépare une attestation de travail pour Karim", "create_mission"],
    ["Où en est Pierre ?", "list_missions"],
    ["Montre-moi les missions en cours", "list_missions"],
    ["Qu'est-ce qui attend ma validation ?", "list_validations"],
    ["Pourquoi cette validation est demandée ?", "explain_validation"],
    ["Montre le dossier de Sophie Martin", "open_employee"],
    ["Liste mes salariés", "list_employees"],
    ["Retrouve le contrat de Marie", "find_document"],
    ["Fais un résumé de l'activité", "summarize"],
    ["Qu'est-ce que Pierre ?", "explain"],
    ["Combien coûte Pierre ?", "explain"],
    ["Aide", "help"],
  ];
  it.each(cases)("« %s » → %s", (msg, expected) => {
    expect(classifyIntent(msg).intent).toBe(expected);
  });

  it("message vide → clarify (jamais d'invention)", () => {
    const c = classifyIntent("");
    expect(c.intent).toBe("clarify");
    expect(c.ambiguous).toBe(true);
    expect(c.confidence).toBe(0);
  });

  it("message inintelligible → clarify", () => {
    expect(classifyIntent("xyzzy blorp").intent).toBe("clarify");
  });

  it("extractEntities : salarié / document / instruction", () => {
    expect(extractEntities("Montre le dossier de Sophie Martin").employeeQuery).toContain("Sophie");
    expect(extractEntities("Retrouve le contrat de Marie Dupont").documentQuery).toBeTruthy();
    const create = extractEntities("Crée une mission pour relancer les candidats");
    expect(create.missionInstruction).toBeTruthy();
  });

  it("intents publics : orientation seulement", () => {
    expect(isPublicAllowed("explain")).toBe(true);
    expect(isPublicAllowed("help")).toBe(true);
    expect(isPublicAllowed("clarify")).toBe(true);
    expect(isPublicAllowed("list_missions")).toBe(false);
    expect(isPublicAllowed("create_mission")).toBe(false);
  });
});
