// src/lib/clonestore/onboarding/index.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Point d'entrée
//
// Exporte tous les types, helpers, mappers, validators, flags et clients
// de la couche onboarding global CloneStore.
//
// Usage :
//   import {
//     GLOBAL_ONBOARDING_LOCALSTORAGE_KEY,
//     saveGlobalOnboardingDraftToLocalStorage,
//     loadGlobalOnboardingDraftFromLocalStorage,
//     clearGlobalOnboardingDraftLocalStorage,
//   } from "@/lib/clonestore/onboarding";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  GlobalOnboardingStepId,
  GlobalOnboardingStepStatus,
  GlobalOnboardingDraftStatus,
  GlobalOnboardingPersistenceMode,
  GlobalOnboardingCompanyDraft,
  GlobalOnboardingHumanDraft,
  GlobalOnboardingDocumentDraft,
  GlobalOnboardingRuleDraft,
  GlobalOnboardingTechnologyDraft,
  GlobalOnboardingFirstMissionDraft,
  GlobalOnboardingDraft,
  GlobalOnboardingPersistablePayload,
  GlobalOnboardingReadResult,
  GlobalOnboardingWriteResult,
  GlobalOnboardingValidationIssue,
  GlobalOnboardingValidationReport,
} from "./global-onboarding-types";

export {
  GLOBAL_ONBOARDING_TABLE_NAME,
  GLOBAL_ONBOARDING_CURRENT_STEP_IDS,
  GLOBAL_ONBOARDING_UNSAFE_PATTERNS,
  GLOBAL_ONBOARDING_REDACT_KEYS,
  GLOBAL_ONBOARDING_PERSISTENCE_MODE,
} from "./global-onboarding-types";

// ── Defaults ──────────────────────────────────────────────────────────────────
export {
  GLOBAL_ONBOARDING_LOCALSTORAGE_KEY,
  GLOBAL_ONBOARDING_MAX_HUMANS,
  GLOBAL_ONBOARDING_MAX_DOCUMENTS,
  GLOBAL_ONBOARDING_MAX_RULES,
  buildEmptyGlobalOnboardingDraft,
  buildDemoGlobalOnboardingDraft,
  buildDefaultGlobalOnboardingCompanyDraft,
  buildDefaultFirstPierreMissionDraft,
} from "./global-onboarding-defaults";

// ── Mappers ───────────────────────────────────────────────────────────────────
export {
  mapGlobalOnboardingDraftToEnterpriseMemory,
  mapEnterpriseMemoryToGlobalOnboardingDraft,
  buildCloneADNPreviewFromOnboardingDraft,
  computeGlobalOnboardingCompletionScore,
  summarizeGlobalOnboardingDraft,
  redactGlobalOnboardingMetadata,
} from "./global-onboarding-mappers";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  validateGlobalOnboardingDraft,
  validateGlobalOnboardingPersistablePayload,
  detectUnsafeGlobalOnboardingWording,
  assertGlobalOnboardingNoSensitiveLeak,
  sanitizeGlobalOnboardingDraft,
} from "./global-onboarding-validation";

// ── LocalStorage ──────────────────────────────────────────────────────────────
export {
  loadGlobalOnboardingDraftFromLocalStorage,
  saveGlobalOnboardingDraftToLocalStorage,
  clearGlobalOnboardingDraftLocalStorage,
  migrateLegacyGlobalOnboardingPayload,
  normalizeGlobalOnboardingPayload,
} from "./global-onboarding-localstorage";

// ── Schema ────────────────────────────────────────────────────────────────────
export {
  GLOBAL_ONBOARDING_SCHEMA,
  GLOBAL_ONBOARDING_SQL_DRAFT_PATH,
  GLOBAL_ONBOARDING_SCHEMA_NOTE,
} from "./global-onboarding-schema";

// ── Flags ─────────────────────────────────────────────────────────────────────
export {
  GLOBAL_ONBOARDING_PERSISTENCE_ENV_KEY,
  GLOBAL_ONBOARDING_ACTIVATION_STEPS,
  isGlobalOnboardingServerPersistenceEnabled,
  getGlobalOnboardingPersistenceMode,
  explainGlobalOnboardingPersistenceMode,
} from "./global-onboarding-flags";

// ── Read-only client ──────────────────────────────────────────────────────────
export {
  loadGlobalOnboardingDraftReadOnly,
  mapGlobalOnboardingRowToDraft,
  sortGlobalOnboardingDrafts,
} from "./global-onboarding-readonly-client";

// ── Storage design ────────────────────────────────────────────────────────────
// Feature flag gate obligatoire — canPersistGlobalOnboarding() = false par défaut.
export {
  buildGlobalOnboardingPersistablePayload,
  canPersistGlobalOnboarding,
  persistGlobalOnboardingDraftSafely,
} from "./global-onboarding-storage";

// ── Health check (PHASE 3.6) ──────────────────────────────────────────────────
export type { GlobalOnboardingHealthReport } from "./global-onboarding-health";
export {
  checkGlobalOnboardingTableReadiness,
  buildGlobalOnboardingHealthReport,
  isGlobalOnboardingTableMissingError,
  isGlobalOnboardingRlsError,
} from "./global-onboarding-health";

// ── Runtime safe bridge (PHASE 3.6 / 3.7) ────────────────────────────────────
// localStorage first → health check → write best-effort.
// PHASE 3.7 : restore serveur safe (read-only, compare updated_at).
// canPersistGlobalOnboarding() = false par défaut.
export type {
  GlobalOnboardingRuntimePersistOutcome,
  GlobalOnboardingRuntimePersistenceMode,
  GlobalOnboardingRuntimeResult,
  PersistGlobalOnboardingOptions,
  GlobalOnboardingRuntimeRestoreOutcome,
  GlobalOnboardingRuntimeRestoreResult,
  RestoreGlobalOnboardingOptions,
} from "./global-onboarding-runtime";
export {
  persistGlobalOnboardingWithFallback,
  restoreGlobalOnboardingWithFallback,
} from "./global-onboarding-runtime";

// ── Activation QA (PHASE 3.7) ─────────────────────────────────────────────────
// Checklist manuelle d'activation — module pur, aucun Supabase, aucun write.
export type {
  GlobalOnboardingManualQaStepId,
  GlobalOnboardingManualQaStepStatus,
  GlobalOnboardingManualQaSeverity,
  GlobalOnboardingManualQaStep,
  GlobalOnboardingManualQaChecklist,
  GlobalOnboardingManualQaVerdict,
  GlobalOnboardingManualQaEvidence,
  GlobalOnboardingManualQaSummary,
} from "./global-onboarding-activation-qa";
export {
  buildGlobalOnboardingManualQaChecklist,
  buildGlobalOnboardingManualQaVerdict,
  getGlobalOnboardingManualQaBlockingSteps,
  summarizeGlobalOnboardingManualQaVerdict,
} from "./global-onboarding-activation-qa";
