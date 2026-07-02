"use client";

// Contexte React du guided tour (P9.1).
// Séparé du provider pour permettre au hook useGuidedTour de l'importer sans
// dépendance circulaire.

import { createContext } from "react";
import type {
  Tour,
  TourProgressView,
  TourState,
  TourStatus,
  TourStep,
} from "@/lib/guided-tour";

export interface GuidedTourApi {
  readonly status: TourStatus;
  readonly activeTour: Tour | null;
  readonly currentStep: TourStep | null;
  readonly stepIndex: number;
  readonly progress: TourProgressView;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isActive: boolean;
  startTour: (tourId: string, options?: { atStep?: number }) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  skip: () => void;
  finish: () => void;
  stop: () => void;
}

export const GuidedTourContext = createContext<GuidedTourApi | null>(null);

export type { TourState };
