// src/lib/clonechat/inspector/__tests__/surface-registry.test.ts
// C1.8 BLOC C — le registre de surfaces identifie une page RÉELLE sans rouvrir le faux-positif.
//
// Les données « visibly_proven » utilisées ici NE SONT PAS inventées : ce sont les éléments
// RÉELLEMENT renvoyés par le fournisseur OpenAI sur une VRAIE capture de /agents/pierre
// (enregistrés dans .c1-8-proofs/part2/cloneinspector-evaluation.json le 2026-07-14).
// Rejouer une sortie fournisseur réelle est une preuve, pas un mock.

import { describe, it, expect } from "vitest";
import { CLONESTORE_SURFACES, matchSurface } from "../surface-registry";
import { inspectScreenshot } from "../cloneinspector";
import { getRouteEntry } from "../../../nav/route-registry";

// ── Sortie fournisseur RÉELLE enregistrée (capture /agents/pierre) ──
const REAL_PIERRE_ANALYSIS = {
  summary: "Vous êtes sur la page de présentation de Pierre.",
  visibly_proven: [
    "Un bouton « Voir la démo Pierre » est visible en bas à gauche de l'encadré principal.",
    "Deux autres boutons sont visibles à côté : « Préparer l'accès » et « Poser une question ».",
    "La barre supérieure contient aussi « CloneChat », « Créer un compte » et « Connexion ».",
  ],
  inference: [],
  unknown: [],
  known_issue: null,
  next_action: null,
};

describe("C1.8 BLOC C — invariant anti-invention du registre de surfaces", () => {
  it("TOUTE surface pointe vers une route RÉELLEMENT présente dans le registre canonique", () => {
    for (const s of CLONESTORE_SURFACES) {
      expect(getRouteEntry(s.route), `${s.route} absente du registre canonique`).not.toBeNull();
      expect(s.minSignals).toBeGreaterThanOrEqual(2); // jamais un seul indice
      expect(s.signals.length).toBeGreaterThanOrEqual(s.minSignals);
    }
  });

  it("chaque surface est TRACÉE (observée, jamais supposée)", () => {
    for (const s of CLONESTORE_SURFACES) {
      expect(s.observedFrom).toMatch(/capture réelle/i);
    }
  });
});

describe("C1.8 BLOC C — identification d'une VRAIE page (données fournisseur réelles)", () => {
  it("la sortie réelle de /agents/pierre est reconnue comme /agents/pierre", () => {
    const text = REAL_PIERRE_ANALYSIS.summary + " " + REAL_PIERRE_ANALYSIS.visibly_proven.join(" ");
    expect(matchSurface(text)).toBe("/agents/pierre");
  });

  it("CloneInspector produit enfin un diagnostic STRUCTURÉ sur cette capture réelle", () => {
    const r = inspectScreenshot({
      analysis: REAL_PIERRE_ANALYSIS,
      imagesSentToProvider: 1,
      currentRoute: null,
      message: "Je dois cliquer où ?",
    });
    expect(r.likely_route).toBe("/agents/pierre");
    expect(r.likely_page).toBeTruthy();
    expect(r.confidence).toBe("high");        // capture prouvée, pas de route réelle pour corroborer
    expect(r.cannot_conclude).toBe(false);    // il conclut, désormais
    expect(r.navigation_target?.href).toBe("/agents/pierre");
  });

  it("la MÊME capture + route d'écran CONCORDANTE ⇒ certitude", () => {
    const r = inspectScreenshot({
      analysis: REAL_PIERRE_ANALYSIS,
      imagesSentToProvider: 1,
      currentRoute: "/agents/pierre",
      message: "Je suis où ?",
    });
    expect(r.confidence).toBe("certain");
  });

  it("la MÊME capture + route d'écran CONTRADICTOIRE ⇒ on se TAIT (jamais un faux état)", () => {
    const r = inspectScreenshot({
      analysis: REAL_PIERRE_ANALYSIS,
      imagesSentToProvider: 1,
      currentRoute: "/checkout",
      message: "Je suis où ?",
    });
    expect(r.cannot_conclude).toBe(true);
    expect(r.likely_route).toBeNull();
    expect(r.needs_another_screenshot).toBe(true);
  });
});

describe("C1.8 BLOC C — le faux-positif « Pierre » reste FERMÉ", () => {
  it("un seul signal générique (« Pierre » dans l'en-tête du cockpit) NE reconnaît AUCUNE surface", () => {
    const cockpit = "Cockpit de suivi des missions RH, avec le nom Pierre affiché dans l'en-tête. Colonne « Missions en cours », bouton « Valider ».";
    expect(matchSurface(cockpit)).toBeNull();
    const r = inspectScreenshot({
      analysis: { summary: cockpit, visibly_proven: ["colonne Missions en cours", "bouton Valider"], inference: [], unknown: [], known_issue: null, next_action: null },
      imagesSentToProvider: 1, currentRoute: null, message: "où cliquer ?",
    });
    expect(r.likely_route).toBeNull();
    expect(r.cannot_conclude).toBe(true);
  });

  it("un seul signal distinctif ne suffit pas (il en faut au moins deux)", () => {
    expect(matchSurface("Il y a un bouton « Voir la démo Pierre ».")).toBeNull();
  });

  it("aucune image ⇒ aucun diagnostic, quel que soit le texte", () => {
    const r = inspectScreenshot({ analysis: null, imagesSentToProvider: 0, currentRoute: "/agents/pierre", message: "?" });
    expect(r.screenshot_received).toBe(false);
    expect(r.cannot_conclude).toBe(true);
  });
});
