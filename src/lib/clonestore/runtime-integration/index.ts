// src/lib/clonestore/runtime-integration/index.ts
// PHASE 4.1 — CloneOS / Pierre Runtime Operational Integration Foundation — Point d'entrée
//
// DESIGN-ONLY / SIMULATION-ONLY. Pas de Supabase, pas de write, pas d'exécution,
// pas d'import Pierre moteur, pas d'activation CloneVoice.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  RuntimeIntegrationPhase,
  RuntimeIntegrationMode,
  RuntimeIntegrationStatus,
  RuntimeIntegrationRiskLevel,
  RuntimeIntegrationValidationMode,
  RuntimeIntegrationTenantScope,
  RuntimeIntegrationEmployeeKey,
  RuntimeIntegrationCommandSource,
  RuntimeIntegrationDomain,
  RuntimeIntegrationCommand,
  RuntimeIntegrationIntent,
  RuntimeIntegrationIntentRoute,
  RuntimeIntegrationGuardDecision,
  RuntimeIntegrationTraceEvent,
  RuntimeIntegrationTraceContract,
  RuntimeIntegrationScaleHint,
  RuntimeIntegrationQueueHint,
  RuntimeIntegrationCostHint,
  RuntimeIntegrationIdempotencyContract,
  RuntimeIntegrationTenantIsolationHint,
  RuntimeIntegrationPlanStep,
  RuntimeIntegrationPlan,
  RuntimeIntegrationIssue,
  RuntimeIntegrationRecommendation,
  RuntimeIntegrationAction,
  RuntimeIntegrationReadResult,
} from "./runtime-integration-types";

// ── Command contract ──────────────────────────────────────────────────────────
export type { RuntimeIntegrationCommandInput } from "./runtime-integration-command-contract";
export {
  RUNTIME_INTEGRATION_FORBIDDEN_PATTERNS,
  detectRuntimeIntegrationUnsafeText,
  normalizeRuntimeIntegrationCommandText,
  generateRuntimeIntegrationCommandId,
  buildRuntimeIntegrationCommand,
  sanitizeRuntimeIntegrationCommand,
  validateRuntimeIntegrationCommand,
  buildRuntimeIntegrationCommandIssues,
  buildRuntimeIntegrationCommandRecommendations,
} from "./runtime-integration-command-contract";

// ── Intent router ─────────────────────────────────────────────────────────────
export {
  inferRuntimeIntegrationDomain,
  inferRuntimeIntegrationCandidateEmployees,
  findRuntimeIntegrationEmployeeCapabilities,
  buildRuntimeIntegrationIntent,
  routeRuntimeIntegrationIntent,
  explainRuntimeIntegrationRoute,
  buildRuntimeIntegrationRoutingIssues,
} from "./runtime-integration-intent-router";

// ── Plan builder ──────────────────────────────────────────────────────────────
export {
  buildRuntimeIntegrationMissingContextSteps,
  buildRuntimeIntegrationValidationSteps,
  buildRuntimeIntegrationPlanSteps,
  deriveRuntimeIntegrationPlanStatus,
  buildRuntimeIntegrationPlan,
  summarizeRuntimeIntegrationPlan,
} from "./runtime-integration-plan-builder";

// ── Guardrails ────────────────────────────────────────────────────────────────
export {
  classifyRuntimeIntegrationRisk,
  requiresRuntimeIntegrationHumanValidation,
  buildRuntimeIntegrationGuardDecision,
  buildRuntimeIntegrationGuardIssues,
  explainRuntimeIntegrationGuardDecision,
} from "./runtime-integration-guardrails";

// ── Trace contract ────────────────────────────────────────────────────────────
export {
  buildRuntimeIntegrationTraceContract,
  buildRuntimeIntegrationTraceEvents,
  summarizeRuntimeIntegrationTraceContract,
  validateRuntimeIntegrationTraceContract,
} from "./runtime-integration-trace-contract";

// ── Scale readiness ───────────────────────────────────────────────────────────
export {
  buildRuntimeIntegrationScaleHints,
  buildRuntimeIntegrationQueueHints,
  buildRuntimeIntegrationCostHints,
  buildRuntimeIntegrationIdempotencyContract,
  buildRuntimeIntegrationTenantIsolationHints,
  summarizeRuntimeIntegrationScaleReadiness,
} from "./runtime-integration-scale-readiness";

// ── Orchestrator (simulation) ─────────────────────────────────────────────────
export type { RuntimeIntegrationOrchestratorOptions } from "./runtime-integration-orchestrator";
export {
  buildRuntimeIntegrationReadResult,
  simulateCloneOSToPierreRuntimePlan,
  buildRuntimeIntegrationIssues,
  buildRuntimeIntegrationRecommendations,
  buildRuntimeIntegrationActions,
} from "./runtime-integration-orchestrator";

// ── QA ────────────────────────────────────────────────────────────────────────
export type {
  RuntimeIntegrationQaStepId,
  RuntimeIntegrationQaStep,
  RuntimeIntegrationQaVerdict,
  RuntimeIntegrationQaChecklist,
  RuntimeIntegrationQaSummary,
} from "./runtime-integration-qa";

export {
  buildRuntimeIntegrationQaChecklist,
  buildRuntimeIntegrationQaVerdict,
  getRuntimeIntegrationBlockingSteps,
  summarizeRuntimeIntegrationQaVerdict,
} from "./runtime-integration-qa";

// ── API Contract (PHASE 4.2) ──────────────────────────────────────────────────
export type {
  RuntimeIntegrationSimulationApiMethod,
  RuntimeIntegrationSimulationApiStatus,
  RuntimeIntegrationSimulationApiRequest,
  RuntimeIntegrationSimulationApiResponse,
  RuntimeIntegrationSimulationApiError,
  RuntimeIntegrationSimulationApiExample,
  RuntimeIntegrationSimulationApiCapabilities,
} from "./runtime-integration-api-contract";

export {
  RUNTIME_INTEGRATION_SIMULATE_ENDPOINT,
  buildRuntimeIntegrationSimulationApiCapabilities,
  buildRuntimeIntegrationSimulationApiExamples,
  buildRuntimeIntegrationSimulationApiResponse,
  buildRuntimeIntegrationSimulationApiCapabilitiesResponse,
  buildRuntimeIntegrationSimulationApiError,
  validateRuntimeIntegrationSimulationApiRequest,
  sanitizeRuntimeIntegrationSimulationApiRequest,
} from "./runtime-integration-api-contract";

// ── API Client (PHASE 4.2) ────────────────────────────────────────────────────
// Seul endroit autorisé à fetch — uniquement l'endpoint de simulation.
export {
  isRuntimeIntegrationSimulationApiResponse,
  normalizeRuntimeIntegrationSimulationApiError,
  fetchRuntimeIntegrationSimulationCapabilities,
  postRuntimeIntegrationSimulation,
} from "./runtime-integration-api-client";

// ── Preview Model (PHASE 4.2) ─────────────────────────────────────────────────
export type {
  RuntimeIntegrationPreviewStatus,
  RuntimeIntegrationPreviewTone,
  RuntimeIntegrationPreviewBadge,
  RuntimeIntegrationPreviewCard,
  RuntimeIntegrationPreviewSectionKind,
  RuntimeIntegrationPreviewSection,
  RuntimeIntegrationPreviewTimelineItem,
  RuntimeIntegrationPreviewAction,
  RuntimeIntegrationPreviewSnapshot,
} from "./runtime-integration-preview-model";

export {
  buildRuntimeIntegrationPreviewSnapshot,
  buildRuntimeIntegrationPreviewBadges,
  buildRuntimeIntegrationPreviewCards,
  buildRuntimeIntegrationPreviewSections,
  buildRuntimeIntegrationPreviewTimeline,
  buildRuntimeIntegrationPreviewActions,
  getRuntimeIntegrationPreviewStatusLabel,
  getRuntimeIntegrationPreviewTone,
  explainRuntimeIntegrationPreview,
} from "./runtime-integration-preview-model";

// ── Preview QA (PHASE 4.2) ────────────────────────────────────────────────────
export type {
  RuntimeIntegrationPreviewQaStepId,
  RuntimeIntegrationPreviewQaStep,
  RuntimeIntegrationPreviewQaVerdict,
  RuntimeIntegrationPreviewQaChecklist,
  RuntimeIntegrationPreviewQaSummary,
} from "./runtime-integration-preview-qa";

export {
  buildRuntimeIntegrationPreviewQaChecklist,
  buildRuntimeIntegrationPreviewQaVerdict,
  getRuntimeIntegrationPreviewBlockingSteps,
  summarizeRuntimeIntegrationPreviewQaVerdict,
} from "./runtime-integration-preview-qa";

// ── Mission Draft Types (PHASE 4.3) ───────────────────────────────────────────
// Brouillon de mission LOCAL/IN-MEMORY. Aucune mission créée en base.
export type {
  RuntimeMissionDraftPhase,
  RuntimeMissionDraftMode,
  RuntimeMissionDraftStatus,
  RuntimeMissionDraftSource,
  RuntimeMissionDraftKind,
  RuntimeMissionDraftRiskLevel,
  RuntimeMissionDraftValidationMode,
  RuntimeMissionDraftEmployeeKey,
  RuntimeMissionDraftTenantScope,
  RuntimeMissionDraftStep,
  RuntimeMissionDraftValidationRequirement,
  RuntimeMissionDraftGuardSnapshot,
  RuntimeMissionDraftTraceSnapshot,
  RuntimeMissionDraftScaleSnapshot,
  RuntimeMissionDraftQueueSnapshot,
  RuntimeMissionDraftCostSnapshot,
  RuntimeMissionDraftIdempotencySnapshot,
  RuntimeMissionDraft,
  RuntimeMissionDraftReadResult,
  RuntimeMissionDraftIssue,
  RuntimeMissionDraftRecommendation,
  RuntimeMissionDraftAction,
} from "./runtime-mission-draft-types";

// ── Mission Draft Builder (PHASE 4.3) ─────────────────────────────────────────
export type { RuntimeMissionDraftBuildOptions } from "./runtime-mission-draft-builder";
export {
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionDraftTitle,
  buildRuntimeMissionDraftObjective,
  buildRuntimeMissionDraftSummary,
  buildRuntimeMissionDraftSteps,
  buildRuntimeMissionDraftValidationRequirements,
  buildRuntimeMissionDraftGuardSnapshot,
  buildRuntimeMissionDraftTraceSnapshot,
  buildRuntimeMissionDraftScaleSnapshot,
  buildRuntimeMissionDraftQueueSnapshot,
  buildRuntimeMissionDraftCostSnapshot,
  buildRuntimeMissionDraftIdempotencySnapshot,
  deriveRuntimeMissionDraftStatus,
  deriveRuntimeMissionDraftKind,
  buildRuntimeMissionDraftIssues,
  buildRuntimeMissionDraftRecommendations,
  buildRuntimeMissionDraftActions,
  summarizeRuntimeMissionDraft,
} from "./runtime-mission-draft-builder";

// ── Mission Draft Validation (PHASE 4.3) ──────────────────────────────────────
export {
  RUNTIME_MISSION_DRAFT_FORBIDDEN_PATTERNS,
  detectRuntimeMissionDraftUnsafeText,
  normalizeRuntimeMissionDraftText,
  assertRuntimeMissionDraftNoSecrets,
  assertRuntimeMissionDraftNoExecution,
  validateRuntimeMissionDraft,
  isRuntimeMissionDraftSafe,
  sanitizeRuntimeMissionDraft,
} from "./runtime-mission-draft-validation";

// ── Mission Draft Snapshot (PHASE 4.3) ────────────────────────────────────────
export type {
  RuntimeMissionDraftTone,
  RuntimeMissionDraftBadge,
  RuntimeMissionDraftCard,
  RuntimeMissionDraftSectionKind,
  RuntimeMissionDraftSection,
  RuntimeMissionDraftTimelineItem,
  RuntimeMissionDraftSnapshot,
} from "./runtime-mission-draft-snapshot";

export {
  buildRuntimeMissionDraftSnapshot,
  buildRuntimeMissionDraftSummaryCards,
  buildRuntimeMissionDraftSections,
  buildRuntimeMissionDraftTimeline,
  buildRuntimeMissionDraftBadges,
  buildRuntimeMissionDraftLocalPreview,
  explainRuntimeMissionDraftSnapshot,
} from "./runtime-mission-draft-snapshot";

// ── Mission Draft QA (PHASE 4.3) ──────────────────────────────────────────────
export type {
  RuntimeMissionDraftQaStepId,
  RuntimeMissionDraftQaStep,
  RuntimeMissionDraftQaVerdict,
  RuntimeMissionDraftQaChecklist,
  RuntimeMissionDraftQaSummary,
} from "./runtime-mission-draft-qa";

export {
  buildRuntimeMissionDraftQaChecklist,
  buildRuntimeMissionDraftQaVerdict,
  getRuntimeMissionDraftBlockingSteps,
  summarizeRuntimeMissionDraftQaVerdict,
} from "./runtime-mission-draft-qa";

// ── Mission Draft Persistence Types (PHASE 4.4) ───────────────────────────────
// DESIGN-ONLY. SQL draft non appliqué. Flag default false. Aucun write.
export type {
  RuntimeMissionDraftPersistencePhase,
  RuntimeMissionDraftPersistenceMode,
  RuntimeMissionDraftPersistenceStatus,
  RuntimeMissionDraftPersistenceSource,
  RuntimeMissionDraftPersistenceFeatureFlag,
  RuntimeMissionDraftPersistenceHealthStatus,
  RuntimeMissionDraftPersistenceTableStatus,
  RuntimeMissionDraftPersistencePolicyStatus,
  RuntimeMissionDraftPersistenceReadiness,
  RuntimeMissionDraftPersistenceSafetyFlags,
  RuntimeMissionDraftPersistencePayload,
  RuntimeMissionDraftPersistenceRecord,
  RuntimeMissionDraftPersistenceWritePlan,
  RuntimeMissionDraftPersistenceReadPlan,
  RuntimeMissionDraftPersistenceIssue,
  RuntimeMissionDraftPersistenceRecommendation,
  RuntimeMissionDraftPersistenceAction,
} from "./runtime-mission-draft-persistence-types";

export { RUNTIME_MISSION_DRAFT_TABLE_NAME } from "./runtime-mission-draft-persistence-types";

// ── Mission Draft Persistence Flags (PHASE 4.4) ───────────────────────────────
export {
  RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_FLAG,
  DEFAULT_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED,
  RUNTIME_MISSION_DRAFT_PERSISTENCE_ACTIVATION_STEPS,
  isRuntimeMissionDraftServerPersistenceEnabled,
  getRuntimeMissionDraftServerPersistenceFlagState,
  explainRuntimeMissionDraftServerPersistenceFlag,
} from "./runtime-mission-draft-persistence-flags";

// ── Mission Draft Persistence Design (PHASE 4.4) ──────────────────────────────
export type { RuntimeMissionDraftPersistenceOptions } from "./runtime-mission-draft-persistence-design";
export {
  buildRuntimeMissionDraftPersistenceSafetyFlags,
  buildRuntimeMissionDraftPersistencePayload,
  buildRuntimeMissionDraftPersistenceRecord,
  buildRuntimeMissionDraftPersistenceWritePlan,
  buildRuntimeMissionDraftPersistenceReadPlan,
  validateRuntimeMissionDraftPersistenceRecord,
  sanitizeRuntimeMissionDraftPersistenceRecord,
  summarizeRuntimeMissionDraftPersistenceDesign,
} from "./runtime-mission-draft-persistence-design";

