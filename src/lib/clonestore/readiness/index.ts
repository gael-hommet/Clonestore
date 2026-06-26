// TECH-11 — Technology Readiness Final Gate — Public Index
// Socle technologique CloneStore — verdict final TECH-01 → TECH-10.
// public_launch_ready est TOUJOURS false — blockers externes.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  TechnologyReadinessStatus,
  TechnologyReadinessVerdict,
  TechnologyReadinessArea,
  TechnologyReadinessSeverity,
  TechnologyReadinessBlockerType,
  TechnologyReadinessCheckStatus,
  TechnologyReadinessCheck,
  TechnologyReadinessTechnologyResult,
  TechnologyReadinessEmployeeResult,
  TechnologyReadinessInvariantResult,
  TechnologyReadinessExternalBlocker,
  TechnologyReadinessReport,
  TechnologyReadinessSnapshot,
  TechnologyReadinessValidationIssue,
  TechnologyReadinessValidationReport,
} from "./technology-readiness-types";

// ── Sources ───────────────────────────────────────────────────────────────────
export type { TechnologySourceEntry } from "./technology-readiness-sources";
export {
  TECHNOLOGY_SOURCE_MAP,
  collectTechnologyReadinessSources,
  collectTechnologyModules,
  collectTechnologyDocs,
  collectEmployeeRuntimeSources,
  collectGoLiveExternalBlockers,
  buildTechnologySourceMap,
  getTechnologySource,
  getAllTechnologyConfigs,
  getPierreContract,
} from "./technology-readiness-sources";

// ── Invariants ────────────────────────────────────────────────────────────────
export {
  evaluateVoiceInvariants,
  evaluateGuardInvariants,
  evaluateTraceInvariants,
  evaluateBriefInvariants,
  evaluateCloneOSInvariants,
  evaluateADNInvariants,
  evaluateEmployeeRuntimeInvariants,
  evaluatePierreInvariants,
  evaluateTechnologyInvariants,
} from "./technology-readiness-invariants";

// ── Evaluator ─────────────────────────────────────────────────────────────────
export {
  evaluateSingleTechnologyReadiness,
  evaluateAllTechnologyReadiness,
  evaluateEmployeeTechnologyReadiness,
  calculateTechnologyFoundationScore,
  calculateOverallReadinessScore,
  buildTechnologyReadinessVerdict,
  evaluateTechnologyReadiness,
} from "./technology-readiness-evaluator";

// ── Pierre Readiness ──────────────────────────────────────────────────────────
export type {
  PierreBridgeCoverageResult,
  PierreTechnologyReadinessResult,
} from "./pierre-technology-readiness";
export {
  evaluatePierreRequiredTechnologies,
  evaluatePierreBridgeCoverage,
  evaluatePierreSafetyCoverage,
  buildPierreTechnologyReadinessResult,
  evaluatePierreTechnologyReadiness,
} from "./pierre-technology-readiness";

// ── Launch Blockers Separation ────────────────────────────────────────────────
export {
  KNOWN_EXTERNAL_LAUNCH_BLOCKERS,
  listExternalLaunchBlockers,
  listInternalTechnologyBlockers,
  separateLaunchBlockers,
  canDeclareTechnologyFoundationReady,
  canDeclarePublicLaunchReady,
  buildBlockersSeparationMessage,
} from "./launch-blockers-separation";

// ── Report ────────────────────────────────────────────────────────────────────
export {
  buildTechnologyReadinessReport,
  buildTechnologyReadinessExecutiveSummary,
  buildTechnologyReadinessNextSteps,
  buildTechnologyReadinessSourceDigest,
  buildTechnologyReadinessMarkdown,
} from "./technology-readiness-report";

// ── Snapshot ──────────────────────────────────────────────────────────────────
export {
  buildTechnologyReadinessSnapshot,
  countTechnologiesByStatus,
  countChecksByStatus,
  countBlockersByType,
  listBlockingReadinessItems,
  listWarnings,
  listNextSteps,
  listImplementedTechnologies,
  listRoadmapTechnologies,
  listPassedAbsoluteInvariants,
  listFailedAbsoluteInvariants,
} from "./technology-readiness-snapshot";

// ── Validation ────────────────────────────────────────────────────────────────
export {
  validateTechnologyReadinessReport,
  validateTechnologyReadinessSnapshot,
  getTechnologyReadinessValidationReport,
} from "./technology-readiness-validation";
