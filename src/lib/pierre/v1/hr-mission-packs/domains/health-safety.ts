// src/lib/pierre/v1/hr-mission-packs/domains/health-safety.ts
// PHASE 8.11 — Health, safety & wellbeing (domain O). Gaps: incident_reporting, risk_assessment,
// accommodations, mental_health, safety_clearances. Pierre NEVER acts as a physician: medical/mental
// content is observe/prepare only + routed to qualified people.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, human, cc, sig } from "../schema";

export const HEALTH_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "health.incident_and_risk", domain: "health", title: "Incident reporting & risk assessment",
    description: "Report workplace incidents/accidents, prepare risk assessments & prevention plans, route to the qualified safety owner.",
    capabilityIds: ["health.incident_reporting", "health.risk_assessment", "health.safety_clearances"], subjectTypes: ["company", "employee"],
    steps: [
      ...intakeSkeleton(),
      rt("record_incident", "collect", "Record incident/accident facts", "mission.noop", { dependsOn: ["validate"] }),
      rt("prepare_assessment", "collect", "Prepare risk assessment (surface risks/gaps)", "analytics.compute", { dependsOn: ["record_incident"], input: { metric: "anomaly_surfacing" } }),
      human("safety_owner", "Route to safety owner / decision", "hr_manager", { dependsOn: ["prepare_assessment"] }),
      ...closeSkeleton("safety_owner"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "safety measures are human-owned" }],
    countryRuleRequirements: [{ ruleFamily: "occupational_health", required: true, notes: "incident declaration obligations are P8.12" }],
    completionCriteria: [cc("health.assessed", "Assessment prepared & routed.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
  defineMissionPack({
    id: "health.accommodations_wellbeing", domain: "health", title: "Accommodations & wellbeing signals",
    description: "Manage medical accommodations (restricted data, human decision) and surface wellbeing/workload signals — never a diagnosis.",
    capabilityIds: ["health.accommodations", "health.mental_health"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("surface_signal", "collect", "Surface wellbeing/workload signals (non-diagnostic)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "absenteeism" }, autonomy: "observe_only", emitsSignal: "health.wellbeing_signal" }),
      human("qualified_decision", "Qualified human decision (occupational health/HR)", "hr_manager", { dependsOn: ["surface_signal"] }),
      ...closeSkeleton("qualified_decision"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "medical accommodations require qualified humans" }],
    countryRuleRequirements: [{ ruleFamily: "occupational_health", required: true }],
    proactiveSignals: [sig("health.wellbeing_signal", "Wellbeing/workload signal")],
    completionCriteria: [cc("health.routed", "Routed to a qualified human.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
