// src/lib/pierre/v1/hr-mission-packs/domains/reporting.ts
// PHASE 8.11 — Reporting & steering (domain T). Gaps: headcount_turnover, absenteeism,
// recruitment_funnel, completeness_deadlines, executive_report, anomaly_surfacing.
import type { HrMissionPackDefinition } from "../types";
import { defineMissionPack, intakeSkeleton, closeSkeleton, rt, cc, sig } from "../schema";

export const REPORTING_PACKS: HrMissionPackDefinition[] = [
  defineMissionPack({
    id: "reporting.hr_dashboards", domain: "reporting", title: "HR dashboards (headcount, turnover, absenteeism, funnel, completeness)",
    description: "Compute headcount/turnover/absenteeism, recruitment/onboarding funnel, completeness & deadline dashboards from verified data.",
    capabilityIds: ["reporting.headcount_turnover", "reporting.absenteeism", "reporting.recruitment_funnel", "reporting.completeness_deadlines"],
    subjectTypes: ["company"],
    steps: [...intakeSkeleton(), rt("compute", "validate", "Compute the metrics", "mission.noop", { dependsOn: ["validate"] }), rt("render", "prepare_document", "Render the dashboard/report", "mission.noop", { dependsOn: ["compute"] }), ...closeSkeleton("render")],
    permissions: [{ permission: "audit.read", scope: "company" }],
    expectedArtifacts: [{ kind: "report", format: "json", label: "HR dashboard", retention: "hot_90d" }],
    completionCriteria: [cc("report.rendered", "Dashboard rendered.", "artifact"), cc("report.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "reporting.executive_and_anomalies", domain: "reporting", title: "Executive report & anomaly surfacing",
    description: "Prepare periodic executive/HR reports with recommended actions and surface anomalies/risks proactively.",
    capabilityIds: ["reporting.executive_report", "reporting.anomaly_surfacing"], subjectTypes: ["company"],
    steps: [...intakeSkeleton(), rt("surface", "validate", "Surface anomalies & risks", "mission.noop", { dependsOn: ["validate"], emitsSignal: "reporting.anomaly" }), rt("prepare_report", "prepare_document", "Prepare executive report + recommended actions", "mission.noop", { dependsOn: ["surface"] }), ...closeSkeleton("prepare_report")],
    proactiveSignals: [sig("reporting.anomaly", "HR anomaly/risk surfaced")],
    completionCriteria: [cc("report.executive", "Executive report prepared.", "artifact")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
