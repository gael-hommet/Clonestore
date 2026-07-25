// Modes d'autonomie publics — fidélité au moteur réel + sûreté des claims.

import { describe, it, expect } from "vitest";
import {
  PUBLIC_AUTONOMY_MODES,
  DEFAULT_AUTONOMY_MODE_ID,
  AUTONOMY_HARD_FLOOR,
  AUTONOMY_INTRO,
  SPLIT_LABELS,
  publicModeById,
} from "../autonomy-modes";
import { PRODUCT_AUTONOMY_MODES } from "@/lib/clonestore/pierre-autonomy/model";
import { evaluateClaimSafety } from "@/lib/clonestore/founder-acceptance/pierre-commercial-truth-matrix";

describe("modes publics — 4 niveaux, dérivés du modèle canonique", () => {
  it("expose exactement les 4 modes moteur distincts, dans l'ordre d'autonomie", () => {
    expect(PUBLIC_AUTONOMY_MODES.map((m) => m.id)).toEqual(["draft", "validation", "controlled", "governed"]);
    expect(PUBLIC_AUTONOMY_MODES.map((m) => m.level)).toEqual([0, 1, 2, 3]);
    expect(PUBLIC_AUTONOMY_MODES.map((m) => m.engineMode)).toEqual([
      "draft",
      "normal",
      "high_autonomy",
      "enterprise_autonomous",
    ]);
  });

  it("réutilise les libellés/taglines CANONIQUES (jamais réinventés)", () => {
    for (const m of PUBLIC_AUTONOMY_MODES) {
      const canonical = PRODUCT_AUTONOMY_MODES.find((p) => p.id === m.id)!;
      expect(m.name).toBe(canonical.label);
      expect(m.tagline).toBe(canonical.tagline);
    }
  });

  it("le défaut est « validation » (↔ moteur « normal »)", () => {
    expect(DEFAULT_AUTONOMY_MODE_ID).toBe("validation");
    expect(publicModeById(DEFAULT_AUTONOMY_MODE_ID).engineMode).toBe("normal");
  });
});

describe("modes publics — la répartition PROUVE que le mode change l'exécution", () => {
  it("l'autonomie augmente : « fait seul » croît de brouillon → gouverné", () => {
    const alone = PUBLIC_AUTONOMY_MODES.map((m) => m.split.alone);
    // Monotone non décroissant.
    for (let i = 1; i < alone.length; i++) expect(alone[i]).toBeGreaterThanOrEqual(alone[i - 1]);
    // Brouillon n'exécute rien tout seul ; le mode le plus autonome, si.
    expect(alone[0]).toBe(0);
    expect(alone[alone.length - 1]).toBeGreaterThan(0);
  });

  it("le hard floor tient dans TOUS les modes : le sensible reste toujours humain", () => {
    // 5 actions « restricted » (sanction, rupture, licenciement, médical, harcèlement)
    // sont réservées à un humain quel que soit le mode — donc human ≥ 5 partout.
    for (const m of PUBLIC_AUTONOMY_MODES) {
      expect(m.split.human, m.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("chaque mode répartit les 14 actions représentatives sans en perdre", () => {
    for (const m of PUBLIC_AUTONOMY_MODES) {
      expect(m.split.alone + m.split.prepared + m.split.human).toBe(14);
    }
  });
});

describe("modes publics — copie sûre (jamais un claim interdit)", () => {
  const publicStrings = [
    AUTONOMY_INTRO.kicker,
    AUTONOMY_INTRO.title,
    AUTONOMY_INTRO.lede,
    AUTONOMY_HARD_FLOOR,
    ...Object.values(SPLIT_LABELS),
    ...PUBLIC_AUTONOMY_MODES.map((m) => m.tagline),
  ];

  for (const s of publicStrings) {
    it(`« ${s.slice(0, 42)}… » n'est jamais « forbidden »`, () => {
      expect(evaluateClaimSafety(s).safety).not.toBe("forbidden");
    });
  }
});
