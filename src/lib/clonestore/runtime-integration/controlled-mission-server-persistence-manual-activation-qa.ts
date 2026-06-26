// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-manual-activation-qa.ts
// PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA
//
// Module PUR. Aucune écriture. Aucun appel réseau. Aucun import base de données.
// Aucun import Pierre. Aucune application SQL. Aucune lecture/écriture .env.local.
// La QA décrit une activation MANUELLE FUTURE — elle n'active RIEN en P5.5.

import {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE,
} from "./controlled-mission-server-persistence-sql-draft";
import {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
} from "./controlled-mission-server-persistence-policy";
import {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT,
} from "./controlled-mission-server-persistence-api-contract";
import type {
  ControlledMissionServerPersistenceManualActivationStep,
  ControlledMissionServerPersistenceManualActivationCategory,
  ControlledMissionServerPersistenceManualActivationStepSeverity,
  ControlledMissionServerPersistenceManualActivationEvaluation,
  ControlledMissionServerPersistenceManualActivationVerdict,
  ControlledMissionServerPersistenceManualActivationQa,
  ControlledMissionServerPersistenceManualActivationRunbook,
  ControlledMissionServerPersistenceManualActivationEvidenceTemplate,
} from "./controlled-mission-server-persistence-manual-activation-types";

// ── Checklist ─────────────────────────────────────────────────────────────────

function s(
  id: string,
  category: ControlledMissionServerPersistenceManualActivationCategory,
  label: string,
  description: string,
  expected_evidence: string,
  severity: ControlledMissionServerPersistenceManualActivationStepSeverity = "blocking"
): ControlledMissionServerPersistenceManualActivationStep {
  return {
    id,
    category,
    label,
    description,
    expected_evidence,
    status: "pending",
    severity,
    manual_only: true,
    execution_enabled: false,
  };
}

