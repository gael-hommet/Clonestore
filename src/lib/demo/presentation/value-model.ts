// /demo — MODÈLE DE VALEUR v2 : la puissance réelle, entièrement dérivée.
//
// PROVENANCE (archéologie 2026-07-17) : l'« ancien tableau ~10 M€/an » n'existe
// dans aucun fichier ni commit — c'est la BORNE HAUTE du calculateur existant
// (computeCapacity, cost-model.ts) : tous curseurs au maximum → 10 200 000 €/an.
// Le « scénario ~11 h 20 » n'a pas été retrouvé ; le plus proche déclaré était
// « 50 avenants » (11 h 55). Le scénario « arrival-full » (arrivée d'un responsable
// commercial, mission complète) a été RECONSTRUIT en étapes déclarées :
// 695 min (11 h 35) de travail humain manuel → 12 min d'attention humaine.
//
// ARCHITECTURE DU MODÈLE (tout dérivé, hypothèses déclarées et affichables) :
//   • € (annuel)  : computeCapacity (formules existantes de cost-model.ts) sur les
//     entrées du PROFIL DE VOLUME choisi — statu quo, capacité récupérable, net.
//   • TEMPS       : minutes DÉCLARÉES des étapes de HR_SCENARIOS × occurrences
//     annuelles DÉCLARÉES du profil (« situations modélisées »).
//   • NIVEAUX     : facteur d'absorption dérivé de la matrice d'autonomie canonique
//     (Brouillon), point médian déclaré (Exécution partagée), résidu déclaré
//     étape par étape (Autonomie gouvernée). « Équipe RH humaine élite » est une
//     référence comparative HUMAINE compétente — pas un mode de Pierre.
//   • DOULEUR     : proxys opérationnels comptés dans les étapes déclarées
//     (interruptions, relances, changements d'outil, attentes/boucles, contrôles).
//   JAMAIS une garantie : estimations, ordres de grandeur, valeur de capacité
//   libérée — selon les volumes et hypothèses affichés.
//
// Module PUR : aucun effet de bord, sûr en SSR comme en client.

import {
  HR_SCENARIOS,
  currentMetrics,
  governedMetrics,
  type OperatingScenario,
} from "./operating-model";
import {
  computeCapacity,
  CAPACITY_FIELDS,
  type CapacityInputs,
  type CapacityResult,
  MINUTES_PER_FTE_MONTH,
  DEFAULT_REFERENCE_COUNTRY,
  formatMoney,
  formatHours,
  formatInteger,
} from "./cost-model";
import { PUBLIC_AUTONOMY_MODES } from "./autonomy-modes";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

// ── Références comparées ────────────────────────────────────────────────────

export type ValueReferenceId = "elite" | "draft" | "copilot" | "governed";

export interface ValueReference {
  readonly id: ValueReferenceId;
  readonly label: string;
  readonly sub: string;
  readonly isHumanBaseline: boolean;
}

export const VALUE_REFERENCES: readonly ValueReference[] = [
  {
    id: "elite",
    label: "Équipe RH humaine élite",
    sub: "Référence comparative — une équipe compétente et performante, exécution entièrement manuelle.",
    isHumanBaseline: true,
  },
  {
    id: "draft",
    label: "Brouillon",
    sub: "Pierre comprend, rassemble, structure, rédige, prépare — vous exécutez et validez.",
    isHumanBaseline: false,
  },
  {
    // « Copilote » est un cadrage INTERDIT par la doctrine commerciale canonique
    // (pierre-commercial-truth-matrix : /assistant|chatbot|copilote/i).
    id: "copilot",
    label: "Exécution partagée",
    sub: "Pierre prépare et exécute l'autorisé — vous intervenez aux étapes importantes.",
    isHumanBaseline: false,
  },
  {
    id: "governed",
    label: "Autonomie gouvernée",
    sub: "L'opérationnel maximal autorisé pris en charge — validations sensibles et stratégiques conservées.",
    isHumanBaseline: false,
  },
];

/** H1 — une action préparée « vaut » la moitié d'une action faite seule. */
export const PREPARED_WEIGHT = 0.5;

function rawFactor(split: { alone: number; prepared: number }): number {
  return split.alone + PREPARED_WEIGHT * split.prepared;
}

