// src/lib/clonestore/integration/p16c/index.ts
// P16C — PIERRE × CLONESTORE TECHNOLOGIES × CLONECHAT INTEGRATION GATE : exports publics.
// Couche ADDITIVE d'intégration : consomme le contrat Pierre (P16A), les registres T1/T2 réels, l'orchestrateur
// CloneOS T2 et la route CloneChat — sans rien reconstruire. Aucun 2e cerveau RH ; aucun provider live ;
// production/paiement OFF ; `externallyExecutable` toujours false. Pierre reste l'autorité RH.

// ── Types ──
export type {
  P16CCanonicalIntegrationId, P16CIntegrationStatus, P16CGovernanceState, P16CGovernanceContribution,
  P16CGovernanceDecision, P16CT1Step, P16CT2Step, P16COperationStatus, P16CMissionStatus,
  P16COperationResult, P16CMergedResult, P16CTechnologyExecutionPlan, P16CIntegrationResult,
} from "./p16c-types";
export { ALL_P16C_GOVERNANCE_STATES } from "./p16c-types";

// ── Items canoniques ──
export type { P16CItemMeta, P16CRecoveryCrossCheck } from "./p16c-canonical-items";
export {
  canonicalIntegrationItems, canonicalIntegrationItemIds, metaForIntegrationItem,
  crossCheckCanonicalIntegrationItems,
} from "./p16c-canonical-items";

// ── Consommation du contrat Pierre ──
export type { P16CContractIdentity, P16CContractConsumption } from "./p16c-pierre-contract-adapter";
export { consumePierreContract } from "./p16c-pierre-contract-adapter";

// ── Résolveurs T1/T2 ──
export type { P16CT1ResolveContext } from "./p16c-t1-resolver";
export { resolveT1Step, resolveT1Steps } from "./p16c-t1-resolver";
export type { P16CT2ResolveContext } from "./p16c-t2-resolver";
export { resolveT2Step, resolveT2Steps } from "./p16c-t2-resolver";

// ── CloneOS ──
export type { P16CCloneOSAdaptation, P16CCloneOSInput } from "./p16c-cloneos-adapter";
export { adaptPierreToCloneOS } from "./p16c-cloneos-adapter";

// ── Gouvernance ──
export type { P16CGovernanceInput } from "./p16c-governance-pipeline";
export { computeGovernanceState, strictest, strictnessOf } from "./p16c-governance-pipeline";

// ── Plan d'exécution ──
export type { BuildPlanInput } from "./p16c-technology-execution-plan";
export { buildTechnologyExecutionPlan } from "./p16c-technology-execution-plan";

// ── Fusion des résultats ──
export type { P16CMergeInput } from "./p16c-result-merger";
export { mergeResults } from "./p16c-result-merger";

// ── Aval (Trace/Review/Brief/Continuum/Signals/Learn) ──
export type { P16CLearningOutcome } from "./p16c-downstream";
export {
  buildTraceRequirements, buildReviewRequirements, buildContinuityRequirements,
  buildSignalsRequirements, buildBriefRequirements, runBrief, runLearningCandidates,
} from "./p16c-downstream";

// ── CloneRoom ──
export type { P16CRoomIntegration, P16CRoomInput } from "./p16c-cloneroom-adapter";
export { integrateCloneRoom, roomEventKey } from "./p16c-cloneroom-adapter";

// ── Runtime ──
export type { P16CRuntimeArgs, P16CRuntimeOptions } from "./p16c-integration-runtime";
export { runP16CIntegration, runP16CIntegrationFromContract, isKnownTechnologyId } from "./p16c-integration-runtime";

// ── CloneChat ──
export type {
  CloneChatIntentKind, P16CClientGovernanceSummary, P16CClientExplanation, P16CClientDelegation, P16CDelegationArgs,
} from "./p16c-clonechat-adapter";
export { classifyCloneChatIntent, buildCloneChatDelegation } from "./p16c-clonechat-adapter";

// ── Flag ──
export { isP16CIntegrationEnabled } from "./p16c-flags";

// ── Command center ──
export type { P16CCommandCenter } from "./p16c-command-center";
export { computeP16CCommandCenter } from "./p16c-command-center";
