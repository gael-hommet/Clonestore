// TECH-08 — CloneOS Command Center Alignment — Public Exports
// Point d'entrée public pour la couche CloneOS Command Center globale.
// Ne pas confondre avec src/lib/cloneos/ (AI/channels/files B32-B39).

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  CloneOSCommandId,
  CloneOSMissionId,
  CloneOSTaskId,
  CloneOSCompanyId,
  CloneOSEmployeeSlug,
  CloneOSSessionId,
  CloneOSCommandStatus,
  CloneOSCommandIntent,
  CloneOSCommandDomain,
  CloneOSCommandPriority,
  CloneOSCommandRiskLevel,
  CloneOSCommandSource,
  CloneOSCommandActor,
  CloneOSCommandInput,
  CloneOSClassifiedCommand,
  CloneOSEmployeeRoute,
  CloneOSTechnologyContext,
  CloneOSEnterpriseMemoryContext,
  CloneOSGuardContext,
  CloneOSCommandContext,
  CloneOSTaskPlan,
  CloneOSMissionPlan,
  CloneOSTaskGuardResult,
  CloneOSCommandGuardResult,
  CloneOSCommandTraceResult,
  CloneOSCommandPlan,
  CloneOSCommandCenterResult,
  CloneOSCommandValidationIssue,
  CloneOSCommandValidationReport,
  CloneOSCommandSnapshot,
} from "./cloneos-command-types";

// ── Classifier ────────────────────────────────────────────────────────────────
export {
  generateCloneOSCommandId,
  classifyCloneOSCommand,
  inferCommandDomain,
  inferCommandIntent,
  inferCommandPriority,
  inferCommandRiskLevel,
  extractCommandEntities,
  getCandidateEmployeesForCommand,
} from "./cloneos-command-classifier";

// ── Employee Router ───────────────────────────────────────────────────────────
export {
  routeCloneOSCommand,
  listAvailableEmployeesForCommand,
  getBestEmployeeRoute,
  buildNoEmployeeAvailableRoute,
  buildEmployeeRoute,
  validateEmployeeRoute,
} from "./cloneos-employee-router";

// ── Command Context ───────────────────────────────────────────────────────────
export {
  buildCloneOSCommandContext,
  buildTechnologyContextForCommand,
  buildEnterpriseMemoryContextForCommand,
  buildGuardContextForCommand,
  buildTraceContextForCommand,
  getCommandContextWarnings,
} from "./cloneos-command-context";

// ── Command Plan ──────────────────────────────────────────────────────────────
export {
  buildCloneOSCommandPlan,
  buildMissionPlanForCommand,
  buildTaskPlansForCommand,
  buildBlockedPlan,
  mapIntentToActionType,
  mapIntentToExpectedArtifact,
  calculatePlanValidationRequirement,
} from "./cloneos-command-plan";

// ── Command Guard ─────────────────────────────────────────────────────────────
export {
  evaluateCloneOSCommandPlanWithGuard,
  evaluateCloneOSTaskWithGuard,
  buildGuardInputFromCloneOSTask,
  aggregateGuardResults,
  applyGuardDecisionToPlan,
} from "./cloneos-command-guard";

// ── Command Trace ─────────────────────────────────────────────────────────────
export {
  buildCloneOSCommandTraceEvents,
  createCommandReceivedTraceEvent,
  createCommandRoutedTraceEvent,
  createCommandPlannedTraceEvent,
  createCommandGuardedTraceEvents,
  buildCloneOSCommandTraceResult,
} from "./cloneos-command-trace";

// ── Command Center Orchestrator ───────────────────────────────────────────────
export {
  processCloneOSCommand,
} from "./cloneos-command-center";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  validateCloneOSCommandInput,
  validateCloneOSClassifiedCommand,
  validateCloneOSEmployeeRoute,
  validateCloneOSMissionPlan,
  validateCloneOSCommandCenterResult,
  getCloneOSCommandValidationReport,
} from "./cloneos-command-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────────
export {
  buildCloneOSCommandSnapshot,
  countCommandsByStatus,
  countCommandsByDomain,
  countCommandsByEmployee,
  countCommandsByRisk,
  listCommandsNeedingValidation,
  listBlockedCommands,
  buildCloneOSCommandCenterHealth,
} from "./cloneos-command-snapshot";

// ── Pierre → CloneOS Bridge ───────────────────────────────────────────────────
export {
  buildPierreCloneOSCommand,
  processPierreCommandThroughCloneOS,
  mapCloneOSMissionPlanToPierreIntent,
  buildPierreLegacyMissionFallback,
} from "./pierre-cloneos-bridge";
export type { PierreCloneOSCommandInput, PierreLegacyMissionFallback } from "./pierre-cloneos-bridge";