/** Facteurs d'absorption (0..1, normalisés sur Autonomie gouvernée = 1). */
export function absorptionFactors(): Readonly<Record<Exclude<ValueReferenceId, "elite">, number>> {
  const byId = new Map(PUBLIC_AUTONOMY_MODES.map((m) => [m.id, m.split]));
  const draft = byId.get("draft");
  const governed = byId.get("governed");
  if (!draft || !governed) return { draft: 0, copilot: 0, governed: 1 };
  const draftF = rawFactor(draft) / (rawFactor(governed) || 1);
  // Exécution partagée : point MÉDIAN déclaré entre Brouillon (dérivé) et
  // Autonomie gouvernée — la matrice représentative (plancher humain ≥ 5/14)
  // ne distingue pas assez les niveaux hauts. Hypothèse affichée.
  return { draft: draftF, copilot: (draftF + 1) / 2, governed: 1 };
}

// ── Mission « choc » : la preuve immédiate ──────────────────────────────────

export interface MissionShock {
  readonly scenario: OperatingScenario;
  /** Travail humain manuel (équipe élite), minutes déclarées. */
  readonly manualMinutes: number;
  /** Attention humaine résiduelle en Autonomie gouvernée, minutes déclarées. */
  readonly attentionMinutes: number;
  readonly ratio: number;
}

export function missionShock(): MissionShock {
  const scenario = HR_SCENARIOS.find((s) => s.id === "arrival-full") ?? HR_SCENARIOS[0];
  const manual = currentMetrics(scenario).minutes;
  const attention = governedMetrics(scenario).minutes;
  return { scenario, manualMinutes: manual, attentionMinutes: attention, ratio: Math.round(manual / Math.max(1, attention)) };
}

// ── Profils de volume (hypothèses DÉCLARÉES, modifiables dans l'UI) ─────────

export interface VolumeAssumptions {
  readonly employees: number;
  readonly sites: number;
  /** Occurrences ANNUELLES de chaque situation modélisée (id → n/an). */
  readonly occurrencesPerYear: Readonly<Record<string, number>>;
}

export interface VolumeProfile {
  readonly id: "pme" | "scaleup" | "groupe";
  readonly label: string;
  readonly tagline: string;
  readonly assumptions: VolumeAssumptions;
  readonly inputs: CapacityInputs;
}

export const VOLUME_PROFILES: readonly VolumeProfile[] = [
  {
    id: "pme",
    label: "PME active",
    tagline: "≈ 120 salariés · 1 site · 2 personnes aux RH",
    assumptions: {
      employees: 120,
      sites: 1,
      occurrencesPerYear: {
        "arrival-full": 6, amendments: 1, questions: 4, payroll: 12,
        "incomplete-files": 4, "hr-state": 6, "sensitive-action": 2,
      },
    },
    inputs: {
      operators: 2, employerCostPerOperator: 3_800, repetitiveSharePct: 55,
      vendorMonthlyCost: 800, toolsMonthlyCost: 300, monthlyOperations: 180,
      coveredSharePct: 60, externalReplaceableSharePct: 25,
    },
  },
  {
    id: "scaleup",
    label: "Scale-up en croissance",
    tagline: "≈ 600 salariés · 3 sites · 6 personnes aux RH",
    assumptions: {
      employees: 600,
      sites: 3,
      occurrencesPerYear: {
        "arrival-full": 36, amendments: 4, questions: 12, payroll: 12,
        "incomplete-files": 12, "hr-state": 18, "sensitive-action": 6,
      },
    },
    inputs: {
      operators: 6, employerCostPerOperator: 4_500, repetitiveSharePct: 60,
      vendorMonthlyCost: 3_500, toolsMonthlyCost: 1_200, monthlyOperations: 700,
      coveredSharePct: 65, externalReplaceableSharePct: 30,
    },
  },
  {
    // PROFIL PAR DÉFAUT — le scénario groupe à forte activité qui produit la
    // projection à plusieurs millions. Hypothèses volontairement AFFICHÉES.
    id: "groupe",
    label: "Groupe multi-sites",
    tagline: "≈ 3 500 salariés · 12 sites · 48 personnes aux RH",
    assumptions: {
      employees: 3_500,
      sites: 12,
      occurrencesPerYear: {
        "arrival-full": 180, amendments: 24, questions: 96, payroll: 144,
        "incomplete-files": 48, "hr-state": 48, "sensitive-action": 24,
      },
    },
    inputs: {
      operators: 48, employerCostPerOperator: 5_600, repetitiveSharePct: 65,
      vendorMonthlyCost: 28_000, toolsMonthlyCost: 9_000, monthlyOperations: 4_800,
      coveredSharePct: 70, externalReplaceableSharePct: 40,
    },
  },
];

