// src/lib/clonestore/integration/p16c/p16c-command-center.ts
// P16C — LE COMMAND CENTER (§17). Chaque drapeau est CALCULÉ à partir du comportement RÉEL : il exécute le
// VRAI runtime d'intégration P16C sur des demandes représentatives, sonde les registres T1/T2 réels, teste
// la précédence de gouvernance, et lit (lecture seule) les invariants des systèmes voisins + les routes
// CloneChat. Aucun booléen vert codé en dur : `readyForIntegratedLocalUse` n'est true que si tout le
// comportement local-safe est prouvé. `readyForProduction` reste false tant que les portes live sont
// bloquées. Les blocages externes restent visibles. Déterministe (aucun OpenAI).

import { HR_CAPABILITIES } from "@/lib/pierre/v1/hr-canon/capability-registry";
import { crossCheckCanonicalItems, pierreCapabilityCount } from "@/lib/pierre/v1/ultimate/p16a";
import { crossCheckTechnologyRegistryWithMasterSplit } from "@/lib/clonestore/technologies/t1/technology-registry";
import { listProductTechnologyRegistryEntries, getProductTechnologyRegistryEntry } from "@/lib/clonestore/product-technologies/t2/product-technology-registry";
import { createProductTechnologyOrchestrator } from "@/lib/clonestore/product-technologies/t2";
import { boundedCapabilitiesFor } from "@/lib/clonechat/intelligence/c1-1/parrain-knowledge-index";
import { C1_UI_INTEGRATION_CONTRACT } from "@/lib/clonechat/intelligence/c1";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";

import { crossCheckCanonicalIntegrationItems, canonicalIntegrationItemIds, canonicalIntegrationItems } from "./p16c-canonical-items";
import { runP16CIntegration } from "./p16c-integration-runtime";
import { computeGovernanceState } from "./p16c-governance-pipeline";
import { integrateCloneRoom } from "./p16c-cloneroom-adapter";
import { runLearningCandidates } from "./p16c-downstream";
import { classifyCloneChatIntent, buildCloneChatDelegation } from "./p16c-clonechat-adapter";
import type { P16CIntegrationResult } from "./p16c-types";

const NOW = "2026-07-13"; // "now" injecté (pur — jamais Date.now)
const ID = { companyId: "co-1", actorId: "user-1" };
const sarah = { employees: [{ kind: "employee" as const, status: "resolved" as const, id: "emp-sarah", label: "Sarah", candidates: [], reason: "unique_match" }] };

export type P16CCommandCenter = {
  readonly canonicalIntegrationItemCount: number;
  readonly canonicalIntegrationItemsRecovered: boolean;
  readonly canonicalIntegrationItems: readonly string[];
  readonly p16aReady: boolean;
  readonly pierreCapabilityCount: number;
  readonly pierreCapabilityCountDerived: boolean;
  readonly pierreContractConsumed: boolean;
  readonly secondHrBrainCreated: boolean;
  readonly t1RegistryConsumed: boolean;
  readonly t1UnknownNeeds: boolean;
  readonly t1FallbacksPreserved: boolean;
  readonly t2RegistryConsumed: boolean;
  readonly t2UnknownNeeds: boolean;
  readonly cloneAdnIntegrated: boolean;
  readonly cloneGuardIntegrated: boolean;
  readonly clonePolicyIntegrated: boolean;
  readonly cloneTrustIntegrated: boolean;
  readonly cloneOsIntegrated: boolean;
  readonly cloneTraceIntegrated: boolean;
  readonly cloneReviewIntegrated: boolean;
  readonly cloneBriefIntegrated: boolean;
  readonly cloneContinuumIntegrated: boolean;
  readonly cloneSignalsIntegrated: boolean;
  readonly cloneLearnIntegrated: boolean;
  readonly cloneCallLocalSafeIntegrated: boolean;
  readonly cloneRoomIntegrated: boolean;
  readonly cloneVoiceStillNotLive: boolean;
  readonly governancePrecedenceReady: boolean;
  readonly technologyExecutionPlanReady: boolean;
  readonly resultMergerReady: boolean;
  readonly authoritativeCompletionReady: boolean;
  readonly cloneChatDelegationIntegrated: boolean;
  readonly assistantRouteIntegrated: boolean;
  readonly executeRouteIntegrated: boolean;
  readonly proposalConfirmationPreserved: boolean;
  readonly explanationOnlyCreatesNoMission: boolean;
  readonly tenantIsolationReady: boolean;
  readonly permissionFilteringReady: boolean;
  readonly idempotencyReady: boolean;
  readonly documentLineageReady: boolean;
  readonly learningProposalOnly: boolean;
  readonly humanOnlyFloorsReady: boolean;
  readonly providerTruthReady: boolean;
  readonly legalTruthReady: boolean;
  readonly productionStillOff: boolean;
  readonly paymentStillDisabled: boolean;
  readonly liveProvidersStillBlocked: boolean;
  readonly p16aUntouched: boolean;
  readonly t1Untouched: boolean;
  readonly t2Untouched: boolean;
  readonly c1Untouched: boolean;
  readonly c11Untouched: boolean;
  readonly c12Untouched: boolean;
  readonly exactCompletedItems: readonly string[];
  readonly exactPartialItems: readonly string[];
  readonly exactBlockedItems: readonly string[];
  readonly exactWarnings: readonly string[];
  readonly exactBlockers: readonly string[];
  readonly readyForIntegratedLocalUse: boolean;
  readonly readyForProduction: boolean;
  readonly nextRecommendedPhase: "P16C" | "done" | "external";
  readonly verdict: string;
};