// ── Mission Draft Persistence Health (PHASE 4.4) ──────────────────────────────
export type {
  RuntimeMissionDraftPersistenceHealthCheck,
  RuntimeMissionDraftPersistenceSqlCheck,
} from "./runtime-mission-draft-persistence-health";
export {
  buildRuntimeMissionDraftPersistenceReadiness,
  buildRuntimeMissionDraftPersistenceHealthChecklist,
  buildRuntimeMissionDraftPersistenceExpectedSqlChecks,
  buildRuntimeMissionDraftPersistenceManualActivationSteps,
  summarizeRuntimeMissionDraftPersistenceReadiness,
} from "./runtime-mission-draft-persistence-health";

// ── Mission Draft LocalStorage Design (PHASE 4.4) ─────────────────────────────
export type {
  RuntimeMissionDraftLocalStorageStrategy,
  RuntimeMissionDraftLocalStorageEnvelope,
} from "./runtime-mission-draft-localstorage-design";
export {
  RUNTIME_MISSION_DRAFT_LOCALSTORAGE_KEY,
  RUNTIME_MISSION_DRAFT_LAST_PREVIEW_KEY,
  buildRuntimeMissionDraftLocalStorageStrategy,
  buildRuntimeMissionDraftLocalStorageEnvelope,
  validateRuntimeMissionDraftLocalStorageEnvelope,
  summarizeRuntimeMissionDraftLocalStorageDesign,
} from "./runtime-mission-draft-localstorage-design";

// ── Mission Draft Persistence QA (PHASE 4.4) ──────────────────────────────────
export type {
  RuntimeMissionDraftPersistenceQaStepId,
  RuntimeMissionDraftPersistenceQaStep,
  RuntimeMissionDraftPersistenceQaVerdict,
  RuntimeMissionDraftPersistenceQaChecklist,
  RuntimeMissionDraftPersistenceQaSummary,
} from "./runtime-mission-draft-persistence-qa";

export {
  buildRuntimeMissionDraftPersistenceQaChecklist,
  buildRuntimeMissionDraftPersistenceQaVerdict,
  getRuntimeMissionDraftPersistenceBlockingSteps,
  summarizeRuntimeMissionDraftPersistenceQaVerdict,
} from "./runtime-mission-draft-persistence-qa";

// ── Mission Draft LocalStorage Runtime (PHASE 4.5) ────────────────────────────
// Seul endroit autorisé à écrire localStorage pour les drafts.
export type {
  RuntimeMissionDraftLocalStorageServerSyncStatus,
  RuntimeMissionDraftLocalStorageEnvelope as RuntimeMissionDraftLocalStorageEnvelopeV2,
  RuntimeMissionDraftLocalStorageSaveOptions,
} from "./runtime-mission-draft-localstorage";
export {
  saveRuntimeMissionDraftToLocalStorage,
  loadRuntimeMissionDraftsFromLocalStorage,
  loadRuntimeMissionDraftFromLocalStorage,
  loadLatestRuntimeMissionDraftFromLocalStorage,
  removeRuntimeMissionDraftFromLocalStorage,
  clearRuntimeMissionDraftsFromLocalStorage,
  buildRuntimeMissionDraftLocalStorageEnvelope as buildRuntimeMissionDraftLocalStorageEnvelopeV2,
  validateRuntimeMissionDraftLocalStorageEnvelope as validateRuntimeMissionDraftLocalStorageEnvelopeV2,
  mergeRuntimeMissionDraftLocalStorageList,
  serializeRuntimeMissionDraftLocalStorageEnvelope,
  parseRuntimeMissionDraftLocalStorageEnvelope,
} from "./runtime-mission-draft-localstorage";

// ── Mission Draft Safe Apply Types (PHASE 4.5) ────────────────────────────────
export type {
  RuntimeMissionDraftSafeApplyMode,
  RuntimeMissionDraftSafeApplyStatus,
  RuntimeMissionDraftSafeApplySource,
  RuntimeMissionDraftSafeApplyAttempt,
  RuntimeMissionDraftSafeApplyServerResult,
  RuntimeMissionDraftSafeApplyIssue,
  RuntimeMissionDraftSafeApplyRecommendation,
  RuntimeMissionDraftSafeApplyAction,
  RuntimeMissionDraftSafeApplyResult,
  RuntimeMissionDraftSafeApplyRestoreResult,
} from "./runtime-mission-draft-safe-apply-types";

// ── Mission Draft Server API Contract (PHASE 4.5) ─────────────────────────────
export type {
  RuntimeMissionDraftServerApiMethod,
  RuntimeMissionDraftServerApiStatus,
  RuntimeMissionDraftServerSaveRequest,
  RuntimeMissionDraftServerSaveResponse,
  RuntimeMissionDraftServerReadResponse,
  RuntimeMissionDraftServerError,
  RuntimeMissionDraftServerCapabilities,
} from "./runtime-mission-draft-server-api-contract";
export {
  RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT,
  buildRuntimeMissionDraftServerCapabilities,
  buildRuntimeMissionDraftServerSaveResponse,
  buildRuntimeMissionDraftServerError,
  validateRuntimeMissionDraftServerSaveRequest,
  sanitizeRuntimeMissionDraftServerSaveRequest,
} from "./runtime-mission-draft-server-api-contract";

// ── Mission Draft API Client (PHASE 4.5) ──────────────────────────────────────
export {
  isRuntimeMissionDraftServerSaveResponse,
  normalizeRuntimeMissionDraftServerApiError,
  fetchRuntimeMissionDraftServerCapabilities,
  postRuntimeMissionDraftServerSave,
} from "./runtime-mission-draft-api-client";

// ── Mission Draft Safe Apply Runtime (PHASE 4.5) ──────────────────────────────
export type {
  RuntimeMissionDraftSafeApplyOptions,
  RuntimeMissionDraftSafeApplyRestoreOptions,
} from "./runtime-mission-draft-safe-apply";
export {
  persistRuntimeMissionDraftWithFallback,
  restoreRuntimeMissionDraftWithFallback,
  buildRuntimeMissionDraftSafeApplyRecommendations,
  buildRuntimeMissionDraftSafeApplyActions,
  summarizeRuntimeMissionDraftSafeApplyResult,
} from "./runtime-mission-draft-safe-apply";

// ── Mission Draft Safe Apply UI (PHASE 4.5) ───────────────────────────────────
export type {
  RuntimeMissionDraftSafeApplyUiTone,
  RuntimeMissionDraftSafeApplyUiBadge,
  RuntimeMissionDraftSafeApplyUiCard,
  RuntimeMissionDraftSafeApplyUiTimelineItem,
  RuntimeMissionDraftSafeApplyUiAction,
  RuntimeMissionDraftSafeApplyUiSnapshot,
} from "./runtime-mission-draft-safe-apply-ui";
export {
  buildRuntimeMissionDraftSafeApplyUiSnapshot,
  buildRuntimeMissionDraftSafeApplyUiBadges,
  buildRuntimeMissionDraftSafeApplyUiCards,
  buildRuntimeMissionDraftSafeApplyUiTimeline,
  buildRuntimeMissionDraftSafeApplyUiActions,
  getRuntimeMissionDraftSafeApplyUiStatusLabel,
  explainRuntimeMissionDraftSafeApplyUiStatus,
} from "./runtime-mission-draft-safe-apply-ui";

// ── Mission Draft Safe Apply QA (PHASE 4.5) ───────────────────────────────────
export type {
  RuntimeMissionDraftSafeApplyQaStepId,
  RuntimeMissionDraftSafeApplyQaStep,
  RuntimeMissionDraftSafeApplyQaVerdict,
  RuntimeMissionDraftSafeApplyQaChecklist,
  RuntimeMissionDraftSafeApplyQaSummary,
} from "./runtime-mission-draft-safe-apply-qa";
export {
  buildRuntimeMissionDraftSafeApplyQaChecklist,
  buildRuntimeMissionDraftSafeApplyQaVerdict,
  getRuntimeMissionDraftSafeApplyBlockingSteps,
  summarizeRuntimeMissionDraftSafeApplyQaVerdict,
} from "./runtime-mission-draft-safe-apply-qa";

// ── Mission Draft Manual Activation QA (PHASE 4.6) ────────────────────────────
// Module pur — checklist QA manuelle. Pas de Supabase, pas de write, pas d'exécution.
export type {
  RuntimeMissionDraftManualActivationStepId,
  RuntimeMissionDraftManualActivationStepStatus,
  RuntimeMissionDraftManualActivationStepSeverity,
  RuntimeMissionDraftManualActivationStep,
  RuntimeMissionDraftManualActivationChecklist,
  RuntimeMissionDraftManualActivationVerdict,
  RuntimeMissionDraftManualActivationEvidence,
  RuntimeMissionDraftManualActivationEvidencePack,
  RuntimeMissionDraftManualActivationSummary,
} from "./runtime-mission-draft-manual-activation-qa";

export {
  buildRuntimeMissionDraftManualActivationChecklist,
  buildRuntimeMissionDraftManualActivationVerdict,
  getRuntimeMissionDraftManualActivationBlockingSteps,
  buildRuntimeMissionDraftManualActivationEvidenceTemplate,
  validateRuntimeMissionDraftManualActivationEvidencePack,
  summarizeRuntimeMissionDraftManualActivationVerdict,
} from "./runtime-mission-draft-manual-activation-qa";

// ── Mission Draft Restore UI (PHASE 4.7) ──────────────────────────────────────
// Modèle UI pur / read-only. Statut local/serveur, source effective, warnings.
// Aucune nouvelle persistance, aucun write, aucun appel réseau, aucune exécution.
export type {
  RuntimeMissionDraftRestoreUiTone,
  RuntimeMissionDraftRestoreUiStatus,
  RuntimeMissionDraftRestoreUiSource,
  RuntimeMissionDraftRestoreUiBadge,
  RuntimeMissionDraftRestoreUiCard,
  RuntimeMissionDraftRestoreUiTimelineItem,
  RuntimeMissionDraftRestoreUiAction,
  RuntimeMissionDraftRestoreUiWarning,
  RuntimeMissionDraftRestoreUiSnapshot,
  RuntimeMissionDraftRestoreUiOptions,
} from "./runtime-mission-draft-restore-ui";
export {
  buildRuntimeMissionDraftRestoreUiSnapshot,
  buildRuntimeMissionDraftRestoreUiBadges,
  buildRuntimeMissionDraftRestoreUiCards,
  buildRuntimeMissionDraftRestoreUiTimeline,
  buildRuntimeMissionDraftRestoreUiWarnings,
  buildRuntimeMissionDraftRestoreUiActions,
  getRuntimeMissionDraftRestoreUiStatusLabel,
  getRuntimeMissionDraftRestoreUiSourceLabel,
  getRuntimeMissionDraftRestoreUiTone,
  explainRuntimeMissionDraftRestoreUiStatus,
} from "./runtime-mission-draft-restore-ui";

// ── Mission Draft Restore UI QA (PHASE 4.7) ───────────────────────────────────
export type {
  RuntimeMissionDraftRestoreUiQaStepId,
  RuntimeMissionDraftRestoreUiQaStepStatus,
  RuntimeMissionDraftRestoreUiQaStepSeverity,
  RuntimeMissionDraftRestoreUiQaStep,
  RuntimeMissionDraftRestoreUiQaChecklist,
  RuntimeMissionDraftRestoreUiQaVerdict,
  RuntimeMissionDraftRestoreUiQaSummary,
} from "./runtime-mission-draft-restore-ui-qa";
export {
  buildRuntimeMissionDraftRestoreUiQaChecklist,
  buildRuntimeMissionDraftRestoreUiQaVerdict,
  getRuntimeMissionDraftRestoreUiBlockingSteps,
  summarizeRuntimeMissionDraftRestoreUiQaVerdict,
} from "./runtime-mission-draft-restore-ui-qa";

// ── Mission Promotion Types (PHASE 4.8) ───────────────────────────────────────
// DESIGN-ONLY / CONTRACT-ONLY. Draft → Controlled Mission. promotion_applied false.
export type {
  RuntimeMissionPromotionPhase,
  RuntimeMissionPromotionMode,
  RuntimeMissionPromotionStatus,
  RuntimeMissionPromotionVerdict,
  ControlledMissionStatus,
  RuntimeMissionPromotionRiskLevel,
  RuntimeMissionPromotionValidationMode,
  RuntimeMissionPromotionGateSeverity,
  RuntimeMissionPromotionGateId,
  RuntimeMissionPromotionGate,
  RuntimeMissionPromotionSafetyFlags,
  RuntimeMissionPromotionPlanStepKind,
  RuntimeMissionPromotionPlanStep,
  ControlledMissionValidationRequirement,
  ControlledMission,
  RuntimeMissionPromotionDecision,
  RuntimeMissionPromotionIssue,
  RuntimeMissionPromotionRecommendation,
  RuntimeMissionPromotionAction,
  RuntimeMissionPromotionContract,
  RuntimeMissionPromotionReadResult,
} from "./runtime-mission-promotion-types";

// ── Mission Promotion Contract (PHASE 4.8) ────────────────────────────────────
export type { RuntimeMissionPromotionOptions } from "./runtime-mission-promotion-contract";
export {
  buildRuntimeMissionPromotionSafetyFlags,
  buildRuntimeMissionPromotionGates,
  evaluateRuntimeMissionPromotionEligibility,
  buildRuntimeMissionPromotionPlanSteps,
  buildControlledMissionValidationRequirements,
  deriveControlledMissionStatus,
  buildControlledMissionFromDraft,
  buildRuntimeMissionPromotionIssues,
  buildRuntimeMissionPromotionRecommendations,
  buildRuntimeMissionPromotionActions,
  buildRuntimeMissionPromotionContract,
  assertRuntimeMissionPromotionNoExecution,
  validateRuntimeMissionPromotionContract,
  summarizeRuntimeMissionPromotionContract,
} from "./runtime-mission-promotion-contract";

// ── Mission Promotion Preview Snapshot (PHASE 4.8) ────────────────────────────
export type {
  RuntimeMissionPromotionTone,
  RuntimeMissionPromotionBadge,
  RuntimeMissionPromotionCard,
  RuntimeMissionPromotionSectionKind,
  RuntimeMissionPromotionSection,
  RuntimeMissionPromotionTimelineItem,
  RuntimeMissionPromotionSnapshot,
} from "./runtime-mission-promotion-snapshot";
export {
  buildRuntimeMissionPromotionSnapshot,
  buildRuntimeMissionPromotionBadges,
  buildRuntimeMissionPromotionCards,
  buildRuntimeMissionPromotionSections,
  buildRuntimeMissionPromotionTimeline,
  getRuntimeMissionPromotionStatusLabel,
  getRuntimeMissionPromotionTone,
  explainRuntimeMissionPromotionSnapshot,
} from "./runtime-mission-promotion-snapshot";

// ── Mission Promotion QA (PHASE 4.8) ──────────────────────────────────────────
export type {
  RuntimeMissionPromotionQaStepId,
  RuntimeMissionPromotionQaStepStatus,
  RuntimeMissionPromotionQaStepSeverity,
  RuntimeMissionPromotionQaStep,
  RuntimeMissionPromotionQaChecklist,
  RuntimeMissionPromotionQaVerdict,
  RuntimeMissionPromotionQaSummary,
} from "./runtime-mission-promotion-qa";
export {
  buildRuntimeMissionPromotionQaChecklist,
  buildRuntimeMissionPromotionQaVerdict,
  getRuntimeMissionPromotionBlockingSteps,
  summarizeRuntimeMissionPromotionQaVerdict,
} from "./runtime-mission-promotion-qa";

