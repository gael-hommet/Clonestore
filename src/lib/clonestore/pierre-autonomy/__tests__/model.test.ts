// src/lib/clonestore/pierre-autonomy/__tests__/model.test.ts
// P9.5 — Prouve que le modèle d'autonomie produit est RÉEL (dérivé du moteur P8 decideValidation),
// PAS cosmétique : les modes changent le comportement ET les gardes dures (approbation/restreint/
// critique) ne sont JAMAIS auto-exécutées, quel que soit le mode.

import { describe, it, expect } from "vitest";
import { AUTONOMY_MODES } from "@/lib/pierre/v1/autonomy";
import {
  PRODUCT_AUTONOMY_MODES, deriveAutonomyMatrix, engineModeFor, willExecuteAlone, requiresHumanFor,
  REPRESENTATIVE_HR_ACTIONS, getProductMode, isProductModeId, type ProductAutonomyModeId,
} from "../model";

const MODE_IDS: ProductAutonomyModeId[] = ["draft", "validation", "controlled", "governed", "dirigeant"];
// Actions à GARDE DURE : approbation-requise et/ou restreintes → jamais autonomes, tous modes confondus.
const GATED_KEYS = ["contract", "amendment", "compensation", "final_recruitment_decision", "sanction", "termination", "dismissal", "sensitive_medical", "harassment_flagged"];
const act = (k: string) => REPRESENTATIVE_HR_ACTIONS.find((a) => a.key === k)!;

describe("P9.5 product autonomy model — mapping to REAL P8 engine", () => {
  it("les 5 modes produit existent et mappent à un mode MOTEUR P8 valide", () => {
    expect(PRODUCT_AUTONOMY_MODES).toHaveLength(5);
    for (const id of MODE_IDS) {
      const m = getProductMode(id);
      expect(m).not.toBeNull();
      expect((AUTONOMY_MODES as readonly string[]).includes(m!.engineMode)).toBe(true); // mode moteur réel
      expect((AUTONOMY_MODES as readonly string[]).includes(engineModeFor(id))).toBe(true);
    }
    expect(isProductModeId("draft")).toBe(true);
    expect(isProductModeId("bogus")).toBe(false);
    // les 4 modes moteur P8 sont tous couverts par les modes produit
    expect(new Set(PRODUCT_AUTONOMY_MODES.map((m) => m.engineMode))).toEqual(new Set(AUTONOMY_MODES));
  });

  it("engineModeFor est garde-fou : un id inconnu retombe sur 'normal' (jamais un mode moteur invalide)", () => {
    expect(engineModeFor("nope" as ProductAutonomyModeId)).toBe("normal");
  });
});

describe("P9.5 HARD FLOORS — aucun mode ne bypasse les gardes (anti-escalade)", () => {
  it("les actions approbation-requise / restreintes ne sont JAMAIS auto-exécutées, dans TOUS les modes", () => {
    for (const id of MODE_IDS) {
      const matrix = deriveAutonomyMatrix(id);
      for (const key of GATED_KEYS) {
        const entry = matrix.entries.find((e) => e.key === key)!;
        // jamais exécutée seule ni « execute+notify »
        expect(entry.bucket === "alone" || entry.bucket === "notify").toBe(false);
        expect(willExecuteAlone(id, act(key))).toBe(false);
        expect(requiresHumanFor(id, act(key))).toBe(true);
      }
    }
  });

  it("mode 'controlled' (exécution contrôlée) : le restreint reste réservé humain, le sensible en validation", () => {
    const m = deriveAutonomyMatrix("controlled");
    for (const key of ["termination", "dismissal", "sensitive_medical", "harassment_flagged", "sanction"]) {
      expect(m.entries.find((e) => e.key === key)!.bucket).toBe("human_only"); // restreint → réservé humain
    }
    for (const key of ["contract", "amendment", "compensation", "final_recruitment_decision"]) {
      expect(m.entries.find((e) => e.key === key)!.bucket).toBe("validation"); // sensible → validation humaine
    }
  });

  it("mode 'governed' / 'dirigeant' (le plus autonome) ne débloque toujours PAS le restreint", () => {
    for (const id of ["governed", "dirigeant"] as ProductAutonomyModeId[]) {
      const m = deriveAutonomyMatrix(id);
      expect(m.entries.find((e) => e.key === "termination")!.bucket).toBe("human_only");
      expect(m.entries.find((e) => e.key === "sensitive_medical")!.bucket).toBe("human_only");
    }
  });
});

describe("P9.5 NOT COSMETIC — les modes changent réellement le comportement", () => {
  it("une mise à jour de statut : préparée en 'draft', faite seule en 'validation'/'controlled', notifiée en 'governed'", () => {
    expect(deriveAutonomyMatrix("draft").entries.find((e) => e.key === "status_update")!.bucket).toBe("prepare");
    expect(deriveAutonomyMatrix("validation").entries.find((e) => e.key === "status_update")!.bucket).toBe("alone");
    expect(deriveAutonomyMatrix("controlled").entries.find((e) => e.key === "status_update")!.bucket).toBe("alone");
    expect(deriveAutonomyMatrix("governed").entries.find((e) => e.key === "status_update")!.bucket).toBe("notify");
  });

  it("'draft' ne fait rien vers l'extérieur seul ; 'governed' exécute réellement le low-risk opérationnel", () => {
    const draft = deriveAutonomyMatrix("draft");
    for (const e of draft.entries) if (e.externalSideEffect) expect(e.bucket === "alone" || e.bucket === "notify").toBe(false);
    const gov = deriveAutonomyMatrix("governed");
    const executedGov = gov.entries.filter((e) => e.bucket === "alone" || e.bucket === "notify").map((e) => e.key);
    // au moins les opérations à faible risque sont réellement exécutées (autonomie réelle, pas un label)
    for (const k of ["status_update", "create_task", "standard_report", "deadline_reminder"]) expect(executedGov).toContain(k);
  });

  it("l'autonomie effective croît de draft → governed (nb d'actions exécutées seul/notify)", () => {
    const count = (id: ProductAutonomyModeId) => deriveAutonomyMatrix(id).entries.filter((e) => e.bucket === "alone" || e.bucket === "notify").length;
    expect(count("draft")).toBeLessThan(count("validation"));
    expect(count("validation")).toBeLessThanOrEqual(count("controlled"));
    expect(count("controlled")).toBeLessThanOrEqual(count("governed"));
    expect(count("governed")).toBeGreaterThan(0);
  });
});
