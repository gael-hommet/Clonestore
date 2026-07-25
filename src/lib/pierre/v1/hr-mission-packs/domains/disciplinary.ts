// src/lib/pierre/v1/hr-mission-packs/domains/disciplinary.ts
// PHASE 8.11 — Disciplinary (domain N). Gaps: file_report, chain_of_custody, appeal, closure.
// (qualify + decision are HUMAN_ONLY — Pierre never qualifies a fault or decides a sanction.)
// Pierre only collects facts, preserves the evidence chain, tracks statutory deadlines, and records
// the human decision + appeal.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, human, cc, sig } from "../schema";

export const DISCIPLINARY_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "disciplinary.case_governance", domain: "disciplinary", title: "Disciplinary case: facts, chain of custody, deadlines, closure",
    description: "File the report, preserve the evidence chain of custody, watch statutory deadlines, and — after the HUMAN qualification/decision (elsewhere) — record the outcome, handle appeal, and close/archive. Pierre never qualifies the fault or decides the sanction.",
    capabilityIds: ["disciplinary.file_report", "disciplinary.chain_of_custody", "disciplinary.appeal", "disciplinary.closure"],
    subjectTypes: ["employee"],
    steps: [
      ...intakeSkeleton(),
      rt("file_report", "collect", "File report & collect facts (restricted)", "hr.data.collect", { dependsOn: ["validate"], autonomy: "prepare_draft" }),
      rt("chain_of_custody", "prepare_document", "Preserve evidence chain of custody (immutable)", "document.generate", { dependsOn: ["file_report"] }),
      rt("watch_deadlines", "schedule", "Watch statutory disciplinary deadlines", "follow_up.schedule", { dependsOn: ["chain_of_custody"], emitsSignal: "disciplinary.deadline" }),
      human("record_decision", "Record the HUMAN disciplinary decision", "hr_manager", { dependsOn: ["watch_deadlines"] }),
      rt("handle_appeal", "mutate_record", "Record any appeal", "hr.record.append", { dependsOn: ["record_decision"], optional: true }),
      rt("archive", "archive", "Close & archive the case (retention)", "mission.complete", { dependsOn: ["record_decision"] }),
    ],
    approvals: [{ when: "always", approver: "hr_manager", reason: "disciplinary decisions are legally reserved to humans" }],
    countryRuleRequirements: [{ ruleFamily: "disciplinary_procedure", required: true, notes: "procedure/deadlines/sanction scale are P8.12" }],
    proactiveSignals: [sig("disciplinary.deadline", "Disciplinary statutory deadline approaching")],
    completionCriteria: [cc("disc.recorded", "Human decision recorded.", "human_recorded"), cc("disc.archived", "Case archived.", "state")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
];
