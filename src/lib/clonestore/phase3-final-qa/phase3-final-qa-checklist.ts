// src/lib/clonestore/phase3-final-qa/phase3-final-qa-checklist.ts
// PHASE 3.22 — Phase 3 Final QA Gate — Checklist
//
// Module pur. Pas de Supabase, pas de write, pas d'import Pierre.

import type {
  Phase3FinalQaStep,
  Phase3FinalQaChecklist,
  Phase3FinalQaDomain,
  Phase3FinalQaDomainSummary,
  Phase3FinalQaVerdict,
  Phase3FinalQaSeverity,
  Phase3FinalQaPhaseKey,
} from "./phase3-final-qa-types";

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildPhase3FinalQaChecklist(): Phase3FinalQaChecklist {
  const step = (
    id: string,
    label: string,
    domain: Phase3FinalQaDomain,
    severity: Phase3FinalQaSeverity,
    expected_result: string,
    verification_hint: string,
    phase_key?: Phase3FinalQaPhaseKey
  ): Phase3FinalQaStep => ({
    id, label, domain, severity, status: "pending", expected_result, verification_hint, phase_key,
  });

  const steps: Phase3FinalQaStep[] = [
    // ── A. Couverture des phases ────────────────────────────────────────────
    step("phase3_1_messages_readonly_validated", "P3.1 Messages read-only", "messages", "blocking",
      "test:phase3-1 passe.", "npm run test:phase3-1", "phase3_1"),
    step("phase3_2_cloneos_history_design_validated", "P3.2 CloneOS History design", "cloneos_history", "blocking",
      "test:phase3-2 passe.", "npm run test:phase3-2", "phase3_2"),
    step("phase3_3_cloneos_history_safe_apply_validated", "P3.3 CloneOS History safe apply", "cloneos_history", "blocking",
      "test:phase3-3 passe.", "npm run test:phase3-3", "phase3_3"),
    step("phase3_4_cloneos_history_messages_bridge_validated", "P3.4 CloneOS History bridge messages", "messages", "blocking",
      "test:phase3-4 passe.", "npm run test:phase3-4", "phase3_4"),
    step("phase3_5_onboarding_persistence_draft_validated", "P3.5 Onboarding persistence draft", "onboarding", "blocking",
      "test:phase3-5 passe.", "npm run test:phase3-5", "phase3_5"),
    step("phase3_6_onboarding_safe_apply_validated", "P3.6 Onboarding safe apply", "onboarding", "blocking",
      "test:phase3-6 passe.", "npm run test:phase3-6", "phase3_6"),
    step("phase3_7_onboarding_manual_activation_validated", "P3.7 Onboarding manual activation QA", "manual_activation", "blocking",
      "test:phase3-7 passe.", "npm run test:phase3-7", "phase3_7"),
    step("phase3_8_enterprise_footprint_qa_validated", "P3.8 Empreinte read/write QA", "enterprise_footprint", "blocking",
      "test:phase3-8 passe.", "npm run test:phase3-8", "phase3_8"),
    step("phase3_9_enterprise_footprint_cockpit_validated", "P3.9 Empreinte cockpit", "profile_agents", "blocking",
      "test:phase3-9 passe.", "npm run test:phase3-9", "phase3_9"),
    step("phase3_10_pierre_setup_footprint_validated", "P3.10 Pierre setup footprint", "pierre_context", "blocking",
      "test:phase3-10 passe.", "npm run test:phase3-10", "phase3_10"),
    step("phase3_11_pierre_use_footprint_validated", "P3.11 Pierre use footprint", "pierre_context", "blocking",
      "test:phase3-11 passe.", "npm run test:phase3-11", "phase3_11"),
    step("phase3_12_pierre_use_prefill_qa_validated", "P3.12 Pierre prefill QA", "pierre_context", "blocking",
      "test:phase3-12 passe.", "npm run test:phase3-12", "phase3_12"),
    step("phase3_13_enterprise_footprint_server_design_validated", "P3.13 Footprint server design", "enterprise_footprint", "blocking",
      "test:phase3-13 passe.", "npm run test:phase3-13", "phase3_13"),
    step("phase3_14_enterprise_footprint_safe_apply_validated", "P3.14 Footprint safe apply", "enterprise_footprint", "blocking",
      "test:phase3-14 passe.", "npm run test:phase3-14", "phase3_14"),
    step("phase3_15_enterprise_footprint_manual_activation_validated", "P3.15 Footprint manual activation", "manual_activation", "blocking",
      "test:phase3-15 passe.", "npm run test:phase3-15", "phase3_15"),
    step("phase3_16_messages_footprint_feed_validated", "P3.16 Messages footprint feed", "messages", "blocking",
      "test:phase3-16 passe.", "npm run test:phase3-16", "phase3_16"),
    step("phase3_17_messages_cloneos_history_merge_validated", "P3.17 Messages CloneOS merge", "messages", "blocking",
      "test:phase3-17 passe.", "npm run test:phase3-17", "phase3_17"),
    step("phase3_18_footprint_restore_ui_validated", "P3.18 Footprint restore UI", "enterprise_footprint", "blocking",
      "test:phase3-18 passe.", "npm run test:phase3-18", "phase3_18"),
    step("phase3_19_cloneos_history_manual_activation_validated", "P3.19 CloneOS History manual activation", "manual_activation", "blocking",
      "test:phase3-19 passe.", "npm run test:phase3-19", "phase3_19"),
    step("phase3_20_employee_context_registry_design_validated", "P3.20 Employee registry design", "employee_context_registry", "blocking",
      "test:phase3-20 passe.", "npm run test:phase3-20", "phase3_20"),
    step("phase3_21_employee_context_registry_ui_validated", "P3.21 Employee registry UI", "employee_context_registry", "blocking",
      "test:phase3-21 passe.", "npm run test:phase3-21", "phase3_21"),

    // ── B. Invariants ────────────────────────────────────────────────────────
    step("no_pierre_engine_modification", "Moteur Pierre non modifié", "security", "blocking",
      "src/lib/pierre/** inchangé.", "git diff src/lib/pierre"),
    step("no_pierre_api_modification", "APIs Pierre non modifiées", "security", "blocking",
      "src/app/api/pierre/** inchangé.", "git diff src/app/api/pierre"),
    step("no_clonevoice_activation", "CloneVoice non activé", "security", "blocking",
      "Aucune activation CloneVoice production.", "Contrat CloneVoice can_execute_actions false"),
    step("no_cloneos_execution", "Aucune exécution CloneOS", "security", "blocking",
      "Aucune commande CloneOS exécutée depuis les feeds.", "Feeds plan-only / read-only"),
    step("no_unflagged_server_write", "Aucun write serveur non flaggé", "security", "blocking",
      "Tout write serveur est feature-flaggé / manuel.", "POST 423 si flag false"),
    step("no_sql_auto_apply", "Aucun SQL appliqué automatiquement", "security", "blocking",
      "SQL drafts non appliqués par le code.", "Scripts read-only"),
    step("no_env_auto_change", "Aucune modification .env.local automatique", "security", "blocking",
      ".env.local jamais modifié par le code.", "Scripts read-only"),
    step("no_go_live_proof_auto_validation", "Aucune auto-validation go-live", "security", "blocking",
      "go-live-proofs.local.json inchangé.", "Aucun write proof"),
    step("no_service_role_client_usage", "Aucun service role côté client", "security", "blocking",
      "Pas de SUPABASE_SERVICE_ROLE_KEY côté client.", "anon key uniquement"),
    step("no_secret_like_registry_keys", "Aucune clé secret-like dans le registry", "security", "blocking",
      "employee_key/function_key/... ne sont pas des secrets.", "validation anti-secrets"),
    step("localstorage_fallback_preserved", "Fallback localStorage conservé", "security", "blocking",
      "localStorage reste le fallback actif.", "Snapshots localStorage-first"),
    step("manual_activation_paths_documented", "Activation manuelle documentée", "manual_activation", "warning",
      "Docs P3.7/P3.15/P3.19 présentes.", "docs/PHASE_3_*_MANUAL_ACTIVATION*"),
    step("profile_pages_readonly_context_preserved", "Contexte profile read-only conservé", "profile_agents", "blocking",
      "/profile/* affiche le contexte en read-only.", "Pas de write depuis les pages"),
    step("messages_no_message_sent", "Aucun message envoyé", "messages", "blocking",
      "/profile/messages n'envoie aucun message.", "Microcopy 'Aucun message envoyé'"),
    step("pierre_prefill_no_auto_submit", "Pierre prefill sans auto-submit", "pierre_context", "blocking",
      "Le prefill utilise setInputDraft, jamais submit auto.", "P3.12 plan-only"),
    step("employee_registry_design_only", "Registry employés design-only", "employee_context_registry", "blocking",
      "execution_enabled false, design-only.", "P3.20/P3.21"),
    step("public_launch_external_not_validated", "Lancement public externe non validé", "release_boundary", "info",
      "Aucune déclaration de lancement public externe validé.", "go-live-proofs inchangé"),

    // ── C. Validation ──────────────────────────────────────────────────────────
    step("phase3_tests_available", "Scripts test:phase3-* disponibles", "qa", "blocking",
      "test:phase3-1 → test:phase3-22 présents.", "package.json"),
    step("phase3_tests_passed", "Tests Phase 3 passent", "qa", "blocking",
      "Tous les test:phase3-* passent.", "npm run test:phase3-*"),
    step("pfinal02_passed", "test:pfinal02 passe", "qa", "blocking",
      "test:pfinal02 passe.", "npm run test:pfinal02"),
    step("npm_test_passed", "npm test passe", "qa", "blocking",
      "npm test passe.", "npm test"),
    step("build_passed", "build passe", "qa", "blocking",
      "npm run build clean.", "npm run build"),
    step("final_evidence_template_created", "Evidence template final créé", "qa", "warning",
      "PHASE_3_22_FINAL_QA_GATE_EVIDENCE.md présent.", "docs/templates/"),
    step("phase3_final_report_created", "Rapport final Phase 3 créé", "qa", "warning",
      "PHASE_3_22_PHASE_3_FINAL_QA_GATE.md présent.", "docs/"),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.22",
  };
}

