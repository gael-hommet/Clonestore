// src/lib/clonestore/integration/p16c/p16c-technology-execution-plan.ts
// P16C — ASSEMBLEUR PUR du plan d'exécution technologique typé (§10). Assemble les pièces déjà calculées
// (contrat P16A validé, décision de gouvernance, run CloneOS réel, étapes T1/T2, exigences aval) en un plan
// borné, sérialisable, sans secret, scopé tenant. INVARIANTS : `externallyExecutable` reste false ; les ids
// de techno inconnus n'arrivent jamais ici (rejetés en amont) ; aucun dump de registre brut.

import type { PierreUltimateIntegrationContract } from "@/lib/pierre/v1/ultimate/p16a";
import type { CloneOSRunResult } from "@/lib/clonestore/product-technologies/t2";
import type {
  P16CGovernanceDecision, P16CT1Step, P16CT2Step, P16CTechnologyExecutionPlan,
} from "./p16c-types";

export interface BuildPlanInput {
  readonly integrationRequestId: string;
  readonly contract: PierreUltimateIntegrationContract;
  readonly governance: P16CGovernanceDecision;
  readonly cloneOsRun: CloneOSRunResult;
  readonly t1Steps: readonly P16CT1Step[];
  readonly t2Steps: readonly P16CT2Step[];
  readonly traceRequirements: readonly string[];
  readonly reviewRequirements: readonly string[];
  readonly briefRequirements: readonly string[];
  readonly continuityRequirements: readonly string[];
  readonly signalsRequirements: readonly string[];
  readonly learningCandidatesAllowed: boolean;
}

/** Références de contexte CloneADN BORNÉES (jamais le profil brut/secret). */
function adnRefs(run: CloneOSRunResult): string[] {
  const p = run.adnProfile;
  if (!p) return [];
  return [
    `cloneadn:tone=${p.tone.slice(0, 24)}`,
    `cloneadn:formality=${p.formality}`,
    `cloneadn:mutationPolicy=${p.mutationPolicy}`,
  ];
}

/** Assemble le plan d'exécution technologique P16C. Déterministe, borné, sans secret. Pur. */
export function buildTechnologyExecutionPlan(input: BuildPlanInput): P16CTechnologyExecutionPlan {
  const { contract, governance, cloneOsRun: run } = input;
  const plan = run.missionPlan;

  const permissionBlockers = governance.contributions
    .filter((c) => c.state === "PERMISSION_BLOCKED")
    .map((c) => c.reason);

  return {
    version: 1,
    integrationRequestId: input.integrationRequestId,
    companyId: contract.companyId,
    actorId: contract.actorId,
    pierreRequestId: contract.requestId,
    sourceContractVersion: contract.version,
    missionObjective: contract.missionProposal.objective,
    capabilityIds: [...contract.selectedCapabilityIds],
    effectiveGovernanceState: governance.effectiveState,
    cloneAdnContextRefs: adnRefs(run),
    guardDecision: run.guardDecision?.decision ?? null,
    policyDecision: run.policyDecision?.decision ?? null,
    trustDecision: run.trustDecision?.autonomyLevel ?? null,
    cloneOsMissionPlan: plan
      ? {
          title: plan.missionCandidate.title,
          objective: plan.missionCandidate.objective,
          taskIds: plan.tasks.map((t) => t.taskId),
          decidesHrOutcomes: false,
          executed: false,
        }
      : null,
    t1Steps: [...input.t1Steps],
    t2Steps: [...input.t2Steps],
    validations: [...contract.autonomy.requiredValidations],
    humanOnlyDecisions: contract.autonomy.humanOnlyDecisions.map((d) => d.category),
    providerBlockers: [...contract.providerDependencies],
    legalBlockers: [...contract.legalDependencies],
    permissionBlockers,
    traceRequirements: [...input.traceRequirements],
    reviewRequirements: [...input.reviewRequirements],
    briefRequirements: [...input.briefRequirements],
    continuityRequirements: [...input.continuityRequirements],
    signalsRequirements: [...input.signalsRequirements],
    learningCandidatesAllowed: input.learningCandidatesAllowed,
    cloneChatExplanation: contract.cloneChatExplanation.summary,
    executableLocally: governance.executableLocally,
    externallyExecutable: false,
    exactBlockers: [...governance.exactBlockers],
    nextSafeStep: contract.nextSafeStep,
    authoritativeReferences: [
      ...contract.authoritativeReferences,
      "p16c-integration-runtime",
      "product-technology-orchestrator.runCloneOSRequest",
      "technology-bus.prepareWithTechnology",
    ],
  };
}
