// src/lib/clonestore/enterprise-footprint/enterprise-footprint-manual-activation-qa.ts
// PHASE 3.15 — Enterprise Footprint Manual Activation QA
//
// Module pur — checklist QA manuelle pour l'activation réelle de la persistence serveur.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre.
// Toutes les étapes sont vérifiées manuellement par l'opérateur.

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintManualActivationStepId =
  | "sql_file_reviewed"
  | "sql_applied_manually"
  | "table_exists"
  | "rls_enabled"
  | "select_policy_exists"
  | "insert_policy_exists"
  | "update_policy_exists"
  | "no_delete_policy"
  | "constraints_verified"
  | "flag_disabled_before_test"
  | "safe_apply_script_passes"
  | "flag_enabled_for_local_test"
  | "app_restarted_after_flag"
  | "authenticated_user_available"
  | "onboarding_local_save_works"
  | "onboarding_server_sync_works"
  | "api_get_returns_server_snapshot"
  | "refresh_restores_latest_snapshot"
  | "rollback_flag_disabled"
  | "localstorage_still_works_after_rollback"
  | "no_write_from_agents_pages"
  | "no_write_from_pierre_pages"
  | "no_service_role_detected"
  | "public_launch_external_not_validated";

export type EnterpriseFootprintManualActivationStepStatus =
  | "pending"   // non encore vérifié
  | "passed"    // vérifié OK
  | "failed"    // vérifié KO
  | "skipped";  // délibérément ignoré

export type EnterpriseFootprintManualActivationStepSeverity =
  | "blocking"  // bloque l'activation si failed
  | "warning"   // avertissement, ne bloque pas
  | "info";     // informatif

export type EnterpriseFootprintManualActivationStep = {
  id: EnterpriseFootprintManualActivationStepId;
  label: string;
  description: string;
  severity: EnterpriseFootprintManualActivationStepSeverity;
  status: EnterpriseFootprintManualActivationStepStatus;
  how_to_verify: string;
  expected_result: string;
  sql_query?: string;
  command?: string;
};

export type EnterpriseFootprintManualActivationChecklist = {
  steps: EnterpriseFootprintManualActivationStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.15";
};

export type EnterpriseFootprintManualActivationVerdict =
  | "ready_for_manual_activation"  // checklist vide, prêt à activer
  | "blocked"                      // au moins un blocking failed
  | "passed"                       // toutes les étapes passées
  | "needs_review";                // quelques étapes pending/warning

// ── Evidence template ─────────────────────────────────────────────────────────

export type EnterpriseFootprintManualActivationEvidence = {
  sql_applied_at: string | null;
  supabase_project_ref: string | null;
  table_check_result: "found" | "not_found" | "not_checked";
  rls_check_result: "enabled" | "disabled" | "not_checked";
  policies_check_result: string;
  constraints_check_result: string;
  flag_enabled_at: string | null;
  onboarding_tested_at: string | null;
  server_row_id: string | null;
  refresh_restore_result: "server_newer_used" | "local_kept" | "empty" | "not_checked";
  rollback_result: "local_intact" | "failed" | "not_checked";
  notes: string;
  screenshots_or_refs: string[];
};

export type EnterpriseFootprintManualActivationEvidencePack = {
  evidence: EnterpriseFootprintManualActivationEvidence;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW" | "PENDING";
  tested_by: string;
  tested_at: string;
  environment: "local" | "staging" | "production";
};

