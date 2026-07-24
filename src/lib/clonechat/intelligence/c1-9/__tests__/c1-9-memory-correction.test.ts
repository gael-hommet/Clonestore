// C1.9 — RÉGRESSION : une valeur corrigée ne doit plus survivre sous un autre `kind`.
//
// Défaut mesuré en campagne réelle (cas « mem3 ») : à « on a deux personnes aux RH » puis
// « finalement on est plutôt trois », le remplacement par `kind` fonctionnait — mais le
// modèle émettait EN PLUS `effectif_fonction_RH_précédemment_indiqué = 2 personnes`.
// L'ancienne valeur restait donc dans la mémoire transmise au rédacteur, qui continuait
// de compter deux personnes. Le juge avait noté la mémoire 0/5.
//
// Le correctif est structurel — `kind` dérivé + valeur écartée — et ne connaît aucun mot
// français : il vaudrait pour « previous_value », « ancien_effectif » ou tout autre libellé
// que le modèle choisirait spontanément.
import { describe, it, expect } from "vitest";
import { absorbTurn, EMPTY_MEMORY, renderMemoryForPrompt } from "../conversation-memory";
import type { Understanding } from "../understanding-schema";

function understanding(entities: Array<{ kind: string; value: string; inferred?: boolean }>, isCorrection = false): Understanding {
  return {
    summary: "s", primary_goal: "g", secondary_goals: [], questions_detected: [],
    entities: entities.map((e) => ({ kind: e.kind, value: e.value, inferred: e.inferred ?? false })),
    requested_metrics: [], requested_actions: [], constraints: [], assumptions: [],
    missing_information: [], ambiguities: [], user_emotion: "neutre",
    requires_clarification: false, clarification_question: null, knowledge_needs: [],
    tool_needs: [], risk_signals: [], confidence: 0.9,
    depends_on_history: false, is_correction: isCorrection, out_of_scope: false,
  } as Understanding;
}

describe("C1.9 memory — a corrected value must not survive under a derived kind", () => {
  it("drops the superseded value when the model re-states it under a derived kind", () => {
    let m = absorbTurn(EMPTY_MEMORY, understanding([{ kind: "effectif_fonction_RH", value: "2 personnes" }]), 0);
    expect(m.facts.map((f) => f.value)).toEqual(["2 personnes"]);

    // Tour de correction : le modèle annonce la nouvelle valeur ET conserve l'ancienne
    // sous un libellé dérivé — c'est exactement ce qui avait été observé.
    m = absorbTurn(m, understanding([
      { kind: "effectif_fonction_RH", value: "3 personnes" },
      { kind: "effectif_fonction_RH_précédemment_indiqué", value: "2 personnes" },
    ], true), 1);

    const values = m.facts.map((f) => f.value);
    expect(values).toContain("3 personnes");
    expect(values).not.toContain("2 personnes");
    // Et le texte réellement transmis au rédacteur ne porte plus l'ancien chiffre.
    expect(renderMemoryForPrompt(m)).not.toContain("2 personnes");
  });

  it("refuse un fait HISTORIQUE émis à un tour ULTÉRIEUR à la correction (mem3 réel)", () => {
    // La correction a lieu au tour 1 ; au tour 2 le modèle ré-émet spontanément la valeur
    // corrigée sous un kind « précédent ». La purge par supersession ne s'applique plus (pas
    // de correction ce tour-là) : c'est le filtre par kind historique qui doit l'écarter.
    let m = absorbTurn(EMPTY_MEMORY, understanding([{ kind: "effectif_RH", value: "2 personnes" }]), 0);
    m = absorbTurn(m, understanding([{ kind: "effectif_RH", value: "3 personnes" }], true), 1);
    m = absorbTurn(m, understanding([
      { kind: "effectif_RH", value: "3 personnes" },
      { kind: "effectif_RH_précédent", value: "2 personnes" },
    ]), 2);
    const values = m.facts.map((f) => f.value);
    expect(values).toContain("3 personnes");
    expect(values).not.toContain("2 personnes");
    expect(renderMemoryForPrompt(m)).not.toContain("2 personnes");
  });

  it("keeps a same-valued fact when its kind is unrelated (no over-deletion)", () => {
    let m = absorbTurn(EMPTY_MEMORY, understanding([
      { kind: "effectif_RH", value: "3" },
      { kind: "nombre_sites", value: "2" },
    ]), 0);
    m = absorbTurn(m, understanding([{ kind: "effectif_RH", value: "5" }], true), 1);
    const byKind = Object.fromEntries(m.facts.map((f) => [f.kind, f.value]));
    expect(byKind["effectif_RH"]).toBe("5");
    // `nombre_sites` n'a aucun lien avec la correction et doit survivre intact.
    expect(byKind["nombre_sites"]).toBe("2");
  });

  it("does not delete an unrelated kind that happens to share the superseded value", () => {
    let m = absorbTurn(EMPTY_MEMORY, understanding([
      { kind: "effectif_RH", value: "2" },
      { kind: "nombre_sites", value: "2" },
    ]), 0);
    m = absorbTurn(m, understanding([{ kind: "effectif_RH", value: "4" }], true), 1);
    const byKind = Object.fromEntries(m.facts.map((f) => [f.kind, f.value]));
    expect(byKind["effectif_RH"]).toBe("4");
    // « nombre_sites » vaut aussi « 2 », mais son kind ne dérive pas d'`effectif_RH` :
    // le purge par valeur seule aurait effacé une information légitime.
    expect(byKind["nombre_sites"]).toBe("2");
  });

  it("a later stated fact still replaces an earlier one of the same kind", () => {
    let m = absorbTurn(EMPTY_MEMORY, understanding([{ kind: "pays", value: "France" }]), 0);
    m = absorbTurn(m, understanding([{ kind: "pays", value: "Suisse" }], true), 1);
    expect(m.facts.filter((f) => f.kind === "pays").map((f) => f.value)).toEqual(["Suisse"]);
  });
});
