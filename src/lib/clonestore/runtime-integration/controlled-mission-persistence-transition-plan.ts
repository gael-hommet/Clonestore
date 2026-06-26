// src/lib/clonestore/runtime-integration/controlled-mission-persistence-transition-plan.ts
// PHASE 5.8 — Controlled Mission Persistence Transition Plan (pur)
//
// DESIGN-ONLY. Produit la roadmap de transition localStorage-only → future
// persistance serveur activable manuellement. N'ACTIVE RIEN. Aucune route. Aucun
// GET/POST serveur. Aucun SQL appliqué. Aucune exécution. Aucun appel réseau.
// Aucun moteur Pierre. Aucune IA. localStorage reste la seule source active.

import { CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME, CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE } from "./controlled-mission-server-persistence-sql-draft";
import { CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG } from "./controlled-mission-server-persistence-policy";
import { CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT } from "./controlled-mission-server-persistence-api-contract";
import type {
  ControlledMissionPersistenceTransitionPhase,
  ControlledMissionPersistenceTransitionPhaseStatus,
  ControlledMissionPersistenceTransitionMilestone,
  ControlledMissionPersistenceTransitionRisk,
  ControlledMissionPersistenceRollbackPlan,
  ControlledMissionPersistenceDataConsistencyPolicy,
  ControlledMissionPersistenceNoExecutionPolicy,
  ControlledMissionPersistenceTransitionEvidenceItem,
  ControlledMissionPersistenceTransitionReadinessLevel,
  ControlledMissionPersistenceTransitionPlan,
} from "./controlled-mission-persistence-transition-plan-types";

// ── Phases futures (T1 → T8) ──────────────────────────────────────────────────

function phase(
  id: string,
  label: string,
  objective: string,
  status: ControlledMissionPersistenceTransitionPhaseStatus,
  prerequisites: string[],
  actions: string[],
  forbidden_actions: string[],
  expected_evidence: string
): ControlledMissionPersistenceTransitionPhase {
  return {
    id,
    label,
    objective,
    status,
    prerequisites,
    actions,
    forbidden_actions,
    expected_evidence,
    no_execution_confirmed: true,
    activation_performed: false,
  };
}

export function buildControlledMissionPersistenceTransitionPhases(): ControlledMissionPersistenceTransitionPhase[] {
  return [
    phase(
      "T1",
      "T1 — Manual SQL Apply Preparation",
      "Préparer la revue manuelle du SQL serveur, sans l'appliquer.",
      "ready_for_manual_review",
      ["P5.4 design serveur prêt", "SQL draft présent", "P5.5 QA d'activation manuelle prête"],
      ["Revue manuelle du SQL", "Confirmation RLS", "Confirmation CHECK no-execution"],
      ["Appliquer le SQL", "Activer le flag", "Créer une route"],
      "Capture de la revue SQL (non appliqué).",
    ),
    phase(
      "T2",
      "T2 — Manual SQL Apply Evidence",
      "Documenter l'application manuelle FUTURE du SQL et son rollback.",
      "future",
      ["T1 validé"],
      ["Application future manuelle du SQL", "Evidence d'application obligatoire", "Rollback SQL documenté"],
      ["Application automatique", "Exécution", "Write serveur en P5.8"],
      "Evidence d'application future + rollback (hors scope P5.8).",
    ),
    phase(
      "T3",
      "T3 — Feature Flag Controlled Activation",
      "Concevoir l'activation contrôlée future du flag serveur (default false).",
      "future",
      ["T2 validé"],
      ["Activation progressive future du flag", "Default false conservé jusqu'à activation"],
      ["Activer le flag en P5.8", "Modifier .env.local"],
      "Plan d'activation progressive du flag (hors scope P5.8).",
    ),
    phase(
      "T4",
      "T4 — Future Server GET Route Design",
      "Concevoir la future route GET serveur (lecture seule), sans la créer.",
      "future",
      ["T3 validé"],
      ["Design route GET future", "Lecture serveur future", "RLS obligatoire"],
      ["Créer la route", "GET serveur en P5.8", "Exécution"],
      "Design de route GET future (hors scope P5.8).",
    ),
    phase(
      "T5",
      "T5 — Future Server POST Route Design",
      "Concevoir la future route POST serveur (write gouverné), sans la créer.",
      "future",
      ["T4 validé"],
      ["Design route POST future", "Write serveur future", "Idempotence obligatoire", "RLS obligatoire"],
      ["Créer la route", "POST serveur en P5.8", "Write serveur en P5.8", "Exécution"],
      "Design de route POST future + idempotence (hors scope P5.8).",
    ),
    phase(
      "T6",
      "T6 — Future Restore From Server",
      "Concevoir la restauration FUTURE des lignes serveur avec fallback local.",
      "future",
      ["T4 validé"],
      ["Restore lignes serveur future", "Local fallback", "Conflict strategy"],
      ["Restaurer en P5.8", "GET serveur en P5.8", "Exécution"],
      "Design de restore future + stratégie de conflit (hors scope P5.8).",
    ),
    phase(
      "T7",
      "T7 — Future Sync Strategy",
      "Concevoir la cohérence FUTURE local ↔ serveur.",
      "future",
      ["T5 validé", "T6 validé"],
      ["Cohérence local ↔ serveur future", "Last-write-safe", "CloneTrace obligatoire"],
      ["Synchroniser en P5.8", "Write serveur en P5.8", "Exécution"],
      "Design de stratégie de sync future + trace (hors scope P5.8).",
    ),
    phase(
      "T8",
      "T8 — Future Production Readiness Gate",
      "Gate de readiness production FUTUR — uniquement après SQL appliqué, flag activé, routes testées, RLS vérifiée.",
      "future",
      ["T2 validé", "T3 validé", "T4 validé", "T5 validé", "T6 validé", "T7 validé"],
      ["Vérification finale future", "Lancement public externe à valider séparément"],
      ["Déclarer production ready en P5.8", "Exécution", "Lancement public externe non validé"],
      "Gate production future (hors scope P5.8 — public launch externe toujours non validé).",
    ),
  ];
}

