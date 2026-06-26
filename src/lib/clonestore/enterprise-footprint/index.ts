// src/lib/clonestore/enterprise-footprint/index.ts
// PHASE 3.8 — Empreinte Entreprise Read/Write QA — Point d'entrée
//
// Exporte tous les types, mappers, validators, helpers, flags et QA
// de la couche Empreinte Entreprise.
//
// Usage :
//   import {
//     mapGlobalOnboardingDraftToEnterpriseFootprint,
//     saveEnterpriseFootprintToLocalStorage,
//     ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY,
//   } from "@/lib/clonestore/enterprise-footprint";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  EnterpriseFootprintStatus,
  EnterpriseFootprintSource,
  EnterpriseFootprintPersistenceMode,
  EnterpriseFootprintCompanyIdentity,
  EnterpriseFootprintHumanRole,
  EnterpriseFootprintApprovalRule,
  EnterpriseFootprintDocumentReference,
  EnterpriseFootprintTechnologyStatus,
  EnterpriseFootprintCloneADNSummary,
  EnterpriseFootprintReadinessScore,
  EnterpriseFootprintValidationIssue,
  EnterpriseFootprintValidationReport,
  EnterpriseFootprintPersistablePayload,
  EnterpriseFootprintReadResult,
  EnterpriseFootprintWriteResult,
  EnterpriseFootprintReadWriteQaStepId,
  EnterpriseFootprintReadWriteQaStepStatus,
  EnterpriseFootprintReadWriteQaStep,
  EnterpriseFootprintReadWriteQaVerdict,
  EnterpriseFootprint,
} from "./enterprise-footprint-types";

export {
  ENTERPRISE_FOOTPRINT_TABLE_NAME,
  ENTERPRISE_FOOTPRINT_UNSAFE_PATTERNS,
  ENTERPRISE_FOOTPRINT_REDACT_KEYS,
} from "./enterprise-footprint-types";

// ── Defaults ──────────────────────────────────────────────────────────────────
export {
  ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY,
  buildDefaultEnterpriseFootprintCompanyIdentity,
  buildEnterpriseFootprintReadinessScore,
  buildEmptyEnterpriseFootprint,
  buildDemoEnterpriseFootprint,
} from "./enterprise-footprint-defaults";

// ── Mappers ───────────────────────────────────────────────────────────────────
export {
  redactEnterpriseFootprintMetadata,
  computeEnterpriseFootprintReadiness,
  computeEnterpriseFootprintMissingItems,
  summarizeEnterpriseFootprint,
  mapGlobalOnboardingDraftToEnterpriseFootprint,
  mapEnterpriseFootprintToGlobalOnboardingDraft,
  mapEnterpriseFootprintToGlobalEnterpriseMemory,
  mapGlobalEnterpriseMemoryToEnterpriseFootprint,
  buildEnterpriseFootprintFromOnboardingAndCloneADN,
} from "./enterprise-footprint-mappers";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  detectUnsafeEnterpriseFootprintWording,
  sanitizeEnterpriseFootprint,
  assertEnterpriseFootprintNoSensitiveLeak,
  validateEnterpriseFootprint,
  validateEnterpriseFootprintPersistablePayload,
} from "./enterprise-footprint-validation";

// ── LocalStorage ──────────────────────────────────────────────────────────────
export {
  loadEnterpriseFootprintFromLocalStorage,
  saveEnterpriseFootprintToLocalStorage,
  clearEnterpriseFootprintLocalStorage,
  migrateLegacyEnterpriseFootprintPayload,
  normalizeEnterpriseFootprintPayload,
} from "./enterprise-footprint-localstorage";

// ── Flags ─────────────────────────────────────────────────────────────────────
export {
  ENTERPRISE_FOOTPRINT_PERSISTENCE_ENV_KEY,
  ENTERPRISE_FOOTPRINT_ACTIVATION_STEPS,
  isEnterpriseFootprintServerPersistenceEnabled,
  getEnterpriseFootprintPersistenceMode,
  explainEnterpriseFootprintPersistenceMode,
} from "./enterprise-footprint-flags";

