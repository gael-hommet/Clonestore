// src/lib/pierre/v1/hr-mission-packs/domains/absence-time.ts
// PHASE 8.11 — Absences, leave & time mission packs (canon domain G). Covers the P8.11 gaps:
// approval_workflow, conflict_detection, timeclock_integration, payroll_transmission.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, svc, ext, cc, sig } from "../schema";

export const ABSENCE_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "absence.request_to_decision", domain: "absence",
    title: "Absence request → conflict check → approval → decision",
    description: "End-to-end absence handling: create the request, detect calendar conflicts, route to the manager/HR for approval, record the decision, notify, and arm the payroll-transmission signal.",
    capabilityIds: ["absence.create_request", "absence.approval_workflow", "absence.conflict_detection", "absence.list"],
    subjectTypes: ["employee", "absence_request"],
    supportedIntents: ["request_absence", "approve_absence", "reject_absence"],
    steps: [
      ...intakeSkeleton(),
      svc("create_request", "mutate_record", "Create the absence request", "absence.create_request", { dependsOn: ["validate"] }),
      rt("detect_conflicts", "validate", "Detect overlapping absences / team coverage conflicts", "mission.noop", { dependsOn: ["create_request"] }),
      rt("request_approval", "request_approval", "Route to manager/HR for approval", "approval.request", { dependsOn: ["detect_conflicts"], autonomy: "execute_with_validation" }),
      rt("notify", "communicate", "Notify requester + manager of the decision", "communication.create_intent", { dependsOn: ["request_approval"], emitsSignal: "absence.payroll_transmission_due" }),
      ...closeSkeleton("notify"),
    ],
    approvals: [{ when: "always", approver: "manager", reason: "an absence must be validated by the manager/HR" }],
    permissions: [{ permission: "absence.write", scope: "team" }],
    expectedCommunications: [{ channel: "in_app", audience: "employee", templateFamily: "absence.decision", proofOfSend: true }],
    expectedEmployeeMutations: [{ target: "absence", operation: "create", reversible: true }],
    proactiveSignals: [sig("absence.payroll_transmission_due", "Approved absence must reach payroll")],
    completionCriteria: [cc("absence.mutated", "The absence request exists and its decision is recorded.", "mutation"), cc("absence.notified", "Requester was notified of the decision.", "communication"), cc("absence.closed", "Mission reached terminal state.", "state")],
    countryRuleRequirements: [{ ruleFamily: "paid_leave", required: false, notes: "balance/entitlement values are P8.12 country rules" }],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "absence.payroll_transmission", domain: "absence",
    title: "Transmit approved absences to payroll",
    description: "Collect approved absences for a period, prepare the payroll-facing recap, and hand off to the payroll pipeline; reconcile the provider return.",
    capabilityIds: ["absence.payroll_transmission"],
    subjectTypes: ["company", "payroll_run"],
    steps: [
      ...intakeSkeleton(),
      rt("collect_period", "collect", "Collect approved absences for the payroll period", "mission.noop", { dependsOn: ["validate"] }),
      rt("prepare_recap", "prepare_document", "Prepare the absence recap for payroll", "mission.noop", { dependsOn: ["collect_period"] }),
      ext("handoff_payroll", "await_external", "Hand off recap to the payroll pipeline", "payroll_provider", { dependsOn: ["prepare_recap"], autonomy: "execute_with_validation" }),
      rt("reconcile", "reconcile", "Reconcile provider return", "mission.noop", { dependsOn: ["handoff_payroll"] }),
      ...closeSkeleton("reconcile"),
    ],
    integrationRequirements: [{ system: "payroll_provider", status: "not_integrated", notes: "real payroll integration is P8.12" }],
    expectedArtifacts: [{ kind: "report", format: "csv", label: "Absence recap", retention: "legal_audit" }],
    completionCriteria: [cc("absence.recap", "Absence recap prepared.", "artifact"), cc("absence.reconciled", "Provider return reconciled.", "external_reconciled")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
  defineMissionPack({
    id: "absence.timeclock_integration", domain: "absence",
    title: "Time-clock / attendance integration (orchestration)",
    description: "Ingest attendance from a time system, normalize to worked time, flag anomalies, and feed absence/time records.",
    capabilityIds: ["absence.timeclock_integration"],
    subjectTypes: ["company", "employee"],
    steps: [
      ...intakeSkeleton(),
      ext("ingest_attendance", "await_external", "Ingest attendance from the time system", "time_attendance", { dependsOn: ["validate"], autonomy: "execute_with_validation" }),
      rt("normalize", "validate", "Normalize + flag anomalies", "mission.noop", { dependsOn: ["ingest_attendance"] }),
      ...closeSkeleton("normalize"),
    ],
    integrationRequirements: [{ system: "time_attendance", status: "not_integrated", notes: "time & attendance provider integration is P8.12" }],
    completionCriteria: [cc("time.normalized", "Attendance normalized to worked time.", "state")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
];