export type EnterpriseFootprintManualActivationQaSummary = {
  verdict: EnterpriseFootprintManualActivationVerdict;
  blocking_steps: EnterpriseFootprintManualActivationStepId[];
  passed_steps: EnterpriseFootprintManualActivationStepId[];
  pending_steps: EnterpriseFootprintManualActivationStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintManualActivationChecklist(): EnterpriseFootprintManualActivationChecklist {
  const steps: EnterpriseFootprintManualActivationStep[] = [
    {
      id: "sql_file_reviewed",
      label: "SQL draft revu manuellement",
      description: "Le fichier supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql a été relu et validé.",
      severity: "blocking", status: "pending",
      how_to_verify: "Ouvrir et lire le fichier SQL. Vérifier table, colonnes, contraintes, RLS.",
      expected_result: "SQL complet avec table + RLS + policies select/insert/update.",
      command: "cat supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql",
    },
    {
      id: "sql_applied_manually",
      label: "SQL appliqué manuellement dans Supabase",
      description: "Le SQL a été copié-collé dans le SQL Editor Supabase et exécuté.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller dans Supabase → SQL Editor → Coller le fichier → Run.",
      expected_result: "Exécution sans erreur. Message 'Success' ou équivalent.",
    },
    {
      id: "table_exists",
      label: "Table clonestore_enterprise_footprints existe",
      description: "La table est accessible dans Supabase.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête SQL dans Supabase SQL Editor.",
      expected_result: "1 ligne retournée avec table_name = 'clonestore_enterprise_footprints'.",
      sql_query: "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'clonestore_enterprise_footprints';",
    },
    {
      id: "rls_enabled",
      label: "RLS activée sur la table",
      description: "Row Level Security est activée (rowsecurity = true).",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête SQL.",
      expected_result: "rowsecurity = true.",
      sql_query: "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'clonestore_enterprise_footprints';",
    },
    {
      id: "select_policy_exists",
      label: "Policy SELECT own existe",
      description: "Policy select_own_enterprise_footprint présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête policies.",
      expected_result: "select_own_enterprise_footprint avec cmd = 'SELECT'.",
      sql_query: "select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'clonestore_enterprise_footprints' order by cmd, policyname;",
    },
    {
      id: "insert_policy_exists",
      label: "Policy INSERT own existe",
      description: "Policy insert_own_enterprise_footprint présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Voir résultat requête policies.",
      expected_result: "insert_own_enterprise_footprint avec cmd = 'INSERT'.",
    },
    {
      id: "update_policy_exists",
      label: "Policy UPDATE own existe",
      description: "Policy update_own_enterprise_footprint présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Voir résultat requête policies.",
      expected_result: "update_own_enterprise_footprint avec cmd = 'UPDATE'.",
    },
    {
      id: "no_delete_policy",
      label: "Aucune policy DELETE",
      description: "Pas de policy DELETE sur la table (préservation intentionnelle).",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier résultat requête policies — aucune ligne avec cmd = 'DELETE'.",
      expected_result: "Aucune policy DELETE.",
    },
    {
      id: "constraints_verified",
      label: "Contraintes vérifiées",
      description: "unique(user_id, company_id), scores 0-100, status valide, source valide.",
      severity: "warning", status: "pending",
      how_to_verify: "Lancer la requête contraintes.",
      expected_result: "6 contraintes présentes (unique + check scores + check status + check source + check company_id).",
      sql_query: "select conname from pg_constraint where conrelid = 'public.clonestore_enterprise_footprints'::regclass order by conname;",
    },
    {
      id: "flag_disabled_before_test",
      label: "Flag désactivé avant le test",
      description: "NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED n'est pas défini ou = false.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier .env.local — flag absent ou false.",
      expected_result: "Flag absent ou false.",
      command: "node scripts/check-enterprise-footprint-server-readiness.mjs",
    },
    {
      id: "safe_apply_script_passes",
      label: "Script safe-apply passe",
      description: "npm run check:enterprise-footprint-safe-apply s'exécute sans erreur.",
      severity: "warning", status: "pending",
      how_to_verify: "Lancer la commande.",
      expected_result: "Script s'exécute. SQL draft trouvé. Route trouvée.",
      command: "npm run check:enterprise-footprint-safe-apply",
    },
    {
      id: "flag_enabled_for_local_test",
      label: "Flag activé pour le test local",
      description: "NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true ajouté dans .env.local.",
      severity: "blocking", status: "pending",
      how_to_verify: "Ajouter NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
      expected_result: "Flag actif dans l'environnement local.",
    },
    {
      id: "app_restarted_after_flag",
      label: "App redémarrée après flag",
      description: "npm run dev relancé après modification .env.local.",
      severity: "blocking", status: "pending",
      how_to_verify: "Ctrl+C puis npm run dev.",
      expected_result: "App démarre sans erreur.",
      command: "npm run dev",
    },
    {
      id: "authenticated_user_available",
      label: "Utilisateur authentifié disponible",
      description: "Un compte test est connecté dans l'app.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile et vérifier l'état de connexion.",
      expected_result: "Utilisateur connecté.",
    },
    {
      id: "onboarding_local_save_works",
      label: "Save localStorage fonctionne",
      description: "Remplir /profile/onboarding → snapshot EnterpriseFootprint sauvegardé en localStorage.",
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools → Application → LocalStorage → vérifier clonestore.enterpriseFootprint.snapshot.v1.",
      expected_result: "Snapshot présent dans localStorage.",
    },
    {
      id: "onboarding_server_sync_works",
      label: "Sync serveur fonctionne",
      description: "Status UI affiche 'Empreinte synchronisée serveur' ou 'sauvegardée localement'.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le span status dans le panneau Empreinte après save.",
      expected_result: "Status = 'Empreinte synchronisée serveur' si flag actif et table disponible.",
    },
    {
      id: "api_get_returns_server_snapshot",
      label: "GET /api/profile/enterprise-footprint retourne snapshot",
      description: "Appel GET retourne le footprint créé.",
      severity: "warning", status: "pending",
      how_to_verify: "DevTools → Network → chercher GET enterprise-footprint → vérifier response.footprint.",
      expected_result: "ok: true, footprint non null, source: 'server'.",
    },
    {
      id: "refresh_restores_latest_snapshot",
      label: "Refresh restaure le snapshot correct",
      description: "Après F5, le restore utilise la version la plus récente (local ou server).",
      severity: "warning", status: "pending",
      how_to_verify: "Recharger /profile/onboarding → vérifier que les données sont intactes.",
      expected_result: "Données Empreinte préservées après reload.",
    },
    {
      id: "rollback_flag_disabled",
      label: "Rollback : retirer le flag",
      description: "Retirer NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED de .env.local, redémarrer.",
      severity: "blocking", status: "pending",
      how_to_verify: "Retirer flag → npm run dev → aller sur /profile/onboarding.",
      expected_result: "App fonctionne. Status = 'Empreinte sauvegardée localement'.",
    },
    {
      id: "localstorage_still_works_after_rollback",
      label: "localStorage intact après rollback",
      description: "Les données localStorage sont intactes après rollback du flag.",
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools → LocalStorage → vérifier snapshot toujours présent.",
      expected_result: "Snapshot localStorage intact. Aucune donnée perdue.",
    },
    {
      id: "no_write_from_agents_pages",
      label: "Aucun write depuis /profile/agents",
      description: "/profile/agents ne déclenche aucun write enterprise-footprint.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/agents → DevTools Network → aucun POST enterprise-footprint.",
      expected_result: "Aucune requête POST /api/profile/enterprise-footprint.",
    },
    {
      id: "no_write_from_pierre_pages",
      label: "Aucun write depuis pages Pierre",
      description: "/agents/pierre/setup et /agents/pierre/use ne déclenchent aucun write.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur les pages Pierre → DevTools Network → aucun POST enterprise-footprint.",
      expected_result: "Aucune requête POST depuis les pages Pierre.",
    },
    {
      id: "no_service_role_detected",
      label: "Pas de service role côté client",
      description: "Aucune requête client n'utilise SUPABASE_SERVICE_ROLE_KEY.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les appels réseau — aucun header service_role.",
      expected_result: "Seul l'anon key est utilisé côté client.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 3.15 n'active pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier go-live-proofs.local.json non modifié.",
      expected_result: "go-live-proofs.local.json inchangé. Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.15",
  };
}

export function buildEnterpriseFootprintManualActivationVerdict(
  steps: EnterpriseFootprintManualActivationStep[]
): EnterpriseFootprintManualActivationQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: EnterpriseFootprintManualActivationVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_manual_activation";
  else verdict = "needs_review";

  const safeToActivate = verdict !== "blocked";

  const summary: EnterpriseFootprintManualActivationQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: safeToActivate,
  };
  summary.message = summarizeEnterpriseFootprintManualActivationQaVerdict(summary);
  return summary;
}