// ── Storage design (PHASE 3.9+) ───────────────────────────────────────────────
// Non activé depuis l'UI en PHASE 3.8. Table SQL non encore créée.
export {
  buildEnterpriseFootprintPersistablePayload,
  canPersistEnterpriseFootprint,
  persistEnterpriseFootprintSafely,
} from "./enterprise-footprint-storage";

// ── Read/Write QA (PHASE 3.8) ─────────────────────────────────────────────────
export type {
  EnterpriseFootprintReadWriteQaChecklist,
  EnterpriseFootprintReadWriteQaSummary,
} from "./enterprise-footprint-readwrite-qa";

export {
  buildEnterpriseFootprintReadWriteQaChecklist,
  buildEnterpriseFootprintReadWriteQaVerdict,
  getEnterpriseFootprintReadWriteBlockingSteps,
  summarizeEnterpriseFootprintReadWriteQaVerdict,
} from "./enterprise-footprint-readwrite-qa";

// ── Cockpit bridge (PHASE 3.9) ────────────────────────────────────────────────
// localStorage-only — pas de Supabase, pas de DB write.
export type {
  EnterpriseFootprintCockpitStatus,
  EnterpriseFootprintCockpitSource,
  EnterpriseFootprintCockpitSummary,
  EnterpriseFootprintCockpitCard,
  EnterpriseFootprintCockpitAction,
  EnterpriseFootprintCockpitReadResult,
} from "./enterprise-footprint-cockpit";

export {
  getEnterpriseFootprintCockpitStatusLabel,
  getEnterpriseFootprintCockpitSourceLabel,
  buildEmptyEnterpriseFootprintCockpitState,
  buildEnterpriseFootprintCockpitSummary,
  buildEnterpriseFootprintCockpitCards,
  buildEnterpriseFootprintCockpitActions,
  loadEnterpriseFootprintForCockpit,
} from "./enterprise-footprint-cockpit";

// ── Pierre Handoff Design (PHASE 3.9) ─────────────────────────────────────────
// Design uniquement — Pierre sera branché en PHASE 3.10+.
// Pas d'import src/lib/pierre.
export type {
  PierreEnterpriseFootprintContextRisk,
  PierreEnterpriseFootprintContextReadiness,
  PierreEnterpriseFootprintContext,
} from "./enterprise-footprint-pierre-handoff";

export {
  buildPierreEnterpriseFootprintContext,
  summarizePierreEnterpriseFootprintContext,
  validatePierreEnterpriseFootprintContext,
} from "./enterprise-footprint-pierre-handoff";

// ── Cockpit QA (PHASE 3.9) ────────────────────────────────────────────────────
export type {
  EnterpriseFootprintCockpitQaStepId,
  EnterpriseFootprintCockpitQaStep,
  EnterpriseFootprintCockpitQaVerdict,
  EnterpriseFootprintCockpitQaChecklist,
  EnterpriseFootprintCockpitQaSummary,
} from "./enterprise-footprint-cockpit-qa";

export {
  buildEnterpriseFootprintCockpitQaChecklist,
  buildEnterpriseFootprintCockpitQaVerdict,
  getEnterpriseFootprintCockpitBlockingSteps,
  summarizeEnterpriseFootprintCockpitQaVerdict,
} from "./enterprise-footprint-cockpit-qa";

// ── Pierre Setup Bridge (PHASE 3.10) ──────────────────────────────────────────
// localStorage-only — pas de Supabase, pas d'import src/lib/pierre, pas de runtime.
export type {
  PierreSetupFootprintStatus,
  PierreSetupFootprintSource,
  PierreSetupFootprintSummary,
  PierreSetupFootprintCard,
  PierreSetupFootprintRecommendation,
  PierreSetupFootprintAction,
  PierreSetupFootprintReadResult,
} from "./enterprise-footprint-pierre-setup";

export {
  getPierreSetupFootprintStatusLabel,
  getPierreSetupFootprintRiskLabel,
  getPierreSetupFootprintReadinessLabel,
  buildEmptyPierreSetupFootprintState,
  buildPierreSetupFootprintSummary,
  buildPierreSetupFootprintCards,
  buildPierreSetupFootprintRecommendations,
  buildPierreSetupFootprintActions,
  loadPierreSetupEnterpriseFootprint,
} from "./enterprise-footprint-pierre-setup";

