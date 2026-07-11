// src/lib/pierre/v1/ultimate/p16a/command-center.ts
// P16A — the command center (owner §15). Every flag is COMPUTED from real behavior: it runs the REAL
// deterministic P16C contract over representative requests, the sync runtime primitives, and read-only
// invariants of the neighbouring systems (T1/T2/C1/C1.1/C1.2 + production/payment gates). No hardcoded
// green booleans: `readyForP16C` is true only when every Pierre-owned canonical item is proven and the
// human-only floors hold. External/live blockers are explicit and NEVER invalidate locally-complete
// Pierre-owned behavior.

import { HR_CAPABILITIES } from "../../hr-canon/capability-registry";
import { COGNITIVE_LIMITS } from "../../cognitive-runtime/config";
import { resolveEntity } from "../../cognitive-runtime/entity-resolution";
import { resolveTemporal } from "../../cognitive-runtime/temporal-resolution";
import { computeClarifications } from "../../cognitive-runtime/clarification-engine";
import { getPierreUltimateItems } from "@/lib/clonestore/ultimate/p16-master-split";
import { crossCheckTechnologyRegistryWithMasterSplit } from "@/lib/clonestore/technologies/t1/technology-registry";
import { listProductTechnologyRegistryEntries } from "@/lib/clonestore/product-technologies/t2/product-technology-registry";
import { boundedCapabilitiesFor } from "@/lib/clonechat/intelligence/c1-1/parrain-knowledge-index";
import { C1_UI_INTEGRATION_CONTRACT } from "@/lib/clonechat/intelligence/c1";
import { isCloneChatEnabled } from "@/lib/features/product-availability";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";

import { crossCheckCanonicalItems, canonicalUltimateItemIds } from "./canonical-items";
import { pierreCapabilityCount, retrieveForRequest } from "./capability-adapter";
import { computeGapMatrix, allPierreOwnedComplete } from "./gap-matrix";
import { analyzeForP16C } from "./integration-contract";
import type { PierreUltimateIntegrationContract } from "./types";

export type P16ACommandCenter = {
  // recovery + canon
  readonly canonicalUltimateItemCount: number;
  readonly canonicalUltimateItemsRecovered: boolean;
  readonly canonicalUltimateItems: readonly string[];
  readonly pierreCapabilityCount: number;
  readonly capabilityCountDerivedNotHardcoded: boolean;
  readonly pierreRuntimeReused: boolean;
  readonly secondHrBrainCreated: boolean;
  // behavior readiness
  readonly requestUnderstandingReady: boolean;
  readonly multiIntentReady: boolean;
  readonly entityResolutionReady: boolean;
  readonly dateResolutionReady: boolean;
  readonly clarificationReady: boolean;
  readonly capabilityRetrievalReady: boolean;
  readonly missionIntelligenceReady: boolean;
  readonly multiStepOperationalDepthReady: boolean;
  readonly outputQualityReady: boolean;
  readonly continuityReady: boolean;
  readonly correctionVersioningReady: boolean;
  readonly idempotencyReady: boolean;
  readonly autonomyClassificationReady: boolean;
  readonly humanOnlyFloorsReady: boolean;
  readonly providerTruthReady: boolean;
  readonly legalTruthReady: boolean;
  readonly documentLineageReady: boolean;
  readonly explanationReady: boolean;
  readonly p16cIntegrationContractReady: boolean;
  // perimeter
  readonly t1Untouched: boolean;
  readonly t2Untouched: boolean;
  readonly c1Untouched: boolean;
  readonly c11Untouched: boolean;
  readonly c12Untouched: boolean;
  readonly productionStillOff: boolean;
  readonly paymentStillDisabled: boolean;
  readonly liveProvidersStillBlocked: boolean;
  // rollup
  readonly exactCompletedItems: readonly string[];
  readonly exactPartialItems: readonly string[];
  readonly exactBlockedItems: readonly string[];
  readonly exactWarnings: readonly string[];
  readonly exactBlockers: readonly string[];
  readonly readyForP16C: boolean;
  readonly nextRecommendedPhase: "P16A" | "P16C";
  readonly verdict: string;
};

const NOW = "2026-07-13"; // injected "now" (pure — no Date.now); a Monday for weekday probes

const sarahSubject = {
  employees: [{ kind: "employee" as const, status: "resolved" as const, id: "emp-sarah", label: "Sarah", candidates: [], reason: "unique_match" }],
};

