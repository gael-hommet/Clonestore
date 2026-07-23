// C1.9 — OUTILS GOUVERNÉS.
//
// Le modèle PROPOSE un appel ; le runtime déterministe valide, autorise, exécute et
// rend le résultat au raisonnement AVANT la réponse. Le modèle n'exécute jamais
// directement une action sensible.
//
// `estimate_workload` répond au §8 du cahier des charges : une estimation doit être
// CALCULÉE et ses hypothèses EXPLICITÉES, pas récitée. On ne demande pas au modèle de
// faire l'arithmétique — il fournit les paramètres, l'outil calcule et retourne les
// hypothèses avec le résultat. Deux entreprises différentes obtiennent donc deux
// raisonnements différents, sans qu'aucun paragraphe ne soit écrit à l'avance.
import { z } from "zod";

export type ToolRisk = "read_only" | "prepares" | "external_effect";

export interface ToolDefinition {
  readonly id: string;
  readonly description: string;
  readonly risk: ToolRisk;
  /** Faux = l'outil est refusé au visiteur anonyme. */
  readonly availableToAnonymous: boolean;
  readonly requiresHumanValidation: boolean;
}

export const C19_TOOLS: readonly ToolDefinition[] = Object.freeze([
  Object.freeze({
    id: "estimate_workload",
    description:
      "Calcule un ordre de grandeur de temps libéré et de comparaison économique à partir des " +
      "paramètres fournis par l'utilisateur. Ne retourne jamais de garantie, toujours des hypothèses.",
    risk: "read_only" as const,
    availableToAnonymous: true,
    requiresHumanValidation: false,
  }),
]);

export function toolById(id: string): ToolDefinition | null {
  return C19_TOOLS.find((t) => t.id === id) ?? null;
}

// ── estimate_workload ────────────────────────────────────────────────────────

export const EstimateWorkloadInput = z.object({
  /** Effectif de l'entreprise, si connu. */
  headcount: z.number().positive().max(100_000).nullable().default(null),
  /** Nombre de personnes qui traitent l'administratif RH. */
  peopleOnAdmin: z.number().positive().max(1000).nullable().default(null),
  /** Heures par semaine consacrées à l'administratif RH, PAR PERSONNE. */
  hoursPerWeekPerPerson: z.number().positive().max(80).nullable().default(null),
  /** Coût horaire chargé, si l'utilisateur l'a donné. Jamais deviné silencieusement. */
  hourlyCost: z.number().positive().max(1000).nullable().default(null),
  /** Devise du coût fourni. */
  currency: z.string().default("EUR"),
  /** Prix mensuel de l'abonnement, fourni par le TruthContext (jamais par le modèle). */
  subscriptionMonthly: z.number().nonnegative().nullable().default(null),
});
export type EstimateWorkloadArgs = z.infer<typeof EstimateWorkloadInput>;

export interface EstimateAssumption {
  readonly label: string;
  readonly value: string;
  readonly origin: "user" | "assumed";
}

export interface EstimateWorkloadResult {
  readonly ok: boolean;
  /** Ce qui manque pour affiner — alimente une vraie question de clarification. */
  readonly missing: readonly string[];
  readonly assumptions: readonly EstimateAssumption[];
  readonly monthlyHoursOnAdmin: number | null;
  /** Fourchette d'heures libérées par mois — jamais un point unique. */
  readonly hoursFreedPerMonth: readonly [number, number] | null;
  readonly valueFreedPerMonth: readonly [number, number] | null;
  readonly subscriptionMonthly: number | null;
  readonly currency: string;
  readonly note: string;
}

/**
 * Part automatisable. C'est une FOURCHETTE assumée, pas une promesse : Pierre absorbe
 * l'exécution répétitive, pas la décision. Exprimée ici pour qu'elle apparaisse dans les
 * hypothèses rendues à l'utilisateur plutôt que d'être enfouie dans une phrase toute faite.
 */
const AUTOMATABLE_SHARE: readonly [number, number] = [0.3, 0.6];
const WEEKS_PER_MONTH = 4.33;

