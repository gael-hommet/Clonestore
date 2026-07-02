// Client Onboarding — Quick Start (P9.2, Étape 5, cœur PUR).
//
// Machine déterministe et sans effet de bord bâtie sur `QuickStartContract`
// (P9.1, réutilisé — jamais dupliqué). Collecte le strict minimum (identité,
// taille, secteur, pays, premier objectif) en quelques écrans cohérents, avec
// validation, progression, complétude et reprise (premier écran incomplet).
// Testable en environnement `node`.

import type { QuickStartContract } from "@/lib/onboarding-foundations/client-onboarding-contracts";

/** Brouillon éditable : mêmes clés, valeurs possiblement vides pendant la saisie. */
export type QuickStartDraft = { [K in keyof QuickStartContract]: string };

export type QuickStartField = keyof QuickStartContract;

/** Tailles d'entreprise autorisées (source unique). */
export const QUICK_START_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

export interface QuickStartScreen {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly QuickStartField[];
}

/** Un petit groupe cohérent par écran (durée réaliste < 5 min). */
export const QUICK_START_SCREENS: readonly QuickStartScreen[] = [
  { id: "identity", title: "Votre entreprise", fields: ["companyName", "companySize"] },
  { id: "context", title: "Votre contexte", fields: ["sector", "country"] },
  { id: "objective", title: "Votre premier objectif", fields: ["firstObjective"] },
];

export function createEmptyQuickStart(): QuickStartDraft {
  return { companyName: "", companySize: "", sector: "", country: "", firstObjective: "" };
}

/** Validation d'un champ : message d'erreur précis, ou null si valide. */
export function validateField(field: QuickStartField, value: string): string | null {
  const v = (value ?? "").trim();
  switch (field) {
    case "companyName":
      if (!v) return "Indiquez le nom de votre entreprise.";
      if (v.length < 2) return "Le nom semble trop court.";
      return null;
    case "companySize":
      if (!v) return "Sélectionnez la taille de votre entreprise.";
      if (!QUICK_START_SIZES.includes(v as (typeof QUICK_START_SIZES)[number]))
        return "Choisissez une taille dans la liste.";
      return null;
    case "sector":
      if (!v) return "Indiquez votre secteur d'activité.";
      return null;
    case "country":
      if (!v) return "Indiquez votre pays.";
      return null;
    case "firstObjective":
      if (!v) return "Décrivez en une phrase ce que vous aimeriez confier à Pierre.";
      if (v.length < 8) return "Un peu plus de détail aiderait Pierre à démarrer.";
      return null;
    default:
      return null;
  }
}

export function isFieldValid(field: QuickStartField, draft: QuickStartDraft): boolean {
  return validateField(field, draft[field]) === null;
}

export function isScreenComplete(screen: QuickStartScreen, draft: QuickStartDraft): boolean {
  return screen.fields.every((f) => isFieldValid(f, draft));
}

const ALL_FIELDS: readonly QuickStartField[] = QUICK_START_SCREENS.flatMap((s) => s.fields);

/** Progression 0..1 (part des champs valides). */
export function quickStartProgress(draft: QuickStartDraft): number {
  const valid = ALL_FIELDS.filter((f) => isFieldValid(f, draft)).length;
  return ALL_FIELDS.length === 0 ? 0 : valid / ALL_FIELDS.length;
}

export function isQuickStartComplete(draft: QuickStartDraft): boolean {
  return ALL_FIELDS.every((f) => isFieldValid(f, draft));
}

/** Premier écran incomplet → point de reprise exact après rechargement. */
export function firstIncompleteScreenIndex(draft: QuickStartDraft): number {
  const idx = QUICK_START_SCREENS.findIndex((s) => !isScreenComplete(s, draft));
  return idx === -1 ? QUICK_START_SCREENS.length - 1 : idx;
}

/** Écran suivant recommandé (borné, sans boucle). */
export function nextScreenIndex(current: number, draft: QuickStartDraft): number {
  const last = QUICK_START_SCREENS.length - 1;
  if (current >= last) return last;
  if (!isScreenComplete(QUICK_START_SCREENS[current], draft)) return current;
  return current + 1;
}

export function prevScreenIndex(current: number): number {
  return current <= 0 ? 0 : current - 1;
}

/** Estimation lisible du temps restant. */
export function estimateRemaining(draft: QuickStartDraft): string {
  const remaining = ALL_FIELDS.filter((f) => !isFieldValid(f, draft)).length;
  if (remaining === 0) return "Terminé";
  if (remaining <= 2) return "moins d'une minute";
  return "moins de 5 minutes";
}

/** Fige un brouillon valide en contrat (à persister). Null si incomplet. */
export function toQuickStartContract(draft: QuickStartDraft): QuickStartContract | null {
  if (!isQuickStartComplete(draft)) return null;
  return {
    companyName: draft.companyName.trim(),
    companySize: draft.companySize.trim(),
    sector: draft.sector.trim(),
    country: draft.country.trim(),
    firstObjective: draft.firstObjective.trim(),
  };
}