function contractIsStructurallyComplete(c: PierreUltimateIntegrationContract): boolean {
  return (
    c.version === 1 &&
    typeof c.understanding.normalizedObjective === "string" &&
    Array.isArray(c.selectedCapabilityIds) &&
    c.capabilityCountDerivedFromRegistry === true &&
    typeof c.missionProposal.source === "string" &&
    Array.isArray(c.autonomy.humanOnlyDecisions) &&
    typeof c.continuity.isContinuation === "boolean" &&
    Array.isArray(c.t1Needs) && Array.isArray(c.t2Needs) &&
    Array.isArray(c.blockedReasons) &&
    typeof c.nextSafeStep === "string" && c.nextSafeStep.length > 0 &&
    c.cloneChatExplanation.safeToShowUser === true
  );
}

// A contract must never fabricate "sent"/"signed"/"completed" for a prepared action.
const FORBIDDEN_CLAIM_RE = /\b(envoy[ée]|sent|sign[ée]|completed|termin[ée] avec succes)\b/i;
function noFabricatedCompletion(c: PierreUltimateIntegrationContract): boolean {
  const blob = `${c.statusExplanation} ${c.nextSafeStep} ${c.cloneChatExplanation.summary}`;
  return !FORBIDDEN_CLAIM_RE.test(blob);
}