export function buildControlledMissionServerPersistenceManualActivationChecklist(): ControlledMissionServerPersistenceManualActivationStep[] {
  return [
    // ── A. Design P5.4 ─────────────────────────────────────────────────────────
    s("a_modules_present", "design_p54", "Modules P5.4 présents", "Vérifier la présence des modules de design de persistance serveur (P5.4).", "Liste des fichiers controlled-mission-server-persistence-*.ts."),
    s("a_sql_draft_present", "design_p54", "SQL draft P5.4 présent", "Vérifier que le SQL draft de persistance serveur existe.", "Chemin du fichier SQL draft."),
    s("a_api_contract_present", "design_p54", "API contract présent", "Vérifier que le contrat d'API (route future) existe.", "current_phase_status disabled_design_only."),
    s("a_feature_flag_contract_present", "design_p54", "Feature flag contract présent", "Vérifier que le contrat de feature flag existe.", "flag_key + default false."),
    s("a_ui_design_only_present", "design_p54", "UI design-only présent", "Vérifier que le panneau UI design-only P5.4 existe.", "Capture du panneau « design non actif »."),
    s("a_docs_present", "design_p54", "Docs P5.4 présentes", "Vérifier la présence de la doc de design P5.4.", "Chemin de la doc P5.4."),
    s("a_evidence_template_present", "design_p54", "Evidence template P5.4 présent", "Vérifier la présence du template d'evidence P5.4.", "Chemin du template d'evidence P5.4."),

    // ── B. SQL manual review ───────────────────────────────────────────────────
    s("b_sql_design_draft_only", "sql_manual_review", "SQL contient DESIGN DRAFT ONLY", "Le SQL draft est clairement marqué design-only.", "Présence du marqueur DESIGN DRAFT ONLY."),
    s("b_sql_do_not_apply", "sql_manual_review", "SQL contient DO NOT APPLY", "Le SQL ne doit pas être appliqué automatiquement.", "Présence du marqueur DO NOT APPLY."),
    s("b_sql_still_no_execution", "sql_manual_review", "SQL contient STILL NO EXECUTION", "Le SQL rappelle qu'aucune exécution n'a lieu.", "Présence du marqueur STILL NO EXECUTION."),
    s("b_sql_flag_must_remain_off", "sql_manual_review", "SQL contient SERVER PERSISTENCE FLAG MUST REMAIN OFF", "Le SQL rappelle que le flag serveur reste off.", "Présence du marqueur SERVER PERSISTENCE FLAG MUST REMAIN OFF."),
    s("b_table_defined", "sql_manual_review", "Table clonestore_controlled_missions définie", "La table cible est définie dans le SQL.", "Définition create table clonestore_controlled_missions."),
    s("b_rls_enable", "sql_manual_review", "RLS enable présent", "Row Level Security activée sur la table.", "enable row level security."),
    s("b_select_policy", "sql_manual_review", "SELECT own policy présente", "Policy SELECT limitée à auth.uid() = user_id.", "select_own_controlled_mission."),
    s("b_insert_policy_future_flag_off", "sql_manual_review", "INSERT own policy présente (future, flag off)", "Policy INSERT prête pour la route serveur future, flag off.", "insert_own_controlled_mission + flag off."),
    s("b_update_policy", "sql_manual_review", "UPDATE own policy présente", "Policy UPDATE limitée au propriétaire.", "update_own_controlled_mission."),
    s("b_no_delete_policy", "sql_manual_review", "Aucune policy DELETE", "Pas de policy DELETE (préservation / audit).", "Absence de policy DELETE."),
    s("b_check_no_execution", "sql_manual_review", "CHECK no-execution présent", "CHECK garantissant tous les *_enabled = false.", "CHECK chk_controlled_missions_no_execution."),
    s("b_runtime_status_disabled", "sql_manual_review", "runtime_status disabled contraint", "runtime_status forcé à 'disabled' par CHECK.", "runtime_status = 'disabled' dans le CHECK."),
    s("b_indexes_present", "sql_manual_review", "Indexes présents", "Index user_id / status / updated_at présents.", "Liste des create index."),
    s("b_trigger_updated_at", "sql_manual_review", "Trigger updated_at présent", "Trigger de mise à jour updated_at présent.", "trg_clonestore_controlled_missions_updated_at."),

    // ── C. Feature flag ────────────────────────────────────────────────────────
    s("c_flag_key_documented", "feature_flag", "Flag key documenté", "La clé de feature flag serveur est documentée.", `Clé ${CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG}.`),
    s("c_flag_default_false", "feature_flag", "Flag default false", "Le flag serveur a une valeur par défaut false.", "default_enabled false."),
    s("c_env_local_not_modified", "feature_flag", ".env.local non modifié", "Aucune modification de .env.local en P5.5.", "Diff vide sur .env.local."),
    s("c_future_activation_documented", "feature_flag", "Activation future documentée", "Les étapes d'activation future sont documentées.", "Runbook + activation_steps."),
    s("c_flag_true_no_route", "feature_flag", "Flag true ne crée aucune route", "Même flag=true, aucune route n'est créée en P5.5.", "Absence de route.ts malgré flag true."),

    // ── D. Routes ──────────────────────────────────────────────────────────────
    s("d_route_controlled_missions_not_created", "routes", "Route controlled-missions non créée", "La route serveur controlled-missions n'existe pas.", "Absence du fichier route.ts controlled-missions."),
    s("d_route_execute_not_created", "routes", "Route execute non créée", "Aucune route execute n'existe.", "Absence de route execute."),
    s("d_api_contract_disabled_design_only", "routes", "API contract disabled_design_only", "Le contrat d'API est en statut disabled_design_only.", "current_phase_status disabled_design_only."),
    s("d_route_file_created_false", "routes", "route_file_created false", "Le contrat d'API indique route_file_created false.", "route_file_created false."),

    // ── E. No-execution invariants ─────────────────────────────────────────────
    s("e_server_write_performed_false", "no_execution_invariants", "server_write_performed false", "Aucun write serveur effectué.", "server_write_performed false."),
    s("e_runtime_execution_performed_false", "no_execution_invariants", "runtime_execution_performed false", "Aucune exécution runtime effectuée.", "runtime_execution_performed false."),
    s("e_real_mission_created_false", "no_execution_invariants", "real_mission_created false", "Aucune mission réelle créée.", "real_mission_created false."),
    s("e_pierre_engine_called_false", "no_execution_invariants", "pierre_engine_called false", "Le moteur Pierre n'est pas appelé.", "pierre_engine_called false."),
    s("e_ai_call_performed_false", "no_execution_invariants", "ai_call_performed false", "Aucun appel IA effectué.", "ai_call_performed false."),
    s("e_email_sent_false", "no_execution_invariants", "email_sent false", "Aucun email envoyé.", "email_sent false."),
    s("e_document_generated_false", "no_execution_invariants", "document_generated false", "Aucun document/PDF généré.", "document_generated false."),
    s("e_clonevoice_active_false", "no_execution_invariants", "clonevoice_active false", "CloneVoice non actif.", "clonevoice_active false."),

    // ── F. Manual evidence ─────────────────────────────────────────────────────
    s("f_evidence_template_exists", "manual_evidence", "Evidence template P5.5 existe", "Le template d'evidence d'activation manuelle existe.", "Chemin du template d'evidence P5.5."),
    s("f_runbook_exists", "manual_evidence", "Runbook manuel existe", "Le runbook d'activation manuelle existe.", "Chemin du runbook P5.5."),
    s("f_qa_script_readonly_exists", "manual_evidence", "QA script read-only existe", "Le script de check read-only existe.", "Chemin du script check P5.5."),
    s("f_public_launch_external_not_validated", "manual_evidence", "Lancement public externe non validé", "Le lancement public externe reste non validé.", "Mention « lancement public externe non validé ».", "info"),
    s("f_scale_80k_not_proven", "manual_evidence", "Scale 80k non prouvé", "Le scale 80k reste non prouvé.", "Mention « scale 80k non prouvé ».", "info"),
  ];
}