export const DEFAULT_PROFILE_ID: VolumeProfile["id"] = "groupe";

/** Borne haute du modèle : TOUS les curseurs du calculateur au maximum
 *  (≈ 10,2 M€/an — la provenance du « ~10 M€ » historique). */
export function modelUpperBound(): CapacityResult {
  const inputs = Object.fromEntries(CAPACITY_FIELDS.map((f) => [f.id, f.max])) as CapacityInputs;
  return computeCapacity(inputs, DEFAULT_REFERENCE_COUNTRY);
}

// ── Vue annuelle par référence (le grand tableau) ───────────────────────────

export interface AnnualReferenceView {
  readonly reference: ValueReferenceId;
  /** Temps humain annuel sur les situations modélisées (minutes). */
  readonly humanMinutesYear: number;
  /** Temps repris par Pierre (minutes/an). */
  readonly recoveredMinutesYear: number;
  /** Équivalent temps plein mobilisé (centièmes d'ETP). */
  readonly fteCenti: number;
  /** Valeur de capacité libérée (centimes/an) — part du récupérable € au facteur du niveau. */
  readonly capacityValueMinor: number;
  /** Coût Pierre (centimes/an) ; 0 pour la référence humaine. */
  readonly pierreCostMinor: number;
  /** Valeur après abonnement (centimes/an). */
  readonly netValueMinor: number;
}

export interface PainMetrics {
  /** Proxys opérationnels annuels, comptés dans les étapes déclarées × occurrences. */
  readonly interruptions: number; // étapes interrupt évitées
  readonly relances: number; // étapes chase prises en charge
  readonly switches: number; // changements d'outil évités
  readonly boucles: number; // attentes/boucles suivies jusqu'à clôture
  readonly controles: number; // vérifications reprises
  readonly documents: number; // documents & communications préparés (côté gouverné)
  readonly total: number;
}

export interface AnnualValue {
  readonly profile: VolumeProfile;
  readonly currency: string;
  readonly subscriptionYearMinor: number;
  readonly subscriptionDisplay: string;
  /** Sorties € du calculateur existant (formules cost-model). */
  readonly capacity: CapacityResult;
  readonly perReference: readonly AnnualReferenceView[];
  readonly pain: PainMetrics;
}

function scenarioById(id: string): OperatingScenario | undefined {
  return HR_SCENARIOS.find((s) => s.id === id);
}

export function annualValue(profileId: VolumeProfile["id"] | CapacityInputs, base?: VolumeProfile): AnnualValue {
  const profile =
    typeof profileId === "string"
      ? VOLUME_PROFILES.find((p) => p.id === profileId) ?? VOLUME_PROFILES[2]
      : ({ ...(base ?? VOLUME_PROFILES[2]), inputs: profileId } as VolumeProfile);

  const capacity = computeCapacity(profile.inputs, DEFAULT_REFERENCE_COUNTRY);
  const resolved = pricingForCountry(DEFAULT_REFERENCE_COUNTRY);
  const pricing = resolved.status === "ok" ? resolved.pricing : { currency: "EUR", amountMinor: 0, display: "abonnement non résolu" };
  const subscriptionYearMinor = pricing.amountMinor * 12;
  const f = absorptionFactors();

  // Temps annuel dérivé : minutes déclarées × occurrences annuelles déclarées.
  let manualYear = 0;
  let governedYear = 0;
  const pain = { interruptions: 0, relances: 0, switches: 0, boucles: 0, controles: 0, documents: 0, total: 0 };
  for (const [id, n] of Object.entries(profile.assumptions.occurrencesPerYear)) {
    const s = scenarioById(id);
    if (!s || n <= 0) continue;
    manualYear += currentMetrics(s).minutes * n;
    governedYear += governedMetrics(s).minutes * n;
    for (const st of s.current.steps) {
      if (st.kind === "interrupt") pain.interruptions += n;
      if (st.kind === "chase") pain.relances += n;
      if (st.kind === "switch") pain.switches += n;
      if (st.kind === "wait") pain.boucles += n;
      if (st.kind === "verify") pain.controles += n;
    }
    for (const st of s.governed.steps) {
      if (st.kind === "prepare" || st.kind === "execute") pain.documents += n;
    }
  }
  pain.total = pain.interruptions + pain.relances + pain.switches + pain.boucles + pain.controles;

  const deltaYear = Math.max(0, manualYear - governedYear);
  const mk = (id: ValueReferenceId, factor: number | null): AnnualReferenceView => {
    const human = factor === null ? manualYear : Math.round(manualYear - factor * deltaYear);
    const recovered = manualYear - human;
    // recoverableAnnualMinor inclut déjà capacité récupérable + externalisé substituable.
    const capacityValueMinor = factor === null ? 0 : Math.round(capacity.recoverableAnnualMinor * factor);
    const pierreCostMinor = factor === null ? 0 : subscriptionYearMinor;
    return {
      reference: id,
      humanMinutesYear: human,
      recoveredMinutesYear: recovered,
      fteCenti: Math.round((human / (MINUTES_PER_FTE_MONTH * 12)) * 100),
      capacityValueMinor,
      pierreCostMinor,
      netValueMinor: capacityValueMinor - pierreCostMinor,
    };
  };

  return {
    profile,
    currency: pricing.currency,
    subscriptionYearMinor,
    subscriptionDisplay: pricing.display,
    capacity,
    perReference: [mk("elite", null), mk("draft", f.draft), mk("copilot", f.copilot), mk("governed", f.governed)],
    pain,
  };
}