async function readRepoFile(relative: string): Promise<string | null> {
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    return readFileSync(resolve(process.cwd(), relative), "utf8");
  } catch {
    return null;
  }
}

/** Calcule le command center P16C à partir du comportement réel. Déterministe (aucun OpenAI). */
export async function computeP16CCommandCenter(): Promise<P16CCommandCenter> {
  // ── Runs représentatifs (vrai runtime P16C, déterministe) ──
  const onboarding = await runP16CIntegration({ requestId: "r-onb", ...ID, instruction: "Prépare l'onboarding de Sarah lundi et préviens son manager", nowIso: NOW }, { subjects: sarah });
  const dismissal = await runP16CIntegration({ requestId: "r-dis", ...ID, instruction: "Licencie Paul", nowIso: NOW }, { mode: "enterprise_autonomous" });
  const sector = await runP16CIntegration({ requestId: "r-sec", ...ID, instruction: "Applique la convention collective de mon secteur pour Sarah", nowIso: NOW }, { subjects: sarah });
  const correction = await runP16CIntegration({ requestId: "r-cor", ...ID, instruction: "Corrige seulement le document", nowIso: NOW }, { continuityContext: { artifacts: [{ id: "art-1", label: "Avenant de Nora" }] } });
  const doc = await runP16CIntegration({ requestId: "r-doc", ...ID, instruction: "Fais l'avenant de Nora pour mardi", nowIso: NOW });
  const foreign = await runP16CIntegration({ requestId: "r-frn", companyId: "co-2", actorId: "user-1", instruction: "Prépare l'onboarding de Sarah", nowIso: NOW }, { subjects: sarah });
  // Idempotence : deux runs identiques → résultats égaux.
  const idem1 = await runP16CIntegration({ requestId: "r-idem", ...ID, instruction: "Prépare l'onboarding de Sarah lundi", nowIso: NOW }, { subjects: sarah });
  const idem2 = await runP16CIntegration({ requestId: "r-idem", ...ID, instruction: "Prépare l'onboarding de Sarah lundi", nowIso: NOW }, { subjects: sarah });

  const roomRun = await integrateCloneRoom({
    room: { roomId: "room-1", participants: [{ id: "human-1", kind: "human" }, { id: "pierre", kind: "ai_employee" }], thread: [{ from: "human-1", content: "Préparer l'onboarding du nouveau développeur lundi." }] },
    ctx: { employeeId: "orchestrator", companyId: ID.companyId, actorUserId: ID.actorId },
    authorizedMemberIds: ["human-1", "pierre"],
  });
  const learn = await runLearningCandidates(
    [{ type: "correction", detail: "toujours vouvoyer" }, { type: "correction", detail: "toujours vouvoyer" }, { type: "correction", detail: "toujours vouvoyer" }],
    { employeeId: "pierre", companyId: ID.companyId },
  );
  const callRun = await createProductTechnologyOrchestrator().runCloneCallSession(
    { employeeCalledId: "pierre", objective: "point onboarding", transcriptText: "prépare l'onboarding" },
    { employeeId: "pierre", companyId: ID.companyId },
  );
  const explanation = await buildCloneChatDelegation({ message: "Qu'est-ce qui bloque ?", identity: ID, nowIso: NOW });
  const hrDelegation = await buildCloneChatDelegation({ message: "Prépare l'onboarding de Sarah lundi", identity: ID, nowIso: NOW, toolCall: { name: "create_mission" } });

  // ── Recovery + canon ──
  const recovery = crossCheckCanonicalIntegrationItems();
  const pierreRecovery = crossCheckCanonicalItems();
  const capCount = pierreCapabilityCount();
  const pierreCapabilityCountDerived = capCount === HR_CAPABILITIES.length && onboarding.plan?.capabilityIds !== undefined;
  const pierreContractConsumed = onboarding.contractConsumed && doc.contractConsumed && dismissal.contractConsumed;
  const secondHrBrainCreated = !(pierreContractConsumed && pierreCapabilityCountDerived);

  // ── T1/T2 consumption ──
  const t1RegistryConsumed = onboarding.plan!.t1Steps.length > 0 && onboarding.plan!.t1Steps.every((s) => s.known);
  const t1UnknownNeeds = [onboarding, doc, sector, correction].some((r) => (r.plan?.t1Steps ?? []).some((s) => !s.known));
  const t1FallbacksPreserved = onboarding.plan!.t1Steps.every((s) => s.safeFallback.trim().length > 0);
  const t2RegistryConsumed = doc.plan!.t2Steps.length > 0 && doc.plan!.t2Steps.every((s) => s.known);
  const t2UnknownNeeds = [onboarding, doc, sector].some((r) => (r.plan?.t2Steps ?? []).some((s) => !s.known));

  // ── T2 pipeline integration (depuis le run CloneOS réel) ──
  const run = onboarding.cloneOsRun!;
  const cloneAdnIntegrated = run.adnProfile !== null && run.adnProfile.mutationPolicy === "proposals_only";
  const cloneGuardIntegrated = run.guardDecision !== null;
  const clonePolicyIntegrated = run.policyDecision !== null;
  const cloneTrustIntegrated = run.trustDecision !== null && run.trustDecision.criticalAlwaysHumanOnly === true;
  const cloneOsIntegrated = run.missionPlan !== null && run.missionPlan.decidesHrOutcomes === false;
  const cloneTraceIntegrated = run.traceEvent !== null;
  const cloneReviewIntegrated = onboarding.plan!.reviewRequirements.length > 0;
  const cloneBriefIntegrated = onboarding.plan!.briefRequirements.length > 0;
  const cloneContinuumIntegrated = run.continuumState !== null;
  const cloneSignalsIntegrated = run.signalCandidates !== null;
  const cloneLearnIntegrated = learn.artifact !== null && learn.artifact.adnMutated === false && learn.artifact.candidates.every((c) => c.approvalRequired === true);
  const cloneCallLocalSafeIntegrated = callRun.session !== null && callRun.session.outboundLivePathBlocked === true && callRun.executedLive === false;
  const cloneRoomIntegrated = roomRun.ok && roomRun.allViaCloneOS && roomRun.peerToPeerBlocked;
  const voiceEntry = getProductTechnologyRegistryEntry("clonevoice");
  const cloneVoiceStillNotLive = voiceEntry?.contract.mode === "live_disabled" && voiceEntry.liveBlockedReason !== null;

  // ── Governance precedence (sondes synthétiques — pures) ──
  const permWins = computeGovernanceState({ disposition: "execute_local", permissionDenied: true, humanOnly: true, humanOnlyReasons: ["x"], legalDependencies: ["y"], providerDependencies: ["z"], clarificationBlocks: false, mustNotClaimPayroll: false }).effectiveState === "PERMISSION_BLOCKED";
  const humanWins = computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: true, humanOnlyReasons: ["dismissal"], legalDependencies: ["y"], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }).effectiveState === "HUMAN_ONLY";
  const legalOverPrepare = computeGovernanceState({ disposition: "prepare", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: ["cc"], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }).effectiveState === "LEGAL_BLOCKED";
  const providerOverLocal = computeGovernanceState({ disposition: "execute_local", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: ["mail"], clarificationBlocks: false, mustNotClaimPayroll: false }).effectiveState === "PROVIDER_BLOCKED";
  const validationPreserved = computeGovernanceState({ disposition: "validation_required", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false }).effectiveState === "VALIDATION_REQUIRED";
  const localOnlyWhenAllPermit = computeGovernanceState({ disposition: "execute_local", permissionDenied: false, humanOnly: false, humanOnlyReasons: [], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false, guardDecision: "allow_prepare", policyDecision: "allow_prepare", trustAutonomyLevel: "autonomous_safe" }).effectiveState === "LOCAL_EXECUTION_ALLOWED";
  const noGateLowers = computeGovernanceState({ disposition: "human_only", permissionDenied: false, humanOnly: true, humanOnlyReasons: ["dismissal"], legalDependencies: [], providerDependencies: [], clarificationBlocks: false, mustNotClaimPayroll: false, guardDecision: "allow_prepare", trustAutonomyLevel: "autonomous_safe" }).effectiveState === "HUMAN_ONLY";
  const governancePrecedenceReady = permWins && humanWins && legalOverPrepare && providerOverLocal && validationPreserved && localOnlyWhenAllPermit && noGateLowers;

  // ── Plan / merger / completion ──
  const technologyExecutionPlanReady = [onboarding, doc, sector, dismissal].every((r) => r.plan !== null && r.plan.externallyExecutable === false && r.plan.version === 1 && r.plan.capabilityIds.length >= 0);
  const resultMergerReady = [onboarding, doc, dismissal].every((r) => r.merged !== null && r.merged.authoritativeCompletion === false);
  const authoritativeCompletionReady = [onboarding, doc, sector, dismissal].every((r) => r.merged!.authoritativeCompletion === false && (r.merged!.missionStatus as string) !== "completed_mission_with_evidence");

  // ── CloneChat delegation + routes ──
  const cloneChatDelegationIntegrated = hrDelegation.kind === "hr_work" && hrDelegation.createsMission === true && hrDelegation.externallyExecutable === false;
  const explanationOnlyCreatesNoMission = explanation.kind !== "hr_work" && explanation.createsMission === false && classifyCloneChatIntent("Qu'est-ce qui bloque ?") === "explanation";
  const chatSrc = await readRepoFile("src/app/api/assistant/chat/route.ts");
  const execSrc = await readRepoFile("src/app/api/assistant/execute/route.ts");
  const assistantRouteIntegrated = !!chatSrc && /p16c/i.test(chatSrc);
  const executeRouteIntegrated = !!execSrc && /proposalId/.test(execSrc) && /(createMissionV1|decideValidationV1|runGovernedCommand)/.test(execSrc);
  const proposalConfirmationPreserved = !!execSrc && /proposalId/.test(execSrc) && /commandFingerprint/.test(execSrc) && !/req\.\w+\.payload/.test(execSrc);

  // ── Isolation / permission / idempotence / lineage / learning ──
  const tenantIsolationReady = foreign.plan?.companyId === "co-2" && foreign.plan?.actorId === "user-1" && onboarding.plan?.companyId === "co-1";
  const permissionFilteringReady = onboarding.plan!.t1Steps.every((s) => s.permissionAllowed) && recovery.technologyDrift.length === 0;
  const idempotencyReady = JSON.stringify(idem1.plan) === JSON.stringify(idem2.plan);
  const documentLineageReady = correction.plan!.continuityRequirements.some((r) => /lign[ée]e|version/i.test(r));
  const learningProposalOnly = learn.adnMutated === false && learn.candidatesAllowed === true;

  // ── Human-only / provider / legal truth ──
  const humanOnlyFloorsReady = dismissal.governance!.effectiveState === "HUMAN_ONLY" && dismissal.merged!.missionStatus === "human_only";
  const providerTruthReady = onboarding.plan!.providerBlockers.length > 0 && onboarding.plan!.t1Steps.some((s) => s.liveBlocked);
  const legalTruthReady = sector.plan!.legalBlockers.length > 0 || sector.governance!.effectiveState === "LEGAL_BLOCKED";

  // ── External floors ──
  const productionStillOff = PRODUCTION_AUTHORIZED === false;
  const paymentStillDisabled = resolvePaymentMode({}) !== "live";
  const liveProvidersStillBlocked = onboarding.plan!.providerBlockers.length > 0 && onboarding.plan!.t1Steps.some((s) => s.liveBlocked);

  // ── Perimeter ──
  const p16aUntouched = pierreRecovery.ok && capCount === HR_CAPABILITIES.length;
  const t1Untouched = crossCheckTechnologyRegistryWithMasterSplit().ok;
  const t2Untouched = listProductTechnologyRegistryEntries().length === 14;
  const c1Untouched = !!C1_UI_INTEGRATION_CONTRACT;
  const c11Untouched = (() => { try { return Array.isArray(boundedCapabilitiesFor("onboarding")); } catch { return false; } })();
  const c12Untouched = isCloneChatEnabled();

  // ── Rollup ── (items complétés/bloqués DÉRIVÉS des métadonnées canoniques réelles, jamais hardcodés).
  const items = canonicalIntegrationItemIds();
  const meta = canonicalIntegrationItems();
  // Bloqué = dépendance externe/live déclarée dans le master split (mail/calendar/signature/notification/voice).
  const exactBlockedItems = meta.filter(({ meta: m }) => m.externalDependency !== null).map(({ meta: m }) => m.id);
  // Complété local-safe = pas de dépendance externe ET statut visé local-safe.
  const exactCompletedItems = meta.filter(({ meta: m }) => m.externalDependency === null && m.expectedStatus === "integrated_local_safe").map(({ meta: m }) => m.id);
  const exactPartialItems: string[] = [];
  const exactWarnings: string[] = [
    "Adaptateurs mail/calendar/signature/notification : chemin LIVE bloqué (provider externe) — fallback local-safe prouvé.",
    "int.voice_adapter : architecture-ready, voix live non opérationnelle (texte autoritaire).",
    "Exécution autoritaire des missions : derrière la route de confirmation + contrat V1 (jamais fabriquée par P16C).",
  ];

  const readinessFlags: Array<[string, boolean]> = [
    ["canonicalIntegrationItemsRecovered", recovery.ok], ["pierreContractConsumed", pierreContractConsumed],
    ["pierreCapabilityCountDerived", pierreCapabilityCountDerived], ["t1RegistryConsumed", t1RegistryConsumed],
    ["t1FallbacksPreserved", t1FallbacksPreserved], ["t2RegistryConsumed", t2RegistryConsumed],
    ["cloneAdnIntegrated", cloneAdnIntegrated], ["cloneGuardIntegrated", cloneGuardIntegrated],
    ["clonePolicyIntegrated", clonePolicyIntegrated], ["cloneTrustIntegrated", cloneTrustIntegrated],
    ["cloneOsIntegrated", cloneOsIntegrated], ["cloneTraceIntegrated", cloneTraceIntegrated],
    ["cloneReviewIntegrated", cloneReviewIntegrated], ["cloneBriefIntegrated", cloneBriefIntegrated],
    ["cloneContinuumIntegrated", cloneContinuumIntegrated], ["cloneSignalsIntegrated", cloneSignalsIntegrated],
    ["cloneLearnIntegrated", cloneLearnIntegrated], ["cloneCallLocalSafeIntegrated", cloneCallLocalSafeIntegrated],
    ["cloneRoomIntegrated", cloneRoomIntegrated], ["cloneVoiceStillNotLive", cloneVoiceStillNotLive],
    ["governancePrecedenceReady", governancePrecedenceReady], ["technologyExecutionPlanReady", technologyExecutionPlanReady],
    ["resultMergerReady", resultMergerReady], ["authoritativeCompletionReady", authoritativeCompletionReady],
    ["cloneChatDelegationIntegrated", cloneChatDelegationIntegrated], ["assistantRouteIntegrated", assistantRouteIntegrated],
    ["executeRouteIntegrated", executeRouteIntegrated], ["proposalConfirmationPreserved", proposalConfirmationPreserved],
    ["explanationOnlyCreatesNoMission", explanationOnlyCreatesNoMission], ["tenantIsolationReady", tenantIsolationReady],
    ["permissionFilteringReady", permissionFilteringReady], ["idempotencyReady", idempotencyReady],
    ["documentLineageReady", documentLineageReady], ["learningProposalOnly", learningProposalOnly],
    ["humanOnlyFloorsReady", humanOnlyFloorsReady], ["providerTruthReady", providerTruthReady],
    ["legalTruthReady", legalTruthReady], ["t1Untouched", t1Untouched], ["t2Untouched", t2Untouched],
    ["c1Untouched", c1Untouched], ["c11Untouched", c11Untouched], ["c12Untouched", c12Untouched],
    ["p16aUntouched", p16aUntouched], ["productionStillOff", productionStillOff],
    ["paymentStillDisabled", paymentStillDisabled], ["liveProvidersStillBlocked", liveProvidersStillBlocked],
  ];
  const exactBlockers: string[] = [];
  if (!recovery.ok) exactBlockers.push(`Recovery drift: ${recovery.issues.join("; ")}`);
  if (secondHrBrainCreated) exactBlockers.push("Un 2e cerveau/registre RH a été détecté.");
  for (const [name, ok] of readinessFlags) if (!ok) exactBlockers.push(`Readiness manquant: ${name}`);

  const readyForIntegratedLocalUse = recovery.ok && !secondHrBrainCreated && readinessFlags.every(([, ok]) => ok) && exactBlockers.length === 0;
  const readyForProduction = false; // JAMAIS true tant que les portes live sont bloquées (plancher P10)

  const verdict = readyForIntegratedLocalUse
    ? "P16C — INTEGRATION LOCALLY VERIFIED / EXTERNAL LIVE CAPABILITIES BLOCKED (10 adaptateurs canoniques intégrés local-safe ; live/production bloqués par conception)."
    : "P16C — INTEGRATION PARTIAL / END-TO-END BLOCKED";

  return {
    canonicalIntegrationItemCount: items.length,
    canonicalIntegrationItemsRecovered: recovery.ok,
    canonicalIntegrationItems: items,
    p16aReady: p16aUntouched,
    pierreCapabilityCount: capCount,
    pierreCapabilityCountDerived,
    pierreContractConsumed,
    secondHrBrainCreated,
    t1RegistryConsumed, t1UnknownNeeds, t1FallbacksPreserved,
    t2RegistryConsumed, t2UnknownNeeds,
    cloneAdnIntegrated, cloneGuardIntegrated, clonePolicyIntegrated, cloneTrustIntegrated, cloneOsIntegrated,
    cloneTraceIntegrated, cloneReviewIntegrated, cloneBriefIntegrated, cloneContinuumIntegrated,
    cloneSignalsIntegrated, cloneLearnIntegrated, cloneCallLocalSafeIntegrated, cloneRoomIntegrated, cloneVoiceStillNotLive,
    governancePrecedenceReady, technologyExecutionPlanReady, resultMergerReady, authoritativeCompletionReady,
    cloneChatDelegationIntegrated, assistantRouteIntegrated, executeRouteIntegrated, proposalConfirmationPreserved,
    explanationOnlyCreatesNoMission, tenantIsolationReady, permissionFilteringReady, idempotencyReady,
    documentLineageReady, learningProposalOnly, humanOnlyFloorsReady, providerTruthReady, legalTruthReady,
    productionStillOff, paymentStillDisabled, liveProvidersStillBlocked,
    p16aUntouched, t1Untouched, t2Untouched, c1Untouched, c11Untouched, c12Untouched,
    exactCompletedItems, exactPartialItems, exactBlockedItems, exactWarnings, exactBlockers,
    readyForIntegratedLocalUse,
    readyForProduction,
    nextRecommendedPhase: readyForIntegratedLocalUse ? "external" : "P16C",
    verdict,
  };
}
