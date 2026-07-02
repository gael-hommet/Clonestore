// Guided Tour — géométrie pure (P9.1).
//
// Calcule le placement de la carte (au-dessus / dessous / gauche / droite /
// centré), avec repli automatique quand la position préférée déborde du
// viewport, ainsi que le rectangle de spotlight et l'ancre du pointeur.
// Tout est du calcul pur → testable sans DOM.

import type { Rect, Size, TourPlacement, Viewport } from "./types";

export interface CardPlacement {
  readonly placement: TourPlacement;
  readonly top: number;
  readonly left: number;
}

export interface PointerAnchor {
  readonly x: number;
  readonly y: number;
}

export const DEFAULT_GAP = 16;
export const VIEWPORT_MARGIN = 14;

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Ordre de repli : la position préférée d'abord, puis les alternatives. */
export function placementFallbackOrder(preferred: TourPlacement): TourPlacement[] {
  const base: TourPlacement[] = ["bottom", "top", "right", "left"];
  if (preferred === "center") return ["center"];
  return [preferred, ...base.filter((p) => p !== preferred)];
}

/** Y a-t-il assez de place pour un placement donné (axe principal) ? */
export function hasRoomFor(
  placement: TourPlacement,
  target: Rect,
  card: Size,
  viewport: Viewport,
  gap: number,
  margin: number,
): boolean {
  switch (placement) {
    case "bottom":
      return target.top + target.height + gap + card.height <= viewport.height - margin;
    case "top":
      return target.top - gap - card.height >= margin;
    case "right":
      return target.left + target.width + gap + card.width <= viewport.width - margin;
    case "left":
      return target.left - gap - card.width >= margin;
    case "center":
    default:
      return true;
  }
}

function rawPosition(
  placement: TourPlacement,
  target: Rect,
  card: Size,
  gap: number,
): { top: number; left: number } {
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  switch (placement) {
    case "top":
      return { top: target.top - gap - card.height, left: centerX - card.width / 2 };
    case "bottom":
      return { top: target.top + target.height + gap, left: centerX - card.width / 2 };
    case "left":
      return { top: centerY - card.height / 2, left: target.left - gap - card.width };
    case "right":
      return { top: centerY - card.height / 2, left: target.left + target.width + gap };
    case "center":
    default:
      return { top: 0, left: 0 };
  }
}

function centeredPlacement(card: Size, viewport: Viewport, margin: number): CardPlacement {
  return {
    placement: "center",
    top: clamp(
      (viewport.height - card.height) / 2,
      margin,
      Math.max(margin, viewport.height - card.height - margin),
    ),
    left: clamp(
      (viewport.width - card.width) / 2,
      margin,
      Math.max(margin, viewport.width - card.width - margin),
    ),
  };
}

/**
 * Position de la carte. Si la cible est absente ou le placement demandé est
 * "center", la carte est centrée. Sinon on essaie la position préférée puis les
 * replis ; l'axe perpendiculaire est toujours borné pour rester à l'écran.
 */
export function computeCardPlacement(
  target: Rect | null,
  card: Size,
  viewport: Viewport,
  preferred: TourPlacement = "bottom",
  gap: number = DEFAULT_GAP,
  margin: number = VIEWPORT_MARGIN,
): CardPlacement {
  if (!target || preferred === "center") {
    return centeredPlacement(card, viewport, margin);
  }

  const maxTop = Math.max(margin, viewport.height - card.height - margin);
  const maxLeft = Math.max(margin, viewport.width - card.width - margin);

  for (const placement of placementFallbackOrder(preferred)) {
    if (placement === "center") continue;
    if (!hasRoomFor(placement, target, card, viewport, gap, margin)) continue;
    const pos = rawPosition(placement, target, card, gap);
    return {
      placement,
      top: clamp(pos.top, margin, maxTop),
      left: clamp(pos.left, margin, maxLeft),
    };
  }

  // Aucun placement ne tient (cible qui remplit l'écran, très petit viewport…) :
  // repli centré, la carte reste lisible et à l'écran.
  return centeredPlacement(card, viewport, margin);
}

/** Rectangle de spotlight = cible + marge, borné au viewport. */
export function computeSpotlightRect(
  target: Rect,
  padding = 8,
  viewport?: Viewport,
): Rect {
  const top = target.top - padding;
  const left = target.left - padding;
  const width = target.width + padding * 2;
  const height = target.height + padding * 2;
  if (!viewport) return { top, left, width, height };
  const boundedLeft = clamp(left, 0, Math.max(0, viewport.width));
  const boundedTop = clamp(top, 0, Math.max(0, viewport.height));
  return {
    top: boundedTop,
    left: boundedLeft,
    width: Math.min(width, viewport.width - boundedLeft + Math.max(0, -left)),
    height: Math.min(height, viewport.height - boundedTop + Math.max(0, -top)),
  };
}

/** Est-ce que le rectangle est (au moins partiellement) dans le viewport ? */
export function isRectInViewport(rect: Rect, viewport: Viewport): boolean {
  return (
    rect.left < viewport.width &&
    rect.top < viewport.height &&
    rect.left + rect.width > 0 &&
    rect.top + rect.height > 0
  );
}

// — Auto-scroll intelligent (P9.1 correction) —
// Ne scroller QUE si la cible n'est pas déjà confortablement visible, en tenant
// compte du header fixe (safeTop) et d'une marge basse (safeBottom).

export const HEADER_SAFE_TOP = 96;
export const SCROLL_SAFE_BOTTOM = 24;

/**
 * La cible est-elle confortablement visible dans la zone sûre du viewport ?
 * - cas normal : entièrement entre safeTop et (hauteur - safeBottom) ;
 * - cible plus grande que la zone utile : confortable si son HAUT est calé près
 *   de la zone sûre (on voit le début de l'élément).
 */
export function isTargetComfortablyVisible(
  rect: Rect,
  viewport: Viewport,
  safeTop: number = HEADER_SAFE_TOP,
  safeBottom: number = SCROLL_SAFE_BOTTOM,
): boolean {
  if (rect.top >= safeTop && rect.top + rect.height <= viewport.height - safeBottom) {
    return true;
  }
  const usable = viewport.height - safeTop - safeBottom;
  if (rect.height > usable) {
    return rect.top >= safeTop - 8 && rect.top <= safeTop + 80;
  }
  return false;
}

/** Faut-il déclencher un scroll vers la cible ? */
export function shouldScrollToTarget(
  rect: Rect,
  viewport: Viewport,
  safeTop: number = HEADER_SAFE_TOP,
  safeBottom: number = SCROLL_SAFE_BOTTOM,
): boolean {
  return !isTargetComfortablyVisible(rect, viewport, safeTop, safeBottom);
}

/** Ancre du pointeur : sur l'arête de la cible la plus proche de la carte. */
export function computePointerAnchor(
  target: Rect,
  placement: TourPlacement,
): PointerAnchor {
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  switch (placement) {
    case "bottom":
      return { x: centerX, y: target.top + target.height };
    case "top":
      return { x: centerX, y: target.top };
    case "left":
      return { x: target.left, y: centerY };
    case "right":
      return { x: target.left + target.width, y: centerY };
    case "center":
    default:
      return { x: centerX, y: centerY };
  }
}
