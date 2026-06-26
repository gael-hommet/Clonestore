// src/lib/clonestore/cloneos-history/index.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Exports publics
//
// Couche historique CloneOS — design server persistence.
// PHASE 3.2 : localStorage uniquement + design DB ready.
// PHASE 3.3 : activation après migration manuelle.

export type {
  CloneOSHistorySource,
  CloneOSHistoryPersistenceMode,
  CloneOSHistoryStatus,
  CloneOSHistoryRiskLevel,
  CloneOSHistoryDomain,
  CloneOSHistoryGuardSummary,
  CloneOSHistoryTraceSummary,
  CloneOSHistoryMissionSummary,
  CloneOSHistoryTaskSummary,
  CloneOSHistoryItem,
  CloneOSHistoryPersistablePayload,
  CloneOSHistoryReadResult,
  CloneOSHistoryWriteResult,
  CloneOSHistoryValidationIssue,
  CloneOSHistoryValidationReport,
} from "./cloneos-history-types";

export {
  CLONEOS_HISTORY_TABLE_NAME,
  CLONEOS_HISTORY_MAX_SUMMARY_LENGTH,
  CLONEOS_HISTORY_MAX_ITEMS,
  CLONEOS_HISTORY_PERSISTENCE_MODE,
  CLONEOS_HISTORY_REDACT_KEYS,
  CLONEOS_HISTORY_UNSAFE_PATTERNS,
} from "./cloneos-history-types";

export {
  CLONEOS_HISTORY_SCHEMA,
  CLONEOS_HISTORY_SQL_DRAFT_PATH,
  CLONEOS_HISTORY_SCHEMA_NOTE,
} from "./cloneos-history-schema";

export {
  mapCloneOSResultToHistoryItem,
  mapHistoryItemToMessageCenterItem,
  summarizeCloneOSRawRequest,
  summarizeCloneOSMission,
  summarizeCloneOSTasks,
  summarizeCloneOSGuard,
  summarizeCloneOSTrace,
  redactCloneOSHistoryMetadata,
  isSensitiveCloneOSHistoryKey,
} from "./cloneos-history-mappers";

export {
  validateCloneOSHistoryItem,
  validateCloneOSHistoryItems,
  validateCloneOSHistoryPersistablePayload,
  detectUnsafeCloneOSHistoryWording,
  assertCloneOSHistoryReadOnlyForUI,
} from "./cloneos-history-validation";

export {
  CLONEOS_HISTORY_LOCALSTORAGE_KEY,
  loadCloneOSHistoryFromLocalStorage,
  saveCloneOSHistoryToLocalStorage,
  appendCloneOSHistoryToLocalStorage,
  clearCloneOSHistoryLocalStorage,
  migrateLegacyCloneOSHistoryPayload,
  normalizeCloneOSHistoryPayload,
  loadCloneOSHistoryItemsFromLocalStorage,
} from "./cloneos-history-localstorage";

export {
  mapCloneOSHistoryRowToItem,
  sortCloneOSHistoryItems,
  filterCloneOSHistoryItems,
  loadCloneOSHistoryReadOnly,
} from "./cloneos-history-readonly-client";

export {
  CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED,
  buildCloneOSHistoryPersistablePayload,
  canPersistCloneOSHistory,
  persistCloneOSHistoryItemSafely,
  persistCloneOSHistoryBatchSafely,
} from "./cloneos-history-storage";

// ── PHASE 3.3 — Feature flags ─────────────────────────────────────────────────
export {
  CLONEOS_HISTORY_PERSISTENCE_ENV_KEY,
  isCloneOSHistoryServerPersistenceConfigured,
  isCloneOSHistoryServerPersistenceEnabled,
  getCloneOSHistoryPersistenceMode,
  explainCloneOSHistoryPersistenceMode,
  CLONEOS_HISTORY_ACTIVATION_STEPS,
} from "./cloneos-history-flags";

// ── PHASE 3.3 — Health check ──────────────────────────────────────────────────
export type { CloneOSHistoryHealthReport } from "./cloneos-history-health";
export {
  checkCloneOSHistoryTableReadiness,
  buildCloneOSHistoryHealthReport,
  isCloneOSHistoryTableMissingError,
  isCloneOSHistoryRlsError,
} from "./cloneos-history-health";

// ── PHASE 3.3 — Runtime bridge ────────────────────────────────────────────────
export type {
  CloneOSHistoryRuntimePersistOutcome,
  CloneOSHistoryRuntimeResult,
  PersistCloneOSHistoryOptions,
} from "./cloneos-history-runtime";
export { persistCloneOSHistoryWithFallback } from "./cloneos-history-runtime";

// ── PHASE 3.19 — Manual Activation QA ─────────────────────────────────────────
// Module pur — checklist QA manuelle. Pas de Supabase, pas de write,
// pas d'exécution CloneOS, pas d'import Pierre.
export type {
  CloneOSHistoryManualActivationStepId,
  CloneOSHistoryManualActivationStepStatus,
  CloneOSHistoryManualActivationStepSeverity,
  CloneOSHistoryManualActivationStep,
  CloneOSHistoryManualActivationChecklist,
  CloneOSHistoryManualActivationVerdict,
  CloneOSHistoryManualActivationEvidence,
  CloneOSHistoryManualActivationEvidencePack,
  CloneOSHistoryManualActivationQaSummary,
} from "./cloneos-history-manual-activation-qa";

export {
  buildCloneOSHistoryManualActivationChecklist,
  buildCloneOSHistoryManualActivationVerdict,
  getCloneOSHistoryManualActivationBlockingSteps,
  buildCloneOSHistoryManualActivationEvidenceTemplate,
  validateCloneOSHistoryManualActivationEvidencePack,
  summarizeCloneOSHistoryManualActivationQaVerdict,
} from "./cloneos-history-manual-activation-qa";
