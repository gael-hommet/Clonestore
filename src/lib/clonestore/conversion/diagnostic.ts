// BLOC 3 — Diagnostic RH déterministe.
//
// Calcul pur, inspectable, sans appel IA, sans email obligatoire, sans donnée
// sensible. Le résultat est exprimé en niveau qualitatif + fourchettes
// d'estimation accompagnées des hypothèses. Aucune économie financière sans
// coût horaire saisi explicitement par l'utilisateur.

import { DIAGNOSTIC_VERSION } from "./contract";
import type { DiagnosticDraft, DiagnosticResult } from "./types";

// Volumes attendus pour les questions (validation déjà faite dans validation.ts).
type Answers = Record<string, string | number | readonly string[] | null>;

interface Bands {
  headcount: number;        // effectif central de la tranche
  rh_team_size: number;     // taille équipe RH centrale
  monthly_hires: number;    // central tranche recrutement
  monthly_onboardings: number;
  recurring_ops_volume: number; // central tranche
  autonomy_target: "fully" | "supervised" | "human_first";
  validation_requirements: "high" | "medium" | "low";
}

const HEADCOUNT_BANDS: Record<string, number> = {
  "1-9": 5,
  "10-49": 25,
  "50-249": 100,
  "250-999": 500,
  "1000+": 1500,
};

const RH_TEAM_BANDS: Record<string, number> = {
  "0": 0.5,
  "1": 1,
  "2-5": 3,
  "6-15": 9,
  "16+": 20,
};

const HIRES_BANDS: Record<string, number> = {
  "0-1": 1,
  "2-5": 3,
  "6-15": 10,
  "16-40": 25,
  "40+": 60,
};

const OPS_BANDS: Record<string, number> = {
  low: 8,
  medium: 25,
  high: 70,
  very_high: 160,
};

function asBand<T>(value: unknown, bands: Record<string, number>, fallback: number): number {
  if (typeof value === "string" && bands[value] !== undefined) return bands[value];
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  return fallback;
}

function parseAutonomy(value: unknown): Bands["autonomy_target"] {
  if (value === "fully" || value === "supervised" || value === "human_first") return value;
  return "supervised";
}

