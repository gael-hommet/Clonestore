// src/lib/clonestore/employee-context-registry/employee-context-registry-profile-feed-qa.ts
// PHASE 3.21 — Global Employee Context Registry UI Preview — QA Module
//
// Module pur. Pas de Supabase, pas d'API, pas de réseau, pas de write, pas d'import Pierre.

export type EmployeeContextRegistryProfileFeedQaStepId =
  | "profile_feed_bridge_exists"
  | "registry_snapshot_reused"
  | "pierre_visible_in_profile_feed"
  | "future_placeholders_visible_design_only"
  | "clonevoice_contract_visible_design_only"
  | "safe_keys_microcopy_visible"
  | "no_secrets_microcopy_visible"
  | "read_only_badge_visible"
  | "no_execution_badge_visible"
  | "no_db_write"
  | "no_api_post"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "profile_agents_panel_visible"
  | "public_launch_external_not_validated";

export type EmployeeContextRegistryProfileFeedQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type EmployeeContextRegistryProfileFeedQaStepSeverity =
  | "blocking" | "warning" | "info";

export type EmployeeContextRegistryProfileFeedQaStep = {
  id: EmployeeContextRegistryProfileFeedQaStepId;
  label: string;
  description: string;
  severity: EmployeeContextRegistryProfileFeedQaStepSeverity;
  status: EmployeeContextRegistryProfileFeedQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EmployeeContextRegistryProfileFeedQaChecklist = {
  steps: EmployeeContextRegistryProfileFeedQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.21";
};

export type EmployeeContextRegistryProfileFeedQaVerdict =
  | "ready" | "blocked" | "needs_review" | "pending";

export type EmployeeContextRegistryProfileFeedQaSummary = {
  verdict: EmployeeContextRegistryProfileFeedQaVerdict;
  blocking_steps: EmployeeContextRegistryProfileFeedQaStepId[];
  passed_steps: EmployeeContextRegistryProfileFeedQaStepId[];
  pending_steps: EmployeeContextRegistryProfileFeedQaStepId[];
  message: string;
  safe_to_activate: boolean;
};

export function buildEmployeeContextRegistryProfileFeedQaChecklist(): EmployeeContextRegistryProfileFeedQaChecklist {
  const mk = (
    id: EmployeeContextRegistryProfileFeedQaStepId,
    label: string,
    description: string,
    severity: EmployeeContextRegistryProfileFeedQaStepSeverity,
    how_to_verify: string,
    expected_result: string
  ): EmployeeContextRegistryProfileFeedQaStep => ({
    id, label, description, severity, status: "pending", how_to_verify, expected_result,
  });

  const steps: EmployeeContextRegistryProfileFeedQaStep[] = [
    mk("profile_feed_bridge_exists", "Bridge profile feed présent",
      "employee-context-registry-profile-feed.ts défini.", "blocking",
      "Vérifier le fichier bridge.", "Bridge présent avec toutes les fonctions."),
    mk("registry_snapshot_reused", "Snapshot registry réutilisé",
      "Le feed réutilise buildEmployeeContextRegistrySnapshot.", "blocking",
      "Vérifier l'import snapshot.", "Snapshot P3.20 réutilisé."),
    mk("pierre_visible_in_profile_feed", "Pierre visible dans le feed",
      "Pierre V1 apparaît dans les employés actifs.", "blocking",
      "Vérifier le feed sur /profile/agents.", "Pierre visible."),
    mk("future_placeholders_visible_design_only", "Placeholders visibles design-only",
      "Les placeholders futurs sont affichés comme inactifs.", "blocking",
      "Vérifier la section placeholders.", "Placeholders design-only visibles."),
    mk("clonevoice_contract_visible_design_only", "Contrat CloneVoice visible design-only",
      "Le contrat CloneVoice gouverné est affiché, non actif.", "blocking",
      "Vérifier la section CloneVoice.", "Contrat design-only visible."),
    mk("safe_keys_microcopy_visible", "Microcopy keys safe visible",
      "Le panneau rappelle que les keys ne sont pas des secrets.", "warning",
      "Vérifier le texte sur /profile/agents.", "Microcopy keys safe présente."),
    mk("no_secrets_microcopy_visible", "Microcopy no-secrets visible",
      "Le panneau rappelle l'absence de secrets.", "warning",
      "Vérifier le texte.", "Microcopy no-secrets présente."),
    mk("read_only_badge_visible", "Badge Lecture seule visible",
      "Le badge 'Lecture seule' est affiché.", "blocking",
      "Inspecter /profile/agents.", "Badge 'Lecture seule' présent."),
    mk("no_execution_badge_visible", "Badge Aucune action exécutée visible",
      "Le badge 'Aucune action exécutée' est affiché.", "blocking",
      "Inspecter /profile/agents.", "Badge aucune action présent."),
    mk("no_db_write", "Aucun write DB",
      "Le feed ne déclenche aucune écriture en base.", "blocking",
      "Vérifier l'absence de write.", "Aucun write DB."),
    mk("no_api_post", "Aucun appel API POST",
      "Aucun fetch POST déclenché par le feed.", "blocking",
      "Vérifier le code.", "Aucun POST."),
    mk("no_supabase_import", "Aucun import Supabase",
      "Le bridge n'importe pas Supabase.", "blocking",
      "Vérifier les imports.", "Aucun import Supabase."),
    mk("no_pierre_engine_import", "Aucun import moteur Pierre",
      "Le bridge n'importe pas src/lib/pierre.", "blocking",
      "Vérifier les imports.", "Aucun import Pierre moteur."),
    mk("no_cloneos_execution", "Aucune exécution CloneOS",
      "Le feed ne déclenche aucune exécution CloneOS.", "blocking",
      "Vérifier l'absence d'exécution.", "Aucune exécution CloneOS."),
    mk("no_clonevoice_activation", "Aucune activation CloneVoice",
      "Le feed n'active pas CloneVoice.", "blocking",
      "Vérifier le contrat CloneVoice.", "CloneVoice non activé."),
    mk("profile_agents_panel_visible", "Panneau /profile/agents visible",
      "Le panneau Registre employés IA est affiché.", "blocking",
      "Aller sur /profile/agents.", "Panneau Registre employés IA visible."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé",
      "PHASE 3.21 n'active pas le lancement public externe.", "info",
      "Vérifier go-live-proofs.local.json non modifié.", "Lancement public externe non validé."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.21",
  };
}

export function buildEmployeeContextRegistryProfileFeedQaVerdict(
  steps: EmployeeContextRegistryProfileFeedQaStep[]
): EmployeeContextRegistryProfileFeedQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: EmployeeContextRegistryProfileFeedQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: EmployeeContextRegistryProfileFeedQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeEmployeeContextRegistryProfileFeedQaVerdict(summary);
  return summary;
}

export function getEmployeeContextRegistryProfileFeedBlockingSteps(): EmployeeContextRegistryProfileFeedQaStep[] {
  return buildEmployeeContextRegistryProfileFeedQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeEmployeeContextRegistryProfileFeedQaVerdict(
  summary: EmployeeContextRegistryProfileFeedQaSummary
): string {
  const lines = [
    `[QA PHASE 3.21 Employee Context Registry UI Preview] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "ready") lines.push("  → QA UI Preview validée.");
  else if (summary.verdict === "pending") lines.push("  → Prêt pour vérification. Read-only / design-only.");
  return lines.join("\n");
}
