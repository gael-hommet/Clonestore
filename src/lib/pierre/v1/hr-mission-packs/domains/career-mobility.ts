// src/lib/pierre/v1/hr-mission-packs/domains/career-mobility.ts
// PHASE 8.11 — Career & mobility (domain L). Gaps: wishes, internal_mobility, geographic_mobility,
// succession_transition, mentoring.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, human, cc } from "../schema";

export const CAREER_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "career.wishes_and_mentoring", domain: "career", title: "Career wishes & mentoring",
    description: "Capture career wishes/evolution paths and manage mentoring relationships & retention signals.",
    capabilityIds: ["career.wishes", "career.mentoring"], subjectTypes: ["employee"],
    steps: [...intakeSkeleton(), rt("capture", "mutate_record", "Capture career wishes / mentoring links", "hr.record.append", { dependsOn: ["validate"] }), rt("followup", "schedule", "Schedule follow-up", "follow_up.schedule", { dependsOn: ["capture"] }), ...closeSkeleton("followup")],
    completionCriteria: [cc("career.captured", "Wishes/mentoring captured.", "mutation"), cc("career.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "career.mobility", domain: "career", title: "Internal / geographic mobility & role transition",
    description: "Handle internal & geographic mobility requests and succession/role transitions; geographic mobility feeds a contract amendment (country rules for site change).",
    capabilityIds: ["career.internal_mobility", "career.geographic_mobility", "career.succession_transition"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("assess", "collect", "Assess the mobility request (workforce context)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "workforce_planning" } }),
      human("mobility_decision", "Manager/HR mobility decision", "hr_manager", { dependsOn: ["assess"] }),
      svc("feed_amendment", "mutate_record", "Feed contract amendment (site/role)", "contract.create_amendment", { dependsOn: ["mobility_decision"] }),
      ...closeSkeleton("feed_amendment"),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "mobility affects the contract" }],
    countryRuleRequirements: [{ ruleFamily: "working_time", required: false, notes: "site-change legal terms are P8.12" }],
    completionCriteria: [cc("mobility.decided", "Mobility decision recorded.", "human_recorded"), cc("mobility.amended", "Amendment fed.", "mutation")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
