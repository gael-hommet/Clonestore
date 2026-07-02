// Guided Tour — résolution de cible (P9.1).
//
// Le ciblage repose UNIQUEMENT sur l'attribut stable `data-tour-id`, jamais sur
// des sélecteurs fragiles (nth-child, classes générées, texte exact). La couche
// pure ne connaît que le concept de "fournisseur de rectangle" (RectProvider) ;
// la variante DOM réelle est isolée et gardée pour rester sûre côté serveur.

import type { Rect } from "./types";

/** Construit le sélecteur canonique pour une cible de tour. */
export function tourTargetSelector(targetId: string): string {
  return `[data-tour-id="${escapeAttrValue(targetId)}"]`;
}

function escapeAttrValue(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/** Un identifiant de cible est valide s'il est non vide et sans guillemet brut. */
export function isValidTargetId(targetId: string | null | undefined): boolean {
  return typeof targetId === "string" && targetId.trim().length > 0;
}

export type RectProvider = (targetId: string) => Rect | null;

/** Résout la cible d'une étape ; `null` (étape centrée) → pas de rectangle. */
export function resolveTargetRect(
  targetId: string | null,
  provider: RectProvider,
): Rect | null {
  if (!isValidTargetId(targetId)) return null;
  return provider(targetId as string);
}

/**
 * Fournisseur adossé au DOM. Retourne `null` si l'élément est absent OU non
 * mis en page (largeur et hauteur nulles) — ce qui permet à l'appelant de gérer
 * une cible « pas encore chargée » ou masquée (repli centré).
 * Gardé pour rester sûr côté serveur / hors navigateur.
 */
export function createDomRectProvider(doc?: Document): RectProvider {
  return (targetId: string): Rect | null => {
    const resolved = doc ?? (typeof document !== "undefined" ? document : undefined);
    if (!resolved) return null;
    const el = resolved.querySelector(tourTargetSelector(targetId));
    if (!el) return null;
    const rect = (el as Element).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  };
}
