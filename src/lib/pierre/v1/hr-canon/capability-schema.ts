// src/lib/pierre/v1/hr-canon/capability-schema.ts
// PHASE 8.10 — the schema layer over HrCapabilityDefinition: the canonical enum value sets
// (used by the validator) + `defineCapability(seed)` which fills conservative defaults so the
// registry can be authored concisely while every capability still ends up COMPLETE. Defaults
// are deliberately safe (empty arrays, fail-closed policies) — a capability that omits a field
// gets the least-capable, least-risky default, never a fabricated one.

import type {
  HrCapabilityDefinition, HrCapabilitySeed, HrDomainId, HrLifecycleStage, HrTriggerMode,
  HrActorRole, HrSubjectType, HrMissingInformationPolicy, HrAutonomyLevel, HrImplementationStatus,
  HrTargetPhase, HrWorkflowContract, HrWorkflowStep, HrCertificationCriterion,
} from "./types";
import { HR_DOMAIN_IDS } from "./domains";

// Canonical enum value sets (single source for the validator).
export const VALUES = {
  domain: HR_DOMAIN_IDS as readonly HrDomainId[],
  lifecycleStage: ["pre_hire", "recruitment", "hiring", "contract", "onboarding", "daily_admin", "absence_time", "payroll", "compensation", "performance", "training", "career", "relations", "disciplinary", "health_safety", "communications", "policy", "compliance", "mobility", "offboarding", "archival", "reporting", "proactive"] as readonly HrLifecycleStage[],
  triggerMode: ["employee_request", "manager_request", "hr_request", "candidate_request", "scheduled", "event_driven", "proactive_detection", "external_webhook", "system"] as readonly HrTriggerMode[],
  actor: ["employee", "manager", "hr_operator", "hr_manager", "admin", "owner", "payroll_operator", "candidate", "external_recipient", "system", "pierre_autonomous"] as readonly HrActorRole[],
  subject: ["company", "site", "team", "position", "employee", "candidate", "contract", "document", "mission", "task", "delivery", "policy", "payroll_run", "training_record", "absence_request", "none"] as readonly HrSubjectType[],
  missingInfo: ["ask_and_block", "ask_and_draft_partial", "block_fail_closed", "proceed_with_default"] as readonly HrMissingInformationPolicy[],
  autonomy: ["observe_only", "suggest", "prepare_draft", "execute_with_validation", "execute_autonomous", "human_only", "forbidden"] as readonly HrAutonomyLevel[],
  implementation: ["VERIFIED_EXISTING", "IMPLEMENTED_UNVERIFIED", "PARTIAL", "CONTRACT_ONLY", "MISSING", "EXTERNAL_DEPENDENCY", "LEGAL_CONTENT_REQUIRED", "HUMAN_ONLY", "OUT_OF_SCOPE"] as readonly HrImplementationStatus[],
  targetPhase: ["P8.11", "P8.12", "ALREADY_VERIFIED", "HUMAN_ONLY"] as readonly HrTargetPhase[],
} as const;

// Map an implementation status → the default phase that must finish it (author may override).
export function defaultTargetPhase(status: HrImplementationStatus, countryDependent: boolean): HrTargetPhase {
  if (status === "VERIFIED_EXISTING") return "ALREADY_VERIFIED";
  if (status === "HUMAN_ONLY") return "HUMAN_ONLY";
  if (status === "LEGAL_CONTENT_REQUIRED" || countryDependent) return "P8.12";
  return "P8.11"; // IMPLEMENTED_UNVERIFIED / PARTIAL / CONTRACT_ONLY / MISSING / EXTERNAL_DEPENDENCY
}

