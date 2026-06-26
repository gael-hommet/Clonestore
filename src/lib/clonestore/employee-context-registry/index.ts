// src/lib/clonestore/employee-context-registry/index.ts
// PHASE 3.20 — Global Employee Context Registry Design — Point d'entrée
//
// DESIGN-ONLY. Registre global des employés IA, fonctions, capacités, limites,
// validations, technologies, visibilité CloneOS / CloneVoice gouverné.
// Pas de Supabase, pas de write, pas d'exécution, pas d'import Pierre moteur.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  EmployeeContextRegistryKey,
  EmployeeContextRegistryEmployeeKey,
  EmployeeContextRegistryCapabilityKey,
  EmployeeContextRegistryFunctionKey,
  EmployeeContextRegistryTechnologyKey,
  EmployeeContextRegistryPolicyKey,
  EmployeeContextRegistryStatus,
  EmployeeContextRegistryVisibility,
  EmployeeContextRegistryRiskLevel,
  EmployeeContextRegistryValidationMode,
  EmployeeContextRegistrySource,
  EmployeeContextRegistryCapability,
  EmployeeContextRegistryFunction,
  EmployeeContextRegistryLimit,
  EmployeeContextRegistryValidationRule,
  EmployeeContextRegistryTechnologyBinding,
  EmployeeContextRegistryEmployee,
  EmployeeContextRegistry,
  EmployeeContextRegistrySummary,
  EmployeeContextRegistryCard,
  EmployeeContextRegistryRecommendation,
  EmployeeContextRegistryAction,
  EmployeeContextRegistrySnapshot,
  EmployeeContextRegistryReadResult,
  EmployeeContextRegistryIssue,
} from "./employee-context-registry-types";

// ── Defaults ──────────────────────────────────────────────────────────────────
export {
  DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_VERSION,
  DEFAULT_EMPLOYEE_CONTEXT_REGISTRY_SOURCE,
  PIERRE_EMPLOYEE_CONTEXT,
  FUTURE_EMPLOYEE_CONTEXT_PLACEHOLDERS,
  DEFAULT_GLOBAL_EMPLOYEE_CONTEXT_REGISTRY,
  buildPierreEmployeeContext,
  buildFutureEmployeeContextPlaceholders,
  buildDefaultEmployeeContextRegistry,
  buildEmptyEmployeeContextRegistry,
} from "./employee-context-registry-defaults";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  EMPLOYEE_CONTEXT_REGISTRY_FORBIDDEN_PATTERNS,
  detectUnsafeEmployeeContextRegistryText,
  isSafeEmployeeContextRegistryKey,
  normalizeEmployeeContextRegistryKey,
  assertEmployeeContextRegistryNoSecrets,
  validateEmployeeContextRegistryCapability,
  validateEmployeeContextRegistryFunction,
  validateEmployeeContextRegistryEmployee,
  validateEmployeeContextRegistry,
  sanitizeEmployeeContextRegistry,
} from "./employee-context-registry-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────────
export {
  filterActiveEmployeeContexts,
  filterCloneOSVisibleEmployeeContexts,
  filterCloneVoiceVisibleEmployeeContexts,
  findEmployeeContextByKey,
  findCapabilityContextByKey,
  findFunctionContextByKey,
  buildEmployeeContextRegistrySummary,
  buildEmployeeContextRegistryCards,
  buildEmployeeContextRegistryRecommendations,
  buildEmployeeContextRegistryActions,
  buildEmployeeContextRegistrySnapshot,
} from "./employee-context-registry-snapshot";

// ── Enterprise Footprint / CloneADN bridge ────────────────────────────────────
export {
  buildEmployeeContextRegistryFromEnterpriseFootprint,
  attachEmployeeContextRegistryToEnterpriseSnapshot,
  buildEnterpriseEmployeeContextReadResult,
  summarizeEnterpriseEmployeeContext,
  buildEnterpriseEmployeeContextIssues,
  buildEnterpriseEmployeeContextRecommendations,
} from "./employee-context-registry-enterprise-bridge";