// ── Pierre Setup QA (PHASE 3.10) ──────────────────────────────────────────────
export type {
  PierreSetupFootprintQaStepId,
  PierreSetupFootprintQaStep,
  PierreSetupFootprintQaVerdict,
  PierreSetupFootprintQaChecklist,
  PierreSetupFootprintQaSummary,
} from "./enterprise-footprint-pierre-setup-qa";

export {
  buildPierreSetupFootprintQaChecklist,
  buildPierreSetupFootprintQaVerdict,
  getPierreSetupFootprintBlockingSteps,
  summarizePierreSetupFootprintQaVerdict,
} from "./enterprise-footprint-pierre-setup-qa";

// ── Pierre Use Bridge (PHASE 3.11) ────────────────────────────────────────────
// localStorage-only — pas de Supabase, pas d'import src/lib/pierre, pas de runtime.
// suggestions plan_only: true — jamais d'auto-submit.
export type {
  PierreUseFootprintStatus,
  PierreUseFootprintSource,
  PierreUseFootprintSummary,
  PierreUseFootprintCard,
  PierreUseFootprintWarning,
  PierreUseFootprintMissionSuggestion,
  PierreUseFootprintAction,
  PierreUseFootprintReadResult,
} from "./enterprise-footprint-pierre-use";

export {
  getPierreUseFootprintStatusLabel,
  getPierreUseFootprintRiskLabel,
  getPierreUseFootprintReadinessLabel,
  buildEmptyPierreUseFootprintState,
  buildPierreUseFootprintSummary,
  buildPierreUseFootprintCards,
  buildPierreUseFootprintWarnings,
  buildPierreUseFootprintMissionSuggestions,
  buildPierreUseFootprintActions,
  loadPierreUseEnterpriseFootprint,
} from "./enterprise-footprint-pierre-use";

// ── Pierre Use QA (PHASE 3.11) ────────────────────────────────────────────────
export type {
  PierreUseFootprintQaStepId,
  PierreUseFootprintQaStep,
  PierreUseFootprintQaVerdict,
  PierreUseFootprintQaChecklist,
  PierreUseFootprintQaSummary,
} from "./enterprise-footprint-pierre-use-qa";

export {
  buildPierreUseFootprintQaChecklist,
  buildPierreUseFootprintQaVerdict,
  getPierreUseFootprintBlockingSteps,
  summarizePierreUseFootprintQaVerdict,
} from "./enterprise-footprint-pierre-use-qa";

// ── Pierre Prefill (PHASE 3.12) ───────────────────────────────────────────────
// Helper pur — préremplissage du composer Pierre depuis suggestions Empreinte.
// plan_only: true invariant. requires_user_submit: true invariant. Aucun auto-submit.
export type {
  PierreFootprintPrefillSource,
  PierreFootprintPrefillStatus,
  PierreFootprintPrefillPayload,
  PierreFootprintPrefillGuard,
  PierreFootprintPrefillResult,
  PierreFootprintPrefillConfirmation,
} from "./enterprise-footprint-pierre-prefill";

export {
  shouldAllowPierreFootprintPrefill,
  explainPierreFootprintPrefillDisabled,
  buildPierreFootprintPrefillPayload,
  validatePierreFootprintPrefillPayload,
  sanitizePierreFootprintPrefillPrompt,
  buildPierreFootprintPrefillConfirmation,
} from "./enterprise-footprint-pierre-prefill";

// ── Pierre Prefill QA (PHASE 3.12) ────────────────────────────────────────────
export type {
  PierreFootprintPrefillQaStepId,
  PierreFootprintPrefillQaStep,
  PierreFootprintPrefillQaVerdict,
  PierreFootprintPrefillQaChecklist,
  PierreFootprintPrefillQaSummary,
} from "./enterprise-footprint-pierre-prefill-qa";

export {
  buildPierreFootprintPrefillQaChecklist,
  buildPierreFootprintPrefillQaVerdict,
  getPierreFootprintPrefillBlockingSteps,
  summarizePierreFootprintPrefillQaVerdict,
} from "./enterprise-footprint-pierre-prefill-qa";

