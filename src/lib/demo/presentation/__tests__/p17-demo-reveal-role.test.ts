// P17 — PIERRE PRIME CLOSURE — non-régression de POSITIONNEMENT.
//
// Défaut trouvé et corrigé en P17 : la révélation finale de la démo générale
// (`SCENE_REVEAL.employee.role`) affichait « Directeur des Ressources Humaines IA ».
// Ce cadrage « DRH » :
//   1) contredit la SOURCE DE VÉRITÉ COMMERCIALE UNIQUE (`PIERRE_PUBLIC.role` =
//      « Employé IA RH opérationnel », src/lib/catalog/public-catalog.ts) ;
//   2) heurte la doctrine `pierre-commercial-truth-matrix` qui interdit explicitement
//      le claim « Pierre est un DRH autonome » et le remplacement de la fonction/direction RH.
//
// La copie de démo n'est reliée à AUCUN garde automatique (les chaînes sont codées en dur).
// Ce test EST ce garde pour la chaîne la plus visible : le rôle révélé DOIT rester la
// position commerciale canonique, et ne jamais réintroduire le cadrage DRH.

import { describe, it, expect } from "vitest";

import { SCENE_REVEAL } from "../content";
import { PIERRE_PUBLIC } from "../../../catalog/public-catalog";
import { evaluateClaimSafety } from "../../../clonestore/founder-acceptance/pierre-commercial-truth-matrix";

describe("P17 — rôle de la révélation Pierre (démo générale)", () => {
  it("affiche EXACTEMENT le rôle commercial canonique (aucune dérive)", () => {
    // Le garde de dérive : si quelqu'un rouvre la porte au cadrage « DRH » (ou à toute
    // autre étiquette), il doit d'abord changer la source de vérité — et ce test tombe.
    expect(SCENE_REVEAL.employee.role).toBe(PIERRE_PUBLIC.role);
    expect(SCENE_REVEAL.employee.role).toBe("Employé IA RH opérationnel");
  });

  it("ne réintroduit jamais le cadrage « DRH / Directeur des Ressources Humaines »", () => {
    const role = SCENE_REVEAL.employee.role;
    // Cadrage de titre RH-directeur interdit pour Pierre (il est un EMPLOYÉ opérationnel).
    expect(/directeur\s+des\s+ressources\s+humaines/i.test(role)).toBe(false);
    expect(/\bdrh\b/i.test(role)).toBe(false);
    // Et jamais le framing « assistant / chatbot » non plus.
    expect(/\bassistant\b|\bchatbot\b/i.test(role)).toBe(false);
  });

  it("le rôle révélé n'est pas un claim INTERDIT par la doctrine commerciale", () => {
    const verdict = evaluateClaimSafety(SCENE_REVEAL.employee.role);
    expect(verdict.safety).not.toBe("forbidden");
  });

  it("la position canonique elle-même reste un cadrage « employé opérationnel » sûr", () => {
    // Verrouille la source de vérité : « Employé IA RH opérationnel », jamais « assistant ».
    expect(/employ[ée]/i.test(PIERRE_PUBLIC.role)).toBe(true);
    expect(/\bassistant\b|\bchatbot\b|\bdrh\b/i.test(PIERRE_PUBLIC.role)).toBe(false);
  });
});
