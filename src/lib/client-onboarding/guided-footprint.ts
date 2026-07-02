// Client Onboarding — Empreinte guidée (P9.2, Étape 6, cœur PUR).
//
// Assemble l'état des sections de l'empreinte entreprise à partir de complétudes
// par section (calculées par la couche React depuis le modèle EXISTANT
// GlobalOnboardingDraft / EnterpriseFootprint — jamais un nouveau modèle
// concurrent). Réutilise les contrats P9.1 (FootprintSectionState,
// deriveOverallCompletion). Déterministe → testable en `node`.

import {
  deriveOverallCompletion,
  type FootprintSectionState,
  type FootprintSectionStatus,
} from "@/lib/onboarding-foundations/client-onboarding-contracts";

/** Définition d'une section (alignée sur le vocabulaire d'onboarding existant). */
export interface FootprintSectionDef {
  readonly id: string;
  readonly label: string;
  readonly helpText: string;
  readonly optional?: boolean;
}

export const FOOTPRINT_SECTIONS: readonly FootprintSectionDef[] = [
  { id: "identity", label: "Identité de l'entreprise", helpText: "Nom, taille, secteur, pays, langue." },
  { id: "team", label: "Équipe & validations", helpText: "Qui valide quoi, approbateurs et périmètres." },
  { id: "documents", label: "Documents", helpText: "Contrats, modèles et références utilisés." },
  { id: "rules", label: "Règles & gouvernance", helpText: "Règles d'approbation et cas sensibles." },
  { id: "technologies", label: "Technologies", helpText: "État des briques CloneStore activées." },
  { id: "mission", label: "Premier objectif", helpText: "La première mission confiée à Pierre.", optional: true },
];

export type SectionCompletionMap = Readonly<Record<string, { completion: number; savedAt?: string }>>;

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function sectionStatus(completion: number): FootprintSectionStatus {
  const c = clamp01(completion);
  if (c >= 1) return "complete";
  if (c > 0) return "in_progress";
  return "empty";
}

/** Construit l'état des sections (dans l'ordre canonique) depuis les complétudes. */
export function buildFootprintSections(inputs: SectionCompletionMap): FootprintSectionState[] {
  return FOOTPRINT_SECTIONS.map((def) => {
    const raw = inputs[def.id];
    const completion = clamp01(raw?.completion ?? 0);
    return {
      id: def.id,
      label: def.label,
      status: sectionStatus(completion),
      completion,
      savedAt: raw?.savedAt,
    };
  });
}

/** Complétude globale (réutilise le helper pur P9.1). */
export function footprintOverall(sections: readonly FootprintSectionState[]): number {
  return deriveOverallCompletion(sections);
}

/** Première section incomplète (hors optionnelles vides) → point de reprise. */
export function firstIncompleteSectionId(sections: readonly FootprintSectionState[]): string | null {
  const optional = new Set(FOOTPRINT_SECTIONS.filter((s) => s.optional).map((s) => s.id));
  const target = sections.find((s) => s.status !== "complete" && !optional.has(s.id));
  return target ? target.id : null;
}

/** L'empreinte est-elle « suffisante » (sections requises complètes) ? */
export function isFootprintSufficient(
  sections: readonly FootprintSectionState[],
  threshold = 0.7,
): boolean {
  const requiredIds = new Set(FOOTPRINT_SECTIONS.filter((s) => !s.optional).map((s) => s.id));
  const required = sections.filter((s) => requiredIds.has(s.id));
  if (required.length === 0) return false;
  return footprintOverall(required) >= clamp01(threshold);
}
