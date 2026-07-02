// Guided Tour — machine à états pure (P9.1).
//
// Réducteur déterministe et sans effet de bord : (state, action, tour) → state.
// Aucune dépendance DOM. Garantit qu'aucune transition ne "boucle" (pas de
// dépassement d'index, pas de PREV sous 0, pas de NEXT au-delà de la fin sans
// passer par "completed").

import type { Tour, TourState } from "./types";

export type TourAction =
  | { readonly type: "START"; readonly tour: Tour; readonly atStep?: number }
  | { readonly type: "NEXT" }
  | { readonly type: "PREV" }
  | { readonly type: "GO_TO"; readonly index: number }
  | { readonly type: "SKIP" }
  | { readonly type: "COMPLETE" }
  | { readonly type: "STOP" };

export const IDLE_STATE: TourState = {
  status: "idle",
  tourId: null,
  version: null,
  stepIndex: 0,
};

export function createInitialState(): TourState {
  return IDLE_STATE;
}

export function clampStepIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(index) || index < 0) return 0;
  if (index > length - 1) return length - 1;
  return Math.floor(index);
}

export function tourReducer(
  state: TourState,
  action: TourAction,
  tour: Tour | null,
): TourState {
  switch (action.type) {
    case "START": {
      const length = action.tour.steps.length;
      if (length === 0) return state; // rien à jouer
      const start = clampStepIndex(action.atStep ?? 0, length);
      return {
        status: "running",
        tourId: action.tour.id,
        version: action.tour.version,
        stepIndex: start,
      };
    }

    case "NEXT": {
      if (state.status !== "running" || !tour) return state;
      const last = tour.steps.length - 1;
      if (state.stepIndex >= last) {
        // Dernière étape : NEXT termine proprement (pas de boucle).
        return { ...state, status: "completed", stepIndex: last };
      }
      return { ...state, stepIndex: state.stepIndex + 1 };
    }

    case "PREV": {
      if (state.status !== "running" || !tour) return state;
      if (state.stepIndex <= 0) return state; // pas de retour sous 0
      return { ...state, stepIndex: state.stepIndex - 1 };
    }

    case "GO_TO": {
      if (state.status !== "running" || !tour) return state;
      return { ...state, stepIndex: clampStepIndex(action.index, tour.steps.length) };
    }

    case "SKIP": {
      if (state.status !== "running") return state;
      return { ...state, status: "skipped" };
    }

    case "COMPLETE": {
      if (state.status !== "running" || !tour) return state;
      return { ...state, status: "completed", stepIndex: tour.steps.length - 1 };
    }

    case "STOP": {
      return { ...IDLE_STATE };
    }

    default:
      return state;
  }
}

// — Sélecteurs purs —

export function isTourActive(state: TourState): boolean {
  return state.status === "running";
}

export function selectCurrentStep(state: TourState, tour: Tour | null) {
  if (state.status !== "running" || !tour) return null;
  const index = clampStepIndex(state.stepIndex, tour.steps.length);
  return tour.steps[index] ?? null;
}

export function isFirstStep(state: TourState): boolean {
  return state.stepIndex <= 0;
}

export function isLastStep(state: TourState, tour: Tour | null): boolean {
  if (!tour || tour.steps.length === 0) return false;
  return state.stepIndex >= tour.steps.length - 1;
}

// — Identité de résolution (anti stale-step, P9.1 correction) —
// Clé déterministe identifiant EXACTEMENT l'étape en cours (tour + version +
// index). L'UI (carte/pointeur/ring) n'est rendue que si la géométrie a été
// résolue POUR cette clé — jamais avec le rectangle de l'étape précédente,
// même le temps d'une frame.

export function stepResolutionKey(state: TourState): string | null {
  if (state.status !== "running" || !state.tourId) return null;
  return `${state.tourId}:${state.version ?? 0}:${state.stepIndex}`;
}

export function isResolutionReady(
  resolutionKey: string | null | undefined,
  currentKey: string | null | undefined,
): boolean {
  return !!currentKey && !!resolutionKey && resolutionKey === currentKey;
}

export interface TourProgressView {
  readonly current: number;
  readonly total: number;
  readonly ratio: number;
}

export function selectProgress(state: TourState, tour: Tour | null): TourProgressView {
  const total = tour ? tour.steps.length : 0;
  const current = total === 0 ? 0 : clampStepIndex(state.stepIndex, total) + 1;
  const ratio = total === 0 ? 0 : current / total;
  return { current, total, ratio };
}
