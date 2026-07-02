// Fondations de l'onboarding client — CONTRATS UNIQUEMENT (P9.1).
//
// ⚠️ P9.1 ne construit PAS les interfaces d'onboarding post-achat. Ce fichier
// ne contient que des TYPES/contrats partagés, destinés à être consommés par
// P9.2 (Quick Start, Empreinte guidée, Empreinte continue) sans duplication.
// Aucune UI, aucun runtime, aucun effet de bord ici. Ces contrats s'alignent
// volontairement sur le vocabulaire de l'empreinte entreprise déjà présent dans
// src/lib/clonestore/onboarding (global-onboarding) pour éviter les divergences.
//
// Voir P9_1_PRODUCT_ARCHITECTURE.md → « Fondations de l'onboarding client ».

/** Étape 1 — Quick Start (< 5 min) : identité entreprise minimale + 1ᵉʳ objectif. */
export interface QuickStartContract {
  readonly companyName: string;
  readonly companySize: string; // ex. "1-10", "11-50"…
  readonly sector: string;
  readonly country: string;
  /** Premier objectif exprimé en langage naturel (mène rapidement dans Pierre). */
  readonly firstObjective: string;
}

/** Progression d'une section d'empreinte (guidée). */
export type FootprintSectionStatus = "empty" | "in_progress" | "complete" | "skipped";

export interface FootprintSectionState {
  readonly id: string;
  readonly label: string;
  readonly status: FootprintSectionStatus;
  /** 0..1 — complétude de la section. */
  readonly completion: number;
  /** Sauvegarde automatique : horodatage ISO de la dernière écriture locale. */
  readonly savedAt?: string;
}

export interface GuidedFootprintContract {
  readonly sections: readonly FootprintSectionState[];
  /** 0..1 — complétude globale, dérivée des sections. */
  readonly overallCompletion: number;
  /** Reprise possible plus tard : la progression est persistée. */
  readonly resumable: boolean;
}

/** Provenance d'une information enrichie pendant l'usage (empreinte continue). */
export type FootprintProvenance = "human" | "pierre_suggested" | "imported";

export interface ContinuousFootprintEntryContract {
  readonly field: string;
  readonly value: string;
  readonly provenance: FootprintProvenance;
  /** Une suggestion Pierre requiert une validation humaine avant adoption. */
  readonly requiresHumanValidation: boolean;
  readonly validated: boolean;
  /** Horodatage ISO — trace/historique pour la confiance. */
  readonly recordedAt: string;
}

/**
 * Un parcours d'onboarding client, décrit de manière générique. Sert de contrat
 * partagé entre Quick Start, Empreinte guidée et Empreinte continue. Le moteur
 * de guided tour (src/lib/guided-tour) reste distinct : la découverte publique
 * et l'onboarding client sont deux usages du même principe « progression
 * guidée, persistée, reprenable », mais ne partagent que ces contrats.
 */
export interface ClientOnboardingContract {
  readonly quickStart: QuickStartContract | null;
  readonly guidedFootprint: GuidedFootprintContract | null;
  readonly continuous: readonly ContinuousFootprintEntryContract[];
}

/** Complétude globale dérivée (helper pur, réutilisable en P9.2). */
export function deriveOverallCompletion(
  sections: readonly FootprintSectionState[],
): number {
  if (sections.length === 0) return 0;
  const total = sections.reduce((sum, section) => sum + clamp01(section.completion), 0);
  return clamp01(total / sections.length);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
