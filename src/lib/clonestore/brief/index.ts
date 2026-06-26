// TECH-09 — CloneBrief Executive Summaries — Public Exports
// Point d'entrée public pour la couche CloneBrief globale.
// CloneBrief est la couche de synthèse exécutive — consomme Trace/OS/Guard/ADN.
// CloneBrief n'est pas un employé IA. CloneBrief n'est pas CloneChat.

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  CloneBriefId,
  CloneBriefCompanyId,
  CloneBriefEmployeeSlug,
  CloneBriefType,
  CloneBriefAudience,
  CloneBriefStatus,
  CloneBriefSeverity,
  CloneBriefPriority,
  CloneBriefSectionType,
  CloneBriefSourceType,
  CloneBriefActionStatus,
  CloneBriefSourceRef,
  CloneBriefMetric,
  CloneBriefActionItem,
  CloneBriefRiskItem,
  CloneBriefValidationItem,
  CloneBriefBlockedItem,
  CloneBriefEmployeeSummary,
  CloneBriefTechnologySummary,
  CloneBriefSection,
  CloneBriefPeriod,
  CloneBriefExecutiveSummary,
  CloneBriefGenerationInput,
  CloneBriefGenerationOptions,
  CloneBriefGenerationResult,
  CloneBriefValidationIssue,
  CloneBriefValidationReport,
  CloneBriefSnapshot,
} from "./clonebrief-types";

// ── Defaults ──────────────────────────────────────────────────────────────────
export {
  generateCloneBriefId,
  buildDefaultBriefPeriod,
  buildSystemBriefSourceRef,
  buildTraceBriefSourceRef,
  buildCommandBriefSourceRef,
  buildGuardBriefSourceRef,
  buildAdnBriefSourceRef,
  buildEmptyBriefSection,
  buildDefaultBriefMetric,
  buildEmptyCloneBrief,
  buildDemoCloneBrief,
} from "./clonebrief-defaults";

// ── Source Adapters ───────────────────────────────────────────────────────────
export {
  adaptTraceEventToBriefSource,
  adaptTraceTimelineToBriefSources,
  adaptCloneOSResultToBriefSource,
  adaptCloneOSResultsToBriefSources,
  adaptCloneOSResultToBriefSources,
  adaptGuardResultToBriefSources,
  adaptEnterpriseMemoryToBriefSources,
  buildBriefGenerationInputFromTrace,
  buildBriefGenerationInputFromCommandResults,
  mergeBriefSources,
  extractBlockedEventsFromInput,
  extractValidationEventsFromInput,
  extractCriticalEventsFromInput,
  extractCompletedEventsFromInput,
  extractBlockedCommandResultsFromInput,
  buildAllSourceRefsFromInput,
} from "./clonebrief-source-adapters";

// ── Sections ──────────────────────────────────────────────────────────────────
export {
  buildOverviewSection,
  buildCompletedActionsSection,
  buildPendingActionsSection,
  buildBlockedActionsSection,
  buildValidationsRequiredSection,
  buildRisksSection,
  buildEmployeeActivitySection,
  buildTechnologyActivitySection,
  buildNextStepsSection,
  buildAttentionPointsSection,
  buildSystemHealthSection,
  buildAllBriefSections,
} from "./clonebrief-sections";

// ── Prioritizer ───────────────────────────────────────────────────────────────
export {
  calculateBriefPriority,
  calculateSectionPriority,
  sortBriefSectionsByPriority,
  sortActionItemsByPriority,
  sortRiskItemsByPriority,
  listUrgentBriefItems,
  listBriefItemsNeedingHumanAttention,
  calculateBriefHealthScore,
} from "./clonebrief-prioritizer";

// ── Generator ─────────────────────────────────────────────────────────────────
export {
  generateCloneBrief,
  generateDailyCloneBrief,
  generateMissionCloneBrief,
  generateEmployeeCloneBrief,
  generateRiskCloneBrief,
  generateValidationCloneBrief,
  buildExecutiveSummaryText,
  buildBriefMetrics,
  buildBriefActionItems,
  buildBriefRiskItems,
  buildBriefValidationItems,
  buildBriefBlockedItems,
  buildEmployeeSummaries,
  buildTechnologySummaries,
} from "./clonebrief-generator";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  validateCloneBrief,
  validateCloneBriefGenerationInput,
  getCloneBriefValidationReport,
} from "./clonebrief-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────────
export {
  buildCloneBriefSnapshot,
  countBriefsByStatus,
  countBriefsByType,
  countBriefItemsBySeverity,
  listBriefsNeedingHumanAttention,
  listBriefsWithBlockedItems,
  listRecentBriefs,
  buildCloneBriefHealth,
} from "./clonebrief-snapshot";

// ── Storage ───────────────────────────────────────────────────────────────────
export {
  getCloneBrief,
  listCloneBriefs,
  saveCloneBriefInMemory,
  clearCloneBriefStore,
  serializeCloneBrief,
  normalizeCloneBriefPayload,
  mergeCloneBriefWithStoredPayload,
} from "./clonebrief-storage";

// ── Employee Brief Access ─────────────────────────────────────────────────────
export {
  PIERRE_DEFAULT_BRIEF_ACCESS_PROFILE,
  UNKNOWN_EMPLOYEE_BRIEF_ACCESS_PROFILE,
  SYSTEM_BRIEF_ACCESS_PROFILE,
  getEmployeeBriefAccessProfile,
  canEmployeeGenerateBrief,
  canEmployeeViewBrief,
  filterBriefForEmployee,
  buildEmployeeBriefContext,
} from "./employee-brief-access";
export type { CloneBriefEmployeeAccessProfile } from "./employee-brief-access";

// ── Pierre → CloneBrief Bridge ────────────────────────────────────────────────
export {
  buildPierreBriefInputFromTrace,
  buildPierreDailyBrief,
  buildPierreMissionBrief,
  mapPierreTraceToBriefSections,
  buildPierreLegacyBriefFallback,
} from "./pierre-brief-bridge";
export type {
  PierreBriefBridgeInput,
  PierreLegacyBriefFallback,
} from "./pierre-brief-bridge";
