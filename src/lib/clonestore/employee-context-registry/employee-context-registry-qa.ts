// src/lib/clonestore/employee-context-registry/employee-context-registry-qa.ts
// PHASE 3.20 — Global Employee Context Registry Design — QA Module
//
// Module pur — checklist QA design-only.
// Pas de Supabase, pas d'API, pas de réseau, pas de write, pas d'import Pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmployeeContextRegistryQaStepId =
  | "registry_types_exist"
  | "registry_defaults_exist"
  | "pierre_employee_context_exists"
  | "future_placeholders_design_only"
  | "safe_keys_used"
  | "no_secret_keys"
  | "validation_blocks_secrets"
  | "execution_disabled_by_default"
  | "clonevoice_contract_design_only"
  | "clonevoice_routes_through_cloneos"
  | "cloneguard_required_for_sensitive_actions"
  | "clonetrace_required_for_audit"
  | "enterprise_bridge_design_only"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_db_write"
  | "public_launch_external_not_validated";

export type EmployeeContextRegistryQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type EmployeeContextRegistryQaStepSeverity =
  | "blocking"
  | "warning"
  | "info";

export type EmployeeContextRegistryQaStep = {
  id: EmployeeContextRegistryQaStepId;
  label: string;
  description: string;
  severity: EmployeeContextRegistryQaStepSeverity;
  status: EmployeeContextRegistryQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EmployeeContextRegistryQaChecklist = {
  steps: EmployeeContextRegistryQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.20";
};

export type EmployeeContextRegistryQaVerdict =
  | "ready"
  | "blocked"
  | "needs_review"
  | "pending";

export type EmployeeContextRegistryQaSummary = {
  verdict: EmployeeContextRegistryQaVerdict;
  blocking_steps: EmployeeContextRegistryQaStepId[];
  passed_steps: EmployeeContextRegistryQaStepId[];
  pending_steps: EmployeeContextRegistryQaStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildEmployeeContextRegistryQaChecklist(): EmployeeContextRegistryQaChecklist {
  const mk = (
    id: EmployeeContextRegistryQaStepId,
    label: string,
    description: string,
    severity: EmployeeContextRegistryQaStepSeverity,
    how_to_verify: string,
    expected_result: string
  ): EmployeeContextRegistryQaStep => ({
    id, label, description, severity, status: "pending", how_to_verify, expected_result,
  });

  const steps: EmployeeContextRegistryQaStep[] = [
    mk("registry_types_exist", "Types registry présents",
      "employee-context-registry-types.ts défini.", "blocking",
      "Vérifier le fichier types.", "Types EmployeeContextRegistry présents."),
    mk("registry_defaults_exist", "Defaults présents",
      "employee-context-registry-defaults.ts défini.", "blocking",
      "Vérifier le fichier defaults.", "Defaults présents avec Pierre + placeholders."),
    mk("pierre_employee_context_exists", "Contexte Pierre présent",
      "PIERRE_EMPLOYEE_CONTEXT défini avec capacités et fonctions.", "blocking",
      "Vérifier PIERRE_EMPLOYEE_CONTEXT.", "Pierre V1 détaillé présent."),
    mk("future_placeholders_design_only", "Placeholders design-only",
      "Les placeholders futurs sont inactifs et design-only.", "blocking",
      "Vérifier status future_placeholder + active_for_company false.", "Placeholders design-only."),
    mk("safe_keys_used", "Clés produit safe utilisées",
      "employee_key/function_key/capability_key/technology_key/policy_key safe.", "blocking",
      "Vérifier le format des clés.", "Clés lowercase snake_case, pas de secrets."),
    mk("no_secret_keys", "Aucune clé secrète",
      "Aucun secret_key/api_key/private_key/token stocké.", "blocking",
      "Vérifier l'absence de secrets.", "Aucun secret dans le registry."),
    mk("validation_blocks_secrets", "Validation bloque les secrets",
      "La validation détecte et bloque les motifs secrets.", "blocking",
      "Tester detectUnsafeEmployeeContextRegistryText.", "Motifs secrets bloqués."),
    mk("execution_disabled_by_default", "Exécution désactivée par défaut",
      "execution_enabled false partout.", "blocking",
      "Vérifier execution_enabled.", "execution_enabled = false."),
    mk("clonevoice_contract_design_only", "Contrat CloneVoice design-only",
      "Le contrat CloneVoice est design-only, sans exécution.", "blocking",
      "Vérifier can_execute_actions false.", "Contrat CloneVoice design-only."),
    mk("clonevoice_routes_through_cloneos", "CloneVoice passe par CloneOS",
      "must_route_through_cloneos true.", "blocking",
      "Vérifier le contrat CloneVoice.", "Routage CloneOS obligatoire."),
    mk("cloneguard_required_for_sensitive_actions", "CloneGuard requis (sensible)",
      "must_pass_cloneguard true.", "blocking",
      "Vérifier le contrat CloneVoice.", "CloneGuard obligatoire."),
    mk("clonetrace_required_for_audit", "CloneTrace requis (audit)",
      "must_trace_with_clonetrace true.", "blocking",
      "Vérifier le contrat CloneVoice.", "CloneTrace obligatoire."),
    mk("enterprise_bridge_design_only", "Bridge Enterprise design-only",
      "Le bridge ne sauvegarde rien et ne modifie pas le footprint.", "blocking",
      "Vérifier le bridge.", "Bridge design-only, aucun write."),
    mk("no_supabase_import", "Aucun import Supabase",
      "Aucun fichier registry n'importe Supabase.", "blocking",
      "Vérifier les imports.", "Aucun import Supabase."),
    mk("no_pierre_engine_import", "Aucun import moteur Pierre",
      "Aucun fichier registry n'importe src/lib/pierre.", "blocking",
      "Vérifier les imports.", "Aucun import Pierre moteur."),
    mk("no_cloneos_execution", "Aucune exécution CloneOS",
      "Le registry ne déclenche aucune exécution CloneOS.", "blocking",
      "Vérifier l'absence d'exécution.", "Aucune exécution CloneOS."),
    mk("no_db_write", "Aucun write DB",
      "Aucune écriture en base depuis le registry.", "blocking",
      "Vérifier l'absence de write.", "Aucun write DB."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé",
      "PHASE 3.20 n'active pas le lancement public externe.", "info",
      "Vérifier go-live-proofs.local.json non modifié.", "Lancement public externe non validé."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.20",
  };
}

export function buildEmployeeContextRegistryQaVerdict(
  steps: EmployeeContextRegistryQaStep[]
): EmployeeContextRegistryQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: EmployeeContextRegistryQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: EmployeeContextRegistryQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeEmployeeContextRegistryQaVerdict(summary);
  return summary;
}

export function getEmployeeContextRegistryBlockingSteps(): EmployeeContextRegistryQaStep[] {
  return buildEmployeeContextRegistryQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeEmployeeContextRegistryQaVerdict(
  summary: EmployeeContextRegistryQaSummary
): string {
  const lines = [
    `[QA PHASE 3.20 Employee Context Registry] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "ready") lines.push("  → QA Registry design validée.");
  else if (summary.verdict === "pending") lines.push("  → Prêt pour vérification. Design-only.");
  return lines.join("\n");
}