// ── Server Persistence Types (PHASE 3.13) ─────────────────────────────────────
// Design-only — table non encore créée. localStorage reste le fallback actif.
export type {
  EnterpriseFootprintServerStatus,
  EnterpriseFootprintServerSource,
  EnterpriseFootprintServerPersistenceMode,
  EnterpriseFootprintServerRow,
  EnterpriseFootprintServerPayload,
  EnterpriseFootprintServerReadResult,
  EnterpriseFootprintServerWriteResult,
  EnterpriseFootprintServerHealth,
  EnterpriseFootprintServerSyncDirection,
  EnterpriseFootprintServerSyncPlan,
  EnterpriseFootprintServerConflictResolution,
} from "./enterprise-footprint-server-types";

// ── Server Schema (PHASE 3.13) ────────────────────────────────────────────────
export {
  ENTERPRISE_FOOTPRINT_SERVER_TABLE,
  ENTERPRISE_FOOTPRINT_SERVER_COLUMNS,
  ENTERPRISE_FOOTPRINT_SERVER_RLS_POLICIES,
  ENTERPRISE_FOOTPRINT_SERVER_VALID_STATUSES,
  ENTERPRISE_FOOTPRINT_SERVER_VALID_SOURCES,
  buildEnterpriseFootprintServerExpectedColumns,
  buildEnterpriseFootprintServerRlsPolicyNames,
  explainEnterpriseFootprintServerSchema,
} from "./enterprise-footprint-server-schema";

export type {
  EnterpriseFootprintServerColumnName,
} from "./enterprise-footprint-server-schema";

// ── Server Flags (PHASE 3.13) ─────────────────────────────────────────────────
// Note : isEnterpriseFootprintServerPersistenceEnabled est déjà exporté
// depuis enterprise-footprint-flags (P3.8) — on n'exporte que les nouveaux identifiants.
export {
  ENTERPRISE_FOOTPRINT_SERVER_ENV_KEY,
  ENTERPRISE_FOOTPRINT_SERVER_ACTIVATION_STEPS,
  getEnterpriseFootprintServerPersistenceMode,
  explainEnterpriseFootprintServerPersistenceMode,
} from "./enterprise-footprint-server-flags";

// ── Server Mappers (PHASE 3.13) ───────────────────────────────────────────────
export {
  redactEnterpriseFootprintServerMetadata,
  mapEnterpriseFootprintToServerPayload,
  mapEnterpriseFootprintToServerRowInsert,
  mapEnterpriseFootprintServerRowToFootprint,
  mergeEnterpriseFootprintLocalAndServer,
  chooseLatestEnterpriseFootprint,
  buildEnterpriseFootprintServerSyncPlan,
  getExpectedServerTable,
} from "./enterprise-footprint-server-mappers";

// ── Server Validation (PHASE 3.13) ────────────────────────────────────────────
export {
  detectUnsafeEnterpriseFootprintServerText,
  validateEnterpriseFootprintServerPayload,
  validateEnterpriseFootprintServerRow,
  sanitizeEnterpriseFootprintServerPayload,
  assertEnterpriseFootprintServerNoSensitiveLeak,
} from "./enterprise-footprint-server-validation";

export type {
  EnterpriseFootprintServerValidationResult,
  EnterpriseFootprintServerLeakCheckResult,
} from "./enterprise-footprint-server-validation";

// ── Server Read-Only Client (PHASE 3.13) ──────────────────────────────────────
export {
  sortEnterpriseFootprintServerRows,
  mapEnterpriseFootprintServerReadResult,
  loadEnterpriseFootprintServerReadOnly,
  loadLatestEnterpriseFootprintServerReadOnly,
} from "./enterprise-footprint-server-readonly-client";

// ── Server Storage Design (PHASE 3.13) ───────────────────────────────────────
// Design-only — non appelé depuis UI en PHASE 3.13.
// Activation en PHASE 3.14 après SQL + RLS validés.
export {
  buildEnterpriseFootprintServerPersistablePayload,
  canPersistEnterpriseFootprintServer,
  persistEnterpriseFootprintServerSafely,
  upsertEnterpriseFootprintServerDraftSafely,
} from "./enterprise-footprint-server-storage";

// ── Server Health (PHASE 3.13) ────────────────────────────────────────────────
export {
  checkEnterpriseFootprintServerTableReadiness,
  buildEnterpriseFootprintServerHealthReport,
  isEnterpriseFootprintServerTableMissingError,
  isEnterpriseFootprintServerRlsError,
} from "./enterprise-footprint-server-health";

