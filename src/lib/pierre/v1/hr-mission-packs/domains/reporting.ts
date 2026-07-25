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
    steps: [...intakeSkeleton(),
      rt("compute_headcount", "collect", "Compute headcount/turnover", "analytics.compute", { dependsOn: ["validate"], input: { metric: "headcount" } }),
      rt("compute_absence", "collect", "Compute absenteeism", "analytics.compute", { dependsOn: ["compute_headcount"], input: { metric: "absenteeism" } }),
      rt("compute_funnel", "collect", "Compute recruitment funnel", "analytics.compute", { dependsOn: ["compute_absence"], input: { metric: "recruitment_funnel" } }),
      rt("compute_completeness", "collect", "Compute completeness/deadlines", "analytics.compute", { dependsOn: ["compute_funnel"], input: { metric: "completeness_deadlines" } }),
      rt("render", "prepare_document", "Render the dashboard/report", "document.generate", { dependsOn: ["compute_completeness"] }),
      ...closeSkeleton("render")],
    permissions: [{ permission: "audit.read", scope: "company" }],
    expectedArtifacts: [{ kind: "report", format: "json", label: "HR dashboard", retention: "hot_90d" }],
    completionCriteria: [cc("report.rendered", "Dashboard rendered.", "artifact"), cc("report.closed", "Terminal state.", "state")],
    runtimeStatus: "IMPLEMENTED",
  }),
  defineMissionPack({
    id: "reporting.executive_and_anomalies", domain: "reporting", title: "Executive report & anomaly surfacing",
    description: "Prepare periodic executive/HR reports with recommended actions and surface anomalies/risks proactively.",
    capabilityIds: ["reporting.executive_report", "reporting.anomaly_surfacing"], subjectTypes: ["company"],
    steps: [...intakeSkeleton(), rt("surface", "collect", "Surface anomalies & risks", "analytics.compute", { dependsOn: ["validate"], input: { metric: "anomaly_surfacing" }, emitsSignal: "reporting.anomaly" }), rt("prepare_report", "collect", "Prepare executive report + recommended actions", "analytics.compute", { dependsOn: ["surface"], input: { metric: "executive_report" } }), ...closeSkeleton("prepare_report")],
    proactiveSignals: [sig("reporting.anomaly", "HR anomaly/risk surfaced")],
    completionCriteria: [cc("report.executive", "Executive report prepared.", "artifact")],
    runtimeStatus: "IMPLEMENTED",
  }),
];