// ── Évaluation ────────────────────────────────────────────────────────────────

export function evaluateControlledMissionServerPersistenceManualActivationQa(
  steps: ControlledMissionServerPersistenceManualActivationStep[]
): ControlledMissionServerPersistenceManualActivationEvaluation {
  const blockingFailed = steps.filter((x) => x.severity === "blocking" && x.status === "failed");
  const passed = steps.filter((x) => x.status === "passed");
  const pending = steps.filter((x) => x.status === "pending" || x.status === "needs_manual_review");

  let verdict: ControlledMissionServerPersistenceManualActivationVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const evaluation: ControlledMissionServerPersistenceManualActivationEvaluation = {
    verdict,
    total: steps.length,
    passed_count: passed.length,
    pending_count: pending.length,
    blocking_failed_count: blockingFailed.length,
    blocking_steps: blockingFailed.map((x) => x.id),
    message: "",
    activation_not_performed: true,
    sql_applied: false,
    env_modified: false,
    route_created: false,
    server_write_performed: false,
    runtime_execution_performed: false,
  };
  evaluation.message = summarizeControlledMissionServerPersistenceManualActivationQa(evaluation);
  return evaluation;
}

export function getControlledMissionServerPersistenceManualActivationBlockingSteps(): ControlledMissionServerPersistenceManualActivationStep[] {
  return buildControlledMissionServerPersistenceManualActivationChecklist().filter((x) => x.severity === "blocking");
}

// ── QA agrégée ────────────────────────────────────────────────────────────────

export function buildControlledMissionServerPersistenceManualActivationQa(
  options?: { now?: string }
): ControlledMissionServerPersistenceManualActivationQa {
  const now = options?.now ?? new Date().toISOString();
  const steps = buildControlledMissionServerPersistenceManualActivationChecklist();
  const evaluation = evaluateControlledMissionServerPersistenceManualActivationQa(steps);

  return {
    phase: "5.5",
    title: "Controlled Mission — QA d'activation manuelle de la persistance serveur (design-only)",
    generated_at: now,
    target_table: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    sql_draft_path: CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE,
    feature_flag_key: CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
    feature_flag_default: false,
    future_endpoint: CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT,
    current_status: "design_ready_manual_qa_pending",
    overall_verdict: evaluation.verdict,
    steps,
    blocking_steps: getControlledMissionServerPersistenceManualActivationBlockingSteps().map((x) => x.id),
    warnings: [
      "QA manuelle uniquement · Aucune activation.",
      "Ne pas appliquer le SQL dans cette phase.",
      "Aucune donnée n'est envoyée au serveur.",
    ],
    required_manual_evidence: [
      "Revue manuelle du SQL draft (non appliqué).",
      "Capture confirmant le flag serveur à false.",
      "Confirmation de l'absence de route serveur.",
      "Confirmation qu'aucune donnée n'a été envoyée.",
    ],
    activation_not_performed: true,
    sql_applied: false,
    env_modified: false,
    route_created: false,
    server_write_performed: false,
    runtime_execution_performed: false,
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
  };
}

export function summarizeControlledMissionServerPersistenceManualActivationQa(
  evaluation: ControlledMissionServerPersistenceManualActivationEvaluation
): string {
  const lines = [
    `[QA PHASE 5.5 Controlled Mission Server Persistence Manual Activation] Verdict : ${evaluation.verdict.toUpperCase()}`,
    `  Étapes réussies : ${evaluation.passed_count}`,
    `  Étapes en attente : ${evaluation.pending_count}`,
    `  Étapes bloquantes échouées : ${evaluation.blocking_failed_count}`,
    `  QA manuelle uniquement — aucune activation, aucune application SQL, aucune exécution.`,
  ];
  if (evaluation.verdict === "passed") lines.push("  → Préparation d'activation manuelle validée (toujours non appliquée).");
  else if (evaluation.verdict === "ready") lines.push("  → Prêt pour la revue manuelle.");
  lines.push("  Persistance serveur inactive · scale 80k non prouvé · lancement public externe non validé.");
  return lines.join("\n");
}

