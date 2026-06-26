// src/lib/clonestore/cloneos-history/cloneos-history-manual-activation-qa.ts
// PHASE 3.19 — CloneOS History Manual Activation QA
//
// Module pur — checklist QA manuelle pour l'activation réelle de la persistance
// serveur de l'historique CloneOS.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre.
// Pas d'exécution CloneOS. Toutes les étapes sont vérifiées manuellement.

// ── Types ─────────────────────────────────────────────────────────────────────

export type CloneOSHistoryManualActivationStepId =
  | "cloneos_history_localstorage_key_verified"
  | "cloneos_history_sql_file_reviewed"
  | "cloneos_history_sql_applied_manually"
  | "cloneos_history_table_exists"
  | "cloneos_history_rls_enabled"
  | "cloneos_history_select_policy_exists"
  | "cloneos_history_insert_policy_exists"
  | "cloneos_history_update_policy_exists"
  | "cloneos_history_no_delete_policy"
  | "cloneos_history_constraints_verified"
  | "cloneos_history_flag_disabled_before_test"
  | "cloneos_history_safe_apply_script_passes"
  | "cloneos_history_flag_enabled_for_local_test"
  | "cloneos_history_app_restarted_after_flag"
  | "cloneos_history_authenticated_user_available"
  | "cloneos_history_local_write_works"
  | "cloneos_history_server_sync_works"
  | "cloneos_history_api_get_returns_server_snapshot"
  | "cloneos_history_refresh_restores_latest_snapshot"
  | "cloneos_history_profile_messages_reads_context_feed"
  | "cloneos_history_rollback_flag_disabled"
  | "cloneos_history_localstorage_still_works_after_rollback"
  | "cloneos_history_no_write_from_profile_messages"
  | "cloneos_history_no_write_from_pierre_pages"
  | "cloneos_history_no_service_role_detected"
  | "cloneos_history_no_cloneos_execution"
  | "public_launch_external_not_validated";

export type CloneOSHistoryManualActivationStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type CloneOSHistoryManualActivationStepSeverity =
  | "blocking"
  | "warning"
  | "info";

export type CloneOSHistoryManualActivationStep = {
  id: CloneOSHistoryManualActivationStepId;
  label: string;
  description: string;
  severity: CloneOSHistoryManualActivationStepSeverity;
  status: CloneOSHistoryManualActivationStepStatus;
  how_to_verify: string;
  expected_result: string;
  sql_query?: string;
  command?: string;
};

export type CloneOSHistoryManualActivationChecklist = {
  steps: CloneOSHistoryManualActivationStep[];
  total: number;
  blocking_count: number;
  table_name: string;
  localstorage_key: string;
  generated_at: string;
  phase: "3.19";
};

export type CloneOSHistoryManualActivationVerdict =
  | "ready_for_manual_activation"
  | "blocked"
  | "passed"
  | "needs_review";

// ── Evidence ──────────────────────────────────────────────────────────────────

export type CloneOSHistoryManualActivationEvidence = {
  sql_applied_at: string | null;
  supabase_project_ref: string | null;
  localstorage_key_check_result: "found" | "not_found" | "not_checked";
  table_check_result: "found" | "not_found" | "not_checked";
  rls_check_result: "enabled" | "disabled" | "not_checked";
  policies_check_result: string;
  constraints_check_result: string;
  flag_enabled_at: string | null;
  cloneos_local_history_tested_at: string | null;
  server_row_id: string | null;
  refresh_restore_result: "server_newer_used" | "local_kept" | "empty" | "not_checked";
  profile_messages_context_feed_result: "visible" | "not_visible" | "not_checked";
  rollback_result: "local_intact" | "failed" | "not_checked";
  no_execution_confirmation: boolean;
  notes: string;
  screenshots_or_refs: string[];
};

export type CloneOSHistoryManualActivationEvidencePack = {
  evidence: CloneOSHistoryManualActivationEvidence;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW" | "PENDING";
  tested_by: string;
  tested_at: string;
  environment: "local" | "staging" | "production";
};

