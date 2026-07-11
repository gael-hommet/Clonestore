// src/lib/clonestore/integration/p16c/p16c-integration-runtime.ts
// P16C — LE RUNTIME D'INTÉGRATION. Le chemin dur (§2) :
//   CloneChat → intent conversationnel autorisé → compréhension/contrat Pierre Ultimate (P16A) →
//   résolveur d'intégration P16C → contextualisation CloneADN → CloneGuard + ClonePolicy + CloneTrust →
//   orchestration mission CloneOS → opérations T1 → continuité/trace/review/brief/signals T2 →
//   résultat autoritaire → explication CloneChat.
// Aucune couche ne saute une porte de gouvernance. Pierre reste le cerveau RH (aucune réinterprétation).
// Aucun effet externe/live n'est autorisé. Déterministe par défaut (aucun OpenAI). Tenant scopé serveur.

import { analyzeForP16C, type AnalyzeForP16COptions, type PierreUltimateIntegrationContract } from "@/lib/pierre/v1/ultimate/p16a";
import type { ProductTechnologyContext, ClonePolicyRule, CloneADNInput } from "@/lib/clonestore/product-technologies/t2";
import { isTechnologyId } from "@/lib/clonestore/technologies/t1";
import { isProductTechnologyId } from "@/lib/clonestore/product-technologies/t2";

import { consumePierreContract, type P16CContractIdentity } from "./p16c-pierre-contract-adapter";
import { resolveT1Steps } from "./p16c-t1-resolver";
import { resolveT2Steps } from "./p16c-t2-resolver";
import { adaptPierreToCloneOS } from "./p16c-cloneos-adapter";
import { computeGovernanceState } from "./p16c-governance-pipeline";
import { buildTechnologyExecutionPlan } from "./p16c-technology-execution-plan";
import { mergeResults } from "./p16c-result-merger";
import {
  buildTraceRequirements, buildReviewRequirements, buildContinuityRequirements,
  buildSignalsRequirements, buildBriefRequirements,
} from "./p16c-downstream";
import { canonicalIntegrationItems } from "./p16c-canonical-items";
import type { P16CIntegrationResult, P16CCanonicalIntegrationId } from "./p16c-types";

export interface P16CRuntimeArgs {
  readonly requestId: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly instruction: string;
  readonly nowIso: string;
}

export interface P16CRuntimeOptions extends AnalyzeForP16COptions {
  readonly requesterRole?: string;
  readonly policyRules?: readonly ClonePolicyRule[];
  readonly adn?: CloneADNInput;
}

const PAYROLL_BLOCK_CODE = "must_not_claim_payroll_engine";

function resolvedCanonicalItems(contract: PierreUltimateIntegrationContract): P16CCanonicalIntegrationId[] {
  const t1 = new Set(contract.t1Needs.map((n) => n.techId));
  const t2 = new Set(contract.t2Needs.map((n) => n.techId));
  return canonicalIntegrationItems()
    .filter(({ meta }) => meta.t1.some((t) => t1.has(t)) || meta.t2.some((t) => t2.has(t)))
    .map(({ meta }) => meta.id);
}

function rejected(reason: string): P16CIntegrationResult {
  return {
    ok: false, rejectedReason: reason, contractConsumed: false,
    plan: null, governance: null, merged: null, cloneOsRun: null, canonicalItemsResolved: [],
  };
}

/**
 * Intègre un contrat P16A DÉJÀ construit (permet d'injecter un contrat forgé en test). Fail-closed :
 * un contrat invalide (version/tenant/capacité/forge/entité interdite/techno inconnue) est REJETÉ.
 */
