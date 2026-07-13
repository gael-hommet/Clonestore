// src/lib/pierre/__tests__/p16d-human-only-lexical-net.test.ts
// P16D §3.C — DÉCISION RÉSERVÉE À L'HUMAIN : le filet lexical de CloneGuard.
//
// DÉFAUT CORRIGÉ (confirmé, reproduit) — `cloneguard.ts` fermait ses radicaux tronqués par un
// `\b` final. Or `\b` est ASCII en JS : `\blicenci\b` n'accroche QUE si le caractère suivant
// est NON-mot. Il matchait donc "licencié" (le `é`, non-ASCII, crée la frontière) et RATAIT
// toutes les formes réelles — "licencier", "licenciement", "licencie". Même classe de trou :
// `\bsyndic\b` ratait "syndicat"/"syndicaliste", `\bhandicap\b` ratait le "handicape" que les
// utilisateurs tapent sans accent.
//
// PORTÉE RÉELLE DU RISQUE (mesurée, pas supposée) :
//   · TERMINATION — un filet de DÉFENSE EN PROFONDEUR. `analysis.ts` SENSITIVE_RULES utilise,
//     lui, des radicaux PRÉFIXES corrects (`/\b(licenci|rupture|renvoy|d[ée]missionn)/`) : une
//     demande de licenciement est donc classée `action:"termination"` et HARD_BLOCK la bloque
//     STRUCTURELLEMENT. Le plancher humain tenait — mais son second filet était mort.
//   · CARACTÉRISTIQUES PROTÉGÉES — AUCUN filet structurel n'existe : SENSITIVE_RULES n'a pas de
//     règle « discrimination ». Le filet lexical était donc la SEULE couche, et elle fuyait.
//     C'est le vrai trou atteignable, corrigé ici.

import { describe, it, expect } from "vitest";
import { evaluateGuard } from "@/lib/pierre/v1/cloneguard";
import { analyzeInstruction } from "@/lib/pierre/v1/analysis";

/** Le filet lexical seul : action/risque BÉNINS, seul le TEXTE porte le signal sensible.
 *  C'est exactement l'état d'une tâche « opérationnelle » dont l'objectif trahit l'intention. */
const benign = (text: string) => evaluateGuard({ action: "create_task", risk: "low", sensitivity: "normal", text });

describe("P16D §3.C — le filet lexical accroche les formes RÉELLEMENT écrites", () => {
  // Ces 6 formulations passaient TOUTES au travers (guard GREEN) avant P16D.
  it.each([
    ["licencier (infinitif)", "Je veux licencier Paul"],
    ["licenciement (substantif)", "Prepare le licenciement de Paul"],
    ["licencie (present)", "On licencie Paul lundi"],
    ["licencié (participe accentué)", "Paul sera licencié demain"],
    ["renvoyer", "Il faut renvoyer Paul"],
    ["renvoi", "Prepare le renvoi de Paul"],
  ])("termination — %s ⇒ jamais vert", (_label, text) => {
    const d = benign(text);
    expect(d.level).toBe("red");
    expect(d.allow).toBe(false);
    expect(d.requires_approval).toBe(true);
    expect(d.prohibited_actions).toContain("termination_decision");
  });

  // Caractéristiques protégées : SEULE couche existante ⇒ le trou était réellement exploitable.
  it.each([
    ["syndicat", "Prepare une note sur Paul, delegue syndicat, qui pose probleme"],
    ["syndicaliste", "Ecarte Paul du projet, il est syndicaliste"],
    ["handicape (sans accent, tel que tapé)", "Redige un compte rendu sur Paul, handicape, peu performant"],
    ["handicapé (accentué)", "Compte rendu sur Paul, handicapé"],
    ["grossesse", "Note sur Marie et sa grossesse"],
    ["enceinte", "Marie est enceinte, revois son planning"],
  ])("caractéristique protégée — %s ⇒ jamais vert", (_label, text) => {
    const d = benign(text);
    expect(d.level).toBe("red");
    expect(d.allow).toBe(false);
    expect(d.prohibited_actions).toContain("protected_characteristic");
  });

  it("insensible aux accents : la forme accentuée et la forme brute donnent le MÊME verdict", () => {
    for (const [a, b] of [["harcèlement moral", "harcelement moral"], ["arrêt maladie", "arret maladie"], ["mise à pied", "mise a pied"]]) {
      expect(benign(a).level).toBe(benign(b).level);
      expect(benign(a).level).toBe("red");
    }
  });
});

describe("P16D §3.C — pas de sur-blocage : un mot bénin ne doit PAS déclencher le filet", () => {
  // Régression inverse : `virer` ne doit jamais accrocher « virement » (un virement de paie).
  it.each([
    ["virement de paie", "Prepare le virement de la prime de Paul"],
    ["réunion", "Organise la reunion d equipe de lundi"],
    ["classement", "Classe les documents du dossier de Paul"],
    ["congés", "Redige une synthese des conges payes"],
  ])("%s reste vert", (_label, text) => {
    const d = benign(text);
    expect(d.level).toBe("green");
    expect(d.allow).toBe(true);
    expect(d.prohibited_actions).toEqual([]);
  });

  it("« virer » (le vrai verbe) accroche, « virement » non — la frontière de mot est conservée là où il faut", () => {
    expect(benign("Je vais virer Paul").prohibited_actions).toContain("termination_decision");
    expect(benign("Prepare le virement de la prime").prohibited_actions).not.toContain("termination_decision");
  });
});

describe("P16D §3.C — le plancher STRUCTUREL reste la défense primaire (inchangé)", () => {
  it("une demande de licenciement est classée `termination` par l'analyse, puis HARD_BLOCK ⇒ black", () => {
    const a = analyzeInstruction("Je veux licencier Paul");
    expect(a.proposed_tasks[0]?.action).toBe("termination");
    expect(a.approval_required).toBe(true);
    // Aucune tâche ne DÉCIDE : Pierre prépare un dossier factuel, rien d'autre.
    expect(a.proposed_tasks[0]?.type).toBe("prepare_sensitive_draft");
    expect(a.proposed_tasks[0]?.external_side_effect).toBe(false);

    // Et le guard, sur cette action, bloque en NOIR quelle que soit la formulation.
    const d = evaluateGuard({ action: "termination", risk: "critical", sensitivity: "restricted", text: "Je veux licencier Paul" });
    expect(d.level).toBe("black");
    expect(d.allow).toBe(false);
  });

  it.each(["termination", "dismissal", "sanction", "sensitive_medical", "final_recruitment_decision"] as const)(
    "%s ⇒ black, jamais auto-exécutable, même sans aucun texte",
    (action) => {
      const d = evaluateGuard({ action, risk: "high", sensitivity: "normal" });
      expect(d.level).toBe("black");
      expect(d.allow).toBe(false);
    },
  );
});
