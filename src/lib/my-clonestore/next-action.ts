// My CloneStore — prochaine action de démarrage (P9.2, cœur PUR).
//
// Détermine, à partir de la complétude réelle (Quick Start + empreinte), l'unique
// « prochaine action » présentée sur la home : étape, titre, description, CTA,
// progression globale et temps estimé. Déterministe → testable en `node`.

import type { NextAction, StartupStage } from "./types";

export interface NextActionInput {
  readonly quickStartComplete: boolean;
  /** 0..1 — progression du Quick Start. */
  readonly quickStartProgress: number;
  /** 0..1 — complétude de l'empreinte guidée. */
  readonly footprintCompletion: number;
}

export interface NextActionOptions {
  readonly onboardingHref?: string;
  /** Seuil de complétude d'empreinte jugé « suffisant » (0..1). */
  readonly sufficientThreshold?: number;
}

const DEFAULTS = { onboardingHref: "/profile/onboarding", sufficientThreshold: 0.7 } as const;

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function resolveNextAction(
  input: NextActionInput,
  options: NextActionOptions = {},
): NextAction {
  const href = options.onboardingHref ?? DEFAULTS.onboardingHref;
  const threshold = options.sufficientThreshold ?? DEFAULTS.sufficientThreshold;
  const qs = clamp01(input.quickStartProgress);
  const fp = clamp01(input.footprintCompletion);

  // Le Quick Start pèse la première moitié de la progression, l'empreinte la seconde.
  const overall = input.quickStartComplete ? 0.5 + fp * 0.5 : qs * 0.5;

  const make = (
    stage: StartupStage,
    title: string,
    description: string,
    label: string,
    estimatedTime?: string,
  ): NextAction => ({
    stage,
    title,
    description,
    cta: { label, href },
    progress: clamp01(overall),
    estimatedTime,
  });

  if (!input.quickStartComplete) {
    if (qs <= 0) {
      return make(
        "not_started",
        "Démarrez avec CloneStore",
        "Cinq minutes suffisent pour donner à Pierre le contexte de votre entreprise.",
        "Démarrer",
        "moins de 5 min",
      );
    }
    return make(
      "quick_start_in_progress",
      "Terminez votre démarrage",
      "Reprenez là où vous vous êtes arrêté. Rien n'est perdu.",
      "Continuer",
      "moins de 5 min",
    );
  }

  if (fp >= threshold) {
    return make(
      "footprint_sufficient",
      "Votre entreprise est prête",
      "Pierre dispose de l'essentiel. Vous pouvez enrichir l'empreinte à tout moment.",
      "Voir mon entreprise",
    );
  }

  if (fp > 0) {
    return make(
      "footprint_in_progress",
      "Complétez l'empreinte de votre entreprise",
      "Chaque section renseignée rend Pierre plus juste et plus autonome.",
      "Continuer l'empreinte",
    );
  }

  return make(
    "quick_start_complete",
    "Renseignez l'empreinte de votre entreprise",
    "Le démarrage est fait. Ajoutez le contexte qui aidera Pierre à bien travailler.",
    "Commencer l'empreinte",
  );
}
