// src/lib/pierre/v1/hr-mission-packs/schema.ts
// PHASE 8.11 — mission-pack authoring layer: concise step builders + defineMissionPack() that fills
// safe defaults so declarative domain packs stay terse while every pack ends up complete. Defaults
// are fail-closed (ask_and_block, resumable recovery, mission-correlation idempotency).

import type {
  HrMissionPackDefinition, HrMissionPackSeed, HrMissionPackStep, MissionPackStepKind,
  StepBinding, HrMissionCompletionCriterion, HrMissionProactiveSignal,
} from "./types";
import type { HrAutonomyLevel, HrIntegrationDependency } from "../hr-canon/types";

type StepOpts = { autonomy?: HrAutonomyLevel; optional?: boolean; dependsOn?: string[]; requiresApproval?: boolean; emitsSignal?: string };

/** step bound to a CLOSED runtime action (validated against runtime-action-registry). */
export function rt(key: string, kind: MissionPackStepKind, label: string, actionKey: string, o: StepOpts = {}): HrMissionPackStep {
  return { key, kind, label, binding: { type: "runtime_action", actionKey }, autonomy: o.autonomy ?? "execute_autonomous", optional: o.optional, dependsOn: o.dependsOn, requiresApproval: o.requiresApproval, emitsSignal: o.emitsSignal };
}
/** step realized by a governed service (a canon capability). */
export function svc(key: string, kind: MissionPackStepKind, label: string, capabilityId: string, o: StepOpts = {}): HrMissionPackStep {
  return { key, kind, label, binding: { type: "governed_service", capabilityId }, autonomy: o.autonomy ?? "execute_with_validation", optional: o.optional, dependsOn: o.dependsOn, requiresApproval: o.requiresApproval, emitsSignal: o.emitsSignal };
}
/** step that is a legally-reserved human decision (Pierre only assists + records). */
export function human(key: string, label: string, role: string, o: StepOpts = {}): HrMissionPackStep {
  return { key, kind: "await_human", label, binding: { type: "human_decision", role }, autonomy: "human_only", optional: o.optional, dependsOn: o.dependsOn, requiresApproval: true, emitsSignal: o.emitsSignal };
}
/** step that hands off to an external provider not yet integrated (blocked, orchestration only). */
export function ext(key: string, kind: MissionPackStepKind, label: string, system: HrIntegrationDependency["system"], o: StepOpts = {}): HrMissionPackStep {
  return { key, kind, label, binding: { type: "external_handoff", system }, autonomy: o.autonomy ?? "execute_with_validation", optional: o.optional, dependsOn: o.dependsOn, requiresApproval: o.requiresApproval, emitsSignal: o.emitsSignal };
}
export function cc(id: string, statement: string, check: HrMissionCompletionCriterion["check"]): HrMissionCompletionCriterion { return { id, statement, check }; }
export function sig(signalKey: string, label: string): HrMissionProactiveSignal { return { signalKey, label }; }

// A default governed skeleton every pack shares: intake → resolve → collect → validate.
export function intakeSkeleton(): HrMissionPackStep[] {
  return [
    rt("intake", "intake", "Understand the request & classify the process", "mission.noop", { autonomy: "execute_autonomous" }),
    svc("resolve_subject", "resolve_subject", "Resolve the subject (employee/candidate/contract/file)", "employee360.view_360", { autonomy: "execute_autonomous" }),
    rt("collect", "collect", "Collect missing information (ask, fail-closed on critical)", "mission.noop", { autonomy: "execute_autonomous" }),
    rt("validate", "validate", "Validate permissions & preconditions", "mission.noop", { autonomy: "execute_autonomous" }),
  ];
}
// A default close: audit + complete.
export function closeSkeleton(dep: string): HrMissionPackStep[] {
  return [rt("close", "close", "Close the mission, persist full audit evidence", "mission.complete", { autonomy: "execute_autonomous", dependsOn: [dep] })];
}

export function defineMissionPack(seed: HrMissionPackSeed): HrMissionPackDefinition {
  return {
    id: seed.id, version: seed.version ?? 1, domain: seed.domain,
    title: seed.title, description: seed.description ?? seed.title,
    capabilityIds: seed.capabilityIds, supportedIntents: seed.supportedIntents ?? [seed.id],
    subjectTypes: seed.subjectTypes ?? ["employee"],
    requiredContext: seed.requiredContext ?? [],
    missingInformationPolicy: seed.missingInformationPolicy ?? "ask_and_block",
    entryConditions: seed.entryConditions ?? [{ key: "permitted", description: "actor holds the required permission" }],
    steps: seed.steps,
    expectedArtifacts: seed.expectedArtifacts ?? [],
    expectedCommunications: seed.expectedCommunications ?? [],
    expectedEmployeeMutations: seed.expectedEmployeeMutations ?? [],
    approvals: seed.approvals ?? [],
    permissions: seed.permissions ?? [],
    countryRuleRequirements: seed.countryRuleRequirements ?? [],
    integrationRequirements: seed.integrationRequirements ?? [],
    proactiveSignals: seed.proactiveSignals ?? [],
    completionCriteria: seed.completionCriteria ?? [cc(`${seed.id}.done`, "Mission reached a terminal state with full audit evidence.", "state")],
    recovery: seed.recovery ?? { onWorkerCrash: "lease_recover_reclaim", onProviderFailure: "retry_backoff_deadletter", resumable: true },
    idempotency: seed.idempotency ?? { key: seed.id, dedup: "mission_correlation" },
    runtimeStatus: seed.runtimeStatus,
  };
}
