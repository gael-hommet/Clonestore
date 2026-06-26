// src/lib/pierre/demo/demo-engine.ts
// PIERRE FINAL INTERACTIVE DEMO — deterministic engine.
//
// Pure, side-effect-free. No Date.now()/Math.random() here: timing lives in the
// React layer. The engine derives the proof metrics FROM the scenario structure
// (so the final numbers can never be invented), defines the ordered guided
// journey, and exposes navigation + consistency helpers used by tests.

import type { DemoScenario, DemoTask, GuidedStep, MissionMetrics, MissionUnderstanding } from "./demo-types";

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
