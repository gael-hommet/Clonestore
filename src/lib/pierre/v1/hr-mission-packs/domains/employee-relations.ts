// src/lib/pierre/v1/hr-mission-packs/domains/employee-relations.ts
// PHASE 8.11 — Employee relations (domain M). Gaps: hr_requests, complaints, mediation,
// harassment_alert. (whistleblower is HUMAN_ONLY, not built here.) Sensitive/confidential; Pierre
// intakes + routes to a human, never adjudicates.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, human, cc, sig } from "../schema";

export const RELATIONS_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "relations.hr_requests", domain: "relations", title: "HR request / question ticketing",
    description: "Intake HR questions/requests, route to the right HR owner, track resolution.",
    capabilityIds: ["relations.hr_requests"], subjectTypes: ["employee"],
    steps: [...intakeSkeleton(), rt("route", "mutate_record", "Route to the HR owner", "mission.noop", { dependsOn: ["validate"] }), rt("track", "schedule", "Track resolution SLA", "follow_up.schedule", { dependsOn: ["route"], emitsSignal: "relations.request_sla" }), ...closeSkeleton("track")],
    permissions: [{ permission: "employee.read", scope: "company" }],
    proactiveSignals: [sig("relations.request_sla", "HR request SLA breach")],
    completionCriteria: [cc("relations.routed", "Request routed & tracked.", "mutation"), cc("relations.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "relations.complaints_and_alerts", domain: "relations", title: "Complaints, conflicts, mediation & sensitive alerts",
    description: "Confidentially intake complaints/conflicts and harassment/discrimination alerts; Pierre records facts and IMMEDIATELY routes to the qualified human — it never investigates or decides.",
    capabilityIds: ["relations.complaints", "relations.mediation", "relations.harassment_alert"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("record_confidential", "collect", "Record facts confidentially (restricted access)", "mission.noop", { dependsOn: ["validate"], autonomy: "observe_only" }),
      human("route_to_qualified", "Route to qualified human (HR/legal/referent)", "hr_manager", { dependsOn: ["record_confidential"] }),
      ...closeSkeleton("route_to_qualified"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "sensitive alerts are handled by qualified humans" }],
    countryRuleRequirements: [{ ruleFamily: "data_protection", required: true, notes: "confidentiality/whistleblower rules are P8.12" }],
    completionCriteria: [cc("relations.recorded", "Facts recorded & routed to a human.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
