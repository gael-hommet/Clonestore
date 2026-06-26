// TECH-05 — CloneADN Global / Enterprise Memory — index
// Point d'entrée unique pour la couche GlobalEnterpriseMemory.
//
// Architecture :
//   CloneStore Platform
//   → GlobalEnterpriseMemory (TECH-05, ce module)
//   → Employee Runtime Contract (TECH-02)
//   → Pierre / futurs employés IA
//
// Ce module N'exporte PAS les modules B28 (CloneADNProfile) et B44 (EnterpriseEmpreinte)
// qui ont leurs propres index. Il expose uniquement les nouveaux types TECH-05.

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  EnterpriseMemoryId,
  EnterpriseMemoryScope,
  EnterpriseMemorySource,
  EnterpriseMemorySensitivity,
  EnterpriseMemoryStability,
  EnterpriseMemoryCategory,
  HumanEmploymentStatus,
  EnterpriseDocumentType,
  EnterpriseDocumentSensitivity,
  EnterpriseDocumentExtractionStatus,
  EnterpriseRuleSeverity,
  EnterpriseIdentityProfile,
  EnterpriseToneProfile,
  EnterpriseCommunicationProfile,
  EnterpriseValidationCircuit,
  EnterpriseHumanProfile,
  EnterpriseHumanRegistry,
  EnterpriseSiteProfile,
  EnterpriseDepartmentProfile,
  EnterpriseDocumentProfile,
  EnterpriseRuleProfile,
  EnterprisePreferenceProfile,
  EnterpriseOperationalPattern,
  EnterpriseMemoryItem,
  EnterpriseEmployeeAccessProfile,
  GlobalEnterpriseMemoryMetadata,
  GlobalEnterpriseMemory,
  GlobalEnterpriseMemoryPatch,
  GlobalEnterpriseMemorySnapshot,
  GlobalEnterpriseMemoryValidationIssue,
  GlobalEnterpriseMemoryValidationReport,
} from "./global-enterprise-memory";

// ── Defaults ──────────────────────────────────────────────────────────────────

export {
  DEFAULT_ENTERPRISE_MEMORY_VERSION,
  ENTERPRISE_MEMORY_ID_PREFIX,
  DEFAULT_ENTERPRISE_IDENTITY_PROFILE,
  DEFAULT_ENTERPRISE_TONE_PROFILE,
  DEFAULT_ENTERPRISE_COMMUNICATION_PROFILE,
  DEFAULT_VALIDATION_CIRCUITS,
  DEFAULT_HUMAN_REGISTRY,
  buildEmptyGlobalEnterpriseMemory,
  buildDemoGlobalEnterpriseMemory,
} from "./global-enterprise-memory-defaults";

// ── Validation ────────────────────────────────────────────────────────────────

export {
  computeCoverageScore,
  validateGlobalEnterpriseMemory,
} from "./global-enterprise-memory-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────────

export {
  buildGlobalEnterpriseMemorySnapshot,
} from "./global-enterprise-memory-snapshot";

// ── Storage ───────────────────────────────────────────────────────────────────

export {
  getEnterpriseMemory,
  getOrCreateEnterpriseMemory,
  listEnterpriseMemoryIds,
  setEnterpriseMemory,
  patchEnterpriseMemory,
  deleteEnterpriseMemory,
  clearEnterpriseMemoryStore,
  getMemoryItemsForEmployee,
  getHumansForEmployee,
} from "./global-enterprise-memory-storage";

// ── Employee ADN Access ───────────────────────────────────────────────────────

export {
  BASE_EMPLOYEE_ACCESS_PROFILE,
  STANDARD_READABLE_CATEGORIES,
  HR_READABLE_CATEGORIES,
  FINANCE_READABLE_CATEGORIES,
  LEGAL_READABLE_CATEGORIES,
  PIERRE_DEFAULT_ACCESS_PROFILE,
  buildEmployeeAccessProfile,
  canEmployeeReadCategory,
  canEmployeeAccessDomain,
  filterReadableCategories,
  canEmployeeAccessHumans,
  canEmployeeAccessDocuments,
} from "./employee-adn-access";

// ── Pierre ADN Bridge ─────────────────────────────────────────────────────────

export type { PierreEnterpriseContext } from "./pierre-adn-bridge";

export {
  buildPierreEnterpriseContextFromMemory,
  buildPierreEnterpriseContextDirect,
  extractActiveRulesForPierre,
  isPierreValidationRequired,
  getRequiredApproversForDomain,
} from "./pierre-adn-bridge";
