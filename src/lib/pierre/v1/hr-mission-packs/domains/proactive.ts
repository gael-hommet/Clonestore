// src/lib/pierre/v1/hr-mission-packs/domains/proactive.ts
// PHASE 8.11 — Proactive operations (domain U). Gaps: contract_expiry, missing_document,
// expiring_training, blocked_signature, payroll_anomaly, sla_breach. These packs are triggered by
// detected signals (see hr-proactive) and create governed follow-up missions.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, cc, sig } from "../schema";

export const PROACTIVE_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "proactive.deadline_watch", domain: "proactive", title: "Deadline & expiry watch (contract, training, missing docs)",
    description: "Detect approaching contract expiry, expiring training, and missing documents; create governed follow-up missions and chase.",
    capabilityIds: ["proactive.contract_expiry", "proactive.expiring_training", "proactive.missing_document"], subjectTypes: ["employee", "contract"],
    steps: [
      ...intakeSkeleton(),
      rt("detect", "validate", "Detect due/expiring/missing items", "mission.noop", { dependsOn: ["validate"], emitsSignal: "proactive.deadline" }),
      rt("chase", "schedule", "Create governed follow-up + chase", "follow_up.schedule", { dependsOn: ["detect"] }),
      ...closeSkeleton("chase"),
    ],
    proactiveSignals: [sig("proactive.deadline", "Deadline/expiry/missing-doc detected")],
    completionCriteria: [cc("proactive.chased", "Follow-up created.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "proactive.operational_watch", domain: "proactive", title: "Operational watch (blocked signature, payroll anomaly, SLA breach)",
    description: "Detect blocked signatures, payroll anomalies and SLA breaches; escalate via governed missions.",
    capabilityIds: ["proactive.blocked_signature", "proactive.payroll_anomaly", "proactive.sla_breach"], subjectTypes: ["company"],
    steps: [
      ...intakeSkeleton(),
      rt("detect", "validate", "Detect operational risk signals", "mission.noop", { dependsOn: ["validate"], emitsSignal: "proactive.operational_risk" }),
      rt("escalate", "communicate", "Escalate to the responsible owner", "communication.create_intent", { dependsOn: ["detect"] }),
      ...closeSkeleton("escalate"),
    ],
    proactiveSignals: [sig("proactive.operational_risk", "Operational risk (signature/payroll/SLA)")],
    completionCriteria: [cc("proactive.escalated", "Risk escalated.", "communication")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