// ── Controlled Mission Promotion Preview UI QA (PHASE 4.9) ─────────────────────
export type {
  RuntimeMissionPromotionPreviewUiQaStepId,
  RuntimeMissionPromotionPreviewUiQaStepStatus,
  RuntimeMissionPromotionPreviewUiQaStepSeverity,
  RuntimeMissionPromotionPreviewUiQaStep,
  RuntimeMissionPromotionPreviewUiQaChecklist,
  RuntimeMissionPromotionPreviewUiQaVerdict,
  RuntimeMissionPromotionPreviewUiQaSummary,
} from "./runtime-mission-promotion-preview-ui-qa";
export {
  buildRuntimeMissionPromotionPreviewUiQaChecklist,
  buildRuntimeMissionPromotionPreviewUiQaVerdict,
  getRuntimeMissionPromotionPreviewUiBlockingSteps,
  summarizeRuntimeMissionPromotionPreviewUiQaVerdict,
} from "./runtime-mission-promotion-preview-ui-qa";

// ── Controlled Mission Persistence Types (PHASE 4.10) ──────────────────────────
// DESIGN-ONLY. SQL draft non appliqué. Flag default false. Aucun write.
export type {
  RuntimeControlledMissionPersistencePhase,
  RuntimeControlledMissionPersistenceMode,
  RuntimeControlledMissionPersistenceStatus,
  RuntimeControlledMissionPersistenceSource,
  RuntimeControlledMissionPersistenceFeatureFlag,
  RuntimeControlledMissionPersistenceHealthStatus,
  RuntimeControlledMissionPersistenceTableStatus,
  RuntimeControlledMissionPersistencePolicyStatus,
  RuntimeControlledMissionPersistenceReadiness,
  RuntimeControlledMissionPersistenceSafetyFlags,
  RuntimeControlledMissionPersistencePayload,
  RuntimeControlledMissionPersistenceRecord,
  RuntimeControlledMissionPersistenceWritePlan,
  RuntimeControlledMissionPersistenceReadPlan,
  RuntimeControlledMissionPersistenceIssue,
  RuntimeControlledMissionPersistenceRecommendation,
  RuntimeControlledMissionPersistenceAction,
} from "./runtime-controlled-mission-persistence-types";
export { RUNTIME_CONTROLLED_MISSION_TABLE_NAME } from "./runtime-controlled-mission-persistence-types";

// ── Controlled Mission Persistence Flags (PHASE 4.10) ──────────────────────────
export {
  RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
  DEFAULT_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  RUNTIME_CONTROLLED_MISSION_PERSISTENCE_ACTIVATION_STEPS,
  isRuntimeControlledMissionServerPersistenceEnabled,
  getRuntimeControlledMissionServerPersistenceFlagState,
  explainRuntimeControlledMissionServerPersistenceFlag,
} from "./runtime-controlled-mission-persistence-flags";

// ── Controlled Mission Persistence Design (PHASE 4.10) ─────────────────────────
export type { RuntimeControlledMissionPersistenceOptions } from "./runtime-controlled-mission-persistence-design";
export {
  buildRuntimeControlledMissionPersistenceSafetyFlags,
  buildRuntimeControlledMissionPersistencePayload,
  buildRuntimeControlledMissionPersistenceRecord,
  buildRuntimeControlledMissionPersistenceWritePlan,
  buildRuntimeControlledMissionPersistenceReadPlan,
  validateRuntimeControlledMissionPersistenceRecord,
  sanitizeRuntimeControlledMissionPersistenceRecord,
  summarizeRuntimeControlledMissionPersistenceDesign,
} from "./runtime-controlled-mission-persistence-design";

// ── Controlled Mission Persistence Health (PHASE 4.10) ─────────────────────────
export type {
  RuntimeControlledMissionPersistenceHealthCheck,
  RuntimeControlledMissionPersistenceSqlCheck,
} from "./runtime-controlled-mission-persistence-health";
export {
  buildRuntimeControlledMissionPersistenceReadiness,
  buildRuntimeControlledMissionPersistenceHealthChecklist,
  buildRuntimeControlledMissionPersistenceExpectedSqlChecks,
  buildRuntimeControlledMissionPersistenceManualActivationSteps,
  summarizeRuntimeControlledMissionPersistenceReadiness,
} from "./runtime-controlled-mission-persistence-health";

// ── Controlled Mission LocalStorage Design (PHASE 4.10) ────────────────────────
export type {
  RuntimeControlledMissionLocalStorageStrategy,
  RuntimeControlledMissionLocalStorageEnvelope,
} from "./runtime-controlled-mission-localstorage-design";
export {
  RUNTIME_CONTROLLED_MISSION_LOCALSTORAGE_KEY,
  RUNTIME_CONTROLLED_MISSION_LAST_PREVIEW_KEY,
  buildRuntimeControlledMissionLocalStorageStrategy,
  buildRuntimeControlledMissionLocalStorageEnvelope,
  validateRuntimeControlledMissionLocalStorageEnvelope,
  summarizeRuntimeControlledMissionLocalStorageDesign,
} from "./runtime-controlled-mission-localstorage-design";

// ── Controlled Mission Persistence QA (PHASE 4.10) ─────────────────────────────
export type {
  RuntimeControlledMissionPersistenceQaStepId,
  RuntimeControlledMissionPersistenceQaStepStatus,
  RuntimeControlledMissionPersistenceQaStepSeverity,
  RuntimeControlledMissionPersistenceQaStep,
  RuntimeControlledMissionPersistenceQaChecklist,
  RuntimeControlledMissionPersistenceQaVerdict,
  RuntimeControlledMissionPersistenceQaSummary,
} from "./runtime-controlled-mission-persistence-qa";
export {
  buildRuntimeControlledMissionPersistenceQaChecklist,
  buildRuntimeControlledMissionPersistenceQaVerdict,
  getRuntimeControlledMissionPersistenceBlockingSteps,
  summarizeRuntimeControlledMissionPersistenceQaVerdict,
} from "./runtime-controlled-mission-persistence-qa";

// ── Controlled Mission Human Validation Types (PHASE 4.11) ─────────────────────
// DESIGN-ONLY. Workflow de validation humaine. approval_applied false.
export type {
  RuntimeControlledMissionHumanValidationPhase,
  RuntimeControlledMissionHumanValidationMode,
  RuntimeControlledMissionHumanValidationStatus,
  RuntimeControlledMissionHumanValidationDecision,
  RuntimeControlledMissionHumanValidationRiskLevel,
  RuntimeControlledMissionHumanValidationSensitivity,
  RuntimeControlledMissionHumanValidationActorRole,
  RuntimeControlledMissionHumanValidationGateId,
  RuntimeControlledMissionHumanValidationGateStatus,
  RuntimeControlledMissionHumanValidationGateSeverity,
  RuntimeControlledMissionHumanValidator,
  RuntimeControlledMissionHumanValidationGate,
  RuntimeControlledMissionHumanValidationRequirement,
  RuntimeControlledMissionHumanValidationDecisionRecord,
  RuntimeControlledMissionHumanValidationWorkflow,
  RuntimeControlledMissionHumanValidationTracePreview,
  RuntimeControlledMissionHumanValidationIssue,
  RuntimeControlledMissionHumanValidationRecommendation,
  RuntimeControlledMissionHumanValidationAction,
} from "./runtime-controlled-mission-human-validation-types";

// ── Controlled Mission Human Validation Policy (PHASE 4.11) ────────────────────
export type { RuntimeControlledMissionHumanValidationPolicy } from "./runtime-controlled-mission-human-validation-policy";
export {
  classifyRuntimeControlledMissionHumanValidationSensitivity,
  classifyRuntimeControlledMissionHumanValidationRisk,
  requiresRuntimeControlledMissionSecondValidator,
  requiresRuntimeControlledMissionLegalReviewer,
  requiresRuntimeControlledMissionHrManager,
  buildRuntimeControlledMissionRequiredValidators,
  buildRuntimeControlledMissionHumanValidationRequirements,
  buildRuntimeControlledMissionHumanValidationPolicy,
  explainRuntimeControlledMissionHumanValidationPolicy,
} from "./runtime-controlled-mission-human-validation-policy";

// ── Controlled Mission Human Validation Gates (PHASE 4.11) ─────────────────────
export type { RuntimeControlledMissionHumanValidationGatesSummary } from "./runtime-controlled-mission-human-validation-gates";
export {
  buildRuntimeControlledMissionHumanValidationGate,
  buildRuntimeControlledMissionHumanValidationGates,
  evaluateRuntimeControlledMissionHumanValidationGates,
  getRuntimeControlledMissionHumanValidationBlockingGates,
  summarizeRuntimeControlledMissionHumanValidationGates,
} from "./runtime-controlled-mission-human-validation-gates";

// ── Controlled Mission Human Validation Workflow (PHASE 4.11) ──────────────────
export type {
  RuntimeControlledMissionHumanValidationWorkflowOptions,
  RuntimeControlledMissionHumanValidationDecisionOptions,
} from "./runtime-controlled-mission-human-validation-workflow";
export {
  buildRuntimeControlledMissionHumanValidationWorkflow,
  buildRuntimeControlledMissionHumanValidationTracePreview,
  buildRuntimeControlledMissionHumanValidationDecisionRecord,
  applyRuntimeControlledMissionHumanValidationDecisionPreview,
  validateRuntimeControlledMissionHumanValidationWorkflow,
  sanitizeRuntimeControlledMissionHumanValidationWorkflow,
  summarizeRuntimeControlledMissionHumanValidationWorkflow,
} from "./runtime-controlled-mission-human-validation-workflow";

// ── Controlled Mission Human Validation Snapshot (PHASE 4.11) ──────────────────
export type {
  RuntimeControlledMissionHumanValidationSnapshotTone,
  RuntimeControlledMissionHumanValidationSnapshotBadge,
  RuntimeControlledMissionHumanValidationSnapshotCard,
  RuntimeControlledMissionHumanValidationSnapshotSection,
  RuntimeControlledMissionHumanValidationSnapshotTimelineItem,
  RuntimeControlledMissionHumanValidationSnapshotWarning,
  RuntimeControlledMissionHumanValidationSnapshotAction,
  RuntimeControlledMissionHumanValidationSnapshot,
} from "./runtime-controlled-mission-human-validation-snapshot";
export {
  buildRuntimeControlledMissionHumanValidationSnapshot,
  buildRuntimeControlledMissionHumanValidationBadges,
  buildRuntimeControlledMissionHumanValidationCards,
  buildRuntimeControlledMissionHumanValidationSections,
  buildRuntimeControlledMissionHumanValidationTimeline,
  buildRuntimeControlledMissionHumanValidationWarnings,
  buildRuntimeControlledMissionHumanValidationActions,
  getRuntimeControlledMissionHumanValidationStatusLabel,
  getRuntimeControlledMissionHumanValidationTone,
  explainRuntimeControlledMissionHumanValidationSnapshot,
} from "./runtime-controlled-mission-human-validation-snapshot";

// ── Controlled Mission Human Validation QA (PHASE 4.11) ────────────────────────
export type {
  RuntimeControlledMissionHumanValidationQaStepId,
  RuntimeControlledMissionHumanValidationQaStepStatus,
  RuntimeControlledMissionHumanValidationQaStepSeverity,
  RuntimeControlledMissionHumanValidationQaStep,
  RuntimeControlledMissionHumanValidationQaChecklist,
  RuntimeControlledMissionHumanValidationQaVerdict,
  RuntimeControlledMissionHumanValidationQaSummary,
} from "./runtime-controlled-mission-human-validation-qa";
export {
  buildRuntimeControlledMissionHumanValidationQaChecklist,
  buildRuntimeControlledMissionHumanValidationQaVerdict,
  getRuntimeControlledMissionHumanValidationBlockingSteps,
  summarizeRuntimeControlledMissionHumanValidationQaVerdict,
} from "./runtime-controlled-mission-human-validation-qa";

// ── Phase 4 Final QA Types (PHASE 4.12) ───────────────────────────────────────
// CLOSURE. Gate final PHASE 4.1 → 4.11. Clôture, pas activation.
export type {
  RuntimePhase4FinalQaPhase,
  RuntimePhase4FinalQaStatus,
  RuntimePhase4FinalQaVerdict,
  RuntimePhase4FinalQaScope,
  RuntimePhase4FinalQaStepSeverity,
  RuntimePhase4FinalQaStepStatus,
  RuntimePhase4FinalQaInvariantId,
  RuntimePhase4FinalQaBlockId,
  RuntimePhase4FinalQaStep,
  RuntimePhase4FinalQaInvariant,
  RuntimePhase4FinalQaBlockSummary,
  RuntimePhase4FinalQaClosure,
  RuntimePhase4FinalQaGate,
  RuntimePhase4FinalQaSnapshot,
  RuntimePhase4FinalQaIssue,
  RuntimePhase4FinalQaRecommendation,
  RuntimePhase4FinalQaAction,
} from "./runtime-phase4-final-qa-types";

// ── Phase 4 Final QA Registry (PHASE 4.12) ────────────────────────────────────
export {
  buildRuntimePhase4FinalQaBlockRegistry,
  getRuntimePhase4FinalQaExpectedDocs,
  getRuntimePhase4FinalQaExpectedScripts,
  getRuntimePhase4FinalQaExpectedTests,
  getRuntimePhase4FinalQaExpectedSqlDrafts,
  getRuntimePhase4FinalQaExpectedRoutes,
  getRuntimePhase4FinalQaForbiddenRoutes,
  summarizeRuntimePhase4FinalQaBlock,
} from "./runtime-phase4-final-qa-registry";

// ── Phase 4 Final QA Invariants (PHASE 4.12) ──────────────────────────────────
export type {
  RuntimePhase4FinalQaInvariantOverrides,
  RuntimePhase4FinalQaInvariantsSummary,
} from "./runtime-phase4-final-qa-invariants";
export {
  buildRuntimePhase4FinalQaInvariants,
  evaluateRuntimePhase4FinalQaInvariants,
  getRuntimePhase4FinalQaBlockingInvariants,
  summarizeRuntimePhase4FinalQaInvariants,
} from "./runtime-phase4-final-qa-invariants";

// ── Phase 4 Final QA Gate (PHASE 4.12) ────────────────────────────────────────
export type { RuntimePhase4FinalQaGateOptions } from "./runtime-phase4-final-qa-gate";
export {
  buildRuntimePhase4FinalQaGate,
  evaluateRuntimePhase4FinalQaGate,
  buildRuntimePhase4FinalQaClosure,
  summarizeRuntimePhase4FinalQaGate,
  assertRuntimePhase4FinalQaNoExecution,
  assertRuntimePhase4FinalQaClosureSafe,
  getRuntimePhase4FinalQaVerdict,
} from "./runtime-phase4-final-qa-gate";

// ── Phase 4 Final QA Snapshot (PHASE 4.12) ────────────────────────────────────
export type {
  RuntimePhase4FinalQaSnapshotTone,
  RuntimePhase4FinalQaSnapshotBadge,
  RuntimePhase4FinalQaSnapshotCard,
  RuntimePhase4FinalQaSnapshotSection,
  RuntimePhase4FinalQaSnapshotTimelineItem,
  RuntimePhase4FinalQaSnapshotWarning,
  RuntimePhase4FinalQaSnapshotAction,
  RuntimePhase4FinalQaReportSnapshot,
} from "./runtime-phase4-final-qa-snapshot";
export {
  buildRuntimePhase4FinalQaSnapshot,
  buildRuntimePhase4FinalQaBadges,
  buildRuntimePhase4FinalQaCards,
  buildRuntimePhase4FinalQaSections,
  buildRuntimePhase4FinalQaTimeline,
  buildRuntimePhase4FinalQaWarnings,
  buildRuntimePhase4FinalQaActions,
  getRuntimePhase4FinalQaTone,
  explainRuntimePhase4FinalQaSnapshot,
} from "./runtime-phase4-final-qa-snapshot";