// ── Scénarios (une mission forte à la fois) ─────────────────────────────────

export const VALUE_SCENARIO_IDS = [
  "arrival-full",
  "amendments",
  "questions",
  "payroll",
  "incomplete-files",
  "hr-state",
] as const;

export interface ScenarioReferenceView {
  readonly reference: ValueReferenceId;
  readonly humanMinutes: number;
  readonly recoveredMinutes: number;
}

export interface ScenarioValueView {
  readonly scenario: OperatingScenario;
  readonly surfaces: number;
  readonly pain: { relances: number; attentes: number; interruptions: number; controles: number };
  readonly views: readonly ScenarioReferenceView[];
}

export function scenarioValue(scenarioId: string): ScenarioValueView | null {
  const scenario = scenarioById(scenarioId);
  if (!scenario) return null;
  const cur = currentMetrics(scenario);
  const gov = governedMetrics(scenario);
  const f = absorptionFactors();
  const delta = Math.max(0, cur.minutes - gov.minutes);
  const mk = (id: ValueReferenceId, human: number): ScenarioReferenceView => ({
    reference: id,
    humanMinutes: Math.round(human),
    recoveredMinutes: Math.round(cur.minutes - human),
  });
  const count = (k: string) => scenario.current.steps.filter((s) => s.kind === k).length;
  return {
    scenario,
    surfaces: cur.surfaces,
    pain: { relances: count("chase"), attentes: count("wait"), interruptions: count("interrupt"), controles: count("verify") },
    views: [
      mk("elite", cur.minutes),
      mk("draft", cur.minutes - f.draft * delta),
      mk("copilot", cur.minutes - f.copilot * delta),
      mk("governed", gov.minutes),
    ],
  };
}

// ── Formats + formulations imposées ─────────────────────────────────────────

export { formatMoney, formatHours, formatInteger };

/** « 1 645 248 € » → « 1,6 M€ » (déterministe, arrondi honnête à une décimale). */
export function formatMillions(minor: number, currency: string): string {
  const units = minor / 100;
  if (units < 1_000_000) return formatMoney(minor, currency);
  const m = Math.round(units / 100_000) / 10;
  const sym = currency === "EUR" ? "M€" : `M ${currency}`;
  return `${String(m).replace(".", ",")} ${sym}`;
}

export const VALUE_WORDING = {
  illustrative: "Scénario illustratif — hypothèses affichées, modifiables.",
  estimation: "Estimation — ordre de grandeur, jamais une garantie.",
  basis: "Valeur de capacité libérée, selon les volumes et hypothèses affichés.",
  humanTime: "Temps humain mobilisé",
  seeCalc: "Voir le calcul",
  editAssumptions: "Modifier les hypothèses",
  eliteNote: "Référence comparative — pas un mode de Pierre.",
  modeled: "Sur les situations modélisées ci-dessous.",
} as const;
