// /demo — Acte 6 « Le coût de continuer comme avant » : MOTEUR DE CALCUL PUR.
//
// Ce module ne contient aucune promesse commerciale : il transforme les données
// saisies par le visiteur en grandeurs dérivées, et rien d'autre. Aucun composant
// ne refait un calcul de son côté — la seule source de vérité arithmétique est ici.
//
// RÈGLES VERROUILLÉES (elles font la crédibilité de la séquence) :
//
//   1. AUCUN CHIFFRE FINANCIER N'EST INVENTÉ.
//      Toute somme affichée dérive d'une valeur SAISIE par le visiteur. Le
//      scénario par défaut est un EXEMPLE ILLUSTRATIF explicitement présenté
//      comme tel et intégralement modifiable. Cette règle est la même que celle
//      appliquée par src/lib/clonestore/founder-acceptance/pierre-economic-value-matrix.ts
//      (« aucune économie financière sans coût fourni »).
//
//   2. LA MASSE SALARIALE N'EST PAS UNE ÉCONOMIE.
//      On distingue strictement : le coût MOBILISÉ (ce que l'organisation engage
//      déjà), la capacité RÉCUPÉRABLE (le temps qui pourrait être rendu, borné
//      par une hypothèse de couverture visible et modifiable) et l'écart NET
//      (capacité récupérable − abonnement). Aucune suppression de poste n'est
//      déduite, jamais.
//
//   3. LE MOTEUR PEUT CONCLURE CONTRE CLONESTORE.
//      Si l'écart net est nul ou négatif, le verdict est « no_gap » et l'interface
//      doit l'afficher tel quel. C'est une exigence, pas un cas dégradé.
//
//   4. ARITHMÉTIQUE ENTIÈRE.
//      L'argent est manipulé en unités mineures (centimes/rappen), le temps en
//      minutes — jamais de float financier. Même discipline que
//      src/lib/partner-program/money.ts.
//
//   5. PRIX = SOURCE DE VÉRITÉ UNIQUE.
//      Le tarif provient de src/lib/clonestore/pricing/country-pricing.ts via
//      pricingForCountry(). Aucun montant n'est réécrit ici. Le pays est explicite :
//      la doctrine du repo interdit de supposer silencieusement une devise.
//
// Module PUR : aucun effet de bord, aucun accès réseau, aucun import node:*.
// Sûr en SSR comme en client.

import { pricingForCountry, type CountryPricing, type LaunchCountry } from "@/lib/clonestore/pricing/country-pricing";

// ──────────────────────────────────────────────────────────────────────────
// Constantes de modèle (hypothèses documentées, affichées dans l'interface)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Base mensuelle d'un temps plein : 35 h hebdomadaires → 151,67 h/mois,
 * arrondi à 9 100 minutes (151 h 40). Sert UNIQUEMENT à convertir un temps
 * récupéré en « équivalent temps plein », jamais à conclure à une suppression
 * de poste.
 */
export const MINUTES_PER_FTE_MONTH = 9_100;

/** Libellé affiché de la base ci-dessus (aucune valeur en dur dans l'UI). */
export const FTE_BASIS_LABEL = "Base 35 h hebdomadaires — 151,67 h par mois";

/** Pays de référence par défaut du calculateur. Modifiable par le visiteur. */
export const DEFAULT_REFERENCE_COUNTRY: LaunchCountry = "FR";

// ──────────────────────────────────────────────────────────────────────────
// Entrées
// ──────────────────────────────────────────────────────────────────────────

/** Une entrée du calculateur : bornes réelles, unité, et intitulé sans jargon. */
export interface CapacityField {
  readonly id: CapacityFieldId;
  readonly label: string;
  /** Précision affichée sous le libellé (ce que la valeur recouvre exactement). */
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: "people" | "money" | "percent" | "count";
  /** true → il s'agit d'une HYPOTHÈSE de modélisation, pas d'une donnée d'entreprise. */
  readonly assumption: boolean;
}