// ── Phase 4 Next Phase Plan (PHASE 4.12) ──────────────────────────────────────
export type {
  RuntimePhase4NextPhaseStep,
  RuntimePhase4NextPhasePlan,
} from "./runtime-phase4-next-phase-plan";
export {
  buildRuntimePhase4NextPhasePlan,
  summarizeRuntimePhase4NextPhasePlan,
} from "./runtime-phase4-next-phase-plan";

// ── Phase 4 Final QA QA (PHASE 4.12) ──────────────────────────────────────────
export type {
  RuntimePhase4FinalQaQaStepStatus,
  RuntimePhase4FinalQaQaStepSeverity,
  RuntimePhase4FinalQaQaStep,
  RuntimePhase4FinalQaQaChecklist,
  RuntimePhase4FinalQaQaVerdict,
  RuntimePhase4FinalQaQaSummary,
} from "./runtime-phase4-final-qa-qa";
export {
  buildRuntimePhase4FinalQaChecklist,
  buildRuntimePhase4FinalQaVerdict,
  getRuntimePhase4FinalQaBlockingSteps,
  summarizeRuntimePhase4FinalQaVerdict,
} from "./runtime-phase4-final-qa-qa";

// ── Controlled Mission Safe Apply Types (PHASE 5.1) ───────────────────────────
// localStorage-first uniquement. Mission préparée, jamais exécutée.
export type {
  LocalControlledMissionPhase,
  LocalControlledMissionSource,
  LocalControlledMissionStatus,
  LocalControlledMissionExecutionStatus,
  LocalControlledMissionServerPersistence,
  LocalControlledMissionRuntimeExecution,
  LocalControlledMissionPriority,
  LocalControlledMissionRiskLevel,
  LocalControlledMissionStep,
  LocalControlledMissionValidationRequirement,
  LocalControlledMissionTimelineItem,
  LocalControlledMissionGuardSummary,
  LocalControlledMission,
  LocalControlledMissionEnvelope,
  ControlledMissionSafeApplyStatus,
  ControlledMissionSafeApplyInputCheck,
  ControlledMissionSafeApplyResult,
  LocalControlledMissionBuildOptions,
} from "./controlled-mission-safe-apply-types";

// ── Controlled Mission LocalStorage (PHASE 5.1) ───────────────────────────────
export {
  CONTROLLED_MISSION_LOCALSTORAGE_KEY,
  CONTROLLED_MISSION_LAST_PREVIEW_KEY,
  buildLocalControlledMissionEnvelope,
  validateLocalControlledMissionEnvelope,
  loadLocalControlledMissionEnvelopes,
  loadLocalControlledMissions,
  getLocalControlledMissionById,
  hasLocalControlledMission,
  upsertLocalControlledMission,
  archiveLocalControlledMission,
  clearLocalControlledMissionsForQA,
} from "./controlled-mission-local-storage";

// ── Controlled Mission Safe Apply (PHASE 5.1) ─────────────────────────────────
export {
  sanitizeControlledMissionText,
  validateControlledMissionSafeApplyInput,
  buildControlledMissionFromPromotionPreview,
  sanitizeControlledMissionPayload,
  buildControlledMissionUserFacingWarnings,
  buildControlledMissionSafeApplyResult,
  createLocalControlledMission,
  summarizeLocalControlledMissions,
} from "./controlled-mission-safe-apply";

// ── Controlled Mission Safe Apply UI Copy (PHASE 5.1) ─────────────────────────
export type {
  LocalControlledMissionBadgeTone,
  LocalControlledMissionBadge,
} from "./controlled-mission-safe-apply-ui-copy";
export {
  CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL,
  CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL_ALT,
  CONTROLLED_MISSION_SAFE_APPLY_MICROCOPY,
  CONTROLLED_MISSION_SAFE_APPLY_SUCCESS,
  CONTROLLED_MISSION_SAFE_APPLY_ALREADY_CREATED,
  CONTROLLED_MISSION_SAFE_APPLY_BLOCKED,
  CONTROLLED_MISSION_SAFE_APPLY_FAILED,
  CONTROLLED_MISSION_GUARDRAILS,
  getLocalControlledMissionStatusLabel,
  buildLocalControlledMissionBadges,
  buildLocalControlledMissionSectionBadges,
} from "./controlled-mission-safe-apply-ui-copy";

// ── Controlled Mission Safe Apply QA (PHASE 5.1) ──────────────────────────────
export type {
  ControlledMissionSafeApplyQaStepId,
  ControlledMissionSafeApplyQaStepStatus,
  ControlledMissionSafeApplyQaStepSeverity,
  ControlledMissionSafeApplyQaStep,
  ControlledMissionSafeApplyQaChecklist,
  ControlledMissionSafeApplyQaVerdict,
  ControlledMissionSafeApplyQaSummary,
} from "./controlled-mission-safe-apply-qa";
export {
  buildControlledMissionSafeApplyQaChecklist,
  buildControlledMissionSafeApplyQaVerdict,
  getControlledMissionSafeApplyBlockingSteps,
  summarizeControlledMissionSafeApplyQaVerdict,
} from "./controlled-mission-safe-apply-qa";

// ── Controlled Mission Local Review Types (PHASE 5.2) ─────────────────────────
// Revue / validation humaine LOCALE. Approbation locale = jamais exécution.
export type {
  LocalControlledMissionReviewStatus,
  LocalControlledMissionReviewerRole,
  LocalControlledMissionReviewDecision,
  LocalControlledMissionReviewChecklistItemId,
  LocalControlledMissionReviewChecklistItem,
  LocalControlledMissionReviewTimelineEvent,
  LocalControlledMissionReviewTimelineItem,
  LocalControlledMissionReviewState,
  LocalControlledMissionReviewDecisionInput,
  LocalControlledMissionReviewResultStatus,
  LocalControlledMissionReviewResult,
} from "./controlled-mission-local-review-types";

// ── Controlled Mission Local Review (PHASE 5.2) ───────────────────────────────
export {
  sanitizeControlledMissionReviewText,
  sanitizeControlledMissionReviewPayload,
  buildControlledMissionReviewChecklist,
  buildDefaultControlledMissionReviewState,
  getControlledMissionReviewState,
  buildControlledMissionLocalReviewResult,
  validateControlledMissionLocalReviewDecision,
  startLocalControlledMissionReview,
  approveLocalControlledMission,
  requestChangesForLocalControlledMission,
  blockLocalControlledMission,
  archiveReviewedLocalControlledMission,
  summarizeControlledMissionReviewState,
} from "./controlled-mission-local-review";

// ── Controlled Mission Local Review UI Copy (PHASE 5.2) ───────────────────────
export type {
  ControlledMissionReviewBadgeTone,
  ControlledMissionReviewBadge,
} from "./controlled-mission-local-review-ui-copy";
export {
  CONTROLLED_MISSION_REVIEW_START_LABEL,
  CONTROLLED_MISSION_REVIEW_APPROVE_LABEL,
  CONTROLLED_MISSION_REVIEW_REQUEST_CHANGES_LABEL,
  CONTROLLED_MISSION_REVIEW_BLOCK_LABEL,
  CONTROLLED_MISSION_REVIEW_ARCHIVE_LABEL,
  CONTROLLED_MISSION_REVIEW_RELIRE_LABEL,
  CONTROLLED_MISSION_REVIEW_MICROCOPY,
  CONTROLLED_MISSION_REVIEW_NO_PIERRE,
  CONTROLLED_MISSION_REVIEW_STILL_PREPARED,
  CONTROLLED_MISSION_REVIEW_FUTURE_PHASE,
  CONTROLLED_MISSION_REVIEW_APPROVED_MESSAGE,
  CONTROLLED_MISSION_REVIEW_PANEL_GUARDRAIL,
  getControlledMissionReviewStatusLabel,
  buildControlledMissionReviewBadges,
} from "./controlled-mission-local-review-ui-copy";

// ── Controlled Mission Local Review QA (PHASE 5.2) ────────────────────────────
export type {
  ControlledMissionReviewQaStepId,
  ControlledMissionReviewQaStepStatus,
  ControlledMissionReviewQaStepSeverity,
  ControlledMissionReviewQaStep,
  ControlledMissionReviewQaChecklist,
  ControlledMissionReviewQaVerdict,
  ControlledMissionReviewQaSummary,
} from "./controlled-mission-local-review-qa";
export {
  buildControlledMissionReviewQaChecklist,
  buildControlledMissionReviewQaVerdict,
  getControlledMissionReviewBlockingSteps,
  summarizeControlledMissionReviewQaVerdict,
} from "./controlled-mission-local-review-qa";

// ── Controlled Mission Preflight Types (PHASE 5.3) ────────────────────────────
// Readiness gate locale. « ready » = candidate future exécution gouvernée, jamais exécution.
export type {
  LocalControlledMissionPreflightStatus,
  LocalControlledMissionReadinessLevel,
  LocalControlledMissionPreflightCheckId,
  LocalControlledMissionPreflightCheckStatus,
  LocalControlledMissionPreflightCheck,
  LocalControlledMissionRuntimeRequirementsSnapshot,
  LocalControlledMissionGuardRequirementsSnapshot,
  LocalControlledMissionHumanValidationSnapshot,
  LocalControlledMissionPreflightState,
  LocalControlledMissionPreflightResultStatus,
  LocalControlledMissionPreflightResult,
} from "./controlled-mission-preflight-types";

// ── Controlled Mission Preflight (PHASE 5.3) ──────────────────────────────────
export {
  buildControlledMissionRuntimeRequirementsSnapshot,
  buildControlledMissionGuardRequirementsSnapshot,
  buildControlledMissionHumanValidationSnapshot,
  buildControlledMissionPreflightChecks,
  computeControlledMissionReadinessScore,
  buildDefaultControlledMissionPreflightState,
  getControlledMissionPreflightState,
  validateControlledMissionPreflightEligibility,
  buildControlledMissionPreflightResult,
  sanitizeControlledMissionPreflightPayload,
  runLocalControlledMissionPreflight,
  summarizeControlledMissionPreflightState,
} from "./controlled-mission-preflight";

// ── Controlled Mission Preflight UI Copy (PHASE 5.3) ──────────────────────────
export type {
  ControlledMissionPreflightBadgeTone,
  ControlledMissionPreflightBadge,
} from "./controlled-mission-preflight-ui-copy";
export {
  CONTROLLED_MISSION_PREFLIGHT_RUN_LABEL,
  CONTROLLED_MISSION_PREFLIGHT_REVIEW_REPORT_LABEL,
  CONTROLLED_MISSION_PREFLIGHT_MICROCOPY,
  CONTROLLED_MISSION_PREFLIGHT_WHAT_IT_DOES,
  CONTROLLED_MISSION_PREFLIGHT_NO_PIERRE,
  CONTROLLED_MISSION_PREFLIGHT_READY_NO_ACTION,
  CONTROLLED_MISSION_PREFLIGHT_STILL_PREPARED,
  CONTROLLED_MISSION_PREFLIGHT_READY_MESSAGE,
  CONTROLLED_MISSION_PREFLIGHT_PANEL_GUARDRAIL,
  getControlledMissionPreflightStatusLabel,
  getControlledMissionReadinessLevelLabel,
  buildControlledMissionPreflightBadges,
} from "./controlled-mission-preflight-ui-copy";

// ── Controlled Mission Preflight QA (PHASE 5.3) ───────────────────────────────
export type {
  ControlledMissionPreflightQaStepId,
  ControlledMissionPreflightQaStepStatus,
  ControlledMissionPreflightQaStepSeverity,
  ControlledMissionPreflightQaStep,
  ControlledMissionPreflightQaChecklist,
  ControlledMissionPreflightQaVerdict,
  ControlledMissionPreflightQaSummary,
} from "./controlled-mission-preflight-qa";
export {
  buildControlledMissionPreflightQaChecklist,
  buildControlledMissionPreflightQaVerdict,
  getControlledMissionPreflightBlockingSteps,
  summarizeControlledMissionPreflightQaVerdict,
} from "./controlled-mission-preflight-qa";

// ── Controlled Mission Server Persistence Types (PHASE 5.4) ───────────────────
// Design-only. « ready » = candidate future persistance serveur. Jamais active.
export type {
  GovernedControlledMissionServerPersistencePhase,
  GovernedControlledMissionServerPersistenceStatus,
  GovernedControlledMissionExecutionStatus,
  GovernedControlledMissionRuntimeStatus,
  GovernedControlledMissionGovernanceStatus,
  GovernedControlledMissionGuardSnapshot,
  GovernedControlledMissionReviewSnapshot,
  GovernedControlledMissionPreflightSnapshot,
  GovernedControlledMissionRuntimeRequirementsSnapshot,
  GovernedControlledMissionHumanValidationSnapshot,
  GovernedControlledMissionTraceSnapshot,
  GovernedControlledMissionServerDraft,
  GovernedControlledMissionServerDraftBuildOptions,
  GovernedControlledMissionServerDraftEligibility,
  GovernedControlledMissionServerPersistenceReadiness,
  GovernedControlledMissionServerPersistencePolicySnapshot,
  GovernedControlledMissionServerPersistenceRlsPolicyDraft,
  GovernedControlledMissionServerPersistenceFeatureFlagContract,
  GovernedControlledMissionServerPersistenceApiSafetyFlags,
  GovernedControlledMissionServerPersistenceApiContract,
  GovernedControlledMissionServerPersistenceSqlDraft,
} from "./controlled-mission-server-persistence-types";

// ── Controlled Mission Server Persistence Contract (PHASE 5.4) ────────────────
export {
  validateGovernedControlledMissionServerDraftEligibility,
  buildControlledMissionServerPersistenceReadiness,
  buildControlledMissionServerPersistenceTraceSnapshot,
  buildGovernedControlledMissionServerDraft,
  summarizeControlledMissionServerPersistenceDraft,
} from "./controlled-mission-server-persistence-contract";

// ── Controlled Mission Server Persistence SQL Draft (PHASE 5.4) ───────────────
export {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_MARKERS,
  buildControlledMissionServerPersistenceSqlDraft,
  buildControlledMissionServerPersistenceRlsPolicyDraft,
} from "./controlled-mission-server-persistence-sql-draft";

// ── Controlled Mission Server Persistence Policy / Flag (PHASE 5.4) ───────────
export {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_ACTIVATION_STEPS,
  getControlledMissionServerPersistenceFlagDefault,
  isControlledMissionServerPersistenceEnabledFromEnv,
  buildControlledMissionServerPersistenceFlagSnapshot,
  buildControlledMissionServerPersistenceFeatureFlagContract,
  buildControlledMissionServerPersistencePolicySnapshot,
} from "./controlled-mission-server-persistence-policy";

// ── Controlled Mission Server Persistence API Contract (PHASE 5.4) ────────────
export {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT,
  buildControlledMissionServerPersistenceApiContract,
} from "./controlled-mission-server-persistence-api-contract";

// ── Controlled Mission Server Persistence UI Copy (PHASE 5.4) ─────────────────
export type {
  ControlledMissionServerPersistenceBadgeTone,
  ControlledMissionServerPersistenceBadge,
} from "./controlled-mission-server-persistence-ui-copy";
export {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_DRAFT_LABEL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_REQUIREMENTS_LABEL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_WHAT_IT_DOES,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_NO_DATA,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_STILL_LOCAL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FACTS,
  getControlledMissionServerPersistenceStatusLabel,
  buildControlledMissionServerPersistenceBadges,
} from "./controlled-mission-server-persistence-ui-copy";

