// Guided Tour — types partagés (P9.1).
//
// Ce module ne dépend d'AUCUNE API navigateur : il décrit uniquement la forme
// des tours, des étapes, de l'état et de la géométrie. Toute la logique métier
// (machine à états, positionnement, résolution de cible, persistance) est bâtie
// sur ces types en TypeScript pur, donc testable dans l'environnement `node`
// de Vitest sans jsdom.

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TourStepActionBehavior = "next" | "finish" | "navigate";

export type TourStepActionVariant = "primary" | "secondary" | "ghost";

export interface TourStepAction {
  readonly label: string;
  readonly behavior: TourStepActionBehavior;
  /** Requis uniquement pour behavior === "navigate". */
  readonly href?: string;
  readonly variant?: TourStepActionVariant;
}

export interface TourStep {
  readonly id: string;
  /**
   * Valeur de l'attribut `data-tour-id` de l'élément à mettre en lumière.
   * `null` → étape centrée, sans cible (ex. étape finale).
   */
  readonly targetId: string | null;
  /** Route sur laquelle vit la cible. Active les tours multi-pages. */
  readonly route?: string;
  readonly title: string;
  readonly body: string;
  /** Placement préféré de la carte par rapport à la cible. */
  readonly placement?: TourPlacement;
  /** Marge (px) autour de la cible pour le spotlight. */
  readonly spotlightPadding?: number;
  /** Actions optionnelles (ex. CTA de l'étape finale). */
  readonly actions?: readonly TourStepAction[];
}

export interface Tour {
  readonly id: string;
  /** À incrémenter pour invalider une progression stockée / reproposer le tour. */
  readonly version: number;
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly TourStep[];
}

export type TourStatus = "idle" | "running" | "completed" | "skipped";

export interface TourState {
  readonly status: TourStatus;
  readonly tourId: string | null;
  readonly version: number | null;
  readonly stepIndex: number;
}

export interface TourProgress {
  readonly tourId: string;
  readonly version: number;
  readonly status: TourStatus;
  readonly stepIndex: number;
  readonly updatedAt: string;
}

/** Rectangle en coordonnées viewport (comme getBoundingClientRect). */
export interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}
