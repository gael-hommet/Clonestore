// src/lib/pierre/demo/demo-engine.ts
// PIERRE FINAL INTERACTIVE DEMO — deterministic engine.
//
// Pure, side-effect-free. No Date.now()/Math.random() here: timing lives in the
// React layer. The engine derives the proof metrics FROM the scenario structure
// (so the final numbers can never be invented), defines the ordered guided
// journey, and exposes navigation + consistency helpers used by tests.

import type {
  CockpitPhase,
  DemoScenario,
  DemoTask,
  GuidedStep,
  MissionMetrics,
  MissionUnderstanding,
} from "./demo-types";

// ── Guided journey (ordered) ─────────────────────────────────────────────────
export const GUIDED_STEPS: readonly GuidedStep[] = [
  { id: "composer", title: "La demande", caption: "Un brief RH en langage naturel.", analyticsLabel: "composer" },
  { id: "understanding", title: "La compréhension", caption: "Pierre détecte les objectifs, sans rien inventer.", analyticsLabel: "understanding" },
  { id: "context", title: "Le contexte", caption: "Pierre relit l'empreinte entreprise.", analyticsLabel: "context" },
  { id: "technology", title: "Les technologies", caption: "Chaque technologie agit, expliquée simplement.", analyticsLabel: "technology" },
  { id: "mission_control", title: "Le centre de missions", caption: "Plusieurs missions avancent en parallèle.", analyticsLabel: "mission_control" },
  { id: "messaging", title: "La messagerie", caption: "Pierre communique et demande les validations.", analyticsLabel: "messaging" },
  { id: "document", title: "Les livrables", caption: "Des documents réels, ouvrables.", analyticsLabel: "document" },
  { id: "approval", title: "La validation", caption: "Une validation humaine, interactive.", analyticsLabel: "approval" },
  { id: "guardrail", title: "Les garde-fous", caption: "Pierre refuse les décisions sensibles seul.", analyticsLabel: "guardrail" },
  { id: "trace", title: "L'historique", caption: "Chaque étape est tracée.", analyticsLabel: "trace" },
  { id: "result", title: "Le résultat", caption: "La preuve, chiffrée par le scénario.", analyticsLabel: "result" },
] as const;

export const GUIDED_STEP_COUNT = GUIDED_STEPS.length;

/** Recommended dwell per step (ms) for the auto-guided mode; total ≈ 2 min. */
export const STEP_DWELL_MS: Record<GuidedStep["id"], number> = {
  composer: 7000,
  understanding: 12000,
  context: 11000,
  technology: 12000,
  mission_control: 18000,
  messaging: 14000,
  document: 13000,
  approval: 12000,
  guardrail: 11000,
  trace: 12000,
  result: 14000,
};

export function totalGuidedDurationMs(): number {
  return GUIDED_STEPS.reduce((acc, s) => acc + STEP_DWELL_MS[s.id], 0);
}

export function stepIndexById(id: GuidedStep["id"]): number {
  return GUIDED_STEPS.findIndex((s) => s.id === id);
}

export function clampStepIndex(index: number): number {
  if (index < 0) return 0;
  if (index > GUIDED_STEP_COUNT - 1) return GUIDED_STEP_COUNT - 1;
  return index;
}

export function nextStepIndex(index: number): number {
  return clampStepIndex(index + 1);
}

export function prevStepIndex(index: number): number {
  return clampStepIndex(index - 1);
}

export function isLastStep(index: number): boolean {
  return index >= GUIDED_STEP_COUNT - 1;
}

export function completionPercentage(index: number): number {
  return Math.round(((clampStepIndex(index) + 1) / GUIDED_STEP_COUNT) * 100);
}

// ── Derivation helpers ───────────────────────────────────────────────────────
export function allTasks(scenario: DemoScenario): DemoTask[] {
  return scenario.missions.flatMap((m) => m.tasks);
}

export function countBlocages(scenario: DemoScenario): number {
  return allTasks(scenario).filter((t) => t.status === "waiting_info" || t.status === "blocked").length;
}

export function countSuivis(scenario: DemoScenario): number {
  return allTasks(scenario).filter((t) => t.status === "scheduled" && t.capabilityId === "scheduling_followup").length;
}

export function countValidations(scenario: DemoScenario): number {
  return scenario.missions.filter((m) => m.autonomy === "validation_requise").length;
}

export function countCommunications(scenario: DemoScenario): number {
  return scenario.messages.filter((m) => m.from === "Pierre").length;
}

/**
 * Proof metrics — derived ONLY from the scenario structure. `informationsInventees`
 * is structurally 0: Pierre never invents information in the demo.
 */