// ── Controlled Mission Server Persistence QA (PHASE 5.4) ──────────────────────
export type {
  ControlledMissionServerPersistenceQaStepId,
  ControlledMissionServerPersistenceQaStepStatus,
  ControlledMissionServerPersistenceQaStepSeverity,
  ControlledMissionServerPersistenceQaStep,
  ControlledMissionServerPersistenceQaChecklist,
  ControlledMissionServerPersistenceQaVerdict,
  ControlledMissionServerPersistenceQaSummary,
} from "./controlled-mission-server-persistence-qa";
export {
  buildControlledMissionServerPersistenceQaChecklist,
  buildControlledMissionServerPersistenceQaVerdict,
  getControlledMissionServerPersistenceBlockingSteps,
  summarizeControlledMissionServerPersistenceQaVerdict,
} from "./controlled-mission-server-persistence-qa";

// ── Controlled Mission Server Persistence Manual Activation Types (PHASE 5.5) ──
// QA manuelle d'activation FUTURE. N'active rien. SQL non appliqué. Flag off.
export type {
  ControlledMissionServerPersistenceManualActivationPhase,
  ControlledMissionServerPersistenceManualActivationStepStatus,
  ControlledMissionServerPersistenceManualActivationStepSeverity,
  ControlledMissionServerPersistenceManualActivationCategory,
  ControlledMissionServerPersistenceManualActivationStep,
  ControlledMissionServerPersistenceManualActivationVerdict,
  ControlledMissionServerPersistenceManualActivationEvaluation,
  ControlledMissionServerPersistenceManualActivationQa,
  ControlledMissionServerPersistenceManualActivationRunbookSection,
  ControlledMissionServerPersistenceManualActivationRunbook,
  ControlledMissionServerPersistenceManualActivationEvidenceSection,
  ControlledMissionServerPersistenceManualActivationEvidenceTemplate,
} from "./controlled-mission-server-persistence-manual-activation-types";

// ── Controlled Mission Server Persistence Manual Activation QA (PHASE 5.5) ─────
export {
  buildControlledMissionServerPersistenceManualActivationChecklist,
  evaluateControlledMissionServerPersistenceManualActivationQa,
  getControlledMissionServerPersistenceManualActivationBlockingSteps,
  buildControlledMissionServerPersistenceManualActivationQa,
  summarizeControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerPersistenceManualActivationRunbook,
  buildControlledMissionServerPersistenceManualActivationEvidenceTemplate,
} from "./controlled-mission-server-persistence-manual-activation-qa";

// ── Controlled Mission Server Persistence Manual Activation UI Copy (PHASE 5.5) ─
export type {
  ControlledMissionServerManualQaBadgeTone,
  ControlledMissionServerManualQaBadge,
} from "./controlled-mission-server-persistence-manual-activation-ui-copy";
export {
  CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_CHECKLIST_LABEL,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_RUNBOOK_LABEL,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_WHAT_IT_DOES,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_DO_NOT_APPLY,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_NO_DATA,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_FACTS,
  getControlledMissionServerManualQaVerdictLabel,
  getControlledMissionServerManualQaCategoryLabel,
  buildControlledMissionServerManualQaBadges,
} from "./controlled-mission-server-persistence-manual-activation-ui-copy";

// ── Controlled Mission Server Restore Types (PHASE 5.6) ───────────────────────
// UI design-only. Restauration serveur NON active. localStorage source active.
export type {
  ControlledMissionServerRestorePhase,
  ControlledMissionServerRestoreStatus,
  ControlledMissionServerRestoreSource,
  ControlledMissionServerRestoreCardStatus,
  ControlledMissionServerRestoreCardSeverity,
  ControlledMissionServerRestoreDisplayCard,
  ControlledMissionServerRestoreTimelineStatus,
  ControlledMissionServerRestoreTimelineItem,
  ControlledMissionServerRestoreDesignState,
} from "./controlled-mission-server-restore-types";

// ── Controlled Mission Server Restore Design (PHASE 5.6) ──────────────────────
export {
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerRestoreDisplayCards,
  buildControlledMissionServerRestoreTimelinePreview,
  buildControlledMissionServerRestoreWarnings,
  buildControlledMissionServerRestoreRequiredNextSteps,
  summarizeControlledMissionServerRestoreDesignState,
} from "./controlled-mission-server-restore-design";

// ── Controlled Mission Server Restore UI Copy (PHASE 5.6) ─────────────────────
export type {
  ControlledMissionServerRestoreBadgeTone,
  ControlledMissionServerRestoreBadge,
} from "./controlled-mission-server-restore-ui-copy";
export {
  CONTROLLED_MISSION_SERVER_RESTORE_VIEW_STATE_LABEL,
  CONTROLLED_MISSION_SERVER_RESTORE_VIEW_FUTURE_LABEL,
  CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY,
  CONTROLLED_MISSION_SERVER_RESTORE_WHAT_IT_DOES,
  CONTROLLED_MISSION_SERVER_RESTORE_NO_GET,
  CONTROLLED_MISSION_SERVER_RESTORE_LOCAL_SOURCE,
  CONTROLLED_MISSION_SERVER_RESTORE_NO_EXECUTION,
  CONTROLLED_MISSION_SERVER_RESTORE_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_SERVER_RESTORE_FACTS,
  getControlledMissionServerRestoreStatusLabel,
  buildControlledMissionServerRestoreBadges,
} from "./controlled-mission-server-restore-ui-copy";

// ── Controlled Mission Server Restore QA (PHASE 5.6) ──────────────────────────
export type {
  ControlledMissionServerRestoreQaStepId,
  ControlledMissionServerRestoreQaStepStatus,
  ControlledMissionServerRestoreQaStepSeverity,
  ControlledMissionServerRestoreQaStep,
  ControlledMissionServerRestoreQaChecklist,
  ControlledMissionServerRestoreQaVerdict,
  ControlledMissionServerRestoreQaSummary,
} from "./controlled-mission-server-restore-qa";
export {
  buildControlledMissionServerRestoreQaChecklist,
  buildControlledMissionServerRestoreQaVerdict,
  getControlledMissionServerRestoreBlockingSteps,
  summarizeControlledMissionServerRestoreQaVerdict,
} from "./controlled-mission-server-restore-qa";

// ── Controlled Mission Server Persistence Final Gate Types (PHASE 5.7) ─────────
// Fermeture P5.1 → P5.6. Design-only. Jamais « production ready » / « execution ready ».
export type {
  ControlledMissionServerPersistenceFinalGatePhase,
  ControlledMissionServerPersistenceFinalGateVerdict,
  ControlledMissionServerPersistenceFinalGateReadinessLevel,
  ControlledMissionServerPersistenceFinalGateCheckStatus,
  ControlledMissionServerPersistenceFinalGateCheckSeverity,
  ControlledMissionServerPersistenceFinalGateCheck,
  ControlledMissionServerPersistenceFinalGateSectionStatus,
  ControlledMissionServerPersistenceFinalGateSection,
  ControlledMissionServerPersistenceFinalGateCommandStatus,
  ControlledMissionServerPersistenceFinalGateCommand,
  ControlledMissionServerPersistenceFinalGateEvidenceItem,
  ControlledMissionServerPersistenceFinalGateInvariant,
  ControlledMissionServerPersistenceFinalGateReport,
} from "./controlled-mission-server-persistence-final-gate-types";

// ── Controlled Mission Server Persistence Final Gate (PHASE 5.7) ───────────────
export {
  buildControlledMissionServerPersistenceFinalGateSections,
  computeControlledMissionServerPersistenceFinalGateScore,
  evaluateControlledMissionServerPersistenceFinalGateVerdict,
  buildControlledMissionServerPersistenceFinalGateEvidence,
  buildControlledMissionServerPersistenceFinalGateCommandMatrix,
  buildControlledMissionServerPersistenceFinalGateInvariants,
  buildControlledMissionServerPersistenceFinalGateReport,
  summarizeControlledMissionServerPersistenceFinalGate,
} from "./controlled-mission-server-persistence-final-gate";

// ── Controlled Mission Server Persistence Final Gate UI Copy (PHASE 5.7) ───────
export type {
  ControlledMissionFinalGateBadgeTone,
  ControlledMissionFinalGateBadge,
} from "./controlled-mission-server-persistence-final-gate-ui-copy";
export {
  CONTROLLED_MISSION_FINAL_GATE_VIEW_REPORT_LABEL,
  CONTROLLED_MISSION_FINAL_GATE_VIEW_INVARIANTS_LABEL,
  CONTROLLED_MISSION_FINAL_GATE_VIEW_NEXT_STEPS_LABEL,
  CONTROLLED_MISSION_FINAL_GATE_MICROCOPY,
  CONTROLLED_MISSION_FINAL_GATE_WHAT_IT_DOES,
  CONTROLLED_MISSION_FINAL_GATE_SERVER_INACTIVE,
  CONTROLLED_MISSION_FINAL_GATE_NO_ROUTE,
  CONTROLLED_MISSION_FINAL_GATE_NO_EXECUTION,
  CONTROLLED_MISSION_FINAL_GATE_PANEL_GUARDRAIL,
  getControlledMissionFinalGateVerdictLabel,
  getControlledMissionFinalGateLevelLabel,
  buildControlledMissionFinalGateBadges,
} from "./controlled-mission-server-persistence-final-gate-ui-copy";

// ── Controlled Mission Server Persistence Final Gate QA (PHASE 5.7) ────────────
export type {
  ControlledMissionFinalGateQaStepId,
  ControlledMissionFinalGateQaStepStatus,
  ControlledMissionFinalGateQaStepSeverity,
  ControlledMissionFinalGateQaStep,
  ControlledMissionFinalGateQaChecklist,
  ControlledMissionFinalGateQaVerdict,
  ControlledMissionFinalGateQaSummary,
} from "./controlled-mission-server-persistence-final-gate-qa";
export {
  buildControlledMissionServerPersistenceFinalGateQaChecklist,
  buildControlledMissionServerPersistenceFinalGateQaVerdict,
  getControlledMissionServerPersistenceFinalGateBlockingSteps,
  summarizeControlledMissionServerPersistenceFinalGateQaVerdict,
} from "./controlled-mission-server-persistence-final-gate-qa";

// ── Controlled Mission Persistence Transition Plan Types (PHASE 5.8) ───────────
// Roadmap design-only localStorage → serveur futur. N'active rien.
export type {
  ControlledMissionPersistenceTransitionPhaseTag,
  ControlledMissionPersistenceTransitionStatus,
  ControlledMissionPersistenceTransitionReadinessLevel,
  ControlledMissionPersistenceTransitionPhaseStatus,
  ControlledMissionPersistenceTransitionPhase,
  ControlledMissionPersistenceTransitionMilestoneStatus,
  ControlledMissionPersistenceTransitionMilestone,
  ControlledMissionPersistenceTransitionRiskSeverity,
  ControlledMissionPersistenceTransitionRisk,
  ControlledMissionPersistenceRollbackPlan,
  ControlledMissionPersistenceDataConsistencyPolicy,
  ControlledMissionPersistenceNoExecutionPolicy,
  ControlledMissionPersistenceTransitionEvidenceItem,
  ControlledMissionPersistenceTransitionPlan,
} from "./controlled-mission-persistence-transition-plan-types";

// ── Controlled Mission Persistence Transition Plan (PHASE 5.8) ─────────────────
export {
  buildControlledMissionPersistenceTransitionPhases,
  buildControlledMissionPersistenceTransitionMilestones,
  buildControlledMissionPersistenceTransitionRisks,
  buildControlledMissionPersistenceRollbackPlan,
  buildControlledMissionPersistenceDataConsistencyPolicy,
  buildControlledMissionPersistenceNoExecutionPolicy,
  buildControlledMissionPersistenceTransitionEvidence,
  computeControlledMissionPersistenceTransitionScore,
  buildControlledMissionPersistenceTransitionPlan,
  summarizeControlledMissionPersistenceTransitionPlan,
} from "./controlled-mission-persistence-transition-plan";

// ── Controlled Mission Persistence Transition Plan UI Copy (PHASE 5.8) ─────────
export type {
  ControlledMissionTransitionBadgeTone,
  ControlledMissionTransitionBadge,
} from "./controlled-mission-persistence-transition-plan-ui-copy";
export {
  CONTROLLED_MISSION_TRANSITION_VIEW_PLAN_LABEL,
  CONTROLLED_MISSION_TRANSITION_VIEW_RISKS_LABEL,
  CONTROLLED_MISSION_TRANSITION_VIEW_ROLLBACK_LABEL,
  CONTROLLED_MISSION_TRANSITION_VIEW_NEXT_STEPS_LABEL,
  CONTROLLED_MISSION_TRANSITION_MICROCOPY,
  CONTROLLED_MISSION_TRANSITION_WHAT_IT_DOES,
  CONTROLLED_MISSION_TRANSITION_LOCAL_SOURCE,
  CONTROLLED_MISSION_TRANSITION_NO_GET_POST,
  CONTROLLED_MISSION_TRANSITION_NO_EXECUTION,
  CONTROLLED_MISSION_TRANSITION_PANEL_GUARDRAIL,
  getControlledMissionTransitionStatusLabel,
  getControlledMissionTransitionLevelLabel,
  getControlledMissionTransitionPhaseStatusLabel,
  buildControlledMissionTransitionBadges,
} from "./controlled-mission-persistence-transition-plan-ui-copy";

// ── Controlled Mission Persistence Transition Plan QA (PHASE 5.8) ──────────────
export type {
  ControlledMissionTransitionQaStepId,
  ControlledMissionTransitionQaStepStatus,
  ControlledMissionTransitionQaStepSeverity,
  ControlledMissionTransitionQaStep,
  ControlledMissionTransitionQaChecklist,
  ControlledMissionTransitionQaVerdict,
  ControlledMissionTransitionQaSummary,
} from "./controlled-mission-persistence-transition-plan-qa";
export {
  buildControlledMissionPersistenceTransitionPlanQaChecklist,
  buildControlledMissionPersistenceTransitionPlanQaVerdict,
  getControlledMissionPersistenceTransitionPlanBlockingSteps,
  summarizeControlledMissionPersistenceTransitionPlanQaVerdict,
} from "./controlled-mission-persistence-transition-plan-qa";

// ── Controlled Mission Persistence Operator Handbook Types (PHASE 5.9) ─────────
// Documentation opérateur P5.1 → P5.8. Design-only. N'active rien.
export type {
  ControlledMissionPersistenceHandbookPhase,
  ControlledMissionPersistenceHandbookStatus,
  ControlledMissionPersistenceOperatorWorkflow,
  ControlledMissionPersistencePlaybook,
  ControlledMissionPersistenceGlossaryItem,
  ControlledMissionPersistenceDecisionMatrixItem,
  ControlledMissionPersistenceEvidenceChecklistItem,
  ControlledMissionPersistenceCommandReferenceItem,
  ControlledMissionPersistenceHandbookInvariant,
  ControlledMissionPersistenceOperatorHandbook,
} from "./controlled-mission-persistence-operator-handbook-types";

// ── Controlled Mission Persistence Operator Handbook (PHASE 5.9) ───────────────
export {
  buildControlledMissionPersistenceOperatorGlossary,
  buildControlledMissionPersistenceOperatorWorkflows,
  buildControlledMissionPersistenceVerificationPlaybooks,
  buildControlledMissionPersistenceIncidentPlaybooks,
  buildControlledMissionPersistenceRollbackPlaybook,
  buildControlledMissionPersistenceEvidenceChecklist,
  buildControlledMissionPersistenceCommandReference,
  buildControlledMissionPersistenceDecisionMatrix,
  buildControlledMissionPersistenceHandbookInvariants,
  buildControlledMissionPersistenceOperatorHandbook,
  summarizeControlledMissionPersistenceOperatorHandbook,
} from "./controlled-mission-persistence-operator-handbook";

