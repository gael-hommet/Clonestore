// src/lib/pierre/v1/hr-mission-packs/domains/performance.ts
// PHASE 8.11 — Performance (domain J). Gaps: objectives, annual_review, feedback_360, one_to_one,
// calibration, pip, recognition.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, human, cc, sig } from "../schema";

export const PERFORMANCE_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "performance.review_cycle", domain: "performance", title: "Performance review cycle (objectives → review → recognition)",
    description: "Set objectives, run annual/professional interviews and 1:1s, collect 360 feedback, document outcomes and recognition.",
    capabilityIds: ["performance.objectives", "performance.annual_review", "performance.feedback_360", "performance.one_to_one", "performance.recognition"],
    subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("set_objectives", "mutate_record", "Set/track objectives", "employee.timeline.append", { dependsOn: ["validate"], input: { entry_type: "performance_objectives" } }),
      rt("schedule_review", "schedule", "Schedule review & 1:1", "follow_up.schedule", { dependsOn: ["set_objectives"], emitsSignal: "performance.review_due" }),
      rt("collect_feedback", "collect", "Collect 360 feedback", "hr.data.collect", { dependsOn: ["schedule_review"] }),
      rt("document", "prepare_document", "Document review outcome & recognition", "document.generate", { dependsOn: ["collect_feedback"] }),
      ...closeSkeleton("document"),
    ],
    countryRuleRequirements: [{ ruleFamily: "mandatory_trainings", required: false, notes: "professional-interview obligations vary by country (P8.12)" }],
    proactiveSignals: [sig("performance.review_due", "Performance review due")],
    completionCriteria: [cc("perf.documented", "Review documented.", "artifact"), cc("perf.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "performance.calibration_and_pip", domain: "performance", title: "Calibration & performance improvement plan",
    description: "Support calibration/promotion committees (human decisions) and prepare a governed PIP (legally sensitive).",
    capabilityIds: ["performance.calibration", "performance.pip"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("prepare", "collect", "Prepare calibration inputs (compute calibration data)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "performance_calibration" }, autonomy: "suggest" }),
      human("committee_or_manager", "Calibration/PIP human decision", "hr_manager", { dependsOn: ["prepare"] }),
      rt("record", "mutate_record", "Record decision + follow-up", "employee.timeline.append", { dependsOn: ["committee_or_manager"], input: { entry_type: "performance_calibration" } }),
      ...closeSkeleton("record"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "calibration/PIP are human decisions (legal exposure)" }],
    completionCriteria: [cc("perf.decision", "Decision recorded.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
