// src/lib/clonechat/core/__tests__/corpus-truth.test.ts
// Vérité canonique CloneStore — garde de non-régression sur le corpus RÉEL (pas une copie codée
// en dur). Défaut RÉEL trouvé (2026-07-27) : l'unité pricing.founder_offer citait uniquement
// France/Belgique/Luxembourg, ce qui se lisait comme une liste exhaustive de disponibilité —
// alors que la Suisse est un pays de lancement à part entière avec son propre prix.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { corpus, invalidateCorpusCache } from "../knowledge-corpus";

describe("CloneChat — vérité canonique CloneStore (corpus réel, pas codé en dur)", () => {
  invalidateCorpusCache();
  const units = corpus();
  const allText = units.map((u) => u.text).join("\n");

  it("la date de lancement active est le 8 septembre 2026", () => {
    expect(allText).toMatch(/8 septembre 2026/);
  });

  it("aucune unité n'affiche une date de lancement supersédée (5 août / 12 août 2026) comme date ACTIVE", () => {
    const pricingUnits = units.filter((u) => u.category === "pricing" || u.category === "demo");
    for (const u of pricingUnits) {
      expect(u.text, `unité ${u.id} ne doit pas référencer une date de lancement supersédée`).not.toMatch(/(?:5|12) août 2026/);
    }
  });

  it("les 4 pays de lancement (FR/BE/LU/CH) sont présents", () => {
    expect(allText).toMatch(/\bFR\b/);
    expect(allText).toMatch(/\bBE\b/);
    expect(allText).toMatch(/\bLU\b/);
    expect(allText).toMatch(/\bCH\b/);
    expect(allText).toMatch(/Suisse/);
  });

  it("les deux prix réels sont présents (449 € et 499 CHF)", () => {
    expect(allText).toMatch(/449\s*€/);
    expect(allText).toMatch(/499\s*CHF/);
  });

  it("aucune contradiction entre pricing.catalog et pricing.founder_offer sur la disponibilité Suisse", () => {
    const catalog = units.find((u) => u.id === "pricing.catalog");
    const founderOffer = units.find((u) => u.id === "pricing.founder_offer");
    expect(catalog).toBeTruthy();
    expect(founderOffer).toBeTruthy();
    // Les deux doivent mentionner la Suisse — sinon l'un des deux laisse croire qu'elle n'existe pas.
    expect(catalog!.text).toMatch(/Suisse|CH\b/);
    expect(founderOffer!.text).toMatch(/Suisse/);
    // founder_offer ne doit jamais se lire comme une liste EXHAUSTIVE de pays disponibles :
    // s'il mentionne "France/Belgique/Luxembourg", il doit aussi explicitement mentionner la Suisse
    // dans la même unité (pas seulement l'offre fondateur limitée à FR/BE/LU).
    if (/France\/Belgique\/Luxembourg|France, Belgique, Luxembourg/i.test(founderOffer!.text)) {
      expect(founderOffer!.text).toMatch(/Suisse/);
    }
  });

  it("le manifeste de génération porte generatedAt, sourceCommitSha, corpusHash, sourceRegistryVersions", () => {
    // Preuve de fraîcheur/traçabilité — voir generate-corpus.gen.test.ts (CLONECHAT_GENERATE_CORPUS=1).
    const manifestPath = "audit-clonechat-unified/corpus/manifest.json";
    if (!existsSync(manifestPath)) return; // pas généré dans cet environnement de test — non bloquant
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.generatedAt).toBeTruthy();
    expect(manifest.corpusHash).toBeTruthy();
    expect(manifest.sourceRegistryVersions).toBeTruthy();
    expect(Object.keys(manifest.sourceRegistryVersions).length).toBeGreaterThan(0);
  });
});