// ── Controlled Mission Persistence Operator Handbook UI Copy (PHASE 5.9) ───────
export type {
  ControlledMissionHandbookBadgeTone,
  ControlledMissionHandbookBadge,
} from "./controlled-mission-persistence-operator-handbook-ui-copy";
export {
  CONTROLLED_MISSION_HANDBOOK_VIEW_HANDBOOK_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_WORKFLOWS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_PLAYBOOKS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_COMMANDS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_DECISIONS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_MICROCOPY,
  CONTROLLED_MISSION_HANDBOOK_WHAT_IT_DOES,
  CONTROLLED_MISSION_HANDBOOK_LOCAL_SOURCE,
  CONTROLLED_MISSION_HANDBOOK_NO_GET_POST,
  CONTROLLED_MISSION_HANDBOOK_NO_EXECUTION,
  CONTROLLED_MISSION_HANDBOOK_PANEL_GUARDRAIL,
  getControlledMissionHandbookStatusLabel,
  buildControlledMissionHandbookBadges,
} from "./controlled-mission-persistence-operator-handbook-ui-copy";

// ── Controlled Mission Persistence Operator Handbook QA (PHASE 5.9) ────────────
export type {
  ControlledMissionHandbookQaStepId,
  ControlledMissionHandbookQaStepStatus,
  ControlledMissionHandbookQaStepSeverity,
  ControlledMissionHandbookQaStep,
  ControlledMissionHandbookQaChecklist,
  ControlledMissionHandbookQaVerdict,
  ControlledMissionHandbookQaSummary,
} from "./controlled-mission-persistence-operator-handbook-qa";
export {
  buildControlledMissionPersistenceOperatorHandbookQaChecklist,
  buildControlledMissionPersistenceOperatorHandbookQaVerdict,
  getControlledMissionPersistenceOperatorHandbookBlockingSteps,
  summarizeControlledMissionPersistenceOperatorHandbookQaVerdict,
} from "./controlled-mission-persistence-operator-handbook-qa";

// ── Controlled Mission Persistence Phase 5 Closure Types (PHASE 5.10) ──────────
// Fermeture P5.1 → P5.9. Design-only. Prépare P6 sans rien activer.
export type {
  ControlledMissionPersistencePhase5ClosurePhase,
  ControlledMissionPersistencePhase5ClosureStatus,
  ControlledMissionPersistencePhase5ClosedBlock,
  ControlledMissionPersistencePhase5EvidenceItem,
  ControlledMissionPersistencePhase5CommandStatus,
  ControlledMissionPersistencePhase5CommandItem,
  ControlledMissionPersistencePhase5Invariant,
  ControlledMissionPersistencePhase5RiskSeverity,
  ControlledMissionPersistencePhase5Risk,
  ControlledMissionPersistenceP6ReadinessStatus,
  ControlledMissionPersistenceP6ReadinessItem,
  ControlledMissionPersistencePhase5ClosureReport,
} from "./controlled-mission-persistence-phase5-closure-types";

// ── Controlled Mission Persistence Phase 5 Closure Report (PHASE 5.10) ─────────
export {
  buildControlledMissionPersistencePhase5ClosedBlocks,
  buildControlledMissionPersistencePhase5EvidenceSummary,
  buildControlledMissionPersistencePhase5CommandMatrix,
  buildControlledMissionPersistencePhase5InvariantMatrix,
  buildControlledMissionPersistencePhase5RiskMatrix,
  buildControlledMissionPersistencePhase5LaunchImpact,
  buildControlledMissionPersistenceP6ReadinessMap,
  buildControlledMissionPersistencePhase5ClosureReport,
  summarizeControlledMissionPersistencePhase5ClosureReport,
} from "./controlled-mission-persistence-phase5-closure-report";

// ── Controlled Mission Persistence Phase 5 Closure UI Copy (PHASE 5.10) ────────
export type {
  ControlledMissionClosureBadgeTone,
  ControlledMissionClosureBadge,
} from "./controlled-mission-persistence-phase5-closure-ui-copy";
export {
  CONTROLLED_MISSION_CLOSURE_VIEW_CLOSURE_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_BLOCKS_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_RISKS_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_P6_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_VERDICT_LABEL,
  CONTROLLED_MISSION_CLOSURE_MICROCOPY,
  CONTROLLED_MISSION_CLOSURE_WHAT_IT_DOES,
  CONTROLLED_MISSION_CLOSURE_LOCAL_SOURCE,
  CONTROLLED_MISSION_CLOSURE_NO_GET_POST,
  CONTROLLED_MISSION_CLOSURE_NO_EXECUTION,
  CONTROLLED_MISSION_CLOSURE_NEXT_P6,
  CONTROLLED_MISSION_CLOSURE_PANEL_GUARDRAIL,
  getControlledMissionClosureStatusLabel,
  buildControlledMissionClosureBadges,
} from "./controlled-mission-persistence-phase5-closure-ui-copy";

// ── Controlled Mission Persistence Phase 5 Closure QA (PHASE 5.10) ─────────────
export type {
  ControlledMissionClosureQaStepId,
  ControlledMissionClosureQaStepStatus,
  ControlledMissionClosureQaStepSeverity,
  ControlledMissionClosureQaStep,
  ControlledMissionClosureQaChecklist,
  ControlledMissionClosureQaVerdict,
  ControlledMissionClosureQaSummary,
} from "./controlled-mission-persistence-phase5-closure-qa";
export {
  buildControlledMissionPersistencePhase5ClosureQaChecklist,
  buildControlledMissionPersistencePhase5ClosureQaVerdict,
  getControlledMissionPersistencePhase5ClosureBlockingSteps,
  summarizeControlledMissionPersistencePhase5ClosureQaVerdict,
} from "./controlled-mission-persistence-phase5-closure-qa";

// ── Pierre Sellable Completion Master Audit Types (PHASE 6.1) ──────────────────
// Audit-only. Ne déclare pas Pierre vendable. N'active rien. Prépare P6.2 → P6.6.
export type {
  PierreSellableAuditPhase,
  PierreSellableAuditStatus,
  PierreSellableLevel,
  PierreSellableAuditClassification,
  PierreSellableAuditSection,
  PierreSellableAuditSeverity,
  PierreSellableAuditRequiredBefore,
  PierreSellableAuditGap,
  PierreSellableAuditBlocker,
  PierreSellableAuditEvidenceItem,
  PierreSellableAuditTechnologyStatus,
  PierreSellableAuditTechnologyDependency,
  PierreSellableAuditJourneyStatus,
  PierreSellableAuditJourneyStep,
  PierreSellableAuditRisk,
  PierreSellableAuditP6SequenceItem,
  PierreSellableAuditCapability,
  PierreSellableAuditSellableDefinition,
  PierreSellableCompletionMasterAuditReport,
} from "./pierre-sellable-completion-master-audit-types";

// ── Pierre Sellable Completion Master Audit (PHASE 6.1) ────────────────────────
export {
  buildPierreSellableAuditSections,
  computePierreSellableAuditScore,
  buildPierreSellableAuditGapMatrix,
  buildPierreSellableAuditBlockerMatrix,
  buildPierreSellableAuditEvidenceMatrix,
  buildPierreSellableAuditTechnologyDependencyMap,
  buildPierreSellableAuditCustomerJourneyMap,
  buildPierreSellableAuditRiskMatrix,
  buildPierreSellableAuditP6Sequence,
  buildPierreSellableAuditCapabilityMap,
  buildPierreSellableAuditSellableDefinition,
  buildPierreSellableCompletionMasterAuditReport,
  summarizePierreSellableCompletionMasterAuditReport,
} from "./pierre-sellable-completion-master-audit";

// ── Pierre Sellable Completion Master Audit UI Copy (PHASE 6.1) ────────────────
export type {
  PierreSellableAuditBadgeTone,
  PierreSellableAuditBadge,
} from "./pierre-sellable-completion-master-audit-ui-copy";
export {
  PIERRE_SELLABLE_AUDIT_VIEW_AUDIT_LABEL,
  PIERRE_SELLABLE_AUDIT_VIEW_BLOCKERS_LABEL,
  PIERRE_SELLABLE_AUDIT_VIEW_P6_LABEL,
  PIERRE_SELLABLE_AUDIT_VIEW_CRITERIA_LABEL,
  PIERRE_SELLABLE_AUDIT_MICROCOPY,
  PIERRE_SELLABLE_AUDIT_WHAT_IT_DOES,
  PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE,
  PIERRE_SELLABLE_AUDIT_NEXT_P6_2,
  PIERRE_SELLABLE_AUDIT_PANEL_GUARDRAIL,
  getPierreSellableAuditStatusLabel,
  getPierreSellableLevelLabel,
  getPierreSellableClassificationLabel,
  buildPierreSellableAuditBadges,
} from "./pierre-sellable-completion-master-audit-ui-copy";

// ── Pierre Sellable Completion Master Audit QA (PHASE 6.1) ─────────────────────
export type {
  PierreSellableAuditQaStepId,
  PierreSellableAuditQaStepStatus,
  PierreSellableAuditQaStepSeverity,
  PierreSellableAuditQaStep,
  PierreSellableAuditQaChecklist,
  PierreSellableAuditQaVerdict,
  PierreSellableAuditQaSummary,
} from "./pierre-sellable-completion-master-audit-qa";
export {
  buildPierreSellableCompletionMasterAuditQaChecklist,
  buildPierreSellableCompletionMasterAuditQaVerdict,
  getPierreSellableCompletionMasterAuditBlockingSteps,
  summarizePierreSellableCompletionMasterAuditQaVerdict,
} from "./pierre-sellable-completion-master-audit-qa";

// ── Pierre Real Workflow Completion Pack Types (PHASE 6.2) ─────────────────────
// 5 scénarios RH vendables. Proof pack — aucune exécution autonome. Ne déclare pas vendable.
export type {
  PierreWorkflowPackPhase,
  PierreWorkflowPackStatus,
  PierreWorkflowTaskType,
  PierreWorkflowTaskStatus,
  PierreWorkflowTask,
  PierreWorkflowExecutionStatus,
  PierreWorkflowHrDomain,
  PierreWorkflowCloneGuardDecision,
  PierreWorkflowScenario,
  PierreWorkflowSellableProofSummary,
  PierreWorkflowHumanValidationRow,
  PierreWorkflowLegalRisk,
  PierreWorkflowTraceabilityRow,
  PierreWorkflowDemoReadinessRow,
  PierreRealWorkflowCompletionPack,
} from "./pierre-real-workflow-completion-pack-types";

// ── Pierre Real Workflow Completion Pack (PHASE 6.2) ───────────────────────────
export {
  buildPierreWorkflowScenarios,
  buildPierreWorkflowSellableProofSummary,
  buildPierreWorkflowHumanValidationMatrix,
  buildPierreWorkflowLegalRiskMatrix,
  buildPierreWorkflowTraceabilityMatrix,
  buildPierreWorkflowDemoReadinessMatrix,
  buildPierreRealWorkflowCompletionPack,
  summarizePierreRealWorkflowCompletionPack,
} from "./pierre-real-workflow-completion-pack";

// ── Pierre Real Workflow Completion Pack UI Copy (PHASE 6.2) ───────────────────
export type {
  PierreWorkflowPackBadgeTone,
  PierreWorkflowPackBadge,
} from "./pierre-real-workflow-completion-pack-ui-copy";
export {
  PIERRE_WORKFLOW_PACK_TITLE,
  PIERRE_WORKFLOW_PACK_VIEW_SCENARIOS_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_DELIVERABLES_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_VALIDATIONS_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_RISKS_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_VALUE_LABEL,
  PIERRE_WORKFLOW_PACK_MICROCOPY,
  PIERRE_WORKFLOW_PACK_VALUE_NO_RUNTIME,
  PIERRE_WORKFLOW_PACK_SENSITIVE_BLOCKED,
  PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE,
  PIERRE_WORKFLOW_PACK_NEXT_P6_3,
  PIERRE_WORKFLOW_PACK_PANEL_GUARDRAIL,
  getPierreWorkflowPackStatusLabel,
  buildPierreWorkflowPackBadges,
} from "./pierre-real-workflow-completion-pack-ui-copy";

// ── Pierre Real Workflow Completion Pack QA (PHASE 6.2) ────────────────────────
export type {
  PierreWorkflowPackQaStepId,
  PierreWorkflowPackQaStepStatus,
  PierreWorkflowPackQaStepSeverity,
  PierreWorkflowPackQaStep,
  PierreWorkflowPackQaChecklist,
  PierreWorkflowPackQaVerdict,
  PierreWorkflowPackQaSummary,
} from "./pierre-real-workflow-completion-pack-qa";
export {
  buildPierreRealWorkflowCompletionPackQaChecklist,
  buildPierreRealWorkflowCompletionPackQaVerdict,
  getPierreRealWorkflowCompletionPackBlockingSteps,
  summarizePierreRealWorkflowCompletionPackQaVerdict,
} from "./pierre-real-workflow-completion-pack-qa";

// ── Pierre State/Server Activation Decision Gate Types (PHASE 6.3) ─────────────
// Decision gate — aucune activation. Recommande local-first controlled sale.
export type {
  PierreDecisionGatePhase,
  PierreDecisionGateStatus,
  PierreDecisionGateStrategy,
  PierreStateStrategyAppliesTo,
  PierreStateStrategyDecision,
  PierreStateStrategyItem,
  PierreDecisionGateApproval,
  PierreDecisionGateRisk,
  PierreDecisionGateDependencyItem,
  PierreStateServerActivationDecisionGate,
} from "./pierre-state-server-activation-decision-gate-types";

// ── Pierre State/Server Activation Decision Gate (PHASE 6.3) ───────────────────
export {
  buildPierreDecisionGateStrategyItems,
  buildPierreDecisionGateActivationConditions,
  buildPierreDecisionGateNoGoConditions,
  buildPierreDecisionGateApprovals,
  buildPierreDecisionGateRiskMatrix,
  buildPierreDecisionGateRollbackStrategy,
  buildPierreDecisionGateAuditTraceRequirements,
  buildPierreDecisionGateDependencyMap,
  buildPierreStateServerActivationDecisionGate,
  summarizePierreStateServerActivationDecisionGate,
} from "./pierre-state-server-activation-decision-gate";

// ── Pierre State/Server Activation Decision Gate UI Copy (PHASE 6.3) ───────────
export type {
  PierreDecisionGateBadgeTone,
  PierreDecisionGateBadge,
} from "./pierre-state-server-activation-decision-gate-ui-copy";
export {
  PIERRE_DECISION_GATE_TITLE,
  PIERRE_DECISION_GATE_VIEW_DECISION_LABEL,
  PIERRE_DECISION_GATE_VIEW_CONDITIONS_LABEL,
  PIERRE_DECISION_GATE_VIEW_NOGO_LABEL,
  PIERRE_DECISION_GATE_VIEW_APPROVALS_LABEL,
  PIERRE_DECISION_GATE_VIEW_ROLLBACK_LABEL,
  PIERRE_DECISION_GATE_VIEW_P6_LABEL,
  PIERRE_DECISION_GATE_MICROCOPY,
  PIERRE_DECISION_GATE_SALE_VS_LAUNCH,
  PIERRE_DECISION_GATE_RUNTIME_INACTIVE,
  PIERRE_DECISION_GATE_SERVER_INACTIVE,
  PIERRE_DECISION_GATE_NEXT_P6_4,
  PIERRE_DECISION_GATE_PANEL_GUARDRAIL,
  getPierreDecisionGateStatusLabel,
  getPierreDecisionGateStrategyLabel,
  getPierreDecisionGateDecisionLabel,
  buildPierreDecisionGateBadges,
} from "./pierre-state-server-activation-decision-gate-ui-copy";

