// src/lib/pierre/__tests__/p16d-ambiguous-instruction.test.ts
// P16D §3.A — INSTRUCTION AMBIGUË : « Fais le nécessaire pour Paul. »
//
// DÉFAUT CORRIGÉ (confirmé, reproduit) — `detectMissingInfo()` ne contrôlait QUE le « qui »
// (et le « quand » des seules relances). Jamais le « QUOI ». Or `hasSubject` est satisfait par
// la simple présence d'un mot capitalisé : « Paul » suffisait. Résultat pour « Fais le
// nécessaire pour Paul. » :
//     missing_info: []            ← aucune demande de clarification
//     approval_required: false
//     next_best_action: "Exécuter les tâches faibles risques"   ← Pierre proposait d'EXÉCUTER
//     proposed_tasks: [create_task]                             ← une action INVENTÉE
// La même phrase SANS « Paul » demandait pourtant correctement « Quel salarié ? ». C'est donc
// le nom propre — et lui seul — qui faisait taire la clarification.
//
// P16D exige : demande de clarification ; aucun effet de bord ; aucun salarié fabriqué ;
// aucun appel provider. Pierre DEMANDE — il ne devine pas.
//
// La détection porte sur la VACUITÉ de la directive, PAS sur « aucune règle opérationnelle n'a
// matché » : OPERATIONAL_RULES est une liste étroite et beaucoup d'instructions parfaitement
// claires n'y figurent pas (« Prépare l'onboarding de Sarah lundi »). Confondre non-match et
// ambiguïté bloquerait des demandes légitimes — c'est vérifié plus bas.

import { describe, it, expect } from "vitest";
import { analyzeInstruction, isVagueDirective } from "@/lib/pierre/v1/analysis";

describe("P16D §3.A — une directive vague déclenche une QUESTION, jamais une action inventée", () => {
  it("« Fais le nécessaire pour Paul. » ⇒ clarification, aucune action, aucun effet de bord", () => {
    const a = analyzeInstruction("Fais le nécessaire pour Paul.");

    // 1) Clarification RÉELLEMENT demandée (c'était le trou : missing_info était vide).
    expect(a.missing_info.map((m) => m.id)).toContain("what");
    expect(a.missing_info.find((m) => m.id === "what")?.priority).toBe("high");

    // 2) Pierre ne propose PAS d'exécuter.
    expect(a.approval_required).toBe(true);
    expect(a.next_best_action).not.toMatch(/Exécuter/i);

    // 3) Aucune action inventée : la seule tâche est une demande d'information.
    expect(a.proposed_tasks).toHaveLength(1);
    expect(a.proposed_tasks[0].type).toBe("request_missing_info");
    expect(a.intent).toBe("clarification_required");

    // 4) AUCUN effet de bord externe (aucun envoi, aucun provider).
    expect(a.proposed_tasks.every((t) => t.external_side_effect === false)).toBe(true);

    // 5) Aucun salarié FABRIQUÉ : rien dans le résultat ne prétend identifier « Paul ».
    expect(a.proposed_tasks[0].expected_output).not.toMatch(/paul/i);
  });

  it.each([
    "Fais le nécessaire pour Paul.",
    "Occupe-toi de Paul",
    "Gère ça pour Marie",
    "Fais au mieux pour Sarah",
    "Débrouille-toi avec le dossier de Paul",
    "Tu sais quoi faire pour Paul",
    "Fais comme d'habitude pour Marie",
  ])("directive vague « %s » ⇒ clarification obligatoire", (text) => {
    const a = analyzeInstruction(text);
    expect(isVagueDirective(text)).toBe(true);
    expect(a.missing_info.some((m) => m.id === "what" && m.priority === "high")).toBe(true);
    expect(a.approval_required).toBe(true);
    expect(a.proposed_tasks.every((t) => t.external_side_effect === false)).toBe(true);
  });

  it("insensible aux accents : « Fais le necessaire » (sans accent) est tout aussi vague", () => {
    expect(isVagueDirective("Fais le necessaire pour Paul")).toBe(true);
    expect(isVagueDirective("Fais le nécessaire pour Paul")).toBe(true);
  });
});

describe("P16D §3.A — pas de sur-blocage : une instruction CLAIRE reste exécutable", () => {
  // Régression inverse : ne pas confondre « aucune règle ne matche » et « demande ambiguë ».
  it.each([
    ["Prépare l'onboarding de Sarah lundi", false],
    ["Relance Paul sur son justificatif", false],
    ["Prépare une synthèse pour Paul", false],
    ["Classe les documents de Marie", false],
    ["Notifier l'équipe de la réunion", false],
  ])("« %s » n'est PAS traitée comme vague", (text) => {
    expect(isVagueDirective(text)).toBe(false);
    const a = analyzeInstruction(text);
    expect(a.missing_info.some((m) => m.id === "what")).toBe(false);
    expect(a.intent).not.toBe("clarification_required");
  });

  it("une demande SENSIBLE reste prioritaire sur la clarification (jamais dégradée)", () => {
    // « Fais le nécessaire, licencie Paul » : le sensible l'emporte — plancher humain d'abord.
    const a = analyzeInstruction("Fais le nécessaire, licencie Paul");
    expect(a.intent).toBe("termination");
    expect(a.approval_required).toBe(true);
    expect(a.proposed_tasks[0].type).toBe("prepare_sensitive_draft");
    expect(a.proposed_tasks[0].external_side_effect).toBe(false);
    expect(a.prohibited_actions).toContain("decision_finale_autonome");
  });

  it("une demande VIDE demande toujours l'instruction elle-même", () => {
    const a = analyzeInstruction("   ");
    expect(a.missing_info[0].id).toBe("instruction");
    expect(a.proposed_tasks).toHaveLength(0);
  });
});