// ── Runbook ───────────────────────────────────────────────────────────────────

export function buildControlledMissionServerPersistenceManualActivationRunbook(): ControlledMissionServerPersistenceManualActivationRunbook {
  return {
    title: "Runbook — Activation manuelle FUTURE de la persistance serveur des Controlled Missions",
    phase: "5.5",
    prerequisites: [
      "PHASE 5.4 (design serveur) validée.",
      "SQL draft présent et NON appliqué.",
      "Flag serveur default false, .env.local non modifié.",
      "Aucune route serveur controlled-missions créée.",
    ],
    sections: [
      {
        heading: "1. Revue du SQL (sans application)",
        items: [
          "Ouvrir le SQL draft et confirmer les marqueurs DESIGN DRAFT ONLY / DO NOT APPLY / STILL NO EXECUTION / SERVER PERSISTENCE FLAG MUST REMAIN OFF.",
          "Vérifier table, RLS enable, policies select/insert/update, absence de DELETE, CHECK no-execution, runtime_status disabled.",
          "NE PAS exécuter le SQL dans cette phase.",
        ],
      },
      {
        heading: "2. Vérification du flag",
        items: [
          "Confirmer que le flag serveur est documenté avec default false.",
          "Confirmer qu'aucune modification de .env.local n'a été faite.",
          "Confirmer que flag=true ne crée aucune route en P5.5.",
        ],
      },
      {
        heading: "3. Vérification des routes",
        items: [
          "Confirmer l'absence de route serveur controlled-missions active.",
          "Confirmer l'absence de route execute.",
          "Confirmer que l'API contract est disabled_design_only.",
        ],
      },
      {
        heading: "4. Vérification no-execution",
        items: [
          "Confirmer server_write_performed / runtime_execution_performed false.",
          "Confirmer real_mission_created / pierre_engine_called / ai_call_performed false.",
          "Confirmer email_sent / document_generated / clonevoice_active false.",
        ],
      },
      {
        heading: "5. Evidence",
        items: [
          "Remplir le template d'evidence P5.5.",
          "Joindre captures : flag off, absence de route, SQL non appliqué.",
        ],
      },
    ],
    decision_options: [
      "PASS — préparation manuelle vérifiée, rien appliqué.",
      "FAIL — SQL appliqué, flag activé, route créée, write serveur ou exécution détectée.",
      "NEEDS REVIEW — points non bloquants à revoir.",
    ],
    do_not_apply_reminders: [
      "Ne pas appliquer le SQL dans cette phase (P5.5).",
      "Ne pas activer le flag serveur.",
      "Ne pas créer de route serveur.",
      "Persistance serveur ≠ exécution. lancement public externe non validé.",
    ],
    activation_not_performed: true,
    sql_applied: false,
  };
}

// ── Evidence template ─────────────────────────────────────────────────────────

export function buildControlledMissionServerPersistenceManualActivationEvidenceTemplate(): ControlledMissionServerPersistenceManualActivationEvidenceTemplate {
  return {
    title: "Evidence — Activation manuelle FUTURE de la persistance serveur (P5.5)",
    phase: "5.5",
    sections: [
      { heading: "Design P5.4", items: ["Modules présents", "SQL draft présent", "API contract présent", "UI design-only présent"] },
      { heading: "SQL manual review", items: ["Marqueurs présents", "RLS + policies vérifiées", "CHECK no-execution vérifié"] },
      { heading: "Feature flag", items: ["default false", ".env.local non modifié", "flag true ne crée aucune route"] },
      { heading: "Routes", items: ["controlled-missions non créée", "execute non créée", "API contract disabled_design_only"] },
      { heading: "No-execution", items: ["server_write false", "runtime/Pierre/IA/email/document/clonevoice false"] },
    ],
    decision_options: ["PASS", "FAIL", "NEEDS REVIEW"],
    reminders: [
      "QA manuelle uniquement · Aucune activation.",
      "Ne pas appliquer le SQL dans cette phase.",
      "scale 80k non prouvé · lancement public externe non validé.",
    ],
  };
}