export function computeScenarioMetrics(scenario: DemoScenario): MissionMetrics {
  return {
    demande: 1,
    missions: scenario.missions.length,
    taches: allTasks(scenario).length,
    documents: scenario.documents.length,
    communications: countCommunications(scenario),
    validations: countValidations(scenario),
    suivis: countSuivis(scenario),
    blocages: countBlocages(scenario),
    informationsInventees: 0,
  };
}

// ── Interactive cockpit phases (distinct spine from GUIDED_STEPS) ─────────────
// The cockpit keeps the three zones visible at all times; a phase is a guided
// spotlight that answers one prospect question and reveals the matching content.
export const COCKPIT_PHASES: readonly CockpitPhase[] = [
  {
    id: "reception",
    title: "Demandes reçues",
    caption: "Une semaine RH ne commence pas par une tâche propre.",
    question: "Avec quoi Pierre travaille-t-il ?",
    focus: ["left"],
    analyticsLabel: "reception",
  },
  {
    id: "analyse",
    title: "Analyse",
    caption: "Pierre lit, relie et hiérarchise — sans rien inventer.",
    question: "Qu'a compris Pierre ?",
    focus: ["left", "center"],
    analyticsLabel: "analyse",
  },
  {
    id: "organisation",
    title: "Organisation",
    caption: "Les demandes deviennent des missions et des actions.",
    question: "Comment le travail est-il organisé ?",
    focus: ["center"],
    analyticsLabel: "organisation",
  },
  {
    id: "execution",
    title: "Exécution",
    caption: "Plusieurs missions avancent ; les livrables apparaissent.",
    question: "Qu'a réellement produit Pierre ?",
    focus: ["center", "right"],
    analyticsLabel: "execution",
  },
  {
    id: "validation",
    title: "Validation",
    caption: "Une action sensible : Pierre s'arrête et vous sollicite.",
    question: "Qui garde la décision ?",
    focus: ["right"],
    analyticsLabel: "validation",
  },
  {
    id: "continuite",
    title: "Continuité",
    caption: "La mission reste active : relances, attentes, reprises.",
    question: "Que se passe-t-il les jours suivants ?",
    focus: ["center"],
    analyticsLabel: "continuite",
  },
  {
    id: "bilan",
    title: "Bilan",
    caption: "La preuve, chiffrée par le scénario — rien d'inventé.",
    question: "Qu'est-ce que Pierre a pris en charge ?",
    focus: ["right"],
    analyticsLabel: "bilan",
  },
] as const;

export const COCKPIT_PHASE_COUNT = COCKPIT_PHASES.length;

/** Recommended dwell per phase (ms) for the auto-guided cockpit. */
export const COCKPIT_PHASE_DWELL_MS: Record<CockpitPhase["id"], number> = {
  reception: 8000,
  analyse: 11000,
  organisation: 12000,
  execution: 15000,
  validation: 12000,
  continuite: 12000,
  bilan: 13000,
};

export function clampPhase(index: number): number {
  if (index < 0) return 0;
  if (index > COCKPIT_PHASE_COUNT - 1) return COCKPIT_PHASE_COUNT - 1;
  return index;
}
export function nextPhase(index: number): number {
  return clampPhase(index + 1);
}
export function prevPhase(index: number): number {
  return clampPhase(index - 1);
}
export function isLastPhase(index: number): boolean {
  return index >= COCKPIT_PHASE_COUNT - 1;
}
export function phaseIndexById(id: CockpitPhase["id"]): number {
  return COCKPIT_PHASES.findIndex((p) => p.id === id);
}
export function cockpitCompletion(index: number): number {
  return Math.round(((clampPhase(index) + 1) / COCKPIT_PHASE_COUNT) * 100);
}

/** Live top-bar counters — all derived, never invented. */
export interface CockpitCounters {
  missions: number;
  actions: number;
  validations: number;
  documents: number;
  waiting: number;
}
export function cockpitCounters(scenario: DemoScenario): CockpitCounters {
  const m = computeScenarioMetrics(scenario);
  return {
    missions: m.missions,
    actions: m.taches,
    validations: m.validations,
    documents: m.documents,
    waiting: m.blocages,
  };
}

/**
 * True iff the scenario's declared `understanding` numbers match what the
 * structure actually contains on the strictly-derivable fields. Narrative
 * fields (echeances/personnes) are only checked to be ≥ 1 and plausible.
 */
export function understandingIsConsistent(scenario: DemoScenario): boolean {
  const u: MissionUnderstanding = scenario.understanding;
  const metrics = computeScenarioMetrics(scenario);
  return (
    u.objectifs === metrics.missions &&
    u.taches === metrics.taches &&
    u.validations === metrics.validations &&
    u.informationsManquantes === metrics.blocages &&
    u.informationsManquantes === scenario.context.missing.length &&
    u.echeances >= 1 &&
    u.personnes >= 1
  );
}
