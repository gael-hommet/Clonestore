// src/lib/pierre/v1/hr-mission-packs/types.ts
// PHASE 8.11 — Total HR Mission Packs. A mission pack is the DECLARATIVE realization of one or
// more P8.10 canon capabilities as a governed, durable HR workflow that compiles onto the ALREADY
// VERIFIED runtime (closed action registry, mission/task/queue, approvals, documents,
// communications, scheduler, Employee 360, audit). Packs never carry SQL, a provider, a tenant, an
// unregistered action, or an unpolicied mutation — those are structurally impossible here.

import type {
  HrDomainId, HrSubjectType, HrExpectedArtifact, HrExpectedCommunication, HrEmployeeMutation,
  HrApprovalPolicy, HrPermissionRequirement, HrCountryRuleDependency, HrIntegrationDependency,
  HrMissingInformationPolicy, HrAutonomyLevel,
} from "../hr-canon/types";

// How a pack step binds to the verified runtime. This is the ONLY way a step executes.
export type StepBinding =
  | { type: "runtime_action"; actionKey: string; input?: Record<string, unknown> } // closed registry action + optional typed input (e.g. analytics metric)
  | { type: "governed_service"; capabilityId: string }            // a canon capability realized by a governed service fn
  | { type: "human_decision"; role: string }                      // legally-reserved decision → routed to a human
  | { type: "external_handoff"; system: HrIntegrationDependency["system"] }; // provider not yet integrated (blocked)

export type MissionPackStepKind =
  | "intake" | "resolve_subject" | "collect" | "validate" | "decide"
  | "prepare_document" | "request_approval" | "mutate_record" | "communicate"
  | "schedule" | "signature" | "await_human" | "await_external" | "reconcile" | "archive" | "close";

export type HrMissionPackStep = {
  key: string;
  kind: MissionPackStepKind;
  label: string;
  binding: StepBinding;
  autonomy: HrAutonomyLevel;
  optional?: boolean;
  dependsOn?: string[];
  requiresApproval?: boolean;
  emitsSignal?: string;      // proactive signal key this step arms
};

export type HrContextRequirement = { key: string; label: string; critical: boolean };
export type HrMissionEntryCondition = { key: string; description: string };
export type HrMissionProactiveSignal = { signalKey: string; label: string };
export type HrMissionCompletionCriterion = { id: string; statement: string; check: "artifact" | "mutation" | "communication" | "approval" | "human_recorded" | "external_reconciled" | "state" };

export type HrMissionRecoveryPolicy = { onWorkerCrash: "lease_recover_reclaim" | "manual"; onProviderFailure: "retry_backoff_deadletter" | "manual" | "not_applicable"; resumable: boolean };
export type HrMissionIdempotencyPolicy = { key: string; dedup: "mission_correlation" | "idempotency_key" | "state_guard" };

export type MissionPackRuntimeStatus =
  | "IMPLEMENTED"                       // fully orchestrated on verified runtime, no external/human blocker
  | "RUNTIME_READY_EXTERNAL_BLOCKED"    // orchestration complete; a real provider is required to finish
  | "HUMAN_DECISION_REQUIRED"          // includes a legally-reserved human decision Pierre only assists
  | "COUNTRY_RULES_REQUIRED"           // orchestration complete; P8.12 legal values required to finalize
  | "BLOCKED";

export type HrMissionPackDefinition = {
  id: string;
  version: number;
  domain: HrDomainId;
  title: string;
  description: string;

  capabilityIds: string[];             // canon capabilities this pack realizes
  supportedIntents: string[];
  subjectTypes: HrSubjectType[];

  requiredContext: HrContextRequirement[];
  missingInformationPolicy: HrMissingInformationPolicy;

  entryConditions: HrMissionEntryCondition[];
  steps: HrMissionPackStep[];

  expectedArtifacts: HrExpectedArtifact[];
  expectedCommunications: HrExpectedCommunication[];
  expectedEmployeeMutations: HrEmployeeMutation[];

  approvals: HrApprovalPolicy[];
  permissions: HrPermissionRequirement[];
  countryRuleRequirements: HrCountryRuleDependency[];
  integrationRequirements: HrIntegrationDependency[];

  proactiveSignals: HrMissionProactiveSignal[];
  completionCriteria: HrMissionCompletionCriterion[];

  recovery: HrMissionRecoveryPolicy;
  idempotency: HrMissionIdempotencyPolicy;

  runtimeStatus: MissionPackRuntimeStatus;
};

export type HrMissionPackSeed = Partial<HrMissionPackDefinition> &
  Pick<HrMissionPackDefinition, "id" | "domain" | "title" | "capabilityIds" | "steps" | "runtimeStatus">;
