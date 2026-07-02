import { describe, it, expect } from "vitest";
import {
  createDomRectProvider,
  isValidTargetId,
  resolveTargetRect,
  tourTargetSelector,
} from "../target-resolver";
import type { Rect, RectProvider } from "../target-resolver";

describe("tourTargetSelector", () => {
  it("cible par data-tour-id (attribut stable, jamais nth-child)", () => {
    expect(tourTargetSelector("store-entry")).toBe('[data-tour-id="store-entry"]');
  });

  it("échappe les guillemets/backslash", () => {
    expect(tourTargetSelector('a"b')).toBe('[data-tour-id="a\\"b"]');
  });
});

describe("isValidTargetId", () => {
  it("valide les identifiants non vides", () => {
    expect(isValidTargetId("x")).toBe(true);
    expect(isValidTargetId("")).toBe(false);
    expect(isValidTargetId("   ")).toBe(false);
    expect(isValidTargetId(null)).toBe(false);
    expect(isValidTargetId(undefined)).toBe(false);
  });
});

describe("resolveTargetRect", () => {
  const rect: Rect = { top: 10, left: 20, width: 30, height: 40 };

  it("étape centrée (targetId null) → null", () => {
    const provider: RectProvider = () => rect;
    expect(resolveTargetRect(null, provider)).toBeNull();
  });

  it("cible trouvée → rectangle", () => {
    const provider: RectProvider = () => rect;
    expect(resolveTargetRect("a", provider)).toEqual(rect);
  });

  it("cible absente → null", () => {
    const provider: RectProvider = () => null;
    expect(resolveTargetRect("a", provider)).toBeNull();
  });

  it("cible chargée avec délai : null puis rectangle", () => {
    let calls = 0;
    const provider: RectProvider = () => (++calls >= 3 ? rect : null);
    expect(resolveTargetRect("a", provider)).toBeNull();
    expect(resolveTargetRect("a", provider)).toBeNull();
    expect(resolveTargetRect("a", provider)).toEqual(rect);
  });
});

describe("createDomRectProvider", () => {
  it("retourne null sans document (sûr côté serveur)", () => {
    const provider = createDomRectProvider(undefined);
    expect(provider("anything")).toBeNull();
  });

  it("lit getBoundingClientRect via un faux document", () => {
    const fakeDoc = {
      querySelector: (sel: string) =>
        sel === '[data-tour-id="hit"]'
          ? { getBoundingClientRect: () => ({ top: 1, left: 2, width: 3, height: 4 }) }
          : null,
    } as unknown as Document;
    const provider = createDomRectProvider(fakeDoc);
    expect(provider("hit")).toEqual({ top: 1, left: 2, width: 3, height: 4 });
    expect(provider("miss")).toBeNull();
  });

  it("cible présente mais non mise en page (0x0) → null", () => {
    const fakeDoc = {
      querySelector: () => ({
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      }),
    } as unknown as Document;
    expect(createDomRectProvider(fakeDoc)("x")).toBeNull();
  });
});
