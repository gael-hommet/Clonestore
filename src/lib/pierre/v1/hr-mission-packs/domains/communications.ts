// src/lib/pierre/v1/hr-mission-packs/domains/communications.ts
// PHASE 8.11 — HR communications (domain P). Gaps: templates, scheduling, read_receipt,
// legal_review. (send/intent/webhook/dead-letter/etc. are VERIFIED_EXISTING from P8.9.)
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, human, cc } from "../schema";

export const COMMUNICATION_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "communications.governed_campaign", domain: "communications", title: "Governed HR communication (template → schedule → send → receipt)",
    description: "Select/manage a template, schedule within quiet hours, send via the verified delivery runtime, and track read receipt.",
    capabilityIds: ["communications.templates", "communications.scheduling", "communications.read_receipt"], subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("select_template", "prepare_document", "Select/prepare the template", "document.generate", { dependsOn: ["validate"] }),
      rt("schedule", "schedule", "Schedule within quiet hours", "follow_up.schedule", { dependsOn: ["select_template"] }),
      rt("send", "communicate", "Send via the verified delivery runtime", "communication.create_intent", { dependsOn: ["schedule"] }),
      rt("track_receipt", "reconcile", "Track read receipt / engagement", "hr.reconcile.apply", { dependsOn: ["send"] }),
      ...closeSkeleton("track_receipt"),
    ],
    expectedCommunications: [{ channel: "email", audience: "employee", templateFamily: "hr.generic", proofOfSend: true }],
    completionCriteria: [cc("comm.sent", "Communication sent.", "communication"), cc("comm.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "communications.legal_review", domain: "communications", title: "Legal/compliance review of communication content",
    description: "Screen communication content for legal/compliance risk and route to a human reviewer for sensitive categories.",
    capabilityIds: ["communications.legal_review"], subjectTypes: ["document"],
    steps: [
      ...intakeSkeleton(),
      rt("screen", "validate", "Screen content for legal/compliance risk", "hr.record.append", { dependsOn: ["validate"], autonomy: "suggest" }),
      human("legal_reviewer", "Human legal/compliance review", "hr_manager", { dependsOn: ["screen"] }),
      ...closeSkeleton("legal_reviewer"),
    ],
    approvals: [{ when: "if_legal_sensitive", approver: "hr_manager", reason: "legal-sensitive comms need human review" }],
    completionCriteria: [cc("comm.reviewed", "Content reviewed & approved.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
