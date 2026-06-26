// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-contract.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence — Contract / Readiness
//
// DESIGN-ONLY. Transforme une Controlled Mission LOCALE (revue + preflight) en
// DRAFT de persistance serveur gouvernée. N'ÉCRIT RIEN. N'ENVOIE RIEN au serveur.
// Aucune mission réelle. Aucune exécution. Aucun moteur Pierre. Aucune IA.
// Aucun appel réseau. localStorage reste la seule source active.

import type { LocalControlledMission } from "./controlled-mission-safe-apply-types";
import type {
  GovernedControlledMissionServerDraft,
  GovernedControlledMissionServerDraftBuildOptions,
  GovernedControlledMissionServerDraftEligibility,
  GovernedControlledMissionServerPersistenceReadiness,
  GovernedControlledMissionServerPersistenceStatus,
  GovernedControlledMissionExecutionStatus,
  GovernedControlledMissionGovernanceStatus,
  GovernedControlledMissionTraceSnapshot,
} from "./controlled-mission-server-persistence-types";
import {
  CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
} from "./controlled-mission-server-persistence-sql-draft";
import {
  getControlledMissionServerPersistenceFlagDefault,
} from "./controlled-mission-server-persistence-policy";

// ── Gating partagé (revue → guard → preflight) ────────────────────────────────

type ServerPersistenceComputation = {
  status: GovernedControlledMissionServerPersistenceStatus;
  blocking_reasons: string[];
};

function computeServerPersistenceStatus(
  mission: LocalControlledMission
): ServerPersistenceComputation {
  const reviewStatus = mission.review_state?.review_status ?? "not_reviewed";

  // 1. Décision manuelle locale bloquante.
  if (reviewStatus === "changes_requested" || reviewStatus === "blocked_local") {
    return {
      status: "blocked_by_manual_decision",
      blocking_reasons: ["Décision manuelle locale (modifications demandées / bloquée)."],
    };
  }
  // 2. Revue locale non approuvée.
  if (reviewStatus !== "approved_local") {
    return {
      status: "blocked_missing_review",
      blocking_reasons: ["Revue locale non approuvée."],
    };
  }
  // 3. Mission bloquée par CloneGuard.
  if (mission.status === "blocked_by_guard") {
    return { status: "blocked_by_guard", blocking_reasons: ["Mission bloquée par CloneGuard."] };
  }
  // 4. Preflight requis.
  const preflight = mission.preflight_state;
  if (!preflight) {
    return {
      status: "blocked_missing_preflight",
      blocking_reasons: ["Preflight local non lancé."],
    };
  }
  switch (preflight.preflight_status) {
    case "ready_for_future_governed_execution":
      return { status: "ready_for_future_server_persistence", blocking_reasons: [] };
    case "blocked_by_guard":
      return { status: "blocked_by_guard", blocking_reasons: ["Preflight bloqué par CloneGuard."] };
    case "blocked_by_manual_decision":
      return { status: "blocked_by_manual_decision", blocking_reasons: ["Preflight bloqué par décision manuelle."] };
    case "blocked_by_missing_review":
      return { status: "blocked_missing_review", blocking_reasons: ["Preflight bloqué — revue manquante."] };
    default:
      return { status: "blocked_missing_preflight", blocking_reasons: ["Preflight non prêt."] };
  }
}

// ── Eligibility ───────────────────────────────────────────────────────────────

export function validateGovernedControlledMissionServerDraftEligibility(
  mission: LocalControlledMission
): GovernedControlledMissionServerDraftEligibility {
  const { status, blocking_reasons } = computeServerPersistenceStatus(mission);
  if (status === "ready_for_future_server_persistence") {
    return { eligible: true, blocked_status: null, reason: null };
  }
  return { eligible: false, blocked_status: status, reason: blocking_reasons[0] ?? null };
}

// ── Readiness ─────────────────────────────────────────────────────────────────

function deriveExecutionStatus(ready: boolean): GovernedControlledMissionExecutionStatus {
  return ready ? "server_draft_only" : "not_executable";
}

function deriveGovernanceStatus(
  status: GovernedControlledMissionServerPersistenceStatus
): GovernedControlledMissionGovernanceStatus {
  if (status === "ready_for_future_server_persistence") return "preflight_ready";
  if (status === "blocked_by_guard") return "blocked";
  return "requires_human_governance";
}

export function buildControlledMissionServerPersistenceReadiness(
  mission: LocalControlledMission
): GovernedControlledMissionServerPersistenceReadiness {
  const { status, blocking_reasons } = computeServerPersistenceStatus(mission);
  const ready = status === "ready_for_future_server_persistence";
  return {
    status,
    execution_status: deriveExecutionStatus(ready),
    runtime_status: "disabled",
    governance_status: deriveGovernanceStatus(status),
    readiness_score: mission.preflight_state?.readiness_score ?? 0,
    readiness_level: mission.preflight_state?.readiness_level ?? "not_ready",
    blocking_reasons,
    required_next_steps: [
      "Revue manuelle du SQL de persistance serveur gouvernée (non appliqué).",
      "Activation manuelle future du flag serveur (default false).",
      "Conception de l'activation manuelle QA (PHASE 5.5).",
      "Aucune persistance, aucune exécution, aucune donnée envoyée dans cette phase.",
    ],
    server_persistence_flag_enabled: getControlledMissionServerPersistenceFlagDefault(),
    requires_manual_sql_review: true,
    table_name: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    local_origin: true,
    server_write_performed: false,
    execution_enabled: false,
  };
}

