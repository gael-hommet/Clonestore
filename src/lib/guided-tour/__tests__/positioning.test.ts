import { describe, it, expect } from "vitest";
import {
  clamp,
  computeCardPlacement,
  computePointerAnchor,
  computeSpotlightRect,
  hasRoomFor,
  isRectInViewport,
  isTargetComfortablyVisible,
  placementFallbackOrder,
  shouldScrollToTarget,
} from "../positioning";
import type { Rect, Size, Viewport } from "../types";

const VP: Viewport = { width: 1200, height: 800 };
const CARD: Size = { width: 360, height: 200 };

describe("clamp", () => {
  it("borne la valeur", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(5, 10, 0)).toBe(10); // max<min → min
  });
});

describe("placementFallbackOrder", () => {
  it("met la position préférée en tête", () => {
    expect(placementFallbackOrder("right")[0]).toBe("right");
    expect(placementFallbackOrder("top")).toContain("bottom");
    expect(placementFallbackOrder("center")).toEqual(["center"]);
  });
});

describe("hasRoomFor", () => {
  const target: Rect = { top: 400, left: 500, width: 100, height: 40 };
  it("détecte la place disponible par axe", () => {
    expect(hasRoomFor("bottom", target, CARD, VP, 16, 14)).toBe(true);
    expect(hasRoomFor("top", { ...target, top: 10 }, CARD, VP, 16, 14)).toBe(false);
    expect(hasRoomFor("center", target, CARD, VP, 16, 14)).toBe(true);
  });
});

describe("computeCardPlacement", () => {
  it("place sous une cible centrale (bottom préféré)", () => {
    const target: Rect = { top: 200, left: 550, width: 100, height: 40 };
    const p = computeCardPlacement(target, CARD, VP, "bottom");
    expect(p.placement).toBe("bottom");
    expect(p.top).toBeGreaterThanOrEqual(240); // sous la cible
    expect(p.left).toBeGreaterThanOrEqual(14);
    expect(p.left + CARD.width).toBeLessThanOrEqual(VP.width - 14);
  });

  it("bascule au-dessus quand pas de place en dessous (repli)", () => {
    const target: Rect = { top: 720, left: 550, width: 100, height: 40 };
    const p = computeCardPlacement(target, CARD, VP, "bottom");
    expect(p.placement).toBe("top");
  });

  it("cible à gauche → carte à droite", () => {
    const target: Rect = { top: 380, left: 20, width: 80, height: 40 };
    const p = computeCardPlacement(target, CARD, VP, "right");
    expect(p.placement).toBe("right");
    expect(p.left).toBeGreaterThan(target.left);
  });

  it("cible à droite → carte à gauche", () => {
    const target: Rect = { top: 380, left: 1100, width: 80, height: 40 };
    const p = computeCardPlacement(target, CARD, VP, "left");
    expect(p.placement).toBe("left");
  });

  it("cible absente → carte centrée", () => {
    const p = computeCardPlacement(null, CARD, VP, "bottom");
    expect(p.placement).toBe("center");
    expect(p.left).toBeCloseTo((VP.width - CARD.width) / 2, 0);
    expect(p.top).toBeCloseTo((VP.height - CARD.height) / 2, 0);
  });

  it("placement 'center' explicite → centré", () => {
    const target: Rect = { top: 200, left: 550, width: 100, height: 40 };
    expect(computeCardPlacement(target, CARD, VP, "center").placement).toBe("center");
  });

  it("mobile : très petit viewport → repli centré et carte à l'écran", () => {
    const mobileVP: Viewport = { width: 360, height: 640 };
    const bigTarget: Rect = { top: 0, left: 0, width: 360, height: 640 };
    const p = computeCardPlacement(bigTarget, { width: 332, height: 200 }, mobileVP, "bottom");
    expect(p.placement).toBe("center");
    expect(p.left).toBeGreaterThanOrEqual(14);
    expect(p.top).toBeGreaterThanOrEqual(14);
  });
});

describe("computeSpotlightRect", () => {
  it("ajoute la marge autour de la cible", () => {
    const target: Rect = { top: 100, left: 200, width: 50, height: 30 };
    const r = computeSpotlightRect(target, 8);
    expect(r).toEqual({ top: 92, left: 192, width: 66, height: 46 });
  });
});

describe("isRectInViewport", () => {
  it("détecte la visibilité partielle", () => {
    expect(isRectInViewport({ top: 100, left: 100, width: 50, height: 50 }, VP)).toBe(true);
    expect(isRectInViewport({ top: -200, left: 100, width: 50, height: 50 }, VP)).toBe(false);
    expect(isRectInViewport({ top: 900, left: 100, width: 50, height: 50 }, VP)).toBe(false);
  });
});

describe("computePointerAnchor", () => {
  const target: Rect = { top: 200, left: 500, width: 100, height: 40 };
  it("pointe l'arête proche de la carte selon le placement", () => {
    expect(computePointerAnchor(target, "bottom")).toEqual({ x: 550, y: 240 });
    expect(computePointerAnchor(target, "top")).toEqual({ x: 550, y: 200 });
    expect(computePointerAnchor(target, "left")).toEqual({ x: 500, y: 220 });
    expect(computePointerAnchor(target, "right")).toEqual({ x: 600, y: 220 });
    expect(computePointerAnchor(target, "center")).toEqual({ x: 550, y: 220 });
  });
});

describe("pointeur ancré sur le placement RÉELLEMENT résolu (Étape 4)", () => {
  it("préféré 'bottom' sans place en dessous → placement 'top' → pointeur sur l'arête haute", () => {
    const target: Rect = { top: 720, left: 550, width: 100, height: 40 };
    const resolved = computeCardPlacement(target, CARD, VP, "bottom");
    expect(resolved.placement).toBe("top"); // fallback réel
    // Le pointeur DOIT utiliser le placement résolu, pas le préféré.
    const anchorFromResolved = computePointerAnchor(target, resolved.placement);
    const anchorFromPreferred = computePointerAnchor(target, "bottom");
    expect(anchorFromResolved).toEqual({ x: 600, y: 720 }); // arête HAUTE de la cible
    expect(anchorFromResolved).not.toEqual(anchorFromPreferred);
  });
});

describe("auto-scroll intelligent (Étape 5)", () => {
  const vp: Viewport = { width: 1200, height: 800 };
  const safeTop = 96;
  const safeBottom = 24;

  it("cible déjà entièrement visible → pas de scroll", () => {
    const rect: Rect = { top: 300, left: 400, width: 200, height: 120 };
    expect(isTargetComfortablyVisible(rect, vp, safeTop, safeBottom)).toBe(true);
    expect(shouldScrollToTarget(rect, vp, safeTop, safeBottom)).toBe(false);
  });

  it("cible en dessous du viewport → scroll", () => {
    const rect: Rect = { top: 900, left: 400, width: 200, height: 120 };
    expect(shouldScrollToTarget(rect, vp, safeTop, safeBottom)).toBe(true);
  });

  it("cible cachée sous le header fixe → scroll", () => {
    const rect: Rect = { top: 20, left: 400, width: 200, height: 120 };
    expect(shouldScrollToTarget(rect, vp, safeTop, safeBottom)).toBe(true);
  });

  it("cible plus grande que la zone utile mais calée en haut → pas de scroll", () => {
    const rect: Rect = { top: 100, left: 0, width: 1200, height: 900 };
    expect(isTargetComfortablyVisible(rect, vp, safeTop, safeBottom)).toBe(true);
    expect(shouldScrollToTarget(rect, vp, safeTop, safeBottom)).toBe(false);
  });
});
