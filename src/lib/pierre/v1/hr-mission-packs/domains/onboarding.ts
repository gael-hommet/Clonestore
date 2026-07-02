// src/lib/pierre/v1/hr-mission-packs/domains/onboarding.ts
// PHASE 8.11 — Onboarding (domain E). Gaps: employee_onboarding_plan, document_collection,
// access_provisioning, incomplete_handling.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, ext, cc, sig } from "../schema";

export const ONBOARDING_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "onboarding.run_plan", domain: "onboarding", title: "Run employee onboarding plan",
    description: "Build the onboarding plan (preboarding, docs, access, equipment, buddy, checkpoints), collect documents, chase gaps, and detect incomplete onboarding.",
    capabilityIds: ["onboarding.employee_onboarding_plan", "onboarding.document_collection", "onboarding.incomplete_handling"],
    subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      svc("build_plan", "prepare_document", "Build the onboarding plan from the canonical registry", "onboarding.registry_steps", { dependsOn: ["validate"] }),
      rt("collect_docs", "collect", "Collect onboarding documents", "communication.create_intent", { dependsOn: ["build_plan"] }),
      rt("chase", "schedule", "Chase missing documents", "follow_up.schedule", { dependsOn: ["collect_docs"], emitsSignal: "onboarding.missing_document" }),
      rt("detect_incomplete", "validate", "Detect incomplete onboarding at deadline", "mission.noop", { dependsOn: ["chase"], emitsSignal: "onboarding.incomplete" }),
      ...closeSkeleton("detect_incomplete"),
    ],
    proactiveSignals: [sig("onboarding.missing_document", "Onboarding document still missing"), sig("onboarding.incomplete", "Onboarding incomplete at deadline")],
    completionCriteria: [cc("onboarding.plan", "Plan built.", "artifact"), cc("onboarding.chased", "Missing docs chased.", "communication"), cc("onboarding.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "onboarding.access_provisioning", domain: "onboarding", title: "Account & access provisioning (orchestration)",
    description: "Request accounts/access from the identity provider (not integrated), track completion, revoke on offboarding.",
    capabilityIds: ["onboarding.access_provisioning"], subjectTypes: ["employee"],
    steps: [...intakeSkeleton(), ext("provision", "await_external", "Provision accounts/access", "identity_provider", { dependsOn: ["validate"], autonomy: "execute_with_validation" }), rt("track", "reconcile", "Track provisioning completion", "mission.noop", { dependsOn: ["provision"] }), ...closeSkeleton("track")],
    integrationRequirements: [{ system: "identity_provider", status: "not_integrated", notes: "IdP integration is P8.12" }],
    completionCriteria: [cc("access.reconciled", "Access provisioning reconciled.", "external_reconciled")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
];
