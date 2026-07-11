// src/lib/clonestore/integration/p16c/p16c-cloneos-adapter.ts
// P16C — ADAPTATEUR Pierre → CloneOS. Convertit le contrat P16A (déjà raisonné par Pierre) en une entrée
// CloneOS GÉNÉRIQUE et exécute l'orchestrateur T2 RÉEL (ADN → OS → Policy → Guard → Trust → Review → Trace
// → Continuum → Signals). CloneOS NE réinterprète PAS la RH : il découpe en tâches génériques et coordonne.
// L'adaptateur PRÉSERVE l'objectif/les capacités/les validations de Pierre et CROSS-CHECK que CloneOS n'a
// décidé AUCUNE issue RH (decidesHrOutcomes=false, executed=false) — sinon fail-closed.

import {
  createProductTechnologyOrchestrator,
  type CloneOSRunResult, type ProductTechnologyContext,
  type CloneOSEmployeeDescriptor, type ClonePolicyRule, type CloneADNInput,
} from "@/lib/clonestore/product-technologies/t2";
import type { PierreUltimateIntegrationContract } from "@/lib/pierre/v1/ultimate/p16a";

export interface P16CCloneOSAdaptation {
  readonly run: CloneOSRunResult;
  /** L'objectif de Pierre a-t-il été préservé dans le plan CloneOS (jamais remplacé) ? */
  readonly preservedPierreObjective: boolean;
  /** CloneOS a-t-il tenté de décider une issue RH / d'exécuter ? (doit rester false). */
  readonly cloneOsInventedHrReasoning: boolean;
  readonly note: string;
}

export interface P16CCloneOSInput {
  readonly contract: PierreUltimateIntegrationContract;
  readonly ctx: ProductTechnologyContext;
  readonly availableEmployees?: readonly CloneOSEmployeeDescriptor[];
  readonly policyRules?: readonly ClonePolicyRule[];
  readonly adn?: CloneADNInput;
}

/**
 * Exécute l'orchestrateur CloneOS T2 réel sur l'objectif AUTORITAIRE de Pierre (jamais le texte brut
 * ré-interprété). Retourne le run gouverné + un cross-check anti-réinterprétation RH.
 */
export async function adaptPierreToCloneOS(input: P16CCloneOSInput): Promise<P16CCloneOSAdaptation> {
  const { contract, ctx } = input;
  const orchestrator = createProductTechnologyOrchestrator(); // instance propre au run (isolation tenant)

  // Pierre est l'employé RH ; l'objectif AUTORITAIRE de Pierre est la demande (pas de ré-interprétation).
  const availableEmployees = input.availableEmployees ?? [{ employeeId: "pierre", domains: ["hr", "general"] }];
  const objective = contract.understanding.normalizedObjective;

  const run = await orchestrator.runCloneOSRequest(
    {
      request: objective,
      availableEmployees,
      context: `P16C · capacités Pierre: ${contract.selectedCapabilityIds.slice(0, 8).join(", ")}`,
      adn: input.adn ?? {},
      policyRules: input.policyRules,
    },
    ctx,
  );

  const plan = run.missionPlan;
  // Cross-check anti-2e-cerveau : CloneOS ne décide aucune issue RH ni n'exécute (invariants durs du plan).
  const cloneOsInventedHrReasoning = plan !== null && (plan.decidesHrOutcomes !== false || plan.executed !== false);
  // Objectif préservé : le plan référence l'objectif de Pierre (jamais un objectif inventé).
  const preservedPierreObjective =
    plan === null // run bloqué par gouvernance : aucun plan livré (le floor de Pierre prime — préservé)
    || plan.missionCandidate.objective.includes(objective.slice(0, 40));

  return {
    run,
    preservedPierreObjective,
    cloneOsInventedHrReasoning,
    note: plan === null
      ? "CloneOS n'a livré aucun plan (gouvernance bloquée / floor Pierre) — le raisonnement RH reste chez Pierre."
      : "CloneOS a produit une structure de tâches générique ; le raisonnement RH reste chez Pierre (decidesHrOutcomes=false).",
  };
}