// ── Safe Apply Types (PHASE 3.14) ─────────────────────────────────────────────
export type {
  EnterpriseFootprintSafeApplyMode,
  EnterpriseFootprintSafeApplyUiStatus,
  EnterpriseFootprintSafeApplyStatus,
  EnterpriseFootprintSafeApplyOutcome,
  EnterpriseFootprintSafeRestoreStatus,
  EnterpriseFootprintSafeRestoreOutcome,
  EnterpriseFootprintSafeApplyOptions,
  EnterpriseFootprintSafeRestoreOptions,
  EnterpriseFootprintSafeApplyResult,
  EnterpriseFootprintSafeRestoreResult,
  EnterpriseFootprintSafeApplyConfirmation,
} from "./enterprise-footprint-safe-apply-types";

// ── Safe Apply Runtime (PHASE 3.14) ──────────────────────────────────────────
// localStorage-first · feature-flaggé · health-check avant write · no service role
export {
  shouldAttemptEnterpriseFootprintServerSync,
  persistEnterpriseFootprintWithFallback,
  restoreEnterpriseFootprintWithFallback,
  buildEnterpriseFootprintSafeApplyUiStatus,
  buildEnterpriseFootprintSafeApplyConfirmation,
  explainEnterpriseFootprintSafeApplyResult,
} from "./enterprise-footprint-safe-apply-runtime";

// ── Safe Apply QA (PHASE 3.14) ────────────────────────────────────────────────
export type {
  EnterpriseFootprintSafeApplyQaStepId,
  EnterpriseFootprintSafeApplyQaStep,
  EnterpriseFootprintSafeApplyQaVerdict,
  EnterpriseFootprintSafeApplyQaChecklist,
  EnterpriseFootprintSafeApplyQaSummary,
} from "./enterprise-footprint-safe-apply-qa";

export {
  buildEnterpriseFootprintSafeApplyQaChecklist,
  buildEnterpriseFootprintSafeApplyQaVerdict,
  getEnterpriseFootprintSafeApplyBlockingSteps,
  summarizeEnterpriseFootprintSafeApplyQaVerdict,
} from "./enterprise-footprint-safe-apply-qa";

// ── API Client (PHASE 3.14) ───────────────────────────────────────────────────
// Wrapper fetch côté client — ne pas appeler depuis /agents/pierre/**
export type {
  EnterpriseFootprintApiGetResponse,
  EnterpriseFootprintApiPostResponse,
} from "./enterprise-footprint-api-client";

export {
  fetchEnterpriseFootprintServerSnapshot,
  postEnterpriseFootprintServerSnapshot,
  isEnterpriseFootprintApiAvailableResponse,
  normalizeEnterpriseFootprintApiError,
} from "./enterprise-footprint-api-client";

// ── Messages Feed (PHASE 3.16) ───────────────────────────────────────────────
// Bridge messages dédié — lecture seule, localStorage-only, pas de Supabase.
// Pas de DB write. Pas de POST. Pas de message envoyé.
export type {
  EnterpriseFootprintMessagesFeedStatus,
  EnterpriseFootprintMessagesFeedSource,
  EnterpriseFootprintMessagesFeedSummary,
  EnterpriseFootprintMessagesFeedCard,
  EnterpriseFootprintMessagesFeedItem,
  EnterpriseFootprintMessagesFeedRecommendation,
  EnterpriseFootprintMessagesFeedAction,
  EnterpriseFootprintMessagesFeedReadResult,
} from "./enterprise-footprint-messages-feed";

export {
  loadEnterpriseFootprintForMessagesFeed,
  buildEnterpriseFootprintMessagesFeedSummary,
  buildEnterpriseFootprintMessagesFeedCards,
  buildEnterpriseFootprintMessagesFeedItems,
  buildEnterpriseFootprintMessagesFeedRecommendations,
  buildEnterpriseFootprintMessagesFeedActions,
  buildEmptyEnterpriseFootprintMessagesFeedState,
  getEnterpriseFootprintMessagesFeedStatusLabel,
  getEnterpriseFootprintMessagesFeedSourceLabel,
} from "./enterprise-footprint-messages-feed";

