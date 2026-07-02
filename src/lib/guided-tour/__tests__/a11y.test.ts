import { describe, it, expect } from "vitest";
import { selectFocusRestoreTarget, type FocusableLike } from "../a11y";

const connected: FocusableLike = { isConnected: true, focus: () => {} };
const detached: FocusableLike = { isConnected: false, focus: () => {} };
const fallback: FocusableLike = { isConnected: true, focus: () => {} };

describe("selectFocusRestoreTarget (restauration de focus, anti nœud détaché)", () => {
  it("rend l'élément d'origine s'il est encore connecté", () => {
    expect(selectFocusRestoreTarget(connected, fallback)).toBe(connected);
  });

  it("bascule sur le repli si l'élément d'origine est détaché", () => {
    expect(selectFocusRestoreTarget(detached, fallback)).toBe(fallback);
  });

  it("bascule sur le repli si aucun élément d'origine", () => {
    expect(selectFocusRestoreTarget(null, fallback)).toBe(fallback);
  });

  it("ne rend JAMAIS un nœud détaché", () => {
    const result = selectFocusRestoreTarget(detached, fallback);
    expect(result?.isConnected).toBe(true);
    expect(result).not.toBe(detached);
  });

  it("rend null si ni origine connectée ni repli", () => {
    expect(selectFocusRestoreTarget(detached, null)).toBeNull();
    expect(selectFocusRestoreTarget(null, null)).toBeNull();
  });
});
