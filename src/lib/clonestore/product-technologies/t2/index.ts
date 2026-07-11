// src/lib/clonestore/product-technologies/t2/index.ts
// T2 — CLONESTORE PRODUCT TECHNOLOGIES : exports publics.
// Couche produit AU-DESSUS de T1 : 14 systèmes CloneStore (CloneOS…CloneRoom), consommés
// plus tard par Pierre (P16A/P16C) et par CloneRoom. Aucun provider live, production OFF.

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  ProductTechnologyId, ProductTechnologyStatus, ProductTechnologyMode, ProductTechnologyContext,
  IntentKind, RiskLevel, AutonomyLevel,
} from "./product-technology-types";
export { ALL_PRODUCT_TECHNOLOGY_IDS, isProductTechnologyId } from "./product-technology-types";

// ── Résultats ──────────────────────────────────────────────────────────────────
export type { ProductTechnologyResult, ProductTechnologyResultKind } from "./product-technology-result";
export {
  ALL_PRODUCT_RESULT_KINDS, productOk, productNeedsValidation, productFallback, productBlocked, productError,
} from "./product-technology-result";

// ── Contrat / validation / audit ───────────────────────────────────────────────
export type {
  ProductTechnologyContract, ProductTechnologyValidationReport, ProductTechnologyAuditEntry,
  ProductTechnologyAuditLog, DefineProductTechnologyConfig, ProductPrepareOutcome,
} from "./product-technology-contract";
export {
  defineProductTechnologyContract, buildProductTechnologyValidationReport,
  createProductTechnologyAuditEntry, createProductTechnologyAuditLog,
  EXPECTED_PRODUCT_ARTIFACT_KIND, PRODUCT_LIVE_BLOCKED_REASON,
} from "./product-technology-contract";

// ── Fallbacks ──────────────────────────────────────────────────────────────────
export {
  PRODUCT_TECHNOLOGY_FALLBACKS, UNKNOWN_PRODUCT_TECHNOLOGY_FALLBACK,
  getProductTechnologyFallbackText, allProductTechnologiesHaveSafeFallback,
} from "./product-technology-fallbacks";

// ── Les 14 technologies produit ────────────────────────────────────────────────
export { cloneOSProductTech, classifyIntentKind, segmentIntoActions, detectSensitiveHrLanguage } from "./cloneos-product-tech";
export type { CloneOSMissionPlan, CloneOSRequestInput, CloneOSTask, CloneOSRoutingProposal, CloneOSEmployeeDescriptor } from "./cloneos-product-tech";
export { cloneADNProductTech } from "./cloneadn-product-tech";
export type { CloneADNInput, CloneADNProfileArtifact } from "./cloneadn-product-tech";
export { cloneGuardProductTech } from "./cloneguard-product-tech";
export type { CloneGuardInput, CloneGuardDecision, CloneGuardActionDecision } from "./cloneguard-product-tech";
export { cloneTraceProductTech } from "./clonetrace-product-tech";
export type { CloneTraceInput, CloneTraceEvent } from "./clonetrace-product-tech";
export { cloneVoiceProductTech, cleanOralTranscript } from "./clonevoice-product-tech";
export type { CloneVoiceInput, CloneVoiceIntentArtifact } from "./clonevoice-product-tech";
export { clonePolicyProductTech, capAutonomy } from "./clonepolicy-product-tech";
export type { ClonePolicyInput, ClonePolicyDecision, ClonePolicyRule, ClonePolicyActionInput } from "./clonepolicy-product-tech";
export { cloneContinuumProductTech, transitionContinuum } from "./clonecontinuum-product-tech";
export type { CloneContinuumInput, CloneContinuumState, CloneContinuumStateKind, CloneContinuumEvent } from "./clonecontinuum-product-tech";
export { cloneTrustProductTech } from "./clonetrust-product-tech";
export type { CloneTrustInput, CloneTrustDecision } from "./clonetrust-product-tech";
export { cloneReviewProductTech } from "./clonereview-product-tech";
export type { CloneReviewInput, CloneReviewReport, CloneReviewIssue } from "./clonereview-product-tech";
export { cloneSignalsProductTech } from "./clonesignals-product-tech";
export type { CloneSignalsInput, CloneSignalsArtifact, CloneSignalCandidate, CloneSignalKind } from "./clonesignals-product-tech";
export { cloneLearnProductTech } from "./clonelearn-product-tech";
export type { CloneLearnInput, CloneLearnArtifact, CloneLearningCandidate, CloneLearnSourceEvent } from "./clonelearn-product-tech";
export { cloneBriefProductTech } from "./clonebrief-product-tech";
export type { CloneBriefInput, CloneBriefArtifact, CloneBriefFact, CloneBriefSection } from "./clonebrief-product-tech";
export { cloneCallProductTech } from "./clonecall-product-tech";
export type { CloneCallInput, CloneCallSessionArtifact } from "./clonecall-product-tech";
export { cloneRoomProductTech } from "./cloneroom-product-tech";
export type {
  CloneRoomInput, CloneRoomCoordinationArtifact, CloneRoomParticipant, CloneRoomParticipantKind,
  CloneRoomMessage, CloneRoomRoute,
} from "./cloneroom-product-tech";

// ── Registre ───────────────────────────────────────────────────────────────────
export type { ProductTechnologyRegistryEntry } from "./product-technology-registry";
export {
  ALL_PRODUCT_TECHNOLOGY_CONTRACTS, buildProductTechnologyRegistry,
  listProductTechnologyRegistryEntries, getProductTechnologyRegistryEntry,
} from "./product-technology-registry";

// ── Orchestrateur ──────────────────────────────────────────────────────────────
export type {
  ProductTechnologyOrchestrator, CloneOSRunResult, CloneCallRunResult, CloneRoomRunResult,
} from "./product-technology-orchestrator";
export {
  createProductTechnologyOrchestrator, runCloneOSRequest, runCloneCallSession, runCloneRoomThread,
  generateCloneBrief, evaluateProductTechnologyReadiness, listProductTechnologies, getProductTechnology,
} from "./product-technology-orchestrator";

// ── Command center ─────────────────────────────────────────────────────────────
export type { ProductTechnologyCommandCenterReport } from "./product-technology-command-center";
export { evaluateProductTechnologyCommandCenter } from "./product-technology-command-center";
