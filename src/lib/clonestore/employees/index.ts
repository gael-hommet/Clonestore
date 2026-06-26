// TECH-02 — CloneStore Employees Module
// Central export for the Employee Runtime Contract layer.
//
// Architecture:
//   CloneStore Platform
//   → Global Technologies (CloneOS, CloneADN, CloneGuard, CloneTrace, ...)
//   → Employee Runtime Contract  ← this module
//   → Employee IA métier: Pierre (HR), Emma (Support), Lucas (Finance), ...
//
// Technologies are NOT employees.
// Employees plug into global technologies via the EmployeeRuntimeContract.

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  EmployeeSlug,
  EmployeeDomain,
  EmployeeStatus,
  EmployeeLaunchStage,
  EmployeeCapability,
  EmployeeMissionType,
  EmployeeTaskType,
  EmployeeArtifactType,
  EmployeeChannel,
  EmployeeRiskDomain,
  EmployeeTechnologyRequirement,
  EmployeeGuardProfile,
  EmployeePolicyPackRef,
  EmployeeTrustProfile,
  EmployeeTraceProfile,
  EmployeeADNUsageProfile,
  EmployeeReviewProfile,
  EmployeeSignalsProfile,
  EmployeeBriefProfile,
  EmployeePermissionSet,
  EmployeeUnavailableReason,
  EmployeeLaunchReadiness,
  EmployeeRuntimeContract,
} from "./employee-runtime-contract";

export { VALID_EMPLOYEE_TECHNOLOGY_SLUGS } from "./employee-runtime-contract";

// ── Registry ──────────────────────────────────────────────────────────────────

export {
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
  EMPLOYEE_RUNTIME_REGISTRY,
  getEmployeeRuntimeContract,
  listEmployeeRuntimeContracts,
  listLaunchReadyEmployees,
  listEmployeesByDomain,
  listEmployeesByTechnology,
  isEmployeeLaunchReady,
  getEmployeeRequiredTechnologies,
  getEmployeeHardRequiredTechnologies,
} from "./employee-registry";

// ── Validator ─────────────────────────────────────────────────────────────────

export type {
  EmployeeContractValidationResult,
  EmployeeRegistryValidationReport,
} from "./employee-registry-validator";

export {
  validateEmployeeRuntimeContract,
  validateEmployeeRuntimeRegistry,
  getEmployeeRuntimeValidationReport,
} from "./employee-registry-validator";

// ── Readiness ─────────────────────────────────────────────────────────────────

export type {
  EmployeeReadinessStatus,
  EmployeeRuntimeReadinessResult,
  EmployeeRuntimeReadinessVerdict,
} from "./employee-runtime-readiness";

export {
  buildEmployeeRuntimeReadiness,
  buildAllEmployeeRuntimeReadiness,
  getEmployeeRuntimeReadinessVerdict,
} from "./employee-runtime-readiness";