export function getEnterpriseFootprintManualActivationBlockingSteps(): EnterpriseFootprintManualActivationStep[] {
  return buildEnterpriseFootprintManualActivationChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function buildEnterpriseFootprintManualActivationEvidenceTemplate(): EnterpriseFootprintManualActivationEvidencePack {
  return {
    evidence: {
      sql_applied_at: null,
      supabase_project_ref: null,
      table_check_result: "not_checked",
      rls_check_result: "not_checked",
      policies_check_result: "non vérifié",
      constraints_check_result: "non vérifié",
      flag_enabled_at: null,
      onboarding_tested_at: null,
      server_row_id: null,
      refresh_restore_result: "not_checked",
      rollback_result: "not_checked",
      notes: "",
      screenshots_or_refs: [],
    },
    verdict: "PENDING",
    tested_by: "",
    tested_at: "",
    environment: "local",
  };
}

export function validateEnterpriseFootprintManualActivationEvidencePack(
  pack: EnterpriseFootprintManualActivationEvidencePack
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!pack.tested_by?.trim()) issues.push("tested_by requis.");
  if (!pack.tested_at?.trim()) issues.push("tested_at requis.");
  if (pack.evidence.table_check_result === "not_checked") {
    issues.push("table_check_result non vérifié.");
  }
  if (pack.evidence.rls_check_result === "not_checked") {
    issues.push("rls_check_result non vérifié.");
  }
  if (pack.verdict === "PENDING") {
    issues.push("Verdict PENDING — QA non terminée.");
  }

  return { valid: issues.length === 0, issues };
}

export function summarizeEnterpriseFootprintManualActivationQaVerdict(
  summary: EnterpriseFootprintManualActivationQaSummary
): string {
  const lines = [
    `[QA PHASE 3.15 Manual Activation] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to activate : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "passed") lines.push("  → QA Manual Activation validée.");
  else if (summary.verdict === "ready_for_manual_activation") {
    lines.push("  → Prêt pour activation manuelle. Suivre les étapes dans l'ordre.");
  }
  return lines.join("\n");
}