// ── Pierre State/Server Activation Decision Gate QA (PHASE 6.3) ────────────────
export type {
  PierreDecisionGateQaStepId,
  PierreDecisionGateQaStepStatus,
  PierreDecisionGateQaStepSeverity,
  PierreDecisionGateQaStep,
  PierreDecisionGateQaChecklist,
  PierreDecisionGateQaVerdict,
  PierreDecisionGateQaSummary,
} from "./pierre-state-server-activation-decision-gate-qa";
export {
  buildPierreStateServerActivationDecisionGateQaChecklist,
  buildPierreStateServerActivationDecisionGateQaVerdict,
  getPierreStateServerActivationDecisionGateBlockingSteps,
  summarizePierreStateServerActivationDecisionGateQaVerdict,
} from "./pierre-state-server-activation-decision-gate-qa";

// ── Pierre Channels & Identity Final Types (PHASE 6.4) ─────────────────────────
// Readiness identity. Aucun email réel. Aucun domaine connecté. Brouillons uniquement.
export type {
  PierreIdentityPhase,
  PierreIdentityStatus,
  PierreIdentityMode,
  PierreDisplayIdentity,
  PierreChannelStatus,
  PierreChannelMatrixItem,
  PierreEmailIdentityStrategy,
  PierreDomainReadinessItem,
  PierreChannelCloneGuardDecision,
  PierrePermissionsRow,
  PierreDraftTemplate,
  PierreChannelsIdentityFinalReport,
} from "./pierre-channels-identity-final-types";

// ── Pierre Channels & Identity Final (PHASE 6.4) ───────────────────────────────
export {
  buildPierreDisplayIdentity,
  buildPierreChannelMatrix,
  buildPierreEmailIdentityStrategy,
  buildPierreDomainReadinessStrategy,
  buildPierrePermissionsMatrix,
  buildPierreDraftTemplateMatrix,
  buildPierreCloneGuardIdentityRules,
  buildPierreCloneTraceIdentityEvents,
  buildPierreChannelsIdentityFinalReport,
  summarizePierreChannelsIdentityFinalReport,
} from "./pierre-channels-identity-final";

// ── Pierre Channels & Identity Final UI Copy (PHASE 6.4) ───────────────────────
export type {
  PierreIdentityBadgeTone,
  PierreIdentityBadge,
} from "./pierre-channels-identity-final-ui-copy";
export {
  PIERRE_IDENTITY_TITLE,
  PIERRE_IDENTITY_VIEW_IDENTITY_LABEL,
  PIERRE_IDENTITY_VIEW_CHANNELS_LABEL,
  PIERRE_IDENTITY_VIEW_EMAIL_LABEL,
  PIERRE_IDENTITY_VIEW_PERMISSIONS_LABEL,
  PIERRE_IDENTITY_VIEW_TEMPLATES_LABEL,
  PIERRE_IDENTITY_VIEW_DOMAIN_LABEL,
  PIERRE_IDENTITY_MICROCOPY,
  PIERRE_IDENTITY_DRAFT_ONLY,
  PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED,
  PIERRE_IDENTITY_SALE_VS_EMAIL,
  PIERRE_IDENTITY_NEXT_P6_5,
  PIERRE_IDENTITY_PANEL_GUARDRAIL,
  getPierreIdentityStatusLabel,
  getPierreIdentityModeLabel,
  getPierreChannelStatusLabel,
  buildPierreIdentityBadges,
} from "./pierre-channels-identity-final-ui-copy";

// ── Pierre Channels & Identity Final QA (PHASE 6.4) ────────────────────────────
export type {
  PierreIdentityQaStepId,
  PierreIdentityQaStepStatus,
  PierreIdentityQaStepSeverity,
  PierreIdentityQaStep,
  PierreIdentityQaChecklist,
  PierreIdentityQaVerdict,
  PierreIdentityQaSummary,
} from "./pierre-channels-identity-final-qa";
export {
  buildPierreChannelsIdentityFinalQaChecklist,
  buildPierreChannelsIdentityFinalQaVerdict,
  getPierreChannelsIdentityFinalBlockingSteps,
  summarizePierreChannelsIdentityFinalQaVerdict,
} from "./pierre-channels-identity-final-qa";

// ── Pierre Customer Activation E2E Final Types (PHASE 6.5) ─────────────────────
// First paid customer proof path. Aucun paiement live. Aucune exécution autonome.
export type {
  PierreActivationPhase,
  PierreActivationStatus,
  PierreCustomerJourneyStep,
  PierreActivationPathStatus,
  PierreActivationPathItem,
  PierreFirstValuePath,
  PierreCustomerState,
  PierreAccessControlRow,
  PierreOnboardingHandoff,
  PierreScenarioEntryPoint,
  PierreFirstMissionFlowStep,
  PierreActivationEvidenceItem,
  PierreCustomerActivationE2EFinalReport,
} from "./pierre-customer-activation-e2e-final-types";

// ── Pierre Customer Activation E2E Final (PHASE 6.5) ───────────────────────────
export {
  buildPierreCustomerJourneySteps,
  buildPierreActivationPathMatrix,
  buildPierreFirstValuePath,
  buildPierreAccessControlMatrix,
  buildPierreOnboardingHandoff,
  buildPierreScenarioEntryPoints,
  buildPierreFirstMissionControlledFlow,
  buildPierreActivationTraceabilityRequirements,
  buildPierreActivationHumanValidationRequirements,
  buildPierreActivationCustomerVisibleLimits,
  buildPierreActivationEvidenceChecklist,
  buildPierreCustomerActivationE2EFinalReport,
  summarizePierreCustomerActivationE2EFinalReport,
} from "./pierre-customer-activation-e2e-final";

// ── Pierre Customer Activation E2E Final UI Copy (PHASE 6.5) ───────────────────
export type {
  PierreActivationBadgeTone,
  PierreActivationBadge,
} from "./pierre-customer-activation-e2e-final-ui-copy";
export {
  PIERRE_ACTIVATION_TITLE,
  PIERRE_ACTIVATION_VIEW_JOURNEY_LABEL,
  PIERRE_ACTIVATION_VIEW_FIRST_VALUE_LABEL,
  PIERRE_ACTIVATION_VIEW_ACCESS_LABEL,
  PIERRE_ACTIVATION_VIEW_SCENARIOS_LABEL,
  PIERRE_ACTIVATION_VIEW_EVIDENCE_LABEL,
  PIERRE_ACTIVATION_VIEW_BLOCKERS_LABEL,
  PIERRE_ACTIVATION_MICROCOPY,
  PIERRE_ACTIVATION_FIRST_VALUE,
  PIERRE_ACTIVATION_NO_AUTONOMOUS,
  PIERRE_ACTIVATION_STRIPE_FUTURE,
  PIERRE_ACTIVATION_NEXT_P6_6,
  PIERRE_ACTIVATION_PANEL_GUARDRAIL,
  getPierreActivationStatusLabel,
  getPierreActivationPathStatusLabel,
  buildPierreActivationBadges,
} from "./pierre-customer-activation-e2e-final-ui-copy";

// ── Pierre Customer Activation E2E Final QA (PHASE 6.5) ────────────────────────
export type {
  PierreActivationQaStepId,
  PierreActivationQaStepStatus,
  PierreActivationQaStepSeverity,
  PierreActivationQaStep,
  PierreActivationQaChecklist,
  PierreActivationQaVerdict,
  PierreActivationQaSummary,
} from "./pierre-customer-activation-e2e-final-qa";
export {
  buildPierreCustomerActivationE2EFinalQaChecklist,
  buildPierreCustomerActivationE2EFinalQaVerdict,
  getPierreCustomerActivationE2EFinalBlockingSteps,
  summarizePierreCustomerActivationE2EFinalQaVerdict,
} from "./pierre-customer-activation-e2e-final-qa";

// ── Pierre Sellable Gate Final Types (PHASE 6.6) ───────────────────────────────
export type {
  PierreSellableGatePhase,
  PierreSellableGateStatus,
  PierreSellabilityLevel,
  PierrePhaseMatrixStatus,
  PierreP6PhaseMatrixRow,
  PierreSellabilityVerdict,
  PierreSellabilityVerdictTier,
  PierreSellabilityVerdictRow,
  PierreEvidenceSummaryItem,
  PierreRiskSeverity,
  PierreRiskMatrixRow,
  PierreOperationalPlaybookStep,
  PierreOperatorChecklistItem,
  PierreSellableGateFinalReport,
} from "./pierre-sellable-gate-final-types";

// ── Pierre Sellable Gate Final (PHASE 6.6) ─────────────────────────────────────
export {
  buildPierreP6PhaseMatrix,
  buildPierreSellabilityVerdictMatrix,
  buildPierreSellableEvidenceSummary,
  buildPierreControlledSaleConditions,
  buildPierrePublicLaunchBlockers,
  buildPierreScaleBlockers,
  buildPierreCustomerPromiseAllowed,
  buildPierreCustomerPromiseForbidden,
  buildPierreOperationalPlaybook,
  buildPierreInternalOperatorChecklist,
  buildPierreSellableRiskMatrix,
  buildPierreSellableGateFinalReport,
  summarizePierreSellableGateFinalReport,
} from "./pierre-sellable-gate-final";

// ── Pierre Sellable Gate Final UI Copy (PHASE 6.6) ─────────────────────────────
export type {
  PierreGateBadgeTone,
  PierreGateBadge,
} from "./pierre-sellable-gate-final-ui-copy";
export {
  PIERRE_GATE_TITLE,
  PIERRE_GATE_VIEW_VERDICT_LABEL,
  PIERRE_GATE_VIEW_EVIDENCE_LABEL,
  PIERRE_GATE_VIEW_ALLOWED_LABEL,
  PIERRE_GATE_VIEW_FORBIDDEN_LABEL,
  PIERRE_GATE_VIEW_CONDITIONS_LABEL,
  PIERRE_GATE_VIEW_BLOCKERS_LABEL,
  PIERRE_GATE_VIEW_NEXT_LABEL,
  PIERRE_GATE_MICROCOPY,
  PIERRE_GATE_CONTROLLED_SELLABLE,
  PIERRE_GATE_NOT_PUBLIC,
  PIERRE_GATE_REMAINING,
  PIERRE_GATE_NEXT_PHASE,
  PIERRE_GATE_PANEL_GUARDRAIL,
  getPierreGateStatusLabel,
  getPierreSellabilityLevelLabel,
  getPierreSellabilityVerdictLabel,
  buildPierreGateBadges,
} from "./pierre-sellable-gate-final-ui-copy";

// ── Pierre Sellable Gate Final QA (PHASE 6.6) ──────────────────────────────────
export type {
  PierreGateQaStepId,
  PierreGateQaStepStatus,
  PierreGateQaStepSeverity,
  PierreGateQaStep,
  PierreGateQaChecklist,
  PierreGateQaVerdict,
  PierreGateQaSummary,
} from "./pierre-sellable-gate-final-qa";
export {
  buildPierreSellableGateFinalQaChecklist,
  buildPierreSellableGateFinalQaVerdict,
  getPierreSellableGateFinalBlockingSteps,
  summarizePierreSellableGateFinalQaVerdict,
} from "./pierre-sellable-gate-final-qa";

// ── External Go-Live Proofs Gate Types (PHASE 7.1) ─────────────────────────────
export type {
  ExternalGoLivePhase,
  ExternalGoLiveProofStatus,
  ExternalProofClassification,
  ExternalProofItemStatus,
  ExternalProofMatrixRow,
  ExternalManualStep,
  ExternalRollbackStep,
  FirstLiveCustomerReadiness,
  ExternalPublicLaunchVerdict,
  ExternalGoLiveProofsReport,
} from "./external-go-live-proofs-gate-types";

// ── External Go-Live Proofs Gate (PHASE 7.1) ───────────────────────────────────
export {
  buildStripeLiveMatrix,
  buildSupabaseProdRlsMatrix,
  buildDomainEmailMatrix,
  buildFirstLiveCustomerMatrix,
  buildExternalEvidenceRequired,
  buildExternalEvidenceCollected,
  buildExternalBlockers,
  buildExternalManualSteps,
  buildExternalRollbackPlan,
  buildExternalGoLiveProofsReport,
  summarizeExternalGoLiveProofsReport,
} from "./external-go-live-proofs-gate";

// ── External Go-Live Proofs Gate UI Copy (PHASE 7.1) ───────────────────────────
export type {
  ExternalGoLiveBadgeTone,
  ExternalGoLiveBadge,
} from "./external-go-live-proofs-gate-ui-copy";
export {
  EXTERNAL_GOLIVE_TITLE,
  EXTERNAL_GOLIVE_VIEW_STRIPE_LABEL,
  EXTERNAL_GOLIVE_VIEW_SUPABASE_LABEL,
  EXTERNAL_GOLIVE_VIEW_DOMAIN_LABEL,
  EXTERNAL_GOLIVE_VIEW_CUSTOMER_LABEL,
  EXTERNAL_GOLIVE_VIEW_MANUAL_LABEL,
  EXTERNAL_GOLIVE_VIEW_BLOCKERS_LABEL,
  EXTERNAL_GOLIVE_MICROCOPY,
  EXTERNAL_GOLIVE_NO_INVENTED,
  EXTERNAL_GOLIVE_NOT_PUBLIC,
  EXTERNAL_GOLIVE_MANUAL,
  EXTERNAL_GOLIVE_NEXT_PHASE,
  EXTERNAL_GOLIVE_PANEL_GUARDRAIL,
  getExternalGoLiveStatusLabel,
  getExternalProofClassificationLabel,
  getExternalPublicLaunchVerdictLabel,
  getFirstLiveCustomerReadinessLabel,
  buildExternalGoLiveBadges,
} from "./external-go-live-proofs-gate-ui-copy";

// ── External Go-Live Proofs Gate QA (PHASE 7.1) ────────────────────────────────
export type {
  ExternalGoLiveQaStepId,
  ExternalGoLiveQaStepStatus,
  ExternalGoLiveQaStepSeverity,
  ExternalGoLiveQaStep,
  ExternalGoLiveQaChecklist,
  ExternalGoLiveQaVerdict,
  ExternalGoLiveQaSummary,
} from "./external-go-live-proofs-gate-qa";
export {
  buildExternalGoLiveProofsQaChecklist,
  buildExternalGoLiveProofsQaVerdict,
  getExternalGoLiveProofsBlockingSteps,
  summarizeExternalGoLiveProofsQaVerdict,
} from "./external-go-live-proofs-gate-qa";

// ── First Live Customer Controlled Run Types (PHASE 7.2) ───────────────────────
export type {
  FirstLiveCustomerPhase,
  FirstLiveCustomerRunStatus,
  FirstCustomerRiskLevel,
  CustomerQualificationItem,
  ActivationRunbookStep,
  SetupRunbookItem,
  FirstMissionScenario,
  EvidenceCollectionItem,
  OperatorResponsibility,
  RollbackStep,
  PublicLaunchImpact,
  GoLiveProofUpdatesPolicy,
  FirstLiveCustomerControlledRunReport,
} from "./first-live-customer-controlled-run-types";