function parseValidation(value: unknown): Bands["validation_requirements"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function extractBands(answers: Answers): Bands {
  return {
    headcount: asBand(answers["headcount"], HEADCOUNT_BANDS, 25),
    rh_team_size: asBand(answers["rh_team_size"], RH_TEAM_BANDS, 1),
    monthly_hires: asBand(answers["monthly_hires"], HIRES_BANDS, 3),
    monthly_onboardings: asBand(answers["monthly_onboardings"], HIRES_BANDS, 3),
    recurring_ops_volume: asBand(answers["recurring_ops_volume"], OPS_BANDS, 25),
    autonomy_target: parseAutonomy(answers["autonomy_target"]),
    validation_requirements: parseValidation(answers["validation_requirements"]),
  };
}

// Heures économisées estimées par mois — bornes prudentes.
// On compte 20 min par opération récurrente, 1h par embauche admin, 1h30 par onboarding.
function estimateSavedHours(b: Bands): { low: number; central: number; high: number } {
  const ops = b.recurring_ops_volume * (20 / 60);
  const hires = b.monthly_hires * 1.0;
  const onboardings = b.monthly_onboardings * 1.5;
  const central = round1(ops + hires + onboardings);

  // L'autonomie demandée influence la part déléguée (0.4 à 0.7).
  const factor = b.autonomy_target === "fully" ? 0.7 : b.autonomy_target === "supervised" ? 0.55 : 0.4;
  const validationPenalty = b.validation_requirements === "high" ? 0.85 : 1.0;
  const adjusted = central * factor * validationPenalty;

  const low = round1(adjusted * 0.7);
  const high = round1(adjusted * 1.2);
  return { low, central: round1(adjusted), high };
}

function compatibilityLevel(b: Bands): { level: DiagnosticResult["compatibilityLevel"]; reasons: string[] } {
  const reasons: string[] = [];
  // Forte compatibilité quand : volume opérations > 15/mois, équipe RH ≥ 1, autonomie ≥ supervised.
  const hasVolume = b.recurring_ops_volume >= 15 || b.monthly_hires + b.monthly_onboardings >= 5;
  const hasTeam = b.rh_team_size >= 1;
  const wantsAutomation = b.autonomy_target !== "human_first";

  if (hasVolume && hasTeam && wantsAutomation) {
    reasons.push("volume_opérationnel_suffisant", "équipe_RH_présente", "autonomie_compatible");
    if (b.validation_requirements === "high") reasons.push("validation_renforcée_compatible_avec_pierre");
    return { level: "high", reasons };
  }
  if (!hasVolume) reasons.push("volume_opérationnel_faible");
  if (!hasTeam) reasons.push("aucune_équipe_RH_dédiée");
  if (!wantsAutomation) reasons.push("autonomie_demandée_très_humaine");
  if (b.recurring_ops_volume >= 5 || hasTeam) {
    return { level: "partial", reasons };
  }
  return { level: "limited", reasons };
}

function suggestedMissions(b: Bands): string[] {
  const out: string[] = [];
  if (b.monthly_onboardings > 0) out.push("Pré-onboarding et checklists d'arrivée");
  if (b.monthly_hires > 0) out.push("Convocations, suivi candidats, briefs managers");
  if (b.recurring_ops_volume >= 15) out.push("Réponses RH récurrentes (absences, attestations, justificatifs)");
  if (b.recurring_ops_volume >= 25) out.push("Relances et suivis d'échéances RH");
  if (b.headcount >= 50) out.push("Synthèses hebdomadaires opérationnelles");
  return out.length > 0 ? out : ["Brouillons RH structurés à valider"];
}

function humanControls(b: Bands): string[] {
  const out = [
    "Décisions disciplinaires et sanctions",
    "Signature de contrats et avenants",
    "Décisions de recrutement finales",
  ];
  if (b.validation_requirements === "high") out.push("Validation manager avant tout envoi externe");
  return out;
}

function defaultHypotheses(b: Bands): string[] {
  return [
    `Effectif ~${Math.round(b.headcount)} personnes (tranche déclarée).`,
    `Équipe RH ~${b.rh_team_size} ETP (tranche déclarée).`,
    `Volume mensuel d'opérations récurrentes estimé central : ${b.recurring_ops_volume}.`,
    "Durée par opération récurrente : ~20 minutes hors validation humaine.",
    "Onboarding administratif : ~1h30 par arrivée.",
    "Recrutement administratif : ~1h par embauche (hors entretiens).",
  ];
}

function defaultLimitations(): string[] {
  return [
    "Estimation, pas une garantie. Dépend du périmètre réellement confié à Pierre.",
    "Pierre ne remplace pas un avocat ni un logiciel de paie certifié.",
    "Les décisions sensibles restent humaines, ce qui borne mécaniquement l'automatisation.",
  ];
}

export function computeDiagnostic(draft: DiagnosticDraft): DiagnosticResult {
  const bands = extractBands(draft.answers);
  const saved = estimateSavedHours(bands);
  const compat = compatibilityLevel(bands);

  // Estimation financière UNIQUEMENT si l'utilisateur a fourni un coût horaire.
  let financial: DiagnosticResult["estimatedFinancialRangeEur"] = null;
  if (typeof draft.hourlyCostHypothesis === "number" && Number.isFinite(draft.hourlyCostHypothesis) && draft.hourlyCostHypothesis > 0) {
    const cost = Math.min(500, draft.hourlyCostHypothesis);
    financial = {
      low: round1(saved.low * cost),
      central: round1(saved.central * cost),
      high: round1(saved.high * cost),
    };
  }

  const hypotheses = defaultHypotheses(bands);
  if (draft.hourlyCostHypothesis && draft.hourlyCostHypothesis > 0) {
    hypotheses.push(`Coût horaire saisi par l'utilisateur : ${draft.hourlyCostHypothesis} €.`);
  }

  return {
    version: draft.version ?? DIAGNOSTIC_VERSION,
    compatibilityLevel: compat.level,
    compatibilityReasonCodes: compat.reasons,
    suggestedMissions: suggestedMissions(bands),
    humanControls: humanControls(bands),
    estimatedSavedHoursPerMonth: saved,
    estimatedFinancialRangeEur: financial,
    hypotheses,
    limitations: defaultLimitations(),
  };
}

function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}
