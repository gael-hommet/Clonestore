// src/lib/pierre/v1/hr-mission-packs/domains/training.ts
// PHASE 8.11 — Training & skills (domain K). Gaps: skills_mapping, plan, enrollment,
// certification_tracking, evaluation.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, ext, cc, sig } from "../schema";

export const TRAINING_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "training.plan_and_enroll", domain: "training", title: "Skills mapping → training plan → enrollment → evaluation",
    description: "Map required vs held skills, build the training plan, enroll + convocations, run enrollment via training provider, capture post-training evaluation.",
    capabilityIds: ["training.skills_mapping", "training.plan", "training.enrollment", "training.evaluation"],
    subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("map_skills", "validate", "Map required vs held skills (gap)", "hr.record.append", { dependsOn: ["validate"] }),
      rt("build_plan", "prepare_document", "Build the training plan", "document.generate", { dependsOn: ["map_skills"] }),
      rt("convocation", "communicate", "Send enrollment convocations", "communication.create_intent", { dependsOn: ["build_plan"] }),
      ext("enroll", "await_external", "Enroll via training provider", "training_provider", { dependsOn: ["convocation"], optional: true }),
      rt("evaluate", "collect", "Capture post-training evaluation", "hr.data.collect", { dependsOn: ["convocation"] }),
      ...closeSkeleton("evaluate"),
    ],
    integrationRequirements: [{ system: "training_provider", status: "not_integrated", notes: "LMS/training provider integration is P8.12" }],
    completionCriteria: [cc("training.planned", "Plan built.", "artifact"), cc("training.convoked", "Convocations sent.", "communication"), cc("training.closed", "Terminal state.", "state")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
  defineMissionPack({
    id: "training.certification_tracking", domain: "training", title: "Certification validity & expiry tracking",
    description: "Track certification validity, detect upcoming expiry, and proactively chase renewals.",
    capabilityIds: ["training.certification_tracking"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("scan_expiry", "validate", "Scan certifications for upcoming expiry", "hr.record.append", { dependsOn: ["validate"], emitsSignal: "training.certification_expiring" }),
      rt("chase", "schedule", "Chase renewal", "follow_up.schedule", { dependsOn: ["scan_expiry"] }),
      ...closeSkeleton("chase"),
    ],
    proactiveSignals: [sig("training.certification_expiring", "Certification expiring")],
    completionCriteria: [cc("training.tracked", "Expiry tracked & chased.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
