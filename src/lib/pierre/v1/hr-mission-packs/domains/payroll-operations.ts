// src/lib/pierre/v1/hr-mission-packs/domains/payroll-operations.ts
// PHASE 8.11 — Payroll operational (domain H). Gaps: collect_variables, absence_recap,
// anomaly_detection, validation, payslip_distribution, provider_reconciliation, calendar, correction.
// Pierre PREPARES + GOVERNS; the certified engine computes (EXTERNAL). No official calculation here.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, ext, human, cc, sig } from "../schema";

export const PAYROLL_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "payroll.prepare_period", domain: "payroll", title: "Prepare a payroll period (variables, absences, anomalies, validation)",
    description: "Collect variable elements + absence recap, detect anomalies, chase gaps, and require human validation before transmission. No official computation.",
    capabilityIds: ["payroll.collect_variables", "payroll.absence_recap", "payroll.anomaly_detection", "payroll.validation", "payroll.calendar", "payroll.correction"],
    subjectTypes: ["company", "payroll_run"],
    steps: [
      ...intakeSkeleton(),
      rt("collect_variables", "collect", "Collect variables (active employees / inputs)", "analytics.compute", { dependsOn: ["validate"], input: { metric: "payroll_variables" } }),
      rt("absence_recap", "collect", "Build the absence recap", "analytics.compute", { dependsOn: ["collect_variables"], input: { metric: "payroll_absence_recap" } }),
      rt("detect_anomalies", "collect", "Detect payroll anomalies", "analytics.compute", { dependsOn: ["absence_recap"], input: { metric: "payroll_anomalies" }, emitsSignal: "payroll.anomaly" }),
      human("validate_payroll", "Human validation of payroll variables", "payroll_operator", { dependsOn: ["detect_anomalies"] }),
      ...closeSkeleton("validate_payroll"),
    ],
    approvals: [{ when: "always", approver: "payroll_operator", reason: "payroll must be human-validated before transmission" }],
    countryRuleRequirements: [{ ruleFamily: "payroll_contributions", required: true, notes: "contributions/bases = P8.12" }],
    expectedArtifacts: [{ kind: "report", format: "csv", label: "Payroll variables recap", retention: "legal_audit" }],
    proactiveSignals: [sig("payroll.anomaly", "Payroll anomaly detected"), sig("payroll.calendar_cutoff", "Payroll cutoff approaching")],
    completionCriteria: [cc("payroll.recap", "Variables recap prepared.", "artifact"), cc("payroll.validated", "Human validation recorded.", "human_recorded")],
    runtimeStatus: "HUMAN_DECISION_REQUIRED",
  }),
  defineMissionPack({
    id: "payroll.transmit_and_reconcile", domain: "payroll", title: "Transmit to provider, distribute payslips, reconcile",
    description: "Hand the validated variables to the payroll provider (external), securely distribute returned payslips, reconcile the provider return, and handle corrections.",
    capabilityIds: ["payroll.provider_reconciliation", "payroll.payslip_distribution"], subjectTypes: ["company", "payroll_run"],
    steps: [
      ...intakeSkeleton(),
      ext("transmit", "await_external", "Transmit variables to payroll provider", "payroll_provider", { dependsOn: ["validate"], autonomy: "execute_with_validation" }),
      rt("distribute_payslips", "communicate", "Securely distribute returned payslips", "communication.create_intent", { dependsOn: ["transmit"] }),
      rt("reconcile", "reconcile", "Reconcile provider return", "mission.noop", { dependsOn: ["distribute_payslips"] }),
      ...closeSkeleton("reconcile"),
    ],
    integrationRequirements: [{ system: "payroll_provider", status: "not_integrated", notes: "certified payroll engine + declarations = P8.12" }],
    countryRuleRequirements: [{ ruleFamily: "payslip_requirements", required: true }],
    expectedCommunications: [{ channel: "email", audience: "employee", templateFamily: "payroll.payslip", proofOfSend: true }],
    completionCriteria: [cc("payroll.transmitted", "Transmitted + reconciled.", "external_reconciled"), cc("payroll.distributed", "Payslips distributed.", "communication")],
    runtimeStatus: "RUNTIME_READY_EXTERNAL_BLOCKED",
  }),
];