// ── Domain summaries ──────────────────────────────────────────────────────────

export function buildPhase3FinalQaDomainSummaries(
  steps: Phase3FinalQaStep[]
): Phase3FinalQaDomainSummary[] {
  const domains = Array.from(new Set(steps.map((s) => s.domain)));
  return domains.map((domain) => {
    const domainSteps = steps.filter((s) => s.domain === domain);
    return {
      domain,
      total: domainSteps.length,
      passed: domainSteps.filter((s) => s.status === "passed").length,
      pending: domainSteps.filter((s) => s.status === "pending" || s.status === "skipped").length,
      failed: domainSteps.filter((s) => s.status === "failed").length,
      blocking_failed: domainSteps.filter((s) => s.status === "failed" && s.severity === "blocking").length,
    };
  });
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export function buildPhase3FinalQaVerdict(steps: Phase3FinalQaStep[]): Phase3FinalQaVerdict {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  if (blockingFailed.length > 0) return "blocked";
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");
  if (pending.length === 0) return "pass";
  const anyFailed = steps.filter((s) => s.status === "failed");
  if (anyFailed.length > 0) return "fail";
  return "needs_review";
}

export function getPhase3FinalQaBlockingSteps(): Phase3FinalQaStep[] {
  return buildPhase3FinalQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizePhase3FinalQaChecklist(checklist: Phase3FinalQaChecklist): string {
  const verdict = buildPhase3FinalQaVerdict(checklist.steps);
  const lines = [
    `[Phase 3 Final QA Gate] Verdict : ${verdict.toUpperCase()}`,
    `  Étapes totales : ${checklist.total}`,
    `  Bloquantes : ${checklist.blocking_count}`,
    `  Lancement public externe : non validé.`,
  ];
  return lines.join("\n");
}
