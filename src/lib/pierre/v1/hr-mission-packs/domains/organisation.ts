// src/lib/pierre/v1/hr-mission-packs/domains/organisation.ts
// PHASE 8.11 — Organisation & planning (domain A). Gaps: manage_org_structure, workforce_planning,
// position_budget, succession_planning.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, human, cc } from "../schema";

export const ORGANISATION_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "org.structure_management", domain: "org", title: "Model & maintain org structure",
    description: "Model teams/departments/positions and keep the org chart consistent with sites and members.",
    capabilityIds: ["org.manage_org_structure"], subjectTypes: ["company", "team", "position"],
    steps: [...intakeSkeleton(), svc("apply", "mutate_record", "Apply structure changes (sites/positions/assignments)", "org.update_site", { dependsOn: ["validate"] }), rt("notify", "communicate", "Notify affected managers", "communication.create_intent", { dependsOn: ["apply"] }), ...closeSkeleton("notify")],
    permissions: [{ permission: "company.write", scope: "company" }],
    expectedEmployeeMutations: [{ target: "employee", operation: "update", field: "site/position", reversible: true }],
    completionCriteria: [cc("org.structure.applied", "Structure change applied.", "mutation"), cc("org.structure.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "org.workforce_planning", domain: "org", title: "Workforce planning & headcount analysis",
    description: "Analyze current headcount vs future needs, propose a plan; a human approves budget/hiring decisions.",
    capabilityIds: ["org.workforce_planning", "org.position_budget"], subjectTypes: ["company"],
    steps: [...intakeSkeleton(), rt("analyze", "collect", "Analyze headcount & needs (workforce planning)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "workforce_planning" }, autonomy: "suggest" }), human("approve_budget", "Approve budget / hiring plan", "hr_manager", { dependsOn: ["analyze"] }), rt("record", "mutate_record", "Record the approved plan", "mission.noop", { dependsOn: ["approve_budget"] }), ...closeSkeleton("record")],
    approvals: [{ when: "always", approver: "hr_manager", reason: "budget/hiring decisions are human-owned" }],
    completionCriteria: [cc("org.plan.recorded", "Approved plan recorded.", "human_recorded"), cc("org.plan.closed", "Terminal state.", "state")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
  defineMissionPack({
    id: "org.succession_planning", domain: "org", title: "Succession planning for key roles",
    description: "Identify key roles + successors (sensitive data), route to leadership for decision, record outcomes.",
    capabilityIds: ["org.succession_planning"], subjectTypes: ["company", "position", "employee"],
    steps: [...intakeSkeleton(), rt("map_roles", "collect", "Map key roles & candidate successors (succession analysis)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "succession_planning" }, autonomy: "suggest" }), human("leadership_decision", "Leadership succession decision", "owner", { dependsOn: ["map_roles"] }), ...closeSkeleton("leadership_decision")],
    approvals: [{ when: "always", approver: "owner", reason: "succession is a leadership decision" }],
    completionCriteria: [cc("org.succession.recorded", "Succession decision recorded.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