export type CapacityFieldId =
  | "operators"
  | "employerCostPerOperator"
  | "repetitiveSharePct"
  | "vendorMonthlyCost"
  | "toolsMonthlyCost"
  | "monthlyOperations"
  | "coveredSharePct"
  | "externalReplaceableSharePct";

export type CapacityInputs = Readonly<Record<CapacityFieldId, number>>;

/**
 * Définition des champs. L'ordre est l'ordre d'affichage.
 *
 * Les deux derniers champs sont des HYPOTHÈSES DE MODÉLISATION : ils bornent ce
 * que l'employé IA peut réellement reprendre. Ils sont exposés, modifiables et
 * peuvent être mis à zéro — auquel cas le calculateur conclut qu'il n'y a rien à
 * récupérer. C'est volontaire : une hypothèse cachée serait une tricherie.
 */
export const CAPACITY_FIELDS: readonly CapacityField[] = [
  {
    id: "operators",
    label: "Collaborateurs mobilisés sur l'opérationnel",
    hint: "Les personnes qui exécutent aujourd'hui le travail administratif récurrent.",
    min: 0,
    max: 60,
    step: 1,
    unit: "people",
    assumption: false,
  },
  {
    id: "employerCostPerOperator",
    label: "Coût employeur mensuel moyen par collaborateur",
    hint: "Coût chargé, tel que votre entreprise le comptabilise.",
    min: 0,
    max: 15_000,
    step: 100,
    unit: "money",
    assumption: false,
  },
  {
    id: "repetitiveSharePct",
    label: "Part de leur temps consacrée aux tâches répétitives",
    hint: "Rechercher, recopier, vérifier, relancer, consolider, répondre plusieurs fois.",
    min: 0,
    max: 90,
    step: 5,
    unit: "percent",
    assumption: false,
  },
  {
    id: "vendorMonthlyCost",
    label: "Prestataires — coût mensuel",
    hint: "Cabinets, sous-traitance administrative, renfort externe.",
    min: 0,
    max: 30_000,
    step: 100,
    unit: "money",
    assumption: false,
  },
  {
    id: "toolsMonthlyCost",
    label: "Outils additionnels — coût mensuel",
    hint: "Licences utilisées pour compenser le travail manuel.",
    min: 0,
    max: 10_000,
    step: 50,
    unit: "money",
    assumption: false,
  },
  {
    id: "monthlyOperations",
    label: "Volume mensuel d'opérations",
    hint: "Arrivées, avenants, demandes internes, dossiers, relances, états à produire.",
    min: 0,
    max: 5_000,
    step: 10,
    unit: "count",
    assumption: false,
  },
  {
    id: "coveredSharePct",
    label: "Part du travail répétitif couverte par le périmètre de l'employé IA",
    hint: "Hypothèse. Tout le travail répétitif n'entre pas dans un périmètre confiable : ce curseur borne ce qui est réellement repris.",
    min: 0,
    max: 100,
    step: 5,
    unit: "percent",
    assumption: true,
  },
  {
    id: "externalReplaceableSharePct",
    label: "Part des prestataires et outils réellement substituable",
    hint: "Hypothèse. Un prestataire couvre souvent aussi des sujets hors périmètre : ce curseur borne ce qui pourrait être repris.",
    min: 0,
    max: 100,
    step: 5,
    unit: "percent",
    assumption: true,
  },
];

/**
 * SCÉNARIO ILLUSTRATIF PAR DÉFAUT — entreprise en croissance, plusieurs centaines
 * de salariés, fonction RH sous forte charge opérationnelle.
 *
 * Ces valeurs ne sont PAS une moyenne de marché et ne sont présentées nulle part
 * comme telle. Elles existent pour que la mécanique soit lisible immédiatement ;
 * l'interface affiche « Exemple illustratif — remplacez chaque donnée par celle
 * de votre entreprise » et chaque champ est modifiable.
 */