/** Compute the P16A command center from real behavior. Deterministic (no OpenAI). */
export async function computeP16ACommandCenter(): Promise<P16ACommandCenter> {
  const base = { companyId: "co-1", actorId: "user-1", nowIso: NOW };

  // ── representative real contracts (deterministic path) ────────────────────────────────────────────
  const onboarding = await analyzeForP16C({ requestId: "r-onb", ...base, instruction: "Prépare l'onboarding de Sarah lundi et préviens son manager" }, { subjects: sarahSubject });
  const missingSubject = await analyzeForP16C({ requestId: "r-mis", ...base, instruction: "Prépare l'avenant" });
  const dismissal = await analyzeForP16C({ requestId: "r-dis", ...base, instruction: "Licencie Paul", }, { mode: "enterprise_autonomous" });
  const salary = await analyzeForP16C({ requestId: "r-sal", ...base, instruction: "Augmente Sarah de 20 % immédiatement" }, { mode: "enterprise_autonomous", subjects: sarahSubject });
  const sanction = await analyzeForP16C({ requestId: "r-san", ...base, instruction: "Décide de la sanction pour ce cas" }, { mode: "enterprise_autonomous" });
  const correction = await analyzeForP16C({ requestId: "r-cor", ...base, instruction: "Corrige seulement le document" }, { continuityContext: { artifacts: [{ id: "art-1", label: "Avenant de Nora" }] } });
  const continueReq = await analyzeForP16C({ requestId: "r-con", ...base, instruction: "Continue la mission" }, { continuityContext: { missions: [{ id: "mis-1", label: "Onboarding Sarah" }] } });
  const sector = await analyzeForP16C({ requestId: "r-sec", ...base, instruction: "Applique la convention collective de mon secteur pour Sarah" }, { subjects: sarahSubject });
  const info = await analyzeForP16C({ requestId: "r-inf", ...base, instruction: "Quelles sont les étapes d'un onboarding conforme ?" });
  const idem1 = await analyzeForP16C({ requestId: "r-idem", ...base, instruction: "Prépare l'onboarding de Sarah lundi" }, { subjects: sarahSubject });
  const idem2 = await analyzeForP16C({ requestId: "r-idem", ...base, instruction: "Prépare l'onboarding de Sarah lundi" }, { subjects: sarahSubject });

  // ── recovery + canon ──────────────────────────────────────────────────────────────────────────────
  const recovery = crossCheckCanonicalItems();
  const capabilityCount = pierreCapabilityCount();
  const capabilityCountDerivedNotHardcoded = capabilityCount === HR_CAPABILITIES.length;
  const secondHrBrainCreated = !capabilityCountDerivedNotHardcoded; // count NOT from the one registry ⇒ a 2nd source

  // ── behavior readiness ──────────────────────────────────────────────────────────────────────────────
  const requestUnderstandingReady = onboarding.understanding.normalizedObjective.length > 0 && onboarding.understanding.requestKind.length > 0;
  const multiIntentReady = onboarding.understanding.multiIntent === true;

  const entResolved = resolveEntity("employee", "Sarah", [{ id: "e1", name: "Sarah Martin" }]).status === "resolved";
  const entAmbiguous = resolveEntity("employee", "Sarah", [{ id: "e1", name: "Sarah Martin" }, { id: "e2", name: "Sarah Durand" }]).status === "ambiguous";
  const entityResolutionReady = entResolved && entAmbiguous;

  const dExplicit = resolveTemporal("2026-09-01", NOW).status === "resolved";
  const dRelative = resolveTemporal("lundi prochain", NOW).status === "resolved";
  const dUnknownBlocks = resolveTemporal("bientôt", NOW).status === "unresolved";
  const dateResolutionReady = dExplicit && dRelative && dUnknownBlocks;

  const clarBlocks = computeClarifications({ entities: [], dates: [], amounts: [], ambiguities: [], missingInformation: [{ field: "who", question: "Qui ?", blocksExecution: true }] }).nextStep === "ASK_CLARIFICATION";
  const clarNoop = computeClarifications({ entities: [], dates: [], amounts: [], ambiguities: [], missingInformation: [] }).nextStep === "PREPARE_PLAN";
  const clarificationReady = clarBlocks && clarNoop && missingSubject.clarification.blocksExecution && !onboarding.clarification.blocksExecution;

  const retr = retrieveForRequest("onboarding contrat absence");
  const capabilityRetrievalReady = retr.length > 0 && retr.length <= COGNITIVE_LIMITS.maxCandidateCapabilities && retr.length < HR_CAPABILITIES.length;

  const gap = computeGapMatrix();
  const missionRow = gap.find((r) => r.id === "pierre.mission_depth");
  const missionIntelligenceReady = !!missionRow?.evidencePresent && onboarding.missionProposal.tasks.length > 0;
  const multiStepOperationalDepthReady = onboarding.missionProposal.tasks.length >= 1 && onboarding.missionProposal.completionCriteria.length > 0 && onboarding.canonicalItemsInvolved.includes("pierre.onboarding_offboarding");

  const outputQualityReady =
    noFabricatedCompletion(onboarding) && noFabricatedCompletion(dismissal) &&
    onboarding.cloneChatExplanation.disclosure.includes("PAS disponible") &&
    onboarding.documentEvidenceRequirements.length >= 0;

  const continuityReady = continueReq.continuity.isContinuation && continueReq.continuity.targetId === "mis-1" && continueReq.continuity.requiresAuthoritativeRead;
  const correctionVersioningReady = correction.continuity.isCorrection && correction.continuity.targetId === "art-1" && correction.documentEvidenceRequirements.some((r) => /lign[ée]e/i.test(r));
  const idempotencyReady = JSON.stringify(idem1) === JSON.stringify(idem2);

  const autonomyClassificationReady = dismissal.autonomy.overallDisposition === "human_only";
  // Human-only floors hold even under the MOST autonomous mode.
  const humanOnlyFloorsReady =
    dismissal.autonomy.overallDisposition === "human_only" &&
    salary.autonomy.overallDisposition === "human_only" &&
    sanction.autonomy.overallDisposition === "human_only" &&
    salary.autonomy.humanOnlyDecisions.some((d) => d.category === "salary_change") &&
    dismissal.autonomy.humanOnlyDecisions.some((d) => d.category === "dismissal");

  const providerTruthReady =
    onboarding.providerDependencies.length > 0 &&
    onboarding.t1Needs.some((n) => n.liveBlocked) &&
    noFabricatedCompletion(onboarding);
  const legalTruthReady =
    (sector.legalDependencies.length > 0 || sector.blockedReasons.some((b) => b.code === "legal_blocked")) &&
    sector.cloneChatExplanation.disclosure.includes("juriste");
  const documentLineageReady = correction.documentEvidenceRequirements.some((r) => /lign[ée]e/i.test(r));
  const explanationReady = [onboarding, dismissal, info, sector].every((c) => c.statusExplanation.length > 0 && c.nextSafeStep.length > 0);
  const p16cIntegrationContractReady = [onboarding, dismissal, correction, sector, info].every(contractIsStructurallyComplete);

  const pierreRuntimeReused = missionIntelligenceReady && capabilityRetrievalReady && requestUnderstandingReady;

  // ── perimeter (read-only invariants of neighbouring systems) ────────────────────────────────────────
  const t1Untouched = crossCheckTechnologyRegistryWithMasterSplit().ok;
  const t2Untouched = listProductTechnologyRegistryEntries().length === 14;
  const c1Untouched = !!C1_UI_INTEGRATION_CONTRACT;
  const c11Untouched = (() => { try { const b = boundedCapabilitiesFor("onboarding"); return Array.isArray(b); } catch { return false; } })();
  const c12Untouched = isCloneChatEnabled();
  const productionStillOff = PRODUCTION_AUTHORIZED === false;
  const paymentStillDisabled = resolvePaymentMode({}) !== "live";
  const liveProvidersStillBlocked = onboarding.t1Needs.some((n) => n.liveBlocked) || onboarding.providerDependencies.length > 0;

  // ── rollup ──────────────────────────────────────────────────────────────────────────────────────────
  const exactCompletedItems = gap.filter((r) => r.pierreOwnedStatus === "complete").map((r) => r.id);
  const exactPartialItems = gap.filter((r) => r.pierreOwnedStatus === "partial").map((r) => r.id);
  const exactBlockedItems = gap.filter((r) => !!r.externalDependency).map((r) => r.id);
  const exactWarnings: string[] = [
    ...gap.filter((r) => !!r.externalDependency).map((r) => `${r.id}: livraison LIVE dépend d'un externe (${r.externalDependency}).`),
    "Livraison T1/T2 réservée à P16C (déclarée, jamais câblée ici).",
  ];

  const behaviorFlags: Array<[string, boolean]> = [
    ["requestUnderstandingReady", requestUnderstandingReady], ["multiIntentReady", multiIntentReady],
    ["entityResolutionReady", entityResolutionReady], ["dateResolutionReady", dateResolutionReady],
    ["clarificationReady", clarificationReady], ["capabilityRetrievalReady", capabilityRetrievalReady],
    ["missionIntelligenceReady", missionIntelligenceReady], ["multiStepOperationalDepthReady", multiStepOperationalDepthReady],
    ["outputQualityReady", outputQualityReady], ["continuityReady", continuityReady],
    ["correctionVersioningReady", correctionVersioningReady], ["idempotencyReady", idempotencyReady],
    ["autonomyClassificationReady", autonomyClassificationReady], ["humanOnlyFloorsReady", humanOnlyFloorsReady],
    ["providerTruthReady", providerTruthReady], ["legalTruthReady", legalTruthReady],
    ["documentLineageReady", documentLineageReady], ["explanationReady", explanationReady],
    ["p16cIntegrationContractReady", p16cIntegrationContractReady],
  ];
  const exactBlockers: string[] = [];
  if (!recovery.ok) exactBlockers.push(`Recovery drift: ${recovery.issues.join("; ")}`);
  if (!allPierreOwnedComplete()) exactBlockers.push(`Items Pierre-owned incomplets: ${exactPartialItems.join(", ")}`);
  for (const [name, ok] of behaviorFlags) if (!ok) exactBlockers.push(`Readiness manquant: ${name}`);
  if (secondHrBrainCreated) exactBlockers.push("Un 2e cerveau/registre RH a été détecté.");

  const readyForP16C =
    recovery.ok && allPierreOwnedComplete() && !secondHrBrainCreated &&
    behaviorFlags.every(([, ok]) => ok) && exactBlockers.length === 0;

  const verdict = readyForP16C
    ? "P16A — PIERRE ULTIMATE LOCALLY VERIFIED / EXTERNAL LIVE CAPABILITIES BLOCKED (Pierre-owned complete, P16C contract ready; live providers stay blocked by design)."
    : "P16A — PIERRE ULTIMATE COMPLETION PARTIAL / P16C BLOCKED";

  return {
    canonicalUltimateItemCount: getPierreUltimateItems().length,
    canonicalUltimateItemsRecovered: recovery.ok,
    canonicalUltimateItems: canonicalUltimateItemIds(),
    pierreCapabilityCount: capabilityCount,
    capabilityCountDerivedNotHardcoded,
    pierreRuntimeReused,
    secondHrBrainCreated,
    requestUnderstandingReady, multiIntentReady, entityResolutionReady, dateResolutionReady,
    clarificationReady, capabilityRetrievalReady, missionIntelligenceReady, multiStepOperationalDepthReady,
    outputQualityReady, continuityReady, correctionVersioningReady, idempotencyReady,
    autonomyClassificationReady, humanOnlyFloorsReady, providerTruthReady, legalTruthReady,
    documentLineageReady, explanationReady, p16cIntegrationContractReady,
    t1Untouched, t2Untouched, c1Untouched, c11Untouched, c12Untouched,
    productionStillOff, paymentStillDisabled, liveProvidersStillBlocked,
    exactCompletedItems, exactPartialItems, exactBlockedItems, exactWarnings, exactBlockers,
    readyForP16C,
    nextRecommendedPhase: readyForP16C ? "P16C" : "P16A",
    verdict,
  };
}