// ── Messages Feed QA (PHASE 3.16) ────────────────────────────────────────────
export type {
  EnterpriseFootprintMessagesFeedQaStepId,
  EnterpriseFootprintMessagesFeedQaStep,
  EnterpriseFootprintMessagesFeedQaVerdict,
  EnterpriseFootprintMessagesFeedQaChecklist,
  EnterpriseFootprintMessagesFeedQaSummary,
} from "./enterprise-footprint-messages-feed-qa";

export {
  buildEnterpriseFootprintMessagesFeedQaChecklist,
  buildEnterpriseFootprintMessagesFeedQaVerdict,
  getEnterpriseFootprintMessagesFeedBlockingSteps,
  summarizeEnterpriseFootprintMessagesFeedQaVerdict,
} from "./enterprise-footprint-messages-feed-qa";

// ── Restore UI Polish (PHASE 3.18) ───────────────────────────────────────────
// Module pur — observabilité UI restore/sync. Pas de Supabase, pas de write.
export type {
  EnterpriseFootprintRestoreUiTone,
  EnterpriseFootprintRestoreUiStatus,
  EnterpriseFootprintRestoreUiSource,
  EnterpriseFootprintRestoreUiBadge,
  EnterpriseFootprintRestoreUiCard,
  EnterpriseFootprintRestoreUiTimelineItem,
  EnterpriseFootprintRestoreUiAction,
  EnterpriseFootprintRestoreUiSnapshotOptions,
  EnterpriseFootprintRestoreUiSnapshot,
} from "./enterprise-footprint-restore-ui";

export {
  buildEnterpriseFootprintRestoreUiSnapshot,
  buildEnterpriseFootprintRestoreUiBadges,
  buildEnterpriseFootprintRestoreUiCards,
  buildEnterpriseFootprintRestoreUiTimeline,
  buildEnterpriseFootprintRestoreUiActions,
  getEnterpriseFootprintRestoreUiStatusLabel,
  getEnterpriseFootprintRestoreUiSourceLabel,
  getEnterpriseFootprintRestoreUiTone,
  explainEnterpriseFootprintRestoreUiStatus,
} from "./enterprise-footprint-restore-ui";

// ── Restore UI QA (PHASE 3.18) ────────────────────────────────────────────────
export type {
  EnterpriseFootprintRestoreUiQaStepId,
  EnterpriseFootprintRestoreUiQaStep,
  EnterpriseFootprintRestoreUiQaVerdict,
  EnterpriseFootprintRestoreUiQaChecklist,
  EnterpriseFootprintRestoreUiQaSummary,
} from "./enterprise-footprint-restore-ui-qa";

export {
  buildEnterpriseFootprintRestoreUiQaChecklist,
  buildEnterpriseFootprintRestoreUiQaVerdict,
  getEnterpriseFootprintRestoreUiBlockingSteps,
  summarizeEnterpriseFootprintRestoreUiQaVerdict,
} from "./enterprise-footprint-restore-ui-qa";

// ── Manual Activation QA (PHASE 3.15) ────────────────────────────────────────
// Module pur — checklist QA manuelle pour l'activation réelle de la persistence serveur.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre.
export type {
  EnterpriseFootprintManualActivationStepId,
  EnterpriseFootprintManualActivationStepStatus,
  EnterpriseFootprintManualActivationStepSeverity,
  EnterpriseFootprintManualActivationStep,
  EnterpriseFootprintManualActivationChecklist,
  EnterpriseFootprintManualActivationVerdict,
  EnterpriseFootprintManualActivationEvidence,
  EnterpriseFootprintManualActivationEvidencePack,
  EnterpriseFootprintManualActivationQaSummary,
} from "./enterprise-footprint-manual-activation-qa";

export {
  buildEnterpriseFootprintManualActivationChecklist,
  buildEnterpriseFootprintManualActivationVerdict,
  getEnterpriseFootprintManualActivationBlockingSteps,
  buildEnterpriseFootprintManualActivationEvidenceTemplate,
  validateEnterpriseFootprintManualActivationEvidencePack,
  summarizeEnterpriseFootprintManualActivationQaVerdict,
} from "./enterprise-footprint-manual-activation-qa";