// ── Milestones ────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceTransitionMilestones(): ControlledMissionPersistenceTransitionMilestone[] {
  const ms = (
    id: string,
    label: string,
    target: string,
    owner: string,
    success_criteria: string[],
    rollback_criteria: string[]
  ): ControlledMissionPersistenceTransitionMilestone => ({ id, label, target, owner, status: "future", success_criteria, rollback_criteria });
  return [
    ms("m_sql_review", "Revue SQL manuelle", "phase future", "opérateur humain", ["SQL revu, marqueurs confirmés"], ["Doute sur RLS / CHECK → ne pas appliquer"]),
    ms("m_sql_apply", "Application SQL manuelle", "phase future", "opérateur humain", ["Table + RLS + CHECK appliqués en test"], ["Échec CHECK → rollback SQL"]),
    ms("m_flag_activation", "Activation flag contrôlée", "phase future", "opérateur humain", ["Flag activé progressivement"], ["Comportement inattendu → flag false"]),
    ms("m_routes_design", "Design routes GET/POST", "phase future", "équipe design", ["Routes conçues, idempotence + RLS"], ["Risque exécution → ne pas créer"]),
    ms("m_restore_sync", "Restore + sync future", "phase future", "équipe design", ["Restore + sync conçus, local fallback"], ["Conflit non résolu → local source wins"]),
    ms("m_production_gate", "Gate production future", "phase future", "gouvernance", ["Tout validé, public launch séparé"], ["Public launch externe non validé → bloqué"]),
  ];
}

// ── Risks ─────────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceTransitionRisks(): ControlledMissionPersistenceTransitionRisk[] {
  return [
    { id: "r_sql_premature", label: "Application SQL prématurée", severity: "high", mitigation: "SQL marqué DO NOT APPLY ; application manuelle gouvernée uniquement." },
    { id: "r_flag_premature", label: "Activation flag prématurée", severity: "high", mitigation: "Flag default false ; activation progressive contrôlée." },
    { id: "r_route_execution", label: "Confusion route/exécution", severity: "high", mitigation: "Persistance ≠ exécution ; routes write gouvernées, idempotence + RLS." },
    { id: "r_data_conflict", label: "Conflit local ↔ serveur", severity: "medium", mitigation: "Local source wins jusqu'à activation serveur ; no silent overwrite." },
    { id: "r_scale", label: "Scale non prouvé", severity: "medium", mitigation: "scale 80k non prouvé ; charge à tester séparément." },
  ];
}

// ── Policies ──────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceRollbackPlan(): ControlledMissionPersistenceRollbackPlan {
  return {
    steps: [
      "Désactiver le flag serveur (disable flag → false).",
      "Revenir à localStorage-only comme source active.",
      "Ignorer les server rows (aucune lecture appliquée).",
      "Vérifier la RLS et l'isolation tenant.",
      "Supprimer la route future si elle a été créée (phase future).",
      "Ne jamais déclencher le runtime execution.",
    ],
    runtime_never_triggered: true,
  };
}

export function buildControlledMissionPersistenceDataConsistencyPolicy(): ControlledMissionPersistenceDataConsistencyPolicy {
  return {
    items: [
      "local mission id stable (localcm_...).",
      "server draft id stable (srvdraft_...).",
      "user_id / tenant_id required.",
      "idempotency key required (future).",
      "conflict resolution (future).",
      "local source wins until server activated.",
      "no silent overwrite.",
      "CloneTrace required (future).",
    ],
    local_source_wins_until_server_activated: true,
    no_silent_overwrite: true,
  };
}