export const ILLUSTRATIVE_INPUTS: CapacityInputs = {
  operators: 4,
  employerCostPerOperator: 4_200,
  repetitiveSharePct: 55,
  vendorMonthlyCost: 1_800,
  toolsMonthlyCost: 600,
  monthlyOperations: 420,
  coveredSharePct: 60,
  externalReplaceableSharePct: 25,
};

const FIELD_BY_ID: Readonly<Record<CapacityFieldId, CapacityField>> = Object.freeze(
  CAPACITY_FIELDS.reduce(
    (acc, f) => {
      acc[f.id] = f;
      return acc;
    },
    {} as Record<CapacityFieldId, CapacityField>,
  ),
);

/**
 * Ramène une valeur quelconque (NaN, Infinity, négatif, décimal, chaîne vide
 * convertie en NaN…) dans les bornes du champ. Une saisie invalide vaut le
 * minimum du champ — jamais une valeur inventée, jamais NaN.
 */
export function sanitizeField(id: CapacityFieldId, value: unknown): number {
  const field = FIELD_BY_ID[id];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return field.min;
  const rounded = Math.round(n);
  if (rounded < field.min) return field.min;
  if (rounded > field.max) return field.max;
  return rounded;
}

/** Assainit l'ensemble des entrées. Toute clé manquante retombe sur le minimum. */
export function sanitizeInputs(input: Partial<Record<CapacityFieldId, unknown>>): CapacityInputs {
  const out = {} as Record<CapacityFieldId, number>;
  for (const field of CAPACITY_FIELDS) {
    out[field.id] = sanitizeField(field.id, input[field.id]);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Résultats
// ──────────────────────────────────────────────────────────────────────────

/**
 * Verdict — il peut être défavorable à CloneStore, et c'est le but.
 *   no_gap      : l'écart net est nul ou négatif → ne changez rien.
 *   marginal    : un écart existe mais reste faible (< 2× l'abonnement).
 *   significant : écart net marqué (2× à 5×).
 *   evident     : écart net important (≥ 5×).
 */
export type CostVerdict = "no_gap" | "marginal" | "significant" | "evident";

export interface CapacityResult {
  readonly inputs: CapacityInputs;
  readonly currency: string;
  readonly country: LaunchCountry;

  /** Coût mensuel total des collaborateurs mobilisés sur l'opérationnel. */
  readonly mobilisedMonthlyMinor: number;
  /** Part de ce coût consacrée aux tâches répétitives. */
  readonly repetitiveMonthlyMinor: number;
  /** Prestataires + outils. */
  readonly externalMonthlyMinor: number;

  /** Coût du statu quo = travail répétitif + prestataires + outils. */
  readonly statusQuoMonthlyMinor: number;
  readonly statusQuoAnnualMinor: number;

  /** Temps mobilisé sur le répétitif (minutes/mois). */
  readonly mobilisedMinutesMonthly: number;
  /** Temps potentiellement récupérable, borné par l'hypothèse de couverture. */
  readonly recoverableMinutesMonthly: number;
  /** Équivalent temps plein libéré, en centièmes (180 → 1,80 ETP). */
  readonly recoverableFteCenti: number;

  /** Valeur de la capacité récupérable (temps). */
  readonly recoverableCapacityMonthlyMinor: number;
  /** Part des prestataires/outils potentiellement substituable. */
  readonly externalReplaceableMonthlyMinor: number;
  /** Total potentiellement récupérable (capacité + externalisé). */
  readonly recoverableMonthlyMinor: number;
  readonly recoverableAnnualMinor: number;

  /** Abonnement de l'employé IA, au tarif canonique du pays. */
  readonly subscriptionMonthlyMinor: number;
  readonly subscriptionAnnualMinor: number;
  readonly subscriptionDisplay: string;

  /** Écart net = récupérable − abonnement. PEUT ÊTRE NÉGATIF. */
  readonly netMonthlyMinor: number;
  readonly netAnnualMinor: number;

  /** Rapport récupérable / abonnement, en points de base (10000 = 1×). */
  readonly ratioBps: number;

  /** Coût moyen d'une opération aujourd'hui — null si aucun volume saisi. */
  readonly currentCostPerOperationMinor: number | null;

  readonly verdict: CostVerdict;
}

/**
 * Calcule tout, en arithmétique entière. Toute division est un Math.floor
 * explicite : on n'arrondit jamais un montant à la hausse en faveur de CloneStore.
 */
export function computeCapacity(
  rawInputs: Partial<Record<CapacityFieldId, unknown>>,
  country: LaunchCountry = DEFAULT_REFERENCE_COUNTRY,
): CapacityResult {
  const inputs = sanitizeInputs(rawInputs);
  const pricing = resolvePricing(country);

  // — Coûts mobilisés (unités mineures entières)
  const mobilisedMonthlyMinor = inputs.operators * inputs.employerCostPerOperator * 100;
  const repetitiveMonthlyMinor = Math.floor((mobilisedMonthlyMinor * inputs.repetitiveSharePct) / 100);
  const externalMonthlyMinor = (inputs.vendorMonthlyCost + inputs.toolsMonthlyCost) * 100;

  // — Coût de continuer comme avant
  const statusQuoMonthlyMinor = repetitiveMonthlyMinor + externalMonthlyMinor;
  const statusQuoAnnualMinor = statusQuoMonthlyMinor * 12;

  // — Temps mobilisé / récupérable
  const mobilisedMinutesMonthly = Math.floor(
    (inputs.operators * MINUTES_PER_FTE_MONTH * inputs.repetitiveSharePct) / 100,
  );
  const recoverableMinutesMonthly = Math.floor(
    (mobilisedMinutesMonthly * inputs.coveredSharePct) / 100,
  );
  const recoverableFteCenti = Math.floor((recoverableMinutesMonthly * 100) / MINUTES_PER_FTE_MONTH);

  // — Capacité récupérable (jamais présentée comme une suppression de poste)
  const recoverableCapacityMonthlyMinor = Math.floor(
    (repetitiveMonthlyMinor * inputs.coveredSharePct) / 100,
  );
  const externalReplaceableMonthlyMinor = Math.floor(
    (externalMonthlyMinor * inputs.externalReplaceableSharePct) / 100,
  );
  const recoverableMonthlyMinor = recoverableCapacityMonthlyMinor + externalReplaceableMonthlyMinor;
  const recoverableAnnualMinor = recoverableMonthlyMinor * 12;

  // — Abonnement (tarif canonique du pays)
  const subscriptionMonthlyMinor = pricing.amountMinor;
  const subscriptionAnnualMinor = subscriptionMonthlyMinor * 12;

  // — Écart net : peut être négatif, et l'interface doit le montrer
  const netMonthlyMinor = recoverableMonthlyMinor - subscriptionMonthlyMinor;
  const netAnnualMinor = netMonthlyMinor * 12;

  const ratioBps =
    subscriptionMonthlyMinor > 0
      ? Math.floor((recoverableMonthlyMinor * 10_000) / subscriptionMonthlyMinor)
      : 0;

  const currentCostPerOperationMinor =
    inputs.monthlyOperations > 0
      ? Math.floor(repetitiveMonthlyMinor / inputs.monthlyOperations)
      : null;

  return {
    inputs,
    currency: pricing.currency,
    country: pricing.country,
    mobilisedMonthlyMinor,
    repetitiveMonthlyMinor,
    externalMonthlyMinor,
    statusQuoMonthlyMinor,
    statusQuoAnnualMinor,
    mobilisedMinutesMonthly,
    recoverableMinutesMonthly,
    recoverableFteCenti,
    recoverableCapacityMonthlyMinor,
    externalReplaceableMonthlyMinor,
    recoverableMonthlyMinor,
    recoverableAnnualMinor,
    subscriptionMonthlyMinor,
    subscriptionAnnualMinor,
    subscriptionDisplay: pricing.display,
    netMonthlyMinor,
    netAnnualMinor,
    ratioBps,
    currentCostPerOperationMinor,
    verdict: verdictFor(netMonthlyMinor, ratioBps),
  };
}

/** Le pays est explicite : un pays inconnu ne produit JAMAIS un prix par défaut. */
function resolvePricing(country: LaunchCountry): CountryPricing {
  const resolution = pricingForCountry(country);
  if (resolution.status !== "ok") {
    // Inatteignable : `country` est typé LaunchCountry. On échoue bruyamment
    // plutôt que d'inventer un tarif — la doctrine du repo l'interdit.
    throw new Error(`tarif indisponible pour le pays: ${String(country)}`);
  }
  return resolution.pricing;
}

function verdictFor(netMonthlyMinor: number, ratioBps: number): CostVerdict {
  if (netMonthlyMinor <= 0) return "no_gap";
  if (ratioBps < 20_000) return "marginal"; // < 2×
  if (ratioBps < 50_000) return "significant"; // < 5×
  return "evident";
}

// ──────────────────────────────────────────────────────────────────────────
// Formatage (déterministe — identique serveur et client)
// ──────────────────────────────────────────────────────────────────────────
//
// On n'utilise NI Intl.NumberFormat NI toLocaleString : leurs séparateurs
// dépendent de la version d'ICU, ce qui produirait un écart d'hydratation entre
// le rendu serveur et le rendu navigateur. Le groupement est donc explicite,
// avec l'espace fine insécable de la typographie française (U+202F).
//
// formatMinorAmount (src/lib/partner-program/money.ts) n'est pas réutilisé ici :
// il affiche toujours les centimes (« 1 260,00 € »), ce qui est juste pour une
// commission mais illisible pour des agrégats annuels. Le moteur reste, lui, en
// unités mineures entières — seul l'AFFICHAGE arrondit à l'unité.

/** Espace fine insécable — séparateur de milliers en typographie française. */
const NNBSP = " ";

const CURRENCY_SYMBOL: Readonly<Record<string, string>> = { EUR: "€", CHF: "CHF" };

/** Groupe un entier par milliers : 1234567 → « 1 234 567 ». */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const negative = value < 0;
  const digits = String(Math.abs(Math.round(value)));
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += NNBSP;
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

/** Montant affiché à l'unité près : 1260000 centimes → « 12 600 € ». */
export function formatMoney(minor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency;
  const units = Math.round(minor / 100);
  return `${formatInteger(units)}${NNBSP}${symbol}`;
}

/** Montant signé, pour l'écart net : « +7 351 € » / « -2 140 € ». */
export function formatSignedMoney(minor: number, currency: string): string {
  const sign = minor > 0 ? "+" : "";
  return `${sign}${formatMoney(minor, currency)}`;
}

/** Durée en minutes → « 268 h » ou « 6 h 30 ». */
export function formatHours(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}${NNBSP}min`;
  if (rest === 0) return `${formatInteger(hours)}${NNBSP}h`;
  return `${formatInteger(hours)}${NNBSP}h${NNBSP}${String(rest).padStart(2, "0")}`;
}

/** Équivalent temps plein : 180 → « 1,8 ». */
export function formatFte(centi: number): string {
  const safe = Number.isFinite(centi) ? Math.max(0, Math.round(centi)) : 0;
  const whole = Math.floor(safe / 100);
  const decimal = Math.floor((safe % 100) / 10);
  return `${whole},${decimal}`;
}

/** Rapport en points de base → « 3,4× ». */
export function formatRatio(ratioBps: number): string {
  const safe = Number.isFinite(ratioBps) ? Math.max(0, ratioBps) : 0;
  const whole = Math.floor(safe / 10_000);
  const decimal = Math.floor((safe % 10_000) / 1_000);
  return `${whole},${decimal}×`;
}