export function estimateWorkload(raw: unknown): EstimateWorkloadResult {
  const parsed = EstimateWorkloadInput.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      ok: false, missing: ["paramètres illisibles"], assumptions: [],
      monthlyHoursOnAdmin: null, hoursFreedPerMonth: null, valueFreedPerMonth: null,
      subscriptionMonthly: null, currency: "EUR", note: "Paramètres invalides.",
    };
  }
  const a = parsed.data;
  const missing: string[] = [];
  const assumptions: EstimateAssumption[] = [];

  const people = a.peopleOnAdmin;
  const hours = a.hoursPerWeekPerPerson;

  if (people === null) missing.push("le nombre de personnes qui traitent l'administratif RH");
  if (hours === null) missing.push("le temps hebdomadaire qu'elles y consacrent");

  if (people === null || hours === null) {
    return {
      ok: false, missing: Object.freeze(missing), assumptions: Object.freeze(assumptions),
      monthlyHoursOnAdmin: null, hoursFreedPerMonth: null, valueFreedPerMonth: null,
      subscriptionMonthly: a.subscriptionMonthly, currency: a.currency,
      note: "Estimation impossible sans ces éléments — je préfère demander plutôt que d'inventer une moyenne.",
    };
  }

  assumptions.push({ label: "personnes sur l'administratif RH", value: String(people), origin: "user" });
  assumptions.push({ label: "heures par semaine et par personne", value: String(hours), origin: "user" });
  if (a.headcount !== null) assumptions.push({ label: "effectif", value: String(a.headcount), origin: "user" });

  const monthlyHours = people * hours * WEEKS_PER_MONTH;
  assumptions.push({ label: "semaines par mois", value: String(WEEKS_PER_MONTH), origin: "assumed" });
  assumptions.push({
    label: "part des tâches réellement automatisable",
    value: `${Math.round(AUTOMATABLE_SHARE[0] * 100)} à ${Math.round(AUTOMATABLE_SHARE[1] * 100)} %`,
    origin: "assumed",
  });

  const freed: readonly [number, number] = [
    Math.round(monthlyHours * AUTOMATABLE_SHARE[0]),
    Math.round(monthlyHours * AUTOMATABLE_SHARE[1]),
  ];

  let value: readonly [number, number] | null = null;
  if (a.hourlyCost !== null) {
    assumptions.push({ label: "coût horaire chargé", value: `${a.hourlyCost} ${a.currency}`, origin: "user" });
    value = [Math.round(freed[0] * a.hourlyCost), Math.round(freed[1] * a.hourlyCost)];
  } else {
    missing.push("un coût horaire chargé, pour convertir le temps en argent");
  }

  return {
    ok: true,
    missing: Object.freeze(missing),
    assumptions: Object.freeze(assumptions),
    monthlyHoursOnAdmin: Math.round(monthlyHours),
    hoursFreedPerMonth: freed,
    valueFreedPerMonth: value,
    subscriptionMonthly: a.subscriptionMonthly,
    currency: a.currency,
    note:
      "Ordre de grandeur calculé à partir des éléments fournis, jamais une garantie. " +
      "La part automatisable est une hypothèse : les décisions sensibles restent humaines.",
  };
}

export interface ToolExecutionRequest {
  readonly toolId: string;
  readonly args: unknown;
}

export interface ToolExecutionOutcome {
  readonly toolId: string;
  readonly executed: boolean;
  readonly refusedReason: string | null;
  readonly result: unknown;
}

/**
 * Exécution gouvernée. Un outil inconnu, indisponible pour ce lecteur, ou à effet
 * externe est REFUSÉ — jamais exécuté silencieusement, jamais prétendu exécuté.
 */
export function executeGovernedTool(
  req: ToolExecutionRequest,
  ctx: { readonly viewerIsAuthenticated: boolean; readonly toolsEnabled: boolean },
): ToolExecutionOutcome {
  const def = toolById(req.toolId);
  if (!def) return { toolId: req.toolId, executed: false, refusedReason: "unknown_tool", result: null };
  if (!ctx.toolsEnabled) return { toolId: req.toolId, executed: false, refusedReason: "tools_disabled", result: null };
  if (def.risk === "external_effect") return { toolId: req.toolId, executed: false, refusedReason: "external_effect_blocked", result: null };
  if (!def.availableToAnonymous && !ctx.viewerIsAuthenticated) {
    return { toolId: req.toolId, executed: false, refusedReason: "authentication_required", result: null };
  }
  if (def.id === "estimate_workload") {
    return { toolId: def.id, executed: true, refusedReason: null, result: estimateWorkload(req.args) };
  }
  return { toolId: req.toolId, executed: false, refusedReason: "not_implemented", result: null };
}
