// src/lib/clonestore/runtime-integration/runtime-mission-draft-manual-activation-qa.ts
// PHASE 4.6 — Runtime Mission Draft Manual Activation QA
//
// Module pur — checklist QA manuelle pour l'activation serveur réelle de la
// persistance des brouillons de mission runtime.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre. Pas d'exécution CloneOS.

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftManualActivationStepId =
  | "runtime_mission_draft_sql_file_reviewed"
  | "runtime_mission_draft_sql_applied_manually"
  | "runtime_mission_draft_table_exists"
  | "runtime_mission_draft_rls_enabled"
  | "runtime_mission_draft_select_policy_exists"
  | "runtime_mission_draft_insert_policy_exists"
  | "runtime_mission_draft_update_policy_exists"
  | "runtime_mission_draft_no_delete_policy"
  | "runtime_mission_draft_constraints_verified"
  | "runtime_mission_draft_indexes_verified"
  | "runtime_mission_draft_flag_disabled_before_test"
  | "runtime_mission_draft_post_returns_423_when_disabled"
  | "runtime_mission_draft_localstorage_save_works"
  | "runtime_mission_draft_localstorage_restore_works"
  | "runtime_mission_draft_flag_enabled_for_local_test"
  | "runtime_mission_draft_app_restarted_after_flag"
  | "runtime_mission_draft_authenticated_user_available"
  | "runtime_mission_draft_server_post_returns_200"
  | "runtime_mission_draft_server_row_created"
  | "runtime_mission_draft_safety_flags_false"
  | "runtime_mission_draft_no_real_mission_created"
  | "runtime_mission_draft_no_execution_started"
  | "runtime_mission_draft_no_pierre_engine_called"
  | "runtime_mission_draft_no_ai_call"
  | "runtime_mission_draft_no_email_or_document"
  | "runtime_mission_draft_profile_messages_status_visible"
  | "runtime_mission_draft_rollback_flag_disabled"
  | "runtime_mission_draft_post_returns_423_after_rollback"
  | "runtime_mission_draft_localstorage_still_works_after_rollback"
  | "runtime_mission_draft_no_service_role_detected"
  | "runtime_mission_draft_scale_80k_not_proven"
  | "public_launch_external_not_validated";

export type RuntimeMissionDraftManualActivationStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type RuntimeMissionDraftManualActivationStepSeverity =
  | "blocking" | "warning" | "info";

export type RuntimeMissionDraftManualActivationStep = {
  id: RuntimeMissionDraftManualActivationStepId;
  label: string;
  description: string;
  severity: RuntimeMissionDraftManualActivationStepSeverity;
  status: RuntimeMissionDraftManualActivationStepStatus;
  how_to_verify: string;
  expected_result: string;
  sql_query?: string;
  command?: string;
};

export type RuntimeMissionDraftManualActivationChecklist = {
  steps: RuntimeMissionDraftManualActivationStep[];
  total: number;
  blocking_count: number;
  table_name: string;
  flag_key: string;
  generated_at: string;
  phase: "4.6";
};

export type RuntimeMissionDraftManualActivationVerdict =
  | "ready_for_manual_activation"
  | "blocked"
  | "passed"
  | "needs_review"
  | "pending";

// ── Evidence ──────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftManualActivationEvidence = {
  sql_applied_at: string | null;
  supabase_project_ref: string | null;
  table_name: string;
  table_check_result: "found" | "not_found" | "not_checked";
  rls_check_result: "enabled" | "disabled" | "not_checked";
  policies_check_result: string;
  constraints_check_result: string;
  indexes_check_result: string;
  flag_disabled_check_result: "false" | "true" | "not_checked";
  post_423_before_activation_result: "423" | "other" | "not_checked";
  localstorage_save_result: "ok" | "failed" | "not_checked";
  localstorage_restore_result: "ok" | "failed" | "not_checked";
  flag_enabled_at: string | null;
  app_restart_result: "done" | "not_done" | "not_checked";
  authenticated_user_result: "available" | "missing" | "not_checked";
  post_200_after_activation_result: "200" | "423" | "other" | "not_checked";
  server_row_id: string | null;
  server_row_draft_id: string | null;
  server_row_safety_flags_result: "all_false" | "violation" | "not_checked";
  no_real_mission_result: "confirmed" | "violation" | "not_checked";
  no_execution_result: "confirmed" | "violation" | "not_checked";
  rollback_result: "flag_false" | "failed" | "not_checked";
  post_423_after_rollback_result: "423" | "other" | "not_checked";
  localstorage_after_rollback_result: "ok" | "failed" | "not_checked";
  notes: string;
  screenshots_or_refs: string[];
};

