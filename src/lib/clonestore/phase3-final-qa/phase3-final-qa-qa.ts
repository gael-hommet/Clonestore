// src/lib/clonestore/phase3-final-qa/phase3-final-qa-qa.ts
// PHASE 3.22 — Phase 3 Final QA Gate — QA Module (méta)
//
// Module pur. Pas de Supabase, pas de write, pas d'import Pierre.

export type Phase3FinalQaQaStepId =
  | "final_qa_types_exist"
  | "final_qa_checklist_exists"
  | "final_qa_invariants_exist"
  | "final_qa_report_exists"
  | "final_qa_evidence_exists"
  | "final_qa_script_exists"
  | "final_qa_doc_exists"
  | "final_qa_evidence_template_exists"
  | "phase3_1_to_21_covered"
  | "no_write_in_final_qa_modules"
  | "no_supabase_import_in_final_qa_modules"
  | "no_pierre_engine_import_in_final_qa_modules"
  | "public_launch_external_not_validated"
  | "phase3_final_gate_ready";

export type Phase3FinalQaQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type Phase3FinalQaQaStepSeverity = "blocking" | "warning" | "info";

export type Phase3FinalQaQaStep = {
  id: Phase3FinalQaQaStepId;
  label: string;
  severity: Phase3FinalQaQaStepSeverity;
  status: Phase3FinalQaQaStepStatus;
  expected_result: string;
};

export type Phase3FinalQaQaChecklist = {
  steps: Phase3FinalQaQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.22";
};

export type Phase3FinalQaQaVerdict = "ready" | "blocked" | "needs_review" | "pending";

export type Phase3FinalQaQaSummary = {
  verdict: Phase3FinalQaQaVerdict;
  blocking_steps: Phase3FinalQaQaStepId[];
  passed_steps: Phase3FinalQaQaStepId[];
  pending_steps: Phase3FinalQaQaStepId[];
  message: string;
  safe_to_close: boolean;
};

export function buildPhase3FinalQaQaChecklist(): Phase3FinalQaQaChecklist {
  const mk = (
    id: Phase3FinalQaQaStepId,
    label: string,
    severity: Phase3FinalQaQaStepSeverity,
    expected_result: string
  ): Phase3FinalQaQaStep => ({ id, label, severity, status: "pending", expected_result });

  const steps: Phase3FinalQaQaStep[] = [
    mk("final_qa_types_exist", "Types final QA présents", "blocking", "phase3-final-qa-types.ts présent."),
    mk("final_qa_checklist_exists", "Checklist final QA présente", "blocking", "phase3-final-qa-checklist.ts présent."),
    mk("final_qa_invariants_exist", "Invariants final QA présents", "blocking", "phase3-final-qa-invariants.ts présent."),
    mk("final_qa_report_exists", "Report final QA présent", "blocking", "phase3-final-qa-report.ts présent."),
    mk("final_qa_evidence_exists", "Evidence final QA présent", "blocking", "phase3-final-qa-evidence.ts présent."),
    mk("final_qa_script_exists", "Script final check présent", "blocking", "scripts/check-phase3-final-qa.mjs présent."),
    mk("final_qa_doc_exists", "Doc finale Phase 3 présente", "blocking", "PHASE_3_22_PHASE_3_FINAL_QA_GATE.md présent."),
    mk("final_qa_evidence_template_exists", "Evidence template présent", "warning", "PHASE_3_22_FINAL_QA_GATE_EVIDENCE.md présent."),
    mk("phase3_1_to_21_covered", "P3.1 → P3.21 couverts", "blocking", "Checklist couvre les 21 phases."),
    mk("no_write_in_final_qa_modules", "Aucun write dans les modules final QA", "blocking", "Pas d'écriture DB."),
    mk("no_supabase_import_in_final_qa_modules", "Aucun import Supabase", "blocking", "Pas d'import @supabase/supabase-js."),
    mk("no_pierre_engine_import_in_final_qa_modules", "Aucun import moteur Pierre", "blocking", "Pas d'import @/lib/pierre."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé", "info", "Aucune claim de lancement public externe."),
    mk("phase3_final_gate_ready", "Gate Phase 3 prêt", "blocking", "Tous les artefacts du gate présents."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.22",
  };
}

export function buildPhase3FinalQaQaVerdict(steps: Phase3FinalQaQaStep[]): Phase3FinalQaQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: Phase3FinalQaQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: Phase3FinalQaQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_close: verdict !== "blocked",
  };
  summary.message = summarizePhase3FinalQaQaVerdict(summary);
  return summary;
}

export function getPhase3FinalQaQaBlockingSteps(): Phase3FinalQaQaStep[] {
  return buildPhase3FinalQaQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizePhase3FinalQaQaVerdict(summary: Phase3FinalQaQaSummary): string {
  return [
    `[QA PHASE 3.22 Final Gate] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Réussies : ${summary.passed_steps.length} · En attente : ${summary.pending_steps.length}`,
    `  Bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to close : ${summary.safe_to_close}`,
    `  Lancement public externe : non validé.`,
  ].join("\n");
}