// ── Trace snapshot ────────────────────────────────────────────────────────────

export function buildControlledMissionServerPersistenceTraceSnapshot(
  mission: LocalControlledMission
): GovernedControlledMissionTraceSnapshot {
  void mission;
  return {
    clonetrace_required: true,
    server_write_performed: false,
    events: [
      "controlled_mission_local_created",
      "local_review_recorded",
      "preflight_recorded",
      "server_persistence_design_prepared",
    ],
    final_event: "server_persistence_not_started",
  };
}

// ── Server draft builder ──────────────────────────────────────────────────────

export function buildGovernedControlledMissionServerDraft(
  mission: LocalControlledMission,
  options?: GovernedControlledMissionServerDraftBuildOptions
): GovernedControlledMissionServerDraft {
  const now = options?.now ?? new Date().toISOString();
  const readiness = buildControlledMissionServerPersistenceReadiness(mission);
  const review = mission.review_state;
  const preflight = mission.preflight_state;
  const approvedLocal = review?.review_status === "approved_local";

  return {
    id: `srvdraft_${mission.id}`,
    local_controlled_mission_id: mission.id,
    source_draft_id: mission.source_draft_id,
    source_promotion_id: mission.source_promotion_id,
    company_id: options?.company_id ?? null,
    user_id: options?.user_id ?? null,
    tenant_id: mission.tenant_id,
    employee_id: mission.employee_id,
    title: mission.title,
    summary: mission.summary,
    intent: mission.intent,
    category: mission.category,
    priority: mission.priority,
    risk_level: mission.risk_level,
    local_review_status: review?.review_status ?? "not_reviewed",
    preflight_status: preflight?.preflight_status ?? "not_started",
    readiness_score: preflight?.readiness_score ?? 0,
    readiness_level: preflight?.readiness_level ?? "not_ready",
    server_persistence_status: readiness.status,
    execution_status: readiness.execution_status,
    runtime_status: "disabled",
    governance_status: readiness.governance_status,
    guard_snapshot: {
      decision: mission.guard_summary?.decision ?? "require_human_validation",
      cloneguard_required: true,
      clonetrace_required: true,
      human_validation_required: true,
    },
    review_snapshot: {
      review_status: review?.review_status ?? "not_reviewed",
      validation_score: review?.validation_score ?? 0,
      approved_local: approvedLocal,
      reviewer_role: review?.reviewer_role ?? "reviewer",
    },
    preflight_snapshot: {
      preflight_status: preflight?.preflight_status ?? "not_started",
      readiness_score: preflight?.readiness_score ?? 0,
      readiness_level: preflight?.readiness_level ?? "not_ready",
      no_execution_performed: true,
    },
    runtime_requirements_snapshot: preflight?.runtime_requirements_snapshot ?? {
      stateless_runtime_required: true,
      idempotency_required: true,
      rate_limit_required: true,
      queue_required: true,
      tenant_isolation_required: true,
      runtime_execution: "disabled",
      future_phase_required: true,
    },
    human_validation_snapshot: preflight?.human_validation_snapshot ?? {
      review_status: review?.review_status ?? "not_reviewed",
      validation_score: review?.validation_score ?? 0,
      approved_local: approvedLocal,
      reviewer_role: review?.reviewer_role ?? "reviewer",
    },
    trace_snapshot: buildControlledMissionServerPersistenceTraceSnapshot(mission),
    created_at: now,
    updated_at: now,
    created_by: options?.user_id ?? null,
    // ── Invariants littéraux ───────────────────────────────────────────────────
    local_origin: true,
    execution_enabled: false,
    runtime_execution_enabled: false,
    pierre_engine_enabled: false,
    ai_execution_enabled: false,
    email_sending_enabled: false,
    document_generation_enabled: false,
    clonevoice_enabled: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionServerPersistenceDraft(
  draft: GovernedControlledMissionServerDraft
): string {
  return [
    `[Persistance serveur — design] ${draft.title} — ${draft.server_persistence_status} (${draft.governance_status})`,
    `  Table cible : ${CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME} · runtime ${draft.runtime_status} · execution ${draft.execution_status}`,
    `  Readiness ${draft.readiness_score}% (${draft.readiness_level}) · revue ${draft.local_review_status} · preflight ${draft.preflight_status}`,
    `  Design serveur uniquement — aucune persistance, aucune exécution, aucune donnée envoyée.`,
    `  La mission reste locale et non exécutée. scale 80k non prouvé. lancement public externe non validé.`,
  ].join("\n");
}
