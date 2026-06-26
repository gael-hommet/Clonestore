// TECH-03 — CloneStore Technologies Module Index
// Clean exports for the unified Global Technology Config layer.
//
// Architecture:
//   Pre-existing (not modified):
//     contracts.ts         — TechnologySlug, TechnologyDefinition, TechnologyRegistry types
//     registry.ts          — TECHNOLOGY_DEFINITIONS, buildTechnologyRegistry()
//     configuration.ts     — validateTechnologySetting, mergeTechnologySettings, etc.
//     storage.ts           — CloneStoreTechnologyRow, normalizeDbRow(), etc.
//     technology-b46-types.ts     — B46 visible layer types (6 techs)
//     technology-b46-registry.ts  — buildAllB46TechnologyItems(), etc.
//
//   TECH-03 additions (exported below):
//     global-tech-config.ts    — GlobalTechnologyKey (13), all config types
//     global-tech-defaults.ts  — DEFAULT_GLOBAL_TECH_CONFIGS for all 13 techs
//     global-tech-snapshot.ts  — buildGlobalTechnologyConfigSnapshot, patch helpers
//     global-tech-validation.ts — validateGlobalTechnologyConfig, reports
//     global-tech-b46-bridge.ts — B46 ↔ Global compatibility bridge
//     global-tech-storage.ts   — Storage payload serialization/deserialization

// ── Types — GlobalTechnologyKey + config model ────────────────────────────────

export type {
  GlobalTechnologyKey,
  GlobalTechnologyCategory,
  GlobalTechnologyVisibility,
  GlobalTechnologyStatus,
  GlobalTechnologyMode,
  GlobalTechnologyRuntimeStatus,
  GlobalTechnologyControlLevel,
  GlobalTechnologyRiskMode,
  GlobalTechnologyAutonomyLevel,
  GlobalTechnologyConfigScope,
  GlobalTechnologyGuardrails,
  GlobalTechnologyEmployeeOverride,
  GlobalTechnologyConfig,
  GlobalTechnologyConfigSummary,
  GlobalTechnologyConfigSnapshot,
  GlobalTechnologyConfigPatch,
  GlobalTechnologyConfigValidationIssue,
  GlobalTechnologyConfigValidationReport,
} from "./global-tech-config";

export {
  ALL_GLOBAL_TECHNOLOGY_KEYS,
  GLOBAL_TECHNOLOGY_KEY_SET,
  TECHNOLOGY_SLUG_SUBSET,
  isGlobalTechnologyKey,
  isInTechnologySlugSubset,
} from "./global-tech-config";

// ── Defaults ──────────────────────────────────────────────────────────────────

export {
  DEFAULT_GLOBAL_TECH_CONFIGS,
  DEFAULT_GLOBAL_TECH_CONFIG_LIST,
  getDefaultGlobalTechConfig,
  getActiveDefaultConfigs,
  getPartialDefaultConfigs,
  getRoadmapDefaultConfigs,
  getEmployeeRuntimeRequiredDefaultConfigs,
  getPlatformLockedDefaultConfigs,
  getCustomerVisibleDefaultConfigs,
  getDefaultReadinessScore,
  getAverageDefaultReadinessScore,
} from "./global-tech-defaults";

// ── Snapshot & resolution ─────────────────────────────────────────────────────

export {
  buildGlobalTechnologyConfigSummary,
  buildGlobalTechnologyConfigSnapshot,
  buildEmployeeCoverageMap,
  resolveGlobalTechConfig,
  resolveTechnologyConfigForEmployee,
  listTechnologiesForEmployee,
  applyGlobalTechConfigPatch,
  applyGlobalTechConfigPatches,
  addEmployeeOverride,
  removeEmployeeOverride,
  getAverageReadinessScore,
  getEmployeeRuntimeReadinessScore,
} from "./global-tech-snapshot";

// ── Validation ────────────────────────────────────────────────────────────────

export type { GlobalTechConfigValidationResult } from "./global-tech-validation";

export {
  validateGlobalTechnologyConfig,
  validateGlobalTechnologyConfigSet,
  getGlobalTechnologyConfigValidationReport,
  isGlobalTechConfigValid,
  areAllDefaultConfigsValid,
} from "./global-tech-validation";

// ── B46 bridge ────────────────────────────────────────────────────────────────

export {
  isB46TechnologyId,
  getB46VisibleTechnologyKeys,
  mapGlobalConfigToB46Item,
  mapGlobalSnapshotToB46Items,
  buildB46CompatibleTechnologyItemsFromGlobal,
  getB46ConfigsFromGlobal,
  getNonB46ConfigsFromGlobal,
  allB46KeysPresentInGlobal,
  getGlobalConfigForB46Id,
} from "./global-tech-b46-bridge";

// ── Storage ───────────────────────────────────────────────────────────────────

export type {
  GlobalTechStorageRow,
  GlobalTechStoragePayload,
  LegacyB46FallbackRow,
} from "./global-tech-storage";

export {
  serializeGlobalTechConfig,
  buildDefaultGlobalTechStoragePayload,
  normalizeGlobalTechStorageRow,
  normalizeGlobalTechStoragePayload,
  mergeGlobalTechConfigWithStoredRow,
  mergeGlobalTechConfigsWithStoredRows,
  buildLegacyB46FallbackFromGlobalConfigs,
  buildStoragePayloadFromPatches,
} from "./global-tech-storage";