// A generic-but-real workflow scaffold, shaped by the capability's autonomy. Used only when the
// author does not supply a specific workflow, so every capability still carries a step contract.
function defaultWorkflow(seed: HrCapabilitySeed): HrWorkflowContract {
  const autonomy = seed.autonomy ?? "prepare_draft";
  const steps: HrWorkflowStep[] = [
    { key: "collect", kind: "collect", label: "Collect required inputs", autonomy: "execute_autonomous" },
    { key: "validate", kind: "validate", label: "Validate inputs & preconditions", autonomy: "execute_autonomous" },
  ];
  if (autonomy === "observe_only" || autonomy === "suggest") {
    steps.push({ key: "report", kind: "communicate", label: "Report / suggest to a human", autonomy });
  } else {
    steps.push({ key: "prepare", kind: "prepare_document", label: "Prepare the artifact/draft", autonomy: "execute_autonomous", optional: true });
    if (autonomy === "execute_with_validation") steps.push({ key: "approve", kind: "await_human", label: "Human validation", autonomy: "human_only" });
    steps.push({ key: "execute", kind: "mutate_record", label: "Execute the governed action", autonomy });
    steps.push({ key: "communicate", kind: "communicate", label: "Notify stakeholders", autonomy: "execute_autonomous", optional: true });
  }
  steps.push({ key: "close", kind: "close", label: "Close & audit", autonomy: "execute_autonomous" });
  return { entryConditions: ["actor permitted", "subject resolved"], steps, terminalStates: ["completed", "cancelled"], reversible: false };
}

// A default certification criterion when the author supplies none — met iff already verified.
function defaultCertification(seed: HrCapabilitySeed): HrCertificationCriterion[] {
  const status = seed.implementation;
  const verifiedBy: HrCertificationCriterion["verifiedBy"] =
    status === "LEGAL_CONTENT_REQUIRED" ? "legal_review"
    : status === "EXTERNAL_DEPENDENCY" ? "provider_integration"
    : status === "HUMAN_ONLY" ? "human_signoff"
    : "integration_test";
  return [{ id: `${seed.id}.cert`, statement: `${seed.label}: behaves per its workflow/approval contract and emits the expected audit events.`, verifiedBy, met: status === "VERIFIED_EXISTING" }];
}

/** Fill conservative defaults so every seed becomes a complete HrCapabilityDefinition. */
export function defineCapability(seed: HrCapabilitySeed): HrCapabilityDefinition {
  const countryDependent = (seed.countryRuleDependencies ?? []).some((c) => c.required);
  const status = seed.implementation;
  return {
    id: seed.id,
    version: seed.version ?? 1,
    domain: seed.domain,
    operation: seed.operation,
    label: seed.label,
    description: seed.description ?? seed.label,

    lifecycleStages: seed.lifecycleStages ?? [],
    triggerModes: seed.triggerModes ?? ["hr_request"],

    supportedActors: seed.supportedActors ?? ["hr_operator"],
    subjectTypes: seed.subjectTypes ?? ["none"],

    requiredInputs: seed.requiredInputs ?? [],
    optionalInputs: seed.optionalInputs ?? [],
    missingInformationPolicy: seed.missingInformationPolicy ?? "ask_and_block",

    workflow: seed.workflow ?? defaultWorkflow(seed),
    expectedTasks: seed.expectedTasks ?? [],
    expectedArtifacts: seed.expectedArtifacts ?? [],
    expectedCommunications: seed.expectedCommunications ?? [],
    employeeMutations: seed.employeeMutations ?? [],

    approvals: seed.approvals ?? [],
    permissions: seed.permissions ?? [],
    risk: seed.risk ?? { level: "medium", reversibility: "reversible", legalSensitivity: "standard", dataSensitivity: "normal", reasons: [] },
    autonomy: seed.autonomy ?? (status === "HUMAN_ONLY" ? "human_only" : "prepare_draft"),

    proactiveSignals: seed.proactiveSignals ?? [],
    deadlines: seed.deadlines ?? [],

    integrationDependencies: seed.integrationDependencies ?? [],
    countryRuleDependencies: seed.countryRuleDependencies ?? [],

    auditEvents: seed.auditEvents ?? [],
    recoveryPolicy: seed.recoveryPolicy ?? { onWorkerCrash: "not_applicable", onProviderFailure: "not_applicable" },
    idempotencyPolicy: seed.idempotencyPolicy ?? { key: seed.id, dedup: "none" },

    implementation: status,
    implementationReferences: seed.implementationReferences ?? [],
    evidence: seed.evidence ?? [],

    certificationCriteria: (seed.certificationCriteria && seed.certificationCriteria.length > 0) ? seed.certificationCriteria : defaultCertification(seed),
    targetPhase: seed.targetPhase ?? defaultTargetPhase(status, countryDependent),
  };
}
