// src/lib/pierre/v1/hr-mission-packs/domains/recruitment.ts
// PHASE 8.11 — Recruitment (domain B). Gaps: classify_intent, job_requisition, posting, sourcing,
// pipeline, interview_scheduling, reference_checks, screening_decision, candidate_rejection.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, human, cc, sig } from "../schema";

export const RECRUITMENT_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "recruitment.open_requisition", domain: "recruitment", title: "Open requisition & publish role",
    description: "Classify the recruitment intent, build the requisition (need, job description), route budget approval, publish the posting.",
    capabilityIds: ["recruitment.classify_intent", "recruitment.job_requisition", "recruitment.posting"], subjectTypes: ["company", "position"],
    steps: [...intakeSkeleton(), rt("classify", "decide", "Classify recruitment intent", "hr.record.append", { dependsOn: ["intake"] }), rt("build_requisition", "prepare_document", "Build requisition + job description", "document.generate", { dependsOn: ["validate"], input: { document_type: "generic_hr_document", title: "Fiche de poste & définition du besoin" } }), rt("budget_gate", "request_approval", "Budget approval", "approval.request", { dependsOn: ["build_requisition"], autonomy: "execute_with_validation" }), rt("publish", "communicate", "Publish the posting", "communication.create_intent", { dependsOn: ["budget_gate"] }), ...closeSkeleton("publish")],
    approvals: [{ when: "always", approver: "hr_manager", reason: "opening a role commits budget" }],
    completionCriteria: [cc("req.published", "Posting published.", "communication"), cc("req.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "recruitment.pipeline_management", domain: "recruitment", title: "Sourcing, pipeline & interviews",
    description: "Manage candidate intake/pipeline (GDPR-scoped), schedule interviews, capture evaluations & references.",
    capabilityIds: ["recruitment.sourcing", "recruitment.pipeline", "recruitment.interview_scheduling", "recruitment.reference_checks"],
    subjectTypes: ["candidate"],
    steps: [...intakeSkeleton(), rt("track", "mutate_record", "Track candidate through pipeline", "recruitment.candidate.ingest", { dependsOn: ["validate"] }), rt("schedule_interview", "schedule", "Schedule interviews", "follow_up.schedule", { dependsOn: ["track"] }), rt("capture_eval", "collect", "Capture evaluations & references", "hr.data.collect", { dependsOn: ["schedule_interview"] }), ...closeSkeleton("capture_eval")],
    permissions: [{ permission: "employee.read", scope: "company" }],
    countryRuleRequirements: [{ ruleFamily: "data_protection", required: true, notes: "candidate data retention/consent = P8.12" }],
    completionCriteria: [cc("pipeline.tracked", "Candidate progressed in pipeline.", "mutation"), cc("pipeline.closed", "Terminal state.", "state")],
    runtimeStatus: "COUNTRY_RULES_REQUIRED",
  }),
  defineMissionPack({
    id: "recruitment.decision", domain: "recruitment", title: "Screening decision & candidate outcome",
    description: "Prepare a fact-based screening summary (never a discriminatory auto-decision), route the accept/reject decision to a human, then send the governed candidate communication.",
    capabilityIds: ["recruitment.screening_decision", "recruitment.candidate_rejection"], subjectTypes: ["candidate"],
    steps: [...intakeSkeleton(), rt("summarize", "decide", "Prepare factual screening summary", "document.generate", { dependsOn: ["validate"], autonomy: "suggest", input: { document_type: "generic_hr_document", title: "Synthèse de présélection (factuelle, non décisionnelle)" } }), human("hiring_decision", "Human accept/reject decision (non-discriminatory)", "hr_manager", { dependsOn: ["summarize"] }), rt("notify_candidate", "communicate", "Send governed candidate communication", "communication.create_intent", { dependsOn: ["hiring_decision"] }), ...closeSkeleton("notify_candidate")],
    approvals: [{ when: "always", approver: "hr_manager", reason: "hiring/rejection decisions are human-owned (non-discrimination)" }],
    countryRuleRequirements: [{ ruleFamily: "data_protection", required: true }],
    proactiveSignals: [sig("recruitment.decision_overdue", "Screening decision pending too long")],
    completionCriteria: [cc("decision.recorded", "Human decision recorded.", "human_recorded"), cc("candidate.notified", "Candidate notified.", "communication")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
