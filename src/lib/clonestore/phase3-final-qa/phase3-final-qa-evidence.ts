// src/lib/clonestore/phase3-final-qa/phase3-final-qa-evidence.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Evidence
//
// Module pur. Pas de Supabase, pas de write, pas d'import Pierre.

import type { Phase3FinalQaEvidenceTemplate } from "./phase3-final-qa-types";

export function buildPhase3FinalQaEvidenceTemplate(): Phase3FinalQaEvidenceTemplate {
  return {
    gate_date: "",
    environment: "local",
    commit_or_branch: "",
    tsc_result: "not_checked",
    phase_tests_result: "",
    pfinal02_result: "",
    npm_test_result: "",
    build_result: "not_checked",
    no_write_no_execution_confirmed: false,
    pierre_engine_api_untouched_confirmed: false,
    clonevoice_not_active_confirmed: false,
    cloneos_not_executed_confirmed: false,
    localstorage_fallback_confirmed: false,
    manual_activation_confirmed: false,
    sql_auto_applied: false,
    env_auto_modified: false,
    go_live_proofs_modified: false,
    public_launch_external_status: "not_validated",
    decision: "PENDING",
    notes: "",
    screenshots_or_refs: [],
  };
}

export function validatePhase3FinalQaEvidenceTemplate(
  evidence: Phase3FinalQaEvidenceTemplate
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!evidence.gate_date?.trim()) issues.push("gate_date requis.");
  if (!evidence.commit_or_branch?.trim()) issues.push("commit_or_branch requis.");
  if (evidence.tsc_result === "not_checked") issues.push("tsc_result non vérifié.");
  if (evidence.build_result === "not_checked") issues.push("build_result non vérifié.");
  if (!evidence.no_write_no_execution_confirmed) issues.push("no_write_no_execution non confirmé.");
  if (!evidence.pierre_engine_api_untouched_confirmed) issues.push("Pierre engine/API non confirmé inchangé.");
  if (!evidence.clonevoice_not_active_confirmed) issues.push("CloneVoice non actif non confirmé.");
  if (!evidence.localstorage_fallback_confirmed) issues.push("localStorage fallback non confirmé.");
  if (evidence.public_launch_external_status !== "not_validated") {
    issues.push("public_launch_external_status doit rester 'not_validated'.");
  }
  if (evidence.decision === "PENDING") issues.push("Décision PENDING — gate non terminé.");

  return { valid: issues.length === 0, issues };
}

export function summarizePhase3FinalQaEvidence(
  evidence: Phase3FinalQaEvidenceTemplate
): string {
  return [
    `[Phase 3 Evidence] Décision : ${evidence.decision}`,
    `  tsc : ${evidence.tsc_result} · build : ${evidence.build_result}`,
    `  Pierre inchangé : ${evidence.pierre_engine_api_untouched_confirmed}`,
    `  CloneVoice non actif : ${evidence.clonevoice_not_active_confirmed}`,
    `  Lancement public externe : ${evidence.public_launch_external_status}`,
  ].join("\n");
}
