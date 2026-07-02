import { describe, it, expect } from "vitest";
import {
  CONTINUOUS_EMPTY_MESSAGE,
  acceptEntry,
  adoptableEntries,
  canAdopt,
  isEmpty,
  pendingEntries,
  refuseEntry,
  replaceEntry,
  requiresValidation,
  type ContinuousEntry,
} from "../continuous-footprint";

const suggestion = (over: Partial<ContinuousEntry> = {}): ContinuousEntry => ({
  id: "e1",
  field: "tone",
  value: "chaleureux et direct",
  provenance: "pierre_suggested",
  requiresHumanValidation: true,
  validated: false,
  recordedAt: "2026-07-01T00:00:00.000Z",
  decision: "to_verify",
  ...over,
});

describe("Empreinte continue — validation humaine obligatoire", () => {
  it("une proposition (pierre_suggested) requiert une validation et n'est PAS adoptable", () => {
    const e = suggestion();
    expect(requiresValidation(e)).toBe(true);
    expect(canAdopt(e)).toBe(false); // jamais adopté silencieusement
  });

  it("une information humaine ne requiert pas de validation", () => {
    const e = suggestion({ provenance: "human", requiresHumanValidation: false });
    expect(requiresValidation(e)).toBe(false);
    expect(canAdopt(e)).toBe(true);
  });

  it("importée : requiert validation", () => {
    expect(requiresValidation(suggestion({ provenance: "imported" }))).toBe(true);
  });

  it("accepter → validé + décision accepted → adoptable", () => {
    const e = acceptEntry(suggestion());
    expect(e.validated).toBe(true);
    expect(e.decision).toBe("accepted");
    expect(canAdopt(e)).toBe(true);
  });

  it("refuser → jamais adopté", () => {
    const e = refuseEntry(suggestion());
    expect(e.decision).toBe("refused");
    expect(adoptableEntries([e])).toHaveLength(0);
  });

  it("modifier puis accepter → provenance humaine, validé, décision replaced", () => {
    const e = replaceEntry(suggestion(), "ton neutre et professionnel");
    expect(e.value).toBe("ton neutre et professionnel");
    expect(e.provenance).toBe("human");
    expect(e.validated).toBe(true);
    expect(e.decision).toBe("replaced");
    expect(canAdopt(e)).toBe(true);
  });

  it("pendingEntries = à vérifier ; adoptableEntries = acceptées/remplacées adoptables", () => {
    const list = [suggestion({ id: "a" }), acceptEntry(suggestion({ id: "b" })), refuseEntry(suggestion({ id: "c" }))];
    expect(pendingEntries(list).map((e) => e.id)).toEqual(["a"]);
    expect(adoptableEntries(list).map((e) => e.id)).toEqual(["b"]);
  });

  it("état vide réel (aucune donnée fictive)", () => {
    expect(isEmpty([])).toBe(true);
    expect(CONTINUOUS_EMPTY_MESSAGE.length).toBeGreaterThan(0);
  });
});
