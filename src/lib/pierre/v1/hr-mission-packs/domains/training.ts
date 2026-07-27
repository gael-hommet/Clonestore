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
  // P22 Reprise 12 — a FULLY AUTHORITATIVE pack: every business step is a real runtime action, later
  // steps thread upstream runtime-generated ids via {$ref}, a human validation gates activation, and it
  // ends in a real terminal (report → mission.complete). Runs end-to-end on the governed runtime.
  defineMissionPack({
    id: "training.mandatory_compliance_setup", domain: "training",
    title: "Set up a mandatory training obligation (sourced → planned → validated)",
    description: "Register the source policy, create the mandatory requirement, verify its source resolves to a real policy, schedule a session, build the plan (threaded ids), gate activation on a human validation, then produce the training report.",
    capabilityIds: ["training.mandatory_compliance", "training.plan"],
    supportedIntents: ["training.mandatory_compliance_setup", "formation obligatoire", "mandatory training", "training compliance", "plan de formation", "mettre en place la formation", "formation securite obligatoire"],
    subjectTypes: ["employee"],
    steps: [
      rt("policy", "mutate_record", "Register the source policy", "hr.policy.create", { input: { policy_key: "mandatory-training-policy", title: "Politique de formation obligatoire" } }),
      rt("requirement", "mutate_record", "Create the mandatory training requirement", "training.requirement.create", { dependsOn: ["policy"], input: { requirement_key: "mandatory-training", title: "Formation obligatoire", source_type: "company_policy", source_ref: "mandatory-training-policy", mandatory: true, proof_required: true } }),
      rt("validate_source", "validate", "Verify the requirement's source resolves to a real policy", "training.requirement.validate_source", { dependsOn: ["requirement"], input: { requirement_key: "mandatory-training" } }),
      rt("session", "schedule", "Schedule a training session", "training.session.create", { dependsOn: ["validate_source"], input: { title: "Session formation obligatoire", requirement_id: { $ref: { step: "requirement", output: "requirement_id" } } } }),
      rt("plan", "mutate_record", "Build the training plan", "training.plan.create", { dependsOn: ["validate_source"], input: { plan_key: "mandatory-training-plan", title: "Plan de formation obligatoire" } }),
      rt("plan_item", "mutate_record", "Add the requirement to the plan (threaded ids)", "training.plan.item.add", { dependsOn: ["plan", "session"], input: { plan_id: { $ref: { step: "plan", output: "plan_id" } }, requirement_id: { $ref: { step: "requirement", output: "requirement_id" } }, session_id: { $ref: { step: "session", output: "session_id" } } } }),
      rt("approve", "validate", "Human validation of the mandatory obligation (never auto-decided)", "approval.request", { dependsOn: ["plan_item"], requiresApproval: true, input: { reason: "Valider la mise en place de la formation obligatoire", validator_role: "hr_manager" } }),
      rt("report", "prepare_document", "Generate the SQL-computed training report", "training.report.generate", { dependsOn: ["approve"], input: {} }),
      ...closeSkeleton("report"),
    ],
    countryRuleRequirements: [{ ruleFamily: "mandatory_trainings", required: true, notes: "mandatory training obligations are country-specific (P8.12)" }],
    completionCriteria: [cc("training.compliance.planned", "Mandatory training set up + human-validated.", "artifact"), cc("training.compliance.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
