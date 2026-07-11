// src/lib/clonestore/founder-acceptance/pierre-economic-value-matrix.ts
// P14 §5 — Matrice de VALEUR ÉCONOMIQUE. Compare Pierre au COÛT de l'exécution RH (pas à un outil IA
// généraliste). Module PUR. Toutes les hypothèses (coût humain, coût horaire, heures) sont des ENTRÉES
// configurables — AUCUNE donnée salariale n'est codée en dur comme vérité légale/financière. Ne
// promet AUCUN gain garanti ni remplacement universel.

/** Prix Pierre de référence (P10, source de vérité unique — repris ici pour l'affichage). */
export const PIERRE_PRICE_EUR_MONTHLY = 449;
export const PIERRE_PRICE_CHF_MONTHLY = 499;

const round2 = (n: number) => Math.round(n * 100) / 100;
const nn = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);

export interface MonthlySavingsInput {
  readonly pierrePrice: number;          // ex. 449 (EUR) ou 499 (CHF)
  readonly humanMonthlyCost?: number;    // coût mensuel chargé d'une capacité RH humaine (hypothèse configurable)
  readonly estimatedHoursSaved?: number; // heures RH opérationnelles absorbées / mois
  readonly hourlyCost?: number;          // coût horaire interne (hypothèse configurable)
  readonly avoidedAdminHours?: number;   // heures admin évitées / mois
  readonly avoidedManagerHours?: number; // heures manager évitées / mois
}

export interface MonthlySavingsResult {
  readonly pierrePrice: number;
  readonly totalHoursAbsorbed: number;
  readonly grossValueOfHours: number | null;   // null si aucun coût horaire fourni
  readonly netMonthlyEstimate: number | null;  // grossValue - pierrePrice (estimation, non garantie)
  readonly vsHumanMonthlyCost: number | null;  // humanMonthlyCost - pierrePrice (si fourni)
  readonly breakEvenReached: boolean | null;   // netMonthlyEstimate >= 0 ?
  readonly isEstimate: true;
  readonly assumptions: string[];
  readonly disclaimer: string;
}

/**
 * Estimation de gain mensuel — ESTIMATION configurable, jamais un gain garanti. Sans coût horaire ni
 * coût humain fournis, ne renvoie que le volume d'heures absorbées (pas de montant inventé). Pur.
 */
export function monthlySavingsEstimate(input: MonthlySavingsInput): MonthlySavingsResult {
  const pierrePrice = nn(input.pierrePrice, PIERRE_PRICE_EUR_MONTHLY);
  const totalHoursAbsorbed = round2(nn(input.estimatedHoursSaved) + nn(input.avoidedAdminHours) + nn(input.avoidedManagerHours));
  const hourlyCost = typeof input.hourlyCost === "number" && input.hourlyCost > 0 ? input.hourlyCost : null;
  const grossValueOfHours = hourlyCost !== null ? round2(totalHoursAbsorbed * hourlyCost) : null;
  const netMonthlyEstimate = grossValueOfHours !== null ? round2(grossValueOfHours - pierrePrice) : null;
  const vsHumanMonthlyCost = typeof input.humanMonthlyCost === "number" && input.humanMonthlyCost > 0
    ? round2(input.humanMonthlyCost - pierrePrice) : null;
  const breakEvenReached = netMonthlyEstimate !== null ? netMonthlyEstimate >= 0 : null;

  const assumptions: string[] = [
    "Toutes les valeurs (coût humain, coût horaire, heures) sont des HYPOTHÈSES fournies par l'utilisateur, non des données vérifiées.",
    "Le gain réel dépend du volume RH réel de l'entreprise et de son coût horaire interne.",
  ];
  if (hourlyCost === null) assumptions.push("Aucun coût horaire fourni → seul le volume d'heures absorbées est estimé (pas de montant).");
  if (vsHumanMonthlyCost === null) assumptions.push("Aucun coût humain mensuel fourni → pas de comparaison directe d'embauche.");

  return {
    pierrePrice, totalHoursAbsorbed, grossValueOfHours, netMonthlyEstimate, vsHumanMonthlyCost, breakEvenReached,
    isEstimate: true, assumptions,
    disclaimer: "Estimation indicative et non garantie. Pierre ne remplace pas toute la RH ni un logiciel de paie ; il absorbe de l'exécution RH opérationnelle sous validation humaine. Aucune donnée salariale n'est présentée comme vérité légale/financière.",
  };
}

export interface RoiBreakEvenInput { readonly pierrePrice: number; readonly hourlyCost: number }
export interface RoiBreakEvenResult {
  readonly pierrePrice: number;
  readonly hourlyCost: number | null;
  readonly breakEvenHours: number | null;  // heures/mois à absorber pour rentabiliser Pierre
  readonly isEstimate: true;
  readonly note: string;
}

/** Heures mensuelles à absorber pour atteindre le seuil de rentabilité = prix / coût horaire. Pur. */
export function roiBreakEvenHours(input: RoiBreakEvenInput): RoiBreakEvenResult {
  const pierrePrice = nn(input.pierrePrice, PIERRE_PRICE_EUR_MONTHLY);
  const hourlyCost = typeof input.hourlyCost === "number" && input.hourlyCost > 0 ? input.hourlyCost : null;
  const breakEvenHours = hourlyCost !== null ? round2(pierrePrice / hourlyCost) : null;
  return {
    pierrePrice, hourlyCost, breakEvenHours, isEstimate: true,
    note: hourlyCost === null
      ? "Fournissez un coût horaire interne positif pour estimer le seuil de rentabilité."
      : `À ${hourlyCost}/h, Pierre est rentabilisé s'il absorbe ~${breakEvenHours} h de charge RH par mois (estimation, non garantie).`,
  };
}

export interface SafeRoiCopy {
  readonly positioning: string;
  readonly threshold: string;
  readonly disclaimer: string;
  readonly forbidden: string[];
}

/** Copie ROI SÛRE (prudente, sans gain garanti ni donnée salariale légale). Pur. */
export function generateSafeRoiCopy(): SafeRoiCopy {
  return {
    positioning: "Pierre ne se compare pas à un outil IA généraliste. Il se compare à la charge RH opérationnelle qu'il absorbe : documents, relances, dossiers, validations, onboarding, absences, pré-paie et suivi.",
    threshold: "Si Pierre retire seulement 10 à 15 heures de charge RH mensuelle, il peut déjà devenir rentable selon le coût horaire interne.",
    disclaimer: "Estimations indicatives, non garanties. Aucune donnée salariale n'est présentée comme vérifiée. Pierre ne remplace pas toute la RH ni un moteur de paie, et garde les décisions sensibles sous validation humaine.",
    forbidden: [
      "Ne pas promettre de gains exacts garantis.",
      "Ne pas présenter de données salariales comme vérifiées légalement.",
      "Ne pas prétendre à un remplacement universel de la RH.",
    ],
  };
}