export async function runP16CIntegrationFromContract(
  contract: PierreUltimateIntegrationContract,
  expected: P16CContractIdentity,
  opts: P16CRuntimeOptions = {},
): Promise<P16CIntegrationResult> {
  // 1) Consommer + VALIDER le contrat Pierre (jamais réinterprété).
  const consumption = consumePierreContract(contract, expected);
  if (!consumption.accepted || !consumption.contract) return rejected(consumption.rejectedReason ?? "Contrat rejeté.");
  const c = consumption.contract;

  const ctx: ProductTechnologyContext = {
    employeeId: "pierre",
    companyId: c.companyId,
    actorUserId: c.actorId,
    requesterRole: opts.requesterRole,
    purpose: c.missionProposal.objective,
  };

  // 2) Résoudre les besoins T1/T2 (vrais registres) — jamais un 2e registre.
  const t1Steps = await resolveT1Steps(c.t1Needs, { companyId: c.companyId, actorId: c.actorId, purpose: c.missionProposal.objective });
  const t2Steps = await resolveT2Steps(c.t2Needs, { companyId: c.companyId, actorId: c.actorId, requesterRole: opts.requesterRole, objective: c.missionProposal.objective });

  // 3) Orchestration CloneOS réelle (ADN→OS→Policy→Guard→Trust→Review→Trace→Continuum→Signals).
  const osAdaptation = await adaptPierreToCloneOS({ contract: c, ctx, policyRules: opts.policyRules, adn: opts.adn });
  const run = osAdaptation.run;

  // 4) Gouvernance effective (le plus strict — fail-closed).
  const t1PermissionDenied = t1Steps.some((s) => s.known && !s.permissionAllowed);
  const t1UnknownOrBlocked = t1Steps.some((s) => !s.known);
  const governance = computeGovernanceState({
    disposition: c.autonomy.overallDisposition,
    permissionDenied: false,
    humanOnly: consumption.humanOnly,
    humanOnlyReasons: c.autonomy.humanOnlyDecisions.map((d) => d.category),
    legalDependencies: c.legalDependencies,
    providerDependencies: c.providerDependencies,
    clarificationBlocks: c.clarification.blocksExecution,
    mustNotClaimPayroll: c.blockedReasons.some((b) => b.code === PAYROLL_BLOCK_CODE),
    guardDecision: run.guardDecision?.decision ?? null,
    guardRisk: run.guardDecision?.riskLevel ?? null,
    guardFinalLegal: run.guardDecision?.finalLegalDecision ?? false,
    policyDecision: run.policyDecision?.decision ?? null,
    trustAutonomyLevel: run.trustDecision?.autonomyLevel ?? null,
    t1PermissionDenied,
    t1UnknownOrBlocked,
    cloneOsBlockedByGovernance: run.blockedByGovernance,
  });

  // 5) Exigences aval (Trace/Review/Brief/Continuum/Signals) — depuis le run réel.
  const traceRequirements = buildTraceRequirements(run);
  const reviewRequirements = buildReviewRequirements(run);
  const continuityRequirements = buildContinuityRequirements(c);
  const signalsRequirements = buildSignalsRequirements(run);

  // 6) Fusion des résultats → statut autoritaire (jamais « completed »).
  const merged = mergeResults({
    governance,
    t1Steps,
    t2Steps,
    cloneOsPlanPresent: run.missionPlan !== null,
    cloneOsBlockedByGovernance: run.blockedByGovernance,
    humanOnlyReasons: c.autonomy.humanOnlyDecisions.map((d) => d.category),
  });
  const briefRequirements = buildBriefRequirements(merged);

  // 7) Plan d'exécution technologique typé (externallyExecutable=false).
  const plan = buildTechnologyExecutionPlan({
    integrationRequestId: `p16c-${c.requestId}`,
    contract: c,
    governance,
    cloneOsRun: run,
    t1Steps,
    t2Steps,
    traceRequirements,
    reviewRequirements,
    briefRequirements,
    continuityRequirements,
    signalsRequirements,
    // Apprentissage autorisé (proposition-only) sauf floor human-only pur (rien à apprendre d'un refus sensible).
    learningCandidatesAllowed: governance.effectiveState !== "PERMISSION_BLOCKED",
  });

  return {
    ok: true,
    rejectedReason: null,
    contractConsumed: true,
    plan,
    governance,
    merged,
    cloneOsRun: run,
    canonicalItemsResolved: resolvedCanonicalItems(c),
  };
}

/**
 * Intègre depuis une demande RH brute : calcule d'abord le VRAI contrat Pierre (P16A, déterministe),
 * puis exécute l'intégration. Tenant scopé serveur (companyId/actorId = args, jamais du client).
 */
export async function runP16CIntegration(
  args: P16CRuntimeArgs,
  opts: P16CRuntimeOptions = {},
): Promise<P16CIntegrationResult> {
  const contract = await analyzeForP16C(
    { requestId: args.requestId, companyId: args.companyId, actorId: args.actorId, instruction: args.instruction, nowIso: args.nowIso },
    opts,
  );
  return runP16CIntegrationFromContract(contract, { companyId: args.companyId, actorId: args.actorId }, opts);
}

/** Garde utilitaire : un id de techno est-il connu (T1 ou T2) ? (fail-closed). Pur. */
export function isKnownTechnologyId(id: string): boolean {
  return isTechnologyId(id) || isProductTechnologyId(id);
}