// ── First Live Customer Controlled Run (PHASE 7.2) ─────────────────────────────
export {
  buildCustomerQualificationMatrix,
  buildPreSaleConditions,
  buildLegalAndCommercialLimits,
  buildActivationRunbook,
  buildSetupRunbook,
  buildFirstMissionRunbook,
  buildEvidenceCollectionPlan,
  buildCustomerFeedbackPlan,
  buildOperatorResponsibilities,
  buildNoGoConditions,
  buildFirstCustomerRollbackPlan,
  buildPublicLaunchImpact,
  buildGoLiveProofUpdatesPolicy,
  buildFirstLiveCustomerControlledRunReport,
  summarizeFirstLiveCustomerControlledRunReport,
} from "./first-live-customer-controlled-run";

// ── First Live Customer Controlled Run UI Copy (PHASE 7.2) ─────────────────────
export type {
  FlcBadgeTone,
  FlcBadge,
} from "./first-live-customer-controlled-run-ui-copy";
export {
  FLC_TITLE,
  FLC_VIEW_QUALIFICATION_LABEL,
  FLC_VIEW_RUNBOOK_LABEL,
  FLC_VIEW_EVIDENCE_LABEL,
  FLC_VIEW_NOGO_LABEL,
  FLC_VIEW_ROLLBACK_LABEL,
  FLC_VIEW_NEXT_LABEL,
  FLC_MICROCOPY,
  FLC_NOT_PUBLIC,
  FLC_NO_INVENTED,
  FLC_GO_LIVE_MANUAL,
  FLC_NEXT_PHASE,
  FLC_PANEL_GUARDRAIL,
  getFlcRunStatusLabel,
  getFlcRiskLabel,
  buildFlcBadges,
} from "./first-live-customer-controlled-run-ui-copy";

// ── First Live Customer Controlled Run QA (PHASE 7.2) ──────────────────────────
export type {
  FlcQaStepId,
  FlcQaStepStatus,
  FlcQaStepSeverity,
  FlcQaStep,
  FlcQaChecklist,
  FlcQaVerdict,
  FlcQaSummary,
} from "./first-live-customer-controlled-run-qa";
export {
  buildFirstLiveCustomerControlledRunQaChecklist,
  buildFirstLiveCustomerControlledRunQaVerdict,
  getFirstLiveCustomerControlledRunBlockingSteps,
  summarizeFirstLiveCustomerControlledRunQaVerdict,
} from "./first-live-customer-controlled-run-qa";

// ── First Customer Evidence Review Types (PHASE 7.3) ───────────────────────────
export type {
  FirstCustomerEvidencePhase,
  EvidenceReviewStatus,
  EvidenceCategory,
  EvidenceItemStatus,
  EvidenceReviewItem,
  EvidenceQualityDimension,
  EvidenceQualityScore,
  PublicLaunchDecisionGate,
  GoLiveProofUpdateRecommendation,
  CustomerContinuationDecision,
  CustomerContinuationRecommendation,
  PostRunDecisionRow,
  FirstCustomerEvidenceReviewReport,
} from "./first-customer-evidence-review-types";

// ── First Customer Evidence Review (PHASE 7.3) ─────────────────────────────────
export {
  buildEvidenceReviewMatrix,
  buildRequiredEvidenceCategories,
  buildVerificationRules,
  buildSuccessCriteria,
  buildFailureCriteria,
  buildPartialSuccessCriteria,
  buildEvidenceQualityScores,
  buildPublicLaunchDecisionGate,
  buildGoLiveProofUpdateRecommendation,
  buildCustomerContinuationRecommendation,
  buildOperatorReviewChecklist,
  buildLegalCommercialReviewChecklist,
  buildTechnicalReviewChecklist,
  buildPostRunDecisionMatrix,
  buildFirstCustomerEvidenceReviewReport,
  summarizeFirstCustomerEvidenceReviewReport,
} from "./first-customer-evidence-review";

// ── First Customer Evidence Review UI Copy (PHASE 7.3) ─────────────────────────
export type {
  FcerBadgeTone,
  FcerBadge,
} from "./first-customer-evidence-review-ui-copy";
export {
  FCER_TITLE,
  FCER_VIEW_MATRIX_LABEL,
  FCER_VIEW_RULES_LABEL,
  FCER_VIEW_CRITERIA_LABEL,
  FCER_VIEW_LAUNCH_GATE_LABEL,
  FCER_VIEW_GOLIVE_LABEL,
  FCER_VIEW_DECISION_LABEL,
  FCER_MICROCOPY,
  FCER_NO_AUTO_VALIDATION,
  FCER_NOT_PUBLIC,
  FCER_GO_LIVE_MANUAL,
  FCER_NEXT_PHASE,
  FCER_PANEL_GUARDRAIL,
  getEvidenceReviewStatusLabel,
  getEvidenceCategoryLabel,
  buildFcerBadges,
} from "./first-customer-evidence-review-ui-copy";

// ── First Customer Evidence Review QA (PHASE 7.3) ──────────────────────────────
export type {
  FcerQaStepId,
  FcerQaStepStatus,
  FcerQaStepSeverity,
  FcerQaStep,
  FcerQaChecklist,
  FcerQaVerdict,
  FcerQaSummary,
} from "./first-customer-evidence-review-qa";
export {
  buildFirstCustomerEvidenceReviewQaChecklist,
  buildFirstCustomerEvidenceReviewQaVerdict,
  getFirstCustomerEvidenceReviewBlockingSteps,
  summarizeFirstCustomerEvidenceReviewQaVerdict,
} from "./first-customer-evidence-review-qa";

// ── Customer Evidence Applied / Second Customer Types (PHASE 7.4) ───────────────
export type {
  CustomerEvidenceAppliedPhase,
  EvidenceApplicationStatus,
  AppliedEvidenceCategory,
  ReviewedEvidenceApplicationItem,
  UnappliedEvidenceCategory,
  GoLiveContributionRow,
  FirstCustomerContinuationDecision,
  FirstCustomerContinuationPlan,
  SecondCustomerPreparationItem,
  MultiCustomerEvidenceBase,
  PublicLaunchSafetyGate,
  SecondCustomerRunbookStep,
  CustomerEvidenceAppliedSecondCustomerReport,
} from "./customer-evidence-applied-second-customer-types";

// ── Customer Evidence Applied / Second Customer (PHASE 7.4) ─────────────────────
export {
  buildReviewedEvidenceApplicationMatrix,
  buildAppliedEvidenceCategories,
  buildUnappliedEvidenceCategories,
  buildGoLiveContributionMatrix,
  buildFirstCustomerContinuationPlan,
  buildSecondCustomerPreparationMatrix,
  buildSecondCustomerSelectionCriteria,
  buildMultiCustomerEvidenceBase,
  buildCustomer1VsCustomer2ComparisonPlan,
  buildPublicLaunchSafetyGate,
  buildEvidenceApplicationRules,
  buildOperatorApplyChecklist,
  buildSecondCustomerRunbook,
  buildCustomerEvidenceAppliedSecondCustomerReport,
  summarizeCustomerEvidenceAppliedSecondCustomerReport,
} from "./customer-evidence-applied-second-customer";

// ── Customer Evidence Applied / Second Customer UI Copy (PHASE 7.4) ─────────────
export type {
  CeaBadgeTone,
  CeaBadge,
} from "./customer-evidence-applied-second-customer-ui-copy";
export {
  CEA_TITLE,
  CEA_VIEW_APPLICATION_LABEL,
  CEA_VIEW_CONTRIBUTION_LABEL,
  CEA_VIEW_SECOND_CUSTOMER_LABEL,
  CEA_VIEW_COMPARISON_LABEL,
  CEA_VIEW_SAFETY_GATE_LABEL,
  CEA_VIEW_RUNBOOK_LABEL,
  CEA_MICROCOPY,
  CEA_NO_APPLY_WITHOUT_REAL,
  CEA_NOT_PUBLIC,
  CEA_GO_LIVE_MANUAL,
  CEA_NEXT_PHASE,
  CEA_PANEL_GUARDRAIL,
  getEvidenceApplicationStatusLabel,
  getAppliedEvidenceCategoryLabel,
  buildCeaBadges,
} from "./customer-evidence-applied-second-customer-ui-copy";

// ── Customer Evidence Applied / Second Customer QA (PHASE 7.4) ──────────────────
export type {
  CeaQaStepId,
  CeaQaStepStatus,
  CeaQaStepSeverity,
  CeaQaStep,
  CeaQaChecklist,
  CeaQaVerdict,
  CeaQaSummary,
} from "./customer-evidence-applied-second-customer-qa";
export {
  buildCustomerEvidenceAppliedSecondCustomerQaChecklist,
  buildCustomerEvidenceAppliedSecondCustomerQaVerdict,
  getCustomerEvidenceAppliedSecondCustomerBlockingSteps,
  summarizeCustomerEvidenceAppliedSecondCustomerQaVerdict,
} from "./customer-evidence-applied-second-customer-qa";

// ── Second Customer Controlled Run / Public Launch Prep Types (PHASE 7.5) ───────
export type {
  SecondCustomerPhase,
  SecondCustomerRunStatus,
  SecondCustomerRiskLevel,
  SecondCustomerQualificationItem,
  SecondCustomerActivationStep,
  SecondCustomerSetupItem,
  SecondCustomerScenario,
  SecondCustomerEvidenceItem,
  CustomerComparisonAxis,
  ReproducibilityDimension,
  ReproducibilityScore,
  MultiCustomerEvidenceReadiness,
  PublicLaunchReviewPrep,
  PublicLaunchReviewInput,
  SecondCustomerRollbackStep,
  SecondCustomerControlledRunPublicLaunchPrepReport,
} from "./second-customer-controlled-run-public-launch-prep-types";

// ── Second Customer Controlled Run / Public Launch Prep (PHASE 7.5) ─────────────
export {
  buildSecondCustomerQualificationMatrix,
  buildSecondCustomerPreSaleConditions,
  buildSecondCustomerActivationRunbook,
  buildSecondCustomerSetupRunbook,
  buildSecondCustomerScenarioMatrix,
  buildSecondCustomerEvidencePlan,
  buildCustomer1VsCustomer2ComparisonMatrix,
  buildReproducibilityAssessment,
  buildMultiCustomerEvidenceReadiness,
  buildPublicLaunchReviewPrep,
  buildPublicLaunchBlockerMatrix,
  buildPublicLaunchReviewInputs,
  buildSecondCustomerOperatorChecklist,
  buildSecondCustomerRollbackPlan,
  buildSecondCustomerControlledRunPublicLaunchPrepReport,
  summarizeSecondCustomerControlledRunPublicLaunchPrepReport,
} from "./second-customer-controlled-run-public-launch-prep";

// ── Second Customer Controlled Run / Public Launch Prep UI Copy (PHASE 7.5) ─────
export type {
  Sc2BadgeTone,
  Sc2Badge,
} from "./second-customer-controlled-run-public-launch-prep-ui-copy";
export {
  SC2_TITLE,
  SC2_VIEW_QUALIFICATION_LABEL,
  SC2_VIEW_RUNBOOK_LABEL,
  SC2_VIEW_EVIDENCE_LABEL,
  SC2_VIEW_COMPARISON_LABEL,
  SC2_VIEW_REPRODUCIBILITY_LABEL,
  SC2_VIEW_LAUNCH_PREP_LABEL,
  SC2_MICROCOPY,
  SC2_NOT_STARTED,
  SC2_MULTI_UNPROVEN,
  SC2_NOT_PUBLIC,
  SC2_NEXT_PHASE,
  SC2_PANEL_GUARDRAIL,
  getSc2RunStatusLabel,
  getSc2RiskLabel,
  buildSc2Badges,
} from "./second-customer-controlled-run-public-launch-prep-ui-copy";

// ── Second Customer Controlled Run / Public Launch Prep QA (PHASE 7.5) ──────────
export type {
  Sc2QaStepId,
  Sc2QaStepStatus,
  Sc2QaStepSeverity,
  Sc2QaStep,
  Sc2QaChecklist,
  Sc2QaVerdict,
  Sc2QaSummary,
} from "./second-customer-controlled-run-public-launch-prep-qa";
export {
  buildSecondCustomerControlledRunPublicLaunchPrepQaChecklist,
  buildSecondCustomerControlledRunPublicLaunchPrepQaVerdict,
  getSecondCustomerControlledRunPublicLaunchPrepBlockingSteps,
  summarizeSecondCustomerControlledRunPublicLaunchPrepQaVerdict,
} from "./second-customer-controlled-run-public-launch-prep-qa";

// ── Public Launch Final Review Gate Types (PHASE 7.6) ──────────────────────────
export type {
  PublicLaunchFinalReviewPhase,
  PublicLaunchReviewStatus,
  Phase7CompletionRow,
  FinalControlledFirstCustomerVerdict,
  FinalControlledSecondCustomerVerdict,
  FinalPublicLaunchVerdict,
  FinalScale80kVerdict,
  FinalProductSellabilityVerdict,
  ExternalProofFinalItem,
  CustomerEvidenceFinalItem,
  LegalCommercialFinalItem,
  TechnicalOperationsFinalItem,
  PublicLaunchScorecardDimension,
  PublicLaunchScorecardItem,
  ImmediateOperationalAction,
  FinalPublicLaunchDecision,
  Phase7ClosureVerdict,
  PublicLaunchFinalReviewGateReport,
} from "./public-launch-final-review-gate-types";

// ── Public Launch Final Review Gate (PHASE 7.6) ────────────────────────────────
export {
  buildPhase7CompletionMatrix,
  buildFinalProductSellabilityVerdict,
  buildExternalProofFinalMatrix,
  buildCustomerEvidenceFinalMatrix,
  buildLegalCommercialFinalMatrix,
  buildTechnicalOperationsFinalMatrix,
  buildPublicLaunchScorecard,
  buildBlockingConditions,
  buildConditionalGoRequirements,
  buildAllowedProductClaims,
  buildForbiddenProductClaims,
  buildImmediateOperationalActions,
  buildRollbackRequirements,
  buildFinalPublicLaunchDecision,
  buildPhase7ClosureVerdict,
  buildPublicLaunchFinalReviewGateReport,
  summarizePublicLaunchFinalReviewGateReport,
} from "./public-launch-final-review-gate";

// ── Public Launch Final Review Gate UI Copy (PHASE 7.6) ────────────────────────
export type {
  PlfBadgeTone,
  PlfBadge,
} from "./public-launch-final-review-gate-ui-copy";
export {
  PLF_TITLE,
  PLF_VIEW_VERDICT_LABEL,
  PLF_VIEW_BLOCKERS_LABEL,
  PLF_VIEW_PROOFS_LABEL,
  PLF_VIEW_CLAIMS_LABEL,
  PLF_VIEW_ACTIONS_LABEL,
  PLF_VIEW_CLOSURE_LABEL,
  PLF_MICROCOPY,
  PLF_INTERNAL_VS_EXTERNAL,
  PLF_SELLABLE_LIMITS,
  PLF_NOT_PUBLIC,
  PLF_NEXT_REAL,
  PLF_PANEL_GUARDRAIL,
  getPlfReviewStatusLabel,
  getPlfScorecardDimensionLabel,
  buildPlfBadges,
} from "./public-launch-final-review-gate-ui-copy";

// ── Public Launch Final Review Gate QA (PHASE 7.6) ─────────────────────────────
export type {
  PlfQaStepId,
  PlfQaStepStatus,
  PlfQaStepSeverity,
  PlfQaStep,
  PlfQaChecklist,
  PlfQaVerdict,
  PlfQaSummary,
} from "./public-launch-final-review-gate-qa";
export {
  buildPublicLaunchFinalReviewGateQaChecklist,
  buildPublicLaunchFinalReviewGateQaVerdict,
  getPublicLaunchFinalReviewGateBlockingSteps,
  summarizePublicLaunchFinalReviewGateQaVerdict,
} from "./public-launch-final-review-gate-qa";
