// src/lib/pierre/__tests__/p16d-conflicting-instruction.test.ts
// P16D §3.B — INSTRUCTION CONTRADICTOIRE : « Envoie le contrat aujourd'hui, mais ne contacte
// personne sans mon accord. » ⇒ la contrainte la PLUS STRICTE doit l'emporter.
//
// DÉFAUT CORRIGÉ (confirmé, reproduit) — la restriction explicite de l'utilisateur était
// PUREMENT IGNORÉE dès que l'action était classée « faible risque » :
//     « Notifier l'équipe MAIS ne contacte personne sans mon accord »
//        ⇒ risk=low, sensitivity=normal ⇒ CloneGuard VERT ⇒ allow=true, requires_approval=false
//        ⇒ EXÉCUTION AUTONOME, alors que l'utilisateur venait d'interdire d'agir sans lui.
//
// Le cas « Envoie le CONTRAT… » n'était sauvé que par ACCIDENT : le mot « contrat » déclenche une
// règle SENSIBLE. Ce n'était donc pas la restriction qui protégeait — retirez le mot « contrat »
// et le garde-fou disparaissait. C'est le signal PERMISSIF (classification faible risque) qui
// écrasait le signal RESTRICTIF — exactement ce que P16D interdit.
//
// Correction : une restriction utilisateur ne peut qu'AJOUTER des contraintes (sensibilité élevée
// à `restricted` ⇒ CloneGuard ROUGE ⇒ préparer seulement + confirmation). Le conflit est TRACÉ.

import { describe, it, expect } from "vitest";
import { analyzeInstruction, detectUserRestriction } from "@/lib/pierre/v1/analysis";
import { evaluateGuard } from "@/lib/pierre/v1/cloneguard";

/** Rejoue la chaîne RÉELLE : analyse → tâche → CloneGuard (comme le fait le worker). */
function govern(instruction: string) {
  const a = analyzeInstruction(instruction);
  const t = a.proposed_tasks[0];
  const g = evaluateGuard({ action: t.action, risk: t.risk, sensitivity: t.sensitivity, text: t.objective });
  return { a, t, g };
}

describe("P16D §3.B — le plus strict l'emporte : une restriction n'est jamais écrasée", () => {
  it("le cas canonique : « Envoie le contrat aujourd'hui, mais ne contacte personne sans mon accord »", () => {
    const { a, t, g } = govern("Envoie le contrat aujourd'hui, mais ne contacte personne sans mon accord.");

    expect(a.approval_required).toBe(true);
    expect(g.allow).toBe(false);                       // rien ne part
    expect(g.requires_approval).toBe(true);            // confirmation demandée AVANT envoi
    expect(t.external_side_effect).toBe(false);        // préparation seule
    expect(t.type).toBe("prepare_sensitive_draft");
    // Le conflit est AUDITÉ, pas résolu en silence.
    expect(a.user_restriction).toBeTruthy();
    expect(a.summary).toMatch(/RESTRICTION UTILISATEUR/);
  });

  // Le vrai test : une action BÉNIGNE assortie d'une restriction. Avant P16D ⇒ VERT.
  it.each([
    "Notifier l'équipe de la réunion mais ne contacte personne sans mon accord",
    "Classer les documents de Marie, mais ne fais rien sans ma validation",
    "Prépare une synthèse pour Paul, mais ne m'envoie rien sans me demander",
    "Relance Paul mais demande-moi avant",
  ])("action faible risque + restriction ⇒ ROUGE, jamais d'exécution autonome : « %s »", (text) => {
    const { a, t, g } = govern(text);

    expect(a.user_restriction).toBeTruthy();           // la restriction est VUE
    expect(a.approval_required).toBe(true);            // …et elle CONTRAINT
    expect(t.sensitivity).toBe("restricted");
    expect(t.external_side_effect).toBe(false);
    expect(g.level).toBe("red");
    expect(g.allow).toBe(false);                       // ← était `true` (vert) avant P16D
    expect(g.requires_approval).toBe(true);
    expect(a.prohibited_actions).toContain("execution_autonome");
    expect(a.prohibited_actions).toContain("envoi_autonome");
  });

  it("insensible aux accents et à la casse", () => {
    expect(detectUserRestriction("Ne fais rien sans ma validation")).toBeTruthy();
    expect(detectUserRestriction("ne fais rien sans ma validation")).toBeTruthy();
    expect(detectUserRestriction("NE CONTACTE PERSONNE")).toBeTruthy();
  });
});

describe("P16D §3.B — pas de sur-blocage : sans restriction, le flux normal est intact", () => {
  it.each([
    "Notifier l'équipe de la réunion de lundi",
    "Classer les documents de Marie",
    "Prépare une synthèse pour Paul",
  ])("« %s » ⇒ aucune restriction détectée, gouvernance inchangée", (text) => {
    const { a, g } = govern(text);
    expect(detectUserRestriction(text)).toBeNull();
    expect(a.user_restriction).toBeNull();
    expect(a.approval_required).toBe(false);
    expect(g.allow).toBe(true);                        // le travail légitime passe toujours
    expect(a.prohibited_actions).toEqual([]);
  });

  it("une restriction n'ASSOUPLIT jamais un cas déjà sensible (elle ne peut qu'ajouter)", () => {
    const strict = govern("Je veux licencier Paul");
    const withRestriction = govern("Je veux licencier Paul, mais ne fais rien sans mon accord");
    // Le licenciement reste NOIR dans les deux cas : la restriction n'a rien pu affaiblir.
    expect(strict.g.level).toBe("black");
    expect(withRestriction.g.level).toBe("black");
    expect(withRestriction.a.approval_required).toBe(true);
    expect(withRestriction.a.user_restriction).toBeTruthy();   // …et elle est tout de même tracée
  });
});