// ── CloneVoice governed context contract ──────────────────────────────────────
export type {
  CloneVoiceEmployeeContextAccessMode,
  CloneVoiceEmployeeContextPermission,
  CloneVoiceEmployeeContextScope,
  CloneVoiceEmployeeContextGuardrail,
  CloneVoiceEmployeeContextContract,
} from "./employee-context-registry-clonevoice-contract";

export {
  buildCloneVoiceEmployeeContextContract,
  buildCloneVoiceEmployeeContextScopes,
  buildCloneVoiceEmployeeContextGuardrails,
  validateCloneVoiceEmployeeContextContract,
  summarizeCloneVoiceEmployeeContextContract,
} from "./employee-context-registry-clonevoice-contract";

// ── QA ────────────────────────────────────────────────────────────────────────
export type {
  EmployeeContextRegistryQaStepId,
  EmployeeContextRegistryQaStep,
  EmployeeContextRegistryQaVerdict,
  EmployeeContextRegistryQaChecklist,
  EmployeeContextRegistryQaSummary,
} from "./employee-context-registry-qa";

export {
  buildEmployeeContextRegistryQaChecklist,
  buildEmployeeContextRegistryQaVerdict,
  getEmployeeContextRegistryBlockingSteps,
  summarizeEmployeeContextRegistryQaVerdict,
} from "./employee-context-registry-qa";

// ── Profile Feed UI Preview (PHASE 3.21) ──────────────────────────────────────
// Read-only / design-only. Pas de Supabase, pas de write, pas d'exécution.
export type {
  EmployeeContextRegistryProfileFeedStatus,
  EmployeeContextRegistryProfileFeedSource,
  EmployeeContextRegistryProfileFeedSummary,
  EmployeeContextRegistryProfileFeedCapabilityItem,
  EmployeeContextRegistryProfileFeedFunctionItem,
  EmployeeContextRegistryProfileFeedEmployeeCard,
  EmployeeContextRegistryProfileFeedItem,
  EmployeeContextRegistryProfileFeedSectionKind,
  EmployeeContextRegistryProfileFeedSection,
  EmployeeContextRegistryProfileFeedWarning,
  EmployeeContextRegistryProfileFeedAction,
  EmployeeContextRegistryProfileFeedReadResult,
} from "./employee-context-registry-profile-feed";

export {
  loadEmployeeContextRegistryProfileFeed,
  buildEmployeeContextRegistryProfileFeed,
  buildEmployeeContextRegistryProfileFeedSummary,
  buildEmployeeContextRegistryProfileFeedSections,
  buildEmployeeContextRegistryProfileFeedEmployees,
  buildEmployeeContextRegistryProfileFeedCapabilities,
  buildEmployeeContextRegistryProfileFeedFunctions,
  buildEmployeeContextRegistryProfileFeedWarnings,
  buildEmployeeContextRegistryProfileFeedActions,
  buildEmptyEmployeeContextRegistryProfileFeed,
  getEmployeeContextRegistryProfileFeedStatusLabel,
  getEmployeeContextRegistryProfileFeedSourceLabel,
} from "./employee-context-registry-profile-feed";

// ── Profile Feed QA (PHASE 3.21) ──────────────────────────────────────────────
export type {
  EmployeeContextRegistryProfileFeedQaStepId,
  EmployeeContextRegistryProfileFeedQaStep,
  EmployeeContextRegistryProfileFeedQaVerdict,
  EmployeeContextRegistryProfileFeedQaChecklist,
  EmployeeContextRegistryProfileFeedQaSummary,
} from "./employee-context-registry-profile-feed-qa";

export {
  buildEmployeeContextRegistryProfileFeedQaChecklist,
  buildEmployeeContextRegistryProfileFeedQaVerdict,
  getEmployeeContextRegistryProfileFeedBlockingSteps,
  summarizeEmployeeContextRegistryProfileFeedQaVerdict,
} from "./employee-context-registry-profile-feed-qa";