export type CloneOSHistoryManualActivationQaSummary = {
  verdict: CloneOSHistoryManualActivationVerdict;
  blocking_steps: CloneOSHistoryManualActivationStepId[];
  passed_steps: CloneOSHistoryManualActivationStepId[];
  pending_steps: CloneOSHistoryManualActivationStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Constantes (source de vérité locale, pas d'import runtime) ─────────────────

const CLONEOS_HISTORY_QA_TABLE_NAME = "clonestore_cloneos_history";
const CLONEOS_HISTORY_QA_LOCALSTORAGE_KEY = "clonestore.cloneos.commandHistory.v1";
const CLONEOS_HISTORY_QA_SQL_PATH = "supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql";
const CLONEOS_HISTORY_QA_FLAG = "NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED";

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildCloneOSHistoryManualActivationChecklist(): CloneOSHistoryManualActivationChecklist {
  const T = CLONEOS_HISTORY_QA_TABLE_NAME;
  const steps: CloneOSHistoryManualActivationStep[] = [
    {
      id: "cloneos_history_localstorage_key_verified",
      label: "Clé localStorage vérifiée",
      description: `La clé ${CLONEOS_HISTORY_QA_LOCALSTORAGE_KEY} est utilisée par loadCloneOSHistoryItemsFromLocalStorage().`,
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools → Application → LocalStorage → chercher la clé.",
      expected_result: `Clé ${CLONEOS_HISTORY_QA_LOCALSTORAGE_KEY} présente après une demande CloneOS locale.`,
    },
    {
      id: "cloneos_history_sql_file_reviewed",
      label: "SQL draft revu manuellement",
      description: `Le fichier ${CLONEOS_HISTORY_QA_SQL_PATH} a été relu et validé.`,
      severity: "blocking", status: "pending",
      how_to_verify: "Ouvrir et lire le fichier SQL. Vérifier table, colonnes, contraintes, RLS.",
      expected_result: "SQL complet avec table + RLS + policies select/insert.",
      command: `cat ${CLONEOS_HISTORY_QA_SQL_PATH}`,
    },
    {
      id: "cloneos_history_sql_applied_manually",
      label: "SQL appliqué manuellement dans Supabase",
      description: "Le SQL a été copié-collé dans le SQL Editor Supabase et exécuté.",
      severity: "blocking", status: "pending",
      how_to_verify: "Supabase → SQL Editor → Coller le fichier → Run.",
      expected_result: "Exécution sans erreur. Message 'Success' ou équivalent.",
    },
    {
      id: "cloneos_history_table_exists",
      label: `Table ${T} existe`,
      description: "La table est accessible dans Supabase.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête SQL dans Supabase SQL Editor.",
      expected_result: `1 ligne retournée avec table_name = '${T}'.`,
      sql_query: `select table_name from information_schema.tables where table_schema = 'public' and table_name = '${T}';`,
    },
    {
      id: "cloneos_history_rls_enabled",
      label: "RLS activée sur la table",
      description: "Row Level Security est activée (rowsecurity = true).",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête SQL.",
      expected_result: "rowsecurity = true.",
      sql_query: `select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = '${T}';`,
    },
    {
      id: "cloneos_history_select_policy_exists",
      label: "Policy SELECT own existe",
      description: "Policy cloneos_history_select_own présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête policies.",
      expected_result: "cloneos_history_select_own avec cmd = 'SELECT'.",
      sql_query: `select policyname, cmd from pg_policies where schemaname = 'public' and tablename = '${T}' order by cmd, policyname;`,
    },
    {
      id: "cloneos_history_insert_policy_exists",
      label: "Policy INSERT own existe",
      description: "Policy cloneos_history_insert_own présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Voir résultat requête policies.",
      expected_result: "cloneos_history_insert_own avec cmd = 'INSERT'.",
    },
    {
      id: "cloneos_history_update_policy_exists",
      label: "Policy UPDATE (audit trail — absente en v1)",
      description: "Le draft v1 ne définit AUCUNE policy UPDATE (audit trail immuable). Étape informative.",
      severity: "info", status: "pending",
      how_to_verify: "Voir résultat requête policies — absence de cmd = 'UPDATE' attendue en v1.",
      expected_result: "Aucune policy UPDATE en v1 (audit trail immuable). Présente uniquement si schéma évolué.",
    },
    {
      id: "cloneos_history_no_delete_policy",
      label: "Aucune policy DELETE",
      description: "Pas de policy DELETE sur la table (audit trail immuable).",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier résultat requête policies — aucune ligne avec cmd = 'DELETE'.",
      expected_result: "Aucune policy DELETE.",
    },
    {
      id: "cloneos_history_constraints_verified",
      label: "Contraintes vérifiées",
      description: "unique(user_id, command_id), summary length, status valid, risk valid, company/command non vides.",
      severity: "warning", status: "pending",
      how_to_verify: "Lancer la requête contraintes.",
      expected_result: "Contraintes unique + check summary/status/risk/company/command présentes.",
      sql_query: `select conname from pg_constraint where conrelid = 'public.${T}'::regclass order by conname;`,
    },
    {
      id: "cloneos_history_flag_disabled_before_test",
      label: "Flag désactivé avant le test",
      description: `${CLONEOS_HISTORY_QA_FLAG} n'est pas défini ou = false.`,
      severity: "info", status: "pending",
      how_to_verify: ".env.local — flag absent ou false.",
      expected_result: "Flag absent ou false.",
      command: "npm run check:cloneos-history-readiness",
    },
    {
      id: "cloneos_history_safe_apply_script_passes",
      label: "Script readiness passe",
      description: "npm run check:cloneos-history-readiness s'exécute sans erreur.",
      severity: "warning", status: "pending",
      how_to_verify: "Lancer la commande.",
      expected_result: "Script s'exécute. SQL draft trouvé.",
      command: "npm run check:cloneos-history-readiness",
    },
    {
      id: "cloneos_history_flag_enabled_for_local_test",
      label: "Flag activé pour le test local",
      description: `${CLONEOS_HISTORY_QA_FLAG}=true ajouté dans .env.local.`,
      severity: "blocking", status: "pending",
      how_to_verify: `Ajouter ${CLONEOS_HISTORY_QA_FLAG}=true dans .env.local.`,
      expected_result: "Flag actif dans l'environnement local.",
    },
    {
      id: "cloneos_history_app_restarted_after_flag",
      label: "App redémarrée après flag",
      description: "npm run dev relancé après modification .env.local.",
      severity: "blocking", status: "pending",
      how_to_verify: "Ctrl+C puis npm run dev.",
      expected_result: "App démarre sans erreur.",
      command: "npm run dev",
    },
    {
      id: "cloneos_history_authenticated_user_available",
      label: "Utilisateur authentifié disponible",
      description: "Un compte test est connecté dans l'app.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile et vérifier l'état de connexion.",
      expected_result: "Utilisateur connecté.",
    },
    {
      id: "cloneos_history_local_write_works",
      label: "Écriture localStorage fonctionne",
      description: "Une demande CloneOS locale ajoute un item à l'historique localStorage.",
      severity: "blocking", status: "pending",
      how_to_verify: `DevTools → LocalStorage → vérifier ${CLONEOS_HISTORY_QA_LOCALSTORAGE_KEY}.`,
      expected_result: "Item présent dans localStorage après demande CloneOS locale.",
    },
    {
      id: "cloneos_history_server_sync_works",
      label: "Sync serveur fonctionne (si flag actif)",
      description: "persistCloneOSHistoryWithFallback synchronise côté serveur si flag + table OK.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier la ligne serveur après demande CloneOS (requête E).",
      expected_result: "Ligne créée côté serveur si flag actif et table disponible.",
    },
    {
      id: "cloneos_history_api_get_returns_server_snapshot",
      label: "Lecture serveur retourne l'historique (read-only)",
      description: "loadCloneOSHistoryReadOnly retourne les items serveur. Pas de route GET dédiée — lecture via client read-only.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier que /profile/messages affiche les items serveur si sync active.",
      expected_result: "Items serveur lus en read-only. Aucune route POST appelée.",
    },
    {
      id: "cloneos_history_refresh_restores_latest_snapshot",
      label: "Refresh restaure le snapshot correct",
      description: "Après F5, le restore utilise la version la plus récente (local ou server).",
      severity: "warning", status: "pending",
      how_to_verify: "Recharger /profile/messages → vérifier que l'historique est intact.",
      expected_result: "Historique CloneOS préservé après reload.",
    },
    {
      id: "cloneos_history_profile_messages_reads_context_feed",
      label: "/profile/messages lit le context feed",
      description: "Le panneau Contexte système affiche l'historique CloneOS via le context feed P3.17.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages → vérifier section Historique CloneOS.",
      expected_result: "Section Historique CloneOS visible — lecture seule.",
    },
    {
      id: "cloneos_history_rollback_flag_disabled",
      label: "Rollback : retirer le flag",
      description: `Retirer ${CLONEOS_HISTORY_QA_FLAG} de .env.local, redémarrer.`,
      severity: "blocking", status: "pending",
      how_to_verify: "Retirer flag → npm run dev → aller sur /profile/messages.",
      expected_result: "App fonctionne. Historique CloneOS lu depuis localStorage.",
    },
    {
      id: "cloneos_history_localstorage_still_works_after_rollback",
      label: "localStorage intact après rollback",
      description: "Les données localStorage sont intactes après rollback du flag.",
      severity: "blocking", status: "pending",
      how_to_verify: `DevTools → LocalStorage → vérifier ${CLONEOS_HISTORY_QA_LOCALSTORAGE_KEY} toujours présent.`,
      expected_result: "Historique localStorage intact. Aucune donnée perdue.",
    },
    {
      id: "cloneos_history_no_write_from_profile_messages",
      label: "Aucun write depuis /profile/messages",
      description: "/profile/messages ne déclenche aucun write CloneOS history.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages → DevTools Network → aucun POST/insert.",
      expected_result: "Aucune écriture déclenchée depuis /profile/messages.",
    },
    {
      id: "cloneos_history_no_write_from_pierre_pages",
      label: "Aucun write depuis pages Pierre",
      description: "/agents/pierre/setup et /agents/pierre/use ne déclenchent aucun write CloneOS history.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur les pages Pierre → DevTools Network → aucun write CloneOS history.",
      expected_result: "Aucune écriture depuis les pages Pierre.",
    },
    {
      id: "cloneos_history_no_service_role_detected",
      label: "Pas de service role côté client",
      description: "Aucune requête client n'utilise SUPABASE_SERVICE_ROLE_KEY.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les appels réseau — aucun header service_role.",
      expected_result: "Seul l'anon key est utilisé côté client.",
    },
    {
      id: "cloneos_history_no_cloneos_execution",
      label: "Aucune exécution CloneOS",
      description: "La QA lit l'historique mais n'exécute aucune commande CloneOS.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier que la QA est plan-only / read-only.",
      expected_result: "Aucune exécution CloneOS — plan-only, lecture seule.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 3.19 n'active pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier go-live-proofs.local.json non modifié.",
      expected_result: "go-live-proofs.local.json inchangé. Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    table_name: CLONEOS_HISTORY_QA_TABLE_NAME,
    localstorage_key: CLONEOS_HISTORY_QA_LOCALSTORAGE_KEY,
    generated_at: new Date().toISOString(),
    phase: "3.19",
  };
}

export function buildCloneOSHistoryManualActivationVerdict(
  steps: CloneOSHistoryManualActivationStep[]
): CloneOSHistoryManualActivationQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: CloneOSHistoryManualActivationVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_manual_activation";
  else verdict = "needs_review";

  const summary: CloneOSHistoryManualActivationQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeCloneOSHistoryManualActivationQaVerdict(summary);
  return summary;
}

export function getCloneOSHistoryManualActivationBlockingSteps(): CloneOSHistoryManualActivationStep[] {
  return buildCloneOSHistoryManualActivationChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function buildCloneOSHistoryManualActivationEvidenceTemplate(): CloneOSHistoryManualActivationEvidencePack {
  return {
    evidence: {
      sql_applied_at: null,
      supabase_project_ref: null,
      localstorage_key_check_result: "not_checked",
      table_check_result: "not_checked",
      rls_check_result: "not_checked",
      policies_check_result: "non vérifié",
      constraints_check_result: "non vérifié",
      flag_enabled_at: null,
      cloneos_local_history_tested_at: null,
      server_row_id: null,
      refresh_restore_result: "not_checked",
      profile_messages_context_feed_result: "not_checked",
      rollback_result: "not_checked",
      no_execution_confirmation: false,
      notes: "",
      screenshots_or_refs: [],
    },
    verdict: "PENDING",
    tested_by: "",
    tested_at: "",
    environment: "local",
  };
}

export function validateCloneOSHistoryManualActivationEvidencePack(
  pack: CloneOSHistoryManualActivationEvidencePack
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
  if (!pack.evidence.no_execution_confirmation) {
    issues.push("no_execution_confirmation requis (aucune exécution CloneOS).");
  }
  if (pack.verdict === "PENDING") {
    issues.push("Verdict PENDING — QA non terminée.");
  }

  return { valid: issues.length === 0, issues };
}

export function summarizeCloneOSHistoryManualActivationQaVerdict(
  summary: CloneOSHistoryManualActivationQaSummary
): string {
  const lines = [
    `[QA PHASE 3.19 CloneOS History Manual Activation] Verdict : ${summary.verdict.toUpperCase()}`,
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
