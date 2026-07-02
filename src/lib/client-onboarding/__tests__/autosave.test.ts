import { describe, it, expect } from "vitest";
import {
  AUTOSAVE_INITIAL,
  autosaveLabel,
  autosaveReducer,
  shouldPersist,
  type AutosaveState,
} from "../autosave";

const reduce = (state: AutosaveState, ...actions: Parameters<typeof autosaveReducer>[1][]) =>
  actions.reduce((s, a) => autosaveReducer(s, a), state);

describe("autosaveReducer", () => {
  it("état initial idle", () => {
    expect(AUTOSAVE_INITIAL.status).toBe("idle");
    expect(shouldPersist(AUTOSAVE_INITIAL)).toBe(false);
  });

  it("EDIT → dirty (déclenche la persistance)", () => {
    const s = autosaveReducer(AUTOSAVE_INITIAL, { type: "EDIT" });
    expect(s.status).toBe("dirty");
    expect(shouldPersist(s)).toBe(true);
  });

  it("cycle nominal : EDIT → SAVE_START → SAVE_SUCCESS", () => {
    const s = reduce(
      AUTOSAVE_INITIAL,
      { type: "EDIT" },
      { type: "SAVE_START" },
      { type: "SAVE_SUCCESS", at: "2026-07-01T00:00:00.000Z" },
    );
    expect(s.status).toBe("saved");
    expect(s.lastSavedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(s.error).toBeNull();
    expect(shouldPersist(s)).toBe(false);
  });

  it("une erreur conserve la dernière sauvegarde réussie (aucune perte affichée)", () => {
    const saved = reduce(
      AUTOSAVE_INITIAL,
      { type: "EDIT" },
      { type: "SAVE_START" },
      { type: "SAVE_SUCCESS", at: "2026-07-01T00:00:00.000Z" },
    );
    const errored = reduce(saved, { type: "EDIT" }, { type: "SAVE_START" }, { type: "SAVE_ERROR", error: "réseau" });
    expect(errored.status).toBe("error");
    expect(errored.error).toBe("réseau");
    expect(errored.lastSavedAt).toBe("2026-07-01T00:00:00.000Z"); // conservé
  });

  it("après saved, une nouvelle édition repasse en dirty", () => {
    const saved = reduce(
      AUTOSAVE_INITIAL,
      { type: "EDIT" },
      { type: "SAVE_START" },
      { type: "SAVE_SUCCESS", at: "x" },
    );
    expect(autosaveReducer(saved, { type: "EDIT" }).status).toBe("dirty");
  });

  it("RESET revient à l'état initial", () => {
    const s = reduce(AUTOSAVE_INITIAL, { type: "EDIT" }, { type: "RESET" });
    expect(s).toEqual(AUTOSAVE_INITIAL);
  });

  it("libellés lisibles par statut", () => {
    expect(autosaveLabel({ status: "saving", lastSavedAt: null, error: null })).toContain("Enregistrement");
    expect(autosaveLabel({ status: "saved", lastSavedAt: "x", error: null })).toBe("Enregistré");
    expect(autosaveLabel({ status: "error", lastSavedAt: null, error: "x" })).toContain("Échec");
  });
});