export function buildControlledMissionPersistenceNoExecutionPolicy(): ControlledMissionPersistenceNoExecutionPolicy {
  return {
    items: [
      "persistence ≠ execution.",
      "restore ≠ execution.",
      "sync ≠ execution.",
      "runtime execution = phase séparée (jamais en P5.8).",
      "Pierre engine not called.",
      "IA / email / document / CloneVoice not called.",
    ],
    persistence_is_not_execution: true,
    restore_is_not_execution: true,
    sync_is_not_execution: true,
  };
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceTransitionEvidence(): ControlledMissionPersistenceTransitionEvidenceItem[] {
  return [
    { id: "ev_sql_review", label: "Revue SQL manuelle (T1)", expected: "SQL revu, marqueurs DO NOT APPLY confirmés", manual_capture_required: true },
    { id: "ev_flag_off", label: "Flag serveur off", expected: "default false, .env.local non modifié", manual_capture_required: true },
    { id: "ev_no_route", label: "Aucune route serveur", expected: "Aucun fichier route.ts controlled-missions/restore/execute", manual_capture_required: true },
    { id: "ev_no_execution", label: "Invariants no-execution", expected: "Tous les *_performed/*_active false", manual_capture_required: true },
    { id: "ev_local_source", label: "localStorage source active", expected: "Aucun GET/POST serveur effectué", manual_capture_required: true },
  ];
}

// ── Score (déterministe) ──────────────────────────────────────────────────────

function phaseScore(status: ControlledMissionPersistenceTransitionPhaseStatus): number {
  switch (status) {
    case "design_ready":
      return 100;
    case "ready_for_manual_review":
      return 80;
    case "future":
      return 60;
    case "blocked":
      return 0;
  }
}

export function computeControlledMissionPersistenceTransitionScore(
  plan: Pick<ControlledMissionPersistenceTransitionPlan, "phases">
): number {
  if (plan.phases.length === 0) return 0;
  const total = plan.phases.reduce((acc, p) => acc + phaseScore(p.status), 0);
  return Math.round(total / plan.phases.length);
}

function deriveReadinessLevel(score: number): ControlledMissionPersistenceTransitionReadinessLevel {
  if (score >= 85) return "next_phase_candidate";
  if (score >= 70) return "manually_review_ready";
  if (score >= 50) return "design_ready";
  return "incomplete";
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export function buildControlledMissionPersistenceTransitionPlan(
  options?: { now?: string }
): ControlledMissionPersistenceTransitionPlan {
  const now = options?.now ?? new Date().toISOString();
  const phases = buildControlledMissionPersistenceTransitionPhases();
  const readiness_score = computeControlledMissionPersistenceTransitionScore({ phases });
  const readiness_level = deriveReadinessLevel(readiness_score);

  return {
    phase: "5.8",
    title: "Plan de transition — persistance contrôlée (design-only, localStorage → serveur futur)",
    generated_at: now,
    transition_status: "ready_for_future_manual_sql_apply",
    current_source: "localStorage",
    future_source: "server_persistence",
    target_table: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    sql_draft_path: CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE,
    flag_key: CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
    flag_default: false,
    future_endpoints: [
      `${CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT} (GET futur)`,
      `${CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT} (POST futur)`,
      `${CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT}/restore (GET futur)`,
    ],
    phases,
    milestones: buildControlledMissionPersistenceTransitionMilestones(),
    blockers: [
      "SQL non appliqué (DO NOT APPLY) — application manuelle gouvernée requise.",
      "Flag serveur default false — activation contrôlée requise.",
      "Routes serveur non créées — design uniquement.",
      "Public launch externe non validé.",
    ],
    risks: buildControlledMissionPersistenceTransitionRisks(),
    rollback_plan: buildControlledMissionPersistenceRollbackPlan(),
    migration_policy: [
      "Migration manuelle gouvernée uniquement (jamais automatique).",
      "localStorage reste la source active jusqu'à activation serveur.",
      "Aucune migration en P5.8.",
    ],
    data_consistency_policy: buildControlledMissionPersistenceDataConsistencyPolicy(),
    no_execution_policy: buildControlledMissionPersistenceNoExecutionPolicy(),
    required_next_steps: [
      "PHASE 5.9 — Controlled Mission Persistence Documentation & Operator Handbook (still no execution).",
      "Conserver le SQL non appliqué et le flag à false.",
      "Aucune route, aucun GET/POST serveur, aucune exécution dans cette phase.",
    ],
    evidence: buildControlledMissionPersistenceTransitionEvidence(),
    readiness_score,
    readiness_level,
    transition_active: false,
    sql_applied: false,
    env_modified: false,
    route_created: false,
    server_get_performed: false,
    server_post_performed: false,
    server_write_performed: false,
    server_restore_performed: false,
    runtime_execution_performed: false,
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionPersistenceTransitionPlan(
  plan: ControlledMissionPersistenceTransitionPlan
): string {
  return [
    `[Plan de transition — PHASE 5.8] statut ${plan.transition_status} · readiness ${plan.readiness_score}% (${plan.readiness_level})`,
    `  Source active : ${plan.current_source} → future : ${plan.future_source}`,
    `  Phases : ${plan.phases.length} (T1 → T8) · milestones : ${plan.milestones.length} · risques : ${plan.risks.length}`,
    `  Plan de transition design-only — aucune activation, aucune route, aucun GET/POST serveur, aucune exécution.`,
    `  persistence ≠ execution · restore ≠ execution · sync ≠ execution.`,
    `  localStorage source active · SQL non appliqué · flag off · scale 80k non prouvé · lancement public externe non validé.`,
  ].join("\n");
}
