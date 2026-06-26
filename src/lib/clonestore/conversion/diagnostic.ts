// BLOC 3 — Diagnostic RH déterministe, conforme LeadForge db9b166.
//
// Réimplémentation littérale de `services/conversion/diagnostic.py:compute`.
// Identique inputs → identique outputs (testé par les golden vectors de la
// fixture LeadForge dans `__tests__/bloc3-parity.test.ts`).
//
// Aucune économie financière n'est calculée sans coût horaire fourni
// EXPLICITEMENT par l'utilisateur.

import {
  DIAGNOSTIC_DEFAULT_ASSUMPTIONS,
  PIERRE_PRICE_EUR,
} from "./contract";
import type {
  DiagnosticAnswers,
  DiagnosticAssumptions,
  DiagnosticResult,
} from "./types";

type Answers = DiagnosticAnswers & { readonly [extra: string]: unknown };
const AUTONOMY = new Set(["low", "medium", "high"] as const);

function intAt(answers: Answers, key: string, fallback = 0): number {
  const v = (answers as Record<string, unknown>)[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
  }
  return fallback;
}

function boolAt(answers: Answers, key: string, fallback = true): boolean {
  const v = (answers as Record<string, unknown>)[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["yes", "true", "1", "oui"].includes(s)) return true;
    if (["no", "false", "0", "non"].includes(s)) return false;
  }
  return fallback;
}

function autonomyAt(answers: Answers): "low" | "medium" | "high" {
  const v = (answers as Record<string, unknown>)["autonomy_level"];
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (AUTONOMY.has(s as "low" | "medium" | "high")) return s as "low" | "medium" | "high";
  }
  return "medium";
}

function band(baseOps: number, share: number, minutesPerOperation: number) {
  const ops = baseOps * share;
  const hours = (ops * minutesPerOperation) / 60.0;
  return {
    automatable_ops_month: Math.round(ops),
    operational_hours_month: Math.round(hours * 10) / 10,
  };
}

export interface DiagnosticInput {
  answers: Answers;
  assumptions?: Partial<DiagnosticAssumptions>;
  /**
   * Coût horaire UNIQUEMENT si fourni par l'utilisateur — sinon aucune
   * économie financière n'est rendue (cf. LeadForge contrat §4).
   */
  monthly_cost_eur?: number | null;
}

/**
 * Re-implémentation littérale de diagnostic.compute. Le résultat est
 * comparé byte-à-byte avec la fixture LeadForge dans les tests.
 */
export function compute(input: DiagnosticInput): DiagnosticResult {
  const a: DiagnosticAssumptions = {
    ...DIAGNOSTIC_DEFAULT_ASSUMPTIONS,
    ...(input.assumptions ?? {}),
  };
  const answers = input.answers ?? {};
  const hires = intAt(answers as Answers, "monthly_hires");
  const onoff = intAt(answers as Answers, "monthly_on_offboardings");
  const declaredOps = intAt(answers as Answers, "monthly_docs_emails_ops");
  const autonomy = autonomyAt(answers as Answers);
  const validation = boolAt(answers as Answers, "validation_required", true);

  const derivedOps = hires * a.ops_per_hire + onoff * a.ops_per_on_offboarding;
  const baseOps = Math.max(declaredOps, derivedOps);

  const volume = {
    low: band(baseOps, a.automatable_share_low, a.minutes_per_operation),
    central: band(baseOps, a.automatable_share_central, a.minutes_per_operation),
    high: band(baseOps, a.automatable_share_high, a.minutes_per_operation),
  };

  const missions: string[] = [
    "Préparation de documents RH",
    "Emails RH récurrents",
    "Suivi des validations",
    "Traçabilité",
  ];
  if (hires > 0) missions.push("Support onboarding/recrutement opérationnel");

  const autonomyBonus = autonomy === "low" ? 0 : autonomy === "medium" ? 10 : 20;
  const opsBonus = Math.min(40, Math.floor(baseOps / 5));
  const score = Math.min(100, 40 + opsBonus + autonomyBonus);
  const compatibility: "low" | "medium" | "high" =
    score >= 75 ? "high" : score >= 55 ? "medium" : "low";

  const result: DiagnosticResult = {
    operational_load: {
      declared_ops_month: declaredOps,
      derived_ops_month: derivedOps,
      base_ops_month: baseOps,
      hr_team_size: intAt(answers as Answers, "hr_team_size"),
    },
    recommended_missions: [...missions],
    priorities: missions.slice(0, 3),
    compatibility,
    compatibility_score: score,
    actions_requiring_validation: validation
      ? [
          "Communication externe sensible",
          "Documents contractuels",
          "Toute action marquée sensible",
        ]
      : ["Toute action marquée sensible"],
    volume_estimate: volume,
    assumptions: a,
    formulas: {
      derived_ops_month:
        "monthly_hires*ops_per_hire + monthly_on_offboardings*ops_per_on_offboarding",
      base_ops_month: "max(declared_ops, derived_ops)",
      automatable_ops: "base_ops * automatable_share",
      operational_hours: "automatable_ops * minutes_per_operation / 60",
    },
    limits: [
      "Fourchettes, pas une prédiction exacte",
      "Aucun résultat garanti",
      "Aucune économie financière sans coût fourni",
      "Hypothèses modifiables",
    ],
    price_comparison: { pierre_eur_month: PIERRE_PRICE_EUR },
    next_steps: [
      "Voir la démonstration",
      "Activer Pierre — 449 €/mois",
      "Réserver 15 minutes (optionnel)",
    ],
    financial_saving: null,
  };

  // Économie financière UNIQUEMENT si l'utilisateur a fourni un coût horaire.
  if (
    input.monthly_cost_eur !== null &&
    input.monthly_cost_eur !== undefined &&
    Number.isFinite(input.monthly_cost_eur) &&
    input.monthly_cost_eur > 0
  ) {
    const hourly = input.monthly_cost_eur;
    const centralHours = volume.central.operational_hours_month;
    const central = Math.round(centralHours * hourly);
    return {
      ...result,
      financial_saving: {
        basis: "user_supplied_hourly_cost",
        hourly_cost_eur: hourly,
        central_monthly_saving_eur: central,
        vs_pierre_eur_month: PIERRE_PRICE_EUR,
        note: "fourchette indicative à partir de votre coût; aucun résultat garanti",
      },
    };
  }
  return result;
}