export type RuntimeMissionDraftManualActivationEvidencePack = {
  evidence: RuntimeMissionDraftManualActivationEvidence;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW" | "PENDING";
  tested_by: string;
  tested_at: string;
  environment: "local" | "staging" | "production";
};

export type RuntimeMissionDraftManualActivationSummary = {
  verdict: RuntimeMissionDraftManualActivationVerdict;
  blocking_steps: RuntimeMissionDraftManualActivationStepId[];
  passed_steps: RuntimeMissionDraftManualActivationStepId[];
  pending_steps: RuntimeMissionDraftManualActivationStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Constantes ────────────────────────────────────────────────────────────────

const TABLE = "clonestore_runtime_mission_drafts";
const FLAG = "NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED";
const SQL_PATH = "supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql";

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftManualActivationChecklist(): RuntimeMissionDraftManualActivationChecklist {
  const steps: RuntimeMissionDraftManualActivationStep[] = [
    {
      id: "runtime_mission_draft_sql_file_reviewed",
      label: "SQL draft revu manuellement",
      description: `Le fichier ${SQL_PATH} a été relu et validé.`,
      severity: "blocking", status: "pending",
      how_to_verify: "Ouvrir et lire le SQL. Vérifier table, colonnes, contraintes safety_flags, RLS.",
      expected_result: "SQL complet avec table + RLS + policies select/insert/update + CHECK safety_flags.",
      command: `cat ${SQL_PATH}`,
    },
    {
      id: "runtime_mission_draft_sql_applied_manually",
      label: "SQL appliqué manuellement dans Supabase",
      description: "Le SQL a été copié-collé dans le SQL Editor Supabase et exécuté.",
      severity: "blocking", status: "pending",
      how_to_verify: "Supabase → SQL Editor → Coller le fichier → Run.",
      expected_result: "Exécution sans erreur.",
    },
    {
      id: "runtime_mission_draft_table_exists",
      label: `Table ${TABLE} existe`,
      description: "La table est accessible dans Supabase.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête SQL.",
      expected_result: `1 ligne table_name = '${TABLE}'.`,
      sql_query: `select table_name from information_schema.tables where table_schema = 'public' and table_name = '${TABLE}';`,
    },
    {
      id: "runtime_mission_draft_rls_enabled",
      label: "RLS activée",
      description: "Row Level Security activée (rowsecurity = true).",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête SQL.",
      expected_result: "rowsecurity = true.",
      sql_query: `select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = '${TABLE}';`,
    },
    {
      id: "runtime_mission_draft_select_policy_exists",
      label: "Policy SELECT own existe",
      description: "Policy select_own_runtime_mission_draft présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête policies.",
      expected_result: "select_own_runtime_mission_draft avec cmd = 'SELECT'.",
      sql_query: `select policyname, cmd from pg_policies where schemaname = 'public' and tablename = '${TABLE}' order by cmd, policyname;`,
    },
    {
      id: "runtime_mission_draft_insert_policy_exists",
      label: "Policy INSERT own existe",
      description: "Policy insert_own_runtime_mission_draft présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Voir résultat requête policies.",
      expected_result: "insert_own_runtime_mission_draft avec cmd = 'INSERT'.",
    },
    {
      id: "runtime_mission_draft_update_policy_exists",
      label: "Policy UPDATE own existe",
      description: "Policy update_own_runtime_mission_draft présente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Voir résultat requête policies.",
      expected_result: "update_own_runtime_mission_draft avec cmd = 'UPDATE'.",
    },
    {
      id: "runtime_mission_draft_no_delete_policy",
      label: "Aucune policy DELETE",
      description: "Pas de policy DELETE (préservation des brouillons).",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier résultat requête policies — aucune ligne cmd = 'DELETE'.",
      expected_result: "Aucune policy DELETE.",
    },
    {
      id: "runtime_mission_draft_constraints_verified",
      label: "Contraintes vérifiées",
      description: "unique (user_id, command_id, plan_id), status/kind valides, CHECK safety_flags no-execution.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête contraintes.",
      expected_result: "Contraintes unique + status/kind + chk_runtime_mission_draft_no_execution présentes.",
      sql_query: `select conname from pg_constraint where conrelid = 'public.${TABLE}'::regclass order by conname;`,
    },
    {
      id: "runtime_mission_draft_indexes_verified",
      label: "Index vérifiés",
      description: "Index user_id/company_id/draft_id/command_id/plan_id/status/updated_at présents.",
      severity: "warning", status: "pending",
      how_to_verify: "Lancer la requête index.",
      expected_result: "Index principaux présents.",
      sql_query: `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = '${TABLE}' order by indexname;`,
    },
    {
      id: "runtime_mission_draft_flag_disabled_before_test",
      label: "Flag désactivé avant test",
      description: `${FLAG} absent ou false.`,
      severity: "info", status: "pending",
      how_to_verify: ".env.local — flag absent ou false.",
      expected_result: "Flag absent ou false.",
      command: "npm run check:runtime-mission-draft-persistence-design",
    },
    {
      id: "runtime_mission_draft_post_returns_423_when_disabled",
      label: "POST retourne 423 si flag false",
      description: "POST /api/clonestore/runtime/mission-drafts retourne 423 quand le flag est false.",
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools Network ou curl manuel → POST avec flag false.",
      expected_result: "HTTP 423 · status 'disabled' · db_write_performed false.",
    },
    {
      id: "runtime_mission_draft_localstorage_save_works",
      label: "Sauvegarde localStorage fonctionne",
      description: "Le bouton 'Sauvegarder le brouillon localement' sauvegarde en localStorage.",
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools → LocalStorage → clé clonestore.runtimeMissionDrafts.local.v1.",
      expected_result: "Enveloppe sauvegardée en localStorage.",
    },
    {
      id: "runtime_mission_draft_localstorage_restore_works",
      label: "Restore localStorage fonctionne",
      description: "Le bouton 'Restaurer le dernier brouillon local' restaure depuis localStorage.",
      severity: "blocking", status: "pending",
      how_to_verify: "Cliquer Restaurer → vérifier le titre du brouillon restauré.",
      expected_result: "Brouillon local restauré.",
    },
    {
      id: "runtime_mission_draft_flag_enabled_for_local_test",
      label: "Flag activé pour test local",
      description: `${FLAG}=true ajouté dans .env.local (test local uniquement).`,
      severity: "blocking", status: "pending",
      how_to_verify: `Ajouter ${FLAG}=true dans .env.local.`,
      expected_result: "Flag actif en local.",
    },
    {
      id: "runtime_mission_draft_app_restarted_after_flag",
      label: "App redémarrée après flag",
      description: "npm run dev relancé après modification .env.local.",
      severity: "blocking", status: "pending",
      how_to_verify: "Ctrl+C puis npm run dev.",
      expected_result: "App démarre sans erreur.",
      command: "npm run dev",
    },
    {
      id: "runtime_mission_draft_authenticated_user_available",
      label: "Utilisateur authentifié disponible",
      description: "Un compte test est connecté.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile et vérifier la connexion.",
      expected_result: "Utilisateur connecté.",
    },
    {
      id: "runtime_mission_draft_server_post_returns_200",
      label: "POST serveur retourne 200",
      description: "Avec flag true + SQL + auth, POST mission-drafts retourne 200 et db_write_performed true.",
      severity: "blocking", status: "pending",
      how_to_verify: "Sauvegarder un brouillon → DevTools Network → POST mission-drafts.",
      expected_result: "HTTP 200 · status 'ok' · db_write_performed true.",
    },
    {
      id: "runtime_mission_draft_server_row_created",
      label: "Row Supabase créée",
      description: `Un row est créé dans ${TABLE}.`,
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête F (last rows).",
      expected_result: "1 ligne avec draft_id/command_id/plan_id correspondants.",
      sql_query: `select id, user_id, draft_id, command_id, plan_id, kind, status, safety_flags, updated_at from public.${TABLE} order by updated_at desc limit 5;`,
    },
    {
      id: "runtime_mission_draft_safety_flags_false",
      label: "safety_flags tous false",
      description: "Tous les safety_flags du row restent 'false'.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lancer la requête G (safety flags check).",
      expected_result: "execution_enabled/db_write_enabled/... tous 'false'.",
      sql_query: `select draft_id, safety_flags->>'execution_enabled' as execution_enabled, safety_flags->>'pierre_engine_called' as pierre_engine_called from public.${TABLE} order by updated_at desc limit 5;`,
    },
    {
      id: "runtime_mission_draft_no_real_mission_created",
      label: "Aucune mission réelle créée",
      description: "Le row est un brouillon, pas une mission Pierre réelle.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier qu'aucune table mission Pierre n'a reçu de nouvelle ligne.",
      expected_result: "Aucune mission réelle. Brouillon uniquement.",
    },
    {
      id: "runtime_mission_draft_no_execution_started",
      label: "Aucune exécution démarrée",
      description: "execution_started false. Aucune exécution déclenchée.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier la réponse POST et les logs.",
      expected_result: "execution_started false.",
    },
    {
      id: "runtime_mission_draft_no_pierre_engine_called",
      label: "Aucun appel moteur Pierre",
      description: "pierre_engine_called false. src/lib/pierre non sollicité.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier la réponse POST et l'absence d'appel /api/pierre.",
      expected_result: "pierre_engine_called false.",
    },
    {
      id: "runtime_mission_draft_no_ai_call",
      label: "Aucun appel IA",
      description: "ai_call_performed false. Aucun OpenAI/Anthropic.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les logs réseau.",
      expected_result: "ai_call_performed false.",
    },
    {
      id: "runtime_mission_draft_no_email_or_document",
      label: "Aucun email/document",
      description: "email_sent/document_generated false.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier qu'aucun email/document n'est généré.",
      expected_result: "email_sent/document_generated false.",
    },
    {
      id: "runtime_mission_draft_profile_messages_status_visible",
      label: "Statut visible dans /profile/messages",
      description: "Le statut safe apply (badges/cards) est affiché après sauvegarde.",
      severity: "warning", status: "pending",
      how_to_verify: "Aller sur /profile/messages → vérifier les badges safe apply.",
      expected_result: "Badges 'Sauvegardé localement et serveur' visibles.",
    },
    {
      id: "runtime_mission_draft_rollback_flag_disabled",
      label: "Rollback : flag désactivé",
      description: `Retirer ${FLAG} de .env.local, redémarrer.`,
      severity: "blocking", status: "pending",
      how_to_verify: "Retirer flag → npm run dev.",
      expected_result: "App fonctionne. Flag false.",
    },
    {
      id: "runtime_mission_draft_post_returns_423_after_rollback",
      label: "POST 423 après rollback",
      description: "Après rollback, POST mission-drafts retourne de nouveau 423.",
      severity: "blocking", status: "pending",
      how_to_verify: "Sauvegarder un brouillon → DevTools Network → POST.",
      expected_result: "HTTP 423 · status 'disabled'.",
    },
    {
      id: "runtime_mission_draft_localstorage_still_works_after_rollback",
      label: "localStorage intact après rollback",
      description: "Le restore localStorage fonctionne toujours après rollback.",
      severity: "blocking", status: "pending",
      how_to_verify: "Cliquer Restaurer après rollback → brouillon local restauré.",
      expected_result: "localStorage restore OK. Aucune donnée perdue.",
    },
    {
      id: "runtime_mission_draft_no_service_role_detected",
      label: "Pas de service role côté client",
      description: "Aucune requête client n'utilise SUPABASE_SERVICE_ROLE_KEY.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les appels réseau — aucun header service_role.",
      expected_result: "Seul l'anon key est utilisé côté client.",
    },
    {
      id: "runtime_mission_draft_scale_80k_not_proven",
      label: "Scale 80k non prouvé",
      description: "P4.6 ne prouve pas le scale 80k — préparation scale uniquement.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier les snapshots scale.",
      expected_result: "scale_80k_not_proven true. Préparation scale.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 4.6 n'active pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier go-live-proofs.local.json non modifié.",
      expected_result: "go-live-proofs.local.json inchangé. Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    table_name: TABLE,
    flag_key: FLAG,
    generated_at: new Date().toISOString(),
    phase: "4.6",
  };
}

export function buildRuntimeMissionDraftManualActivationVerdict(
  steps: RuntimeMissionDraftManualActivationStep[]
): RuntimeMissionDraftManualActivationSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionDraftManualActivationVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_manual_activation";
  else verdict = "needs_review";

  const summary: RuntimeMissionDraftManualActivationSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeRuntimeMissionDraftManualActivationVerdict(summary);
  return summary;
}

export function getRuntimeMissionDraftManualActivationBlockingSteps(): RuntimeMissionDraftManualActivationStep[] {
  return buildRuntimeMissionDraftManualActivationChecklist().steps.filter((s) => s.severity === "blocking");
}

export function buildRuntimeMissionDraftManualActivationEvidenceTemplate(): RuntimeMissionDraftManualActivationEvidencePack {
  return {
    evidence: {
      sql_applied_at: null,
      supabase_project_ref: null,
      table_name: TABLE,
      table_check_result: "not_checked",
      rls_check_result: "not_checked",
      policies_check_result: "non vérifié",
      constraints_check_result: "non vérifié",
      indexes_check_result: "non vérifié",
      flag_disabled_check_result: "not_checked",
      post_423_before_activation_result: "not_checked",
      localstorage_save_result: "not_checked",
      localstorage_restore_result: "not_checked",
      flag_enabled_at: null,
      app_restart_result: "not_checked",
      authenticated_user_result: "not_checked",
      post_200_after_activation_result: "not_checked",
      server_row_id: null,
      server_row_draft_id: null,
      server_row_safety_flags_result: "not_checked",
      no_real_mission_result: "not_checked",
      no_execution_result: "not_checked",
      rollback_result: "not_checked",
      post_423_after_rollback_result: "not_checked",
      localstorage_after_rollback_result: "not_checked",
      notes: "",
      screenshots_or_refs: [],
    },
    verdict: "PENDING",
    tested_by: "",
    tested_at: "",
    environment: "local",
  };
}

export function validateRuntimeMissionDraftManualActivationEvidencePack(
  pack: RuntimeMissionDraftManualActivationEvidencePack
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!pack.tested_by?.trim()) issues.push("tested_by requis.");
  if (!pack.tested_at?.trim()) issues.push("tested_at requis.");
  if (pack.evidence.table_check_result === "not_checked") issues.push("table_check_result non vérifié.");
  if (pack.evidence.rls_check_result === "not_checked") issues.push("rls_check_result non vérifié.");
  if (pack.evidence.post_423_before_activation_result === "not_checked") issues.push("post_423_before_activation non vérifié.");
  if (pack.evidence.server_row_safety_flags_result === "not_checked") issues.push("server_row_safety_flags non vérifié.");
  if (pack.verdict === "PENDING") issues.push("Verdict PENDING — QA non terminée.");
  return { valid: issues.length === 0, issues };
}

export function summarizeRuntimeMissionDraftManualActivationVerdict(
  summary: RuntimeMissionDraftManualActivationSummary
): string {
  const lines = [
    `[QA PHASE 4.6 Runtime Mission Draft Manual Activation] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to activate : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "passed") lines.push("  → QA Manual Activation validée.");
  else if (summary.verdict === "ready_for_manual_activation") {
    lines.push("  → Prêt pour activation manuelle. Suivre les étapes dans l'ordre.");
  }
  lines.push("  Scale 80k non prouvé. Lancement public externe non validé.");
  return lines.join("\n");
}
