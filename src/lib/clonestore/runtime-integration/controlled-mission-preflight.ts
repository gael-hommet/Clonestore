// src/lib/clonestore/runtime-integration/controlled-mission-preflight.ts
// PHASE 5.3 — Controlled Mission Local Execution Readiness Gate / Preflight
//
// Preflight LOCAL : vérifie si une Controlled Mission approuvée localement SERAIT
// candidate à une future exécution gouvernée. NE LANCE RIEN. « ready » = candidate
// future, JAMAIS exécution. localStorage-first uniquement.
// Aucun appel réseau. Pas de base de données. Pas d'import Pierre. Aucune IA.

import type { LocalControlledMission } from "./controlled-mission-safe-apply-types";
import type {
  LocalControlledMissionPreflightState,
  LocalControlledMissionPreflightStatus,
  LocalControlledMissionReadinessLevel,
  LocalControlledMissionPreflightCheck,
  LocalControlledMissionPreflightCheckId,
  LocalControlledMissionPreflightCheckStatus,
  LocalControlledMissionRuntimeRequirementsSnapshot,
  LocalControlledMissionGuardRequirementsSnapshot,
  LocalControlledMissionHumanValidationSnapshot,
  LocalControlledMissionPreflightResult,
  LocalControlledMissionPreflightResultStatus,
} from "./controlled-mission-preflight-types";
import { getControlledMissionReviewState } from "./controlled-mission-local-review";
import {
  getLocalControlledMissionById,
  upsertLocalControlledMission,
} from "./controlled-mission-local-storage";

// ── Snapshots ─────────────────────────────────────────────────────────────────

export function buildControlledMissionRuntimeRequirementsSnapshot(
  mission: LocalControlledMission
): LocalControlledMissionRuntimeRequirementsSnapshot {
  void mission;
  return {
    stateless_runtime_required: true,
    idempotency_required: true,
    rate_limit_required: true,
    queue_required: true,
    tenant_isolation_required: true,
    runtime_execution: "disabled",
    future_phase_required: true,
  };
}

export function buildControlledMissionGuardRequirementsSnapshot(
  mission: LocalControlledMission
): LocalControlledMissionGuardRequirementsSnapshot {
  return {
    cloneguard_required: true,
    clonetrace_required: true,
    human_validation_required: true,
    decision: mission.guard_summary?.decision ?? "require_human_validation",
  };
}

export function buildControlledMissionHumanValidationSnapshot(
  mission: LocalControlledMission
): LocalControlledMissionHumanValidationSnapshot {
  const review = getControlledMissionReviewState(mission);
  return {
    review_status: review.review_status,
    validation_score: review.validation_score,
    approved_local: review.review_status === "approved_local",
    reviewer_role: review.reviewer_role,
  };
}

// ── Checks ────────────────────────────────────────────────────────────────────

function check(
  id: LocalControlledMissionPreflightCheckId,
  label: string,
  ok: boolean,
  detail: string,
  blocking: boolean,
  warningWhenNotBlocking = false
): LocalControlledMissionPreflightCheck {
  const status: LocalControlledMissionPreflightCheckStatus = ok ? "pass" : blocking ? "fail" : warningWhenNotBlocking ? "warning" : "warning";
  return { id, label, status, detail, blocking, local_only: true, execution_enabled: false };
}

export function buildControlledMissionPreflightChecks(
  mission: LocalControlledMission
): LocalControlledMissionPreflightCheck[] {
  const review = getControlledMissionReviewState(mission);
  const notArchived = mission.status !== "archived_local" && review.review_status !== "archived_local";

  return [
    check("mission_exists", "Mission présente", true, "Mission contrôlée locale présente.", true),
    check("mission_not_archived", "Mission non archivée", notArchived, "La mission ne doit pas être archivée.", true),
    check("local_review_exists", "Revue locale existante", review.review_status !== "not_reviewed", "Une revue locale doit avoir été démarrée.", true),
    check("local_review_approved", "Revue locale approuvée", review.review_status === "approved_local", "La revue locale doit être approuvée.", true),
    check("no_changes_requested", "Aucune modification demandée", review.review_status !== "changes_requested", "Aucune modification ne doit rester en attente.", true),
    check("not_blocked_locally", "Non bloquée localement", review.review_status !== "blocked_local", "La mission ne doit pas être bloquée localement.", true),
    check("not_blocked_by_guard", "Non bloquée par CloneGuard", mission.status !== "blocked_by_guard", "La mission ne doit pas être bloquée par CloneGuard.", true),
    check("required_information_present", "Informations requises présentes", mission.blocked_reasons.length === 0, "Aucune information manquante.", true),
    check("employee_identified", "Employé IA identifié", Boolean(mission.employee_id), "Un employé IA doit être identifié.", true),
    check("steps_present", "Étapes présentes", mission.steps.length > 0, "Des étapes plan-only doivent exister.", false),
    check("human_validation_understood", "Validation humaine comprise", true, "Validation humaine requise comprise.", true),
    check("runtime_execution_still_disabled", "Runtime execution désactivé", mission.runtime_execution === "disabled", "Le runtime reste désactivé.", true),
    check("server_persistence_still_disabled", "Persistance serveur désactivée", mission.server_persistence === "disabled", "La persistance serveur reste désactivée.", true),
    check("pierre_not_called", "Pierre non appelé", mission.pierre_engine_called === false, "Le moteur Pierre n'est pas appelé.", true),
    check("ai_not_called", "Aucun appel IA", mission.ai_call_performed === false, "Aucun appel IA.", true),
    check("email_not_sent", "Aucun email envoyé", mission.email_sent === false, "Aucun email envoyé.", true),
    check("document_not_generated", "Aucun document généré", mission.document_generated === false, "Aucun document/PDF généré.", true),
    check("clonevoice_not_active", "CloneVoice non actif", mission.clonevoice_active === false, "CloneVoice non actif.", true),
    check("future_governed_execution_requires_new_phase", "Exécution gouvernée = phase future", false, "Une future exécution gouvernée nécessite une nouvelle phase. Aucune exécution ici.", false, true),
    check("scale_not_proven", "Scale 80k non prouvé", false, "Préparation scale uniquement — scale 80k non prouvé.", false, true),
  ];
}

// ── Score (déterministe) ──────────────────────────────────────────────────────

export function computeControlledMissionReadinessScore(
  checks: LocalControlledMissionPreflightCheck[]
): number {
  if (checks.length === 0) return 0;
  const passed = checks.filter((c) => c.status === "pass").length;
  return Math.round((passed / checks.length) * 100);
}

// ── État de preflight (défaut / accès) ────────────────────────────────────────

export function buildDefaultControlledMissionPreflightState(
  mission: LocalControlledMission
): LocalControlledMissionPreflightState {
  const checks = buildControlledMissionPreflightChecks(mission);
  return {
    preflight_status: "not_started",
    readiness_score: computeControlledMissionReadinessScore(checks),
    readiness_level: "not_ready",
    checked_at: null,
    checks,
    blocking_reasons: [],
    warnings: [],
    required_next_steps: [],
    runtime_requirements_snapshot: buildControlledMissionRuntimeRequirementsSnapshot(mission),
    guard_requirements_snapshot: buildControlledMissionGuardRequirementsSnapshot(mission),
    human_validation_snapshot: buildControlledMissionHumanValidationSnapshot(mission),
    local_only: true,
    no_execution_performed: true,
    runtime_execution_after_preflight: "disabled",
    server_persistence_after_preflight: "disabled",
  };
}

export function getControlledMissionPreflightState(
  mission: LocalControlledMission
): LocalControlledMissionPreflightState {
  return mission.preflight_state ?? buildDefaultControlledMissionPreflightState(mission);
}

// ── Eligibility ───────────────────────────────────────────────────────────────

export function validateControlledMissionPreflightEligibility(
  mission: LocalControlledMission
): { eligible: boolean; blocked_status: LocalControlledMissionPreflightStatus | null; reason: string | null } {
  if (mission.status === "archived_local") {
    return { eligible: false, blocked_status: "archived_local", reason: "Mission archivée — preflight impossible." };
  }
  if (mission.status === "blocked_by_guard") {
    return { eligible: false, blocked_status: "blocked_by_guard", reason: "Mission bloquée par CloneGuard." };
  }
  if (mission.status === "blocked_by_missing_information") {
    return { eligible: false, blocked_status: "blocked_by_missing_information", reason: "Informations manquantes." };
  }
  const review = getControlledMissionReviewState(mission);
  if (review.review_status === "archived_local") {
    return { eligible: false, blocked_status: "archived_local", reason: "Mission archivée — preflight impossible." };
  }
  if (review.review_status === "blocked_local" || review.review_status === "changes_requested") {
    return { eligible: false, blocked_status: "blocked_by_manual_decision", reason: "Décision manuelle locale (bloquée / modifications demandées)." };
  }
  if (review.review_status === "not_reviewed" || review.review_status === "in_review") {
    return { eligible: false, blocked_status: "blocked_by_missing_review", reason: "Revue locale non approuvée." };
  }
  // approved_local → éligible
  return { eligible: true, blocked_status: null, reason: null };
}

// ── Result builder ────────────────────────────────────────────────────────────

export function buildControlledMissionPreflightResult(
  status: LocalControlledMissionPreflightResultStatus,
  missionId: string,
  preflightState: LocalControlledMissionPreflightState | null,
  extra?: { reason?: string; warnings?: string[]; now?: string }
): LocalControlledMissionPreflightResult {
  return {
    ok: status === "ready_for_future_governed_execution",
    status,
    mission_id: missionId,
    preflight_state: preflightState,
    reason: extra?.reason ?? null,
    warnings: extra?.warnings ?? [
      "Preflight local uniquement · Aucune exécution.",
      "Un statut ready ne déclenche aucune action.",
      "La mission reste préparée et non exécutée.",
    ],
    runtime_execution_performed: false,
    server_persistence_performed: false,
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    applied_at: extra?.now ?? new Date().toISOString(),
  };
}

// ── Sanitize ──────────────────────────────────────────────────────────────────

export function sanitizeControlledMissionPreflightPayload(
  state: LocalControlledMissionPreflightState
): LocalControlledMissionPreflightState {
  return {
    ...state,
    // Invariants re-forcés.
    checks: state.checks.map((c) => ({ ...c, local_only: true, execution_enabled: false })),
    local_only: true,
    no_execution_performed: true,
    runtime_execution_after_preflight: "disabled",
    server_persistence_after_preflight: "disabled",
  };
}

// ── Run preflight (localStorage write, idempotent) ────────────────────────────

function mapBlockedToResultStatus(
  blocked: LocalControlledMissionPreflightStatus
): LocalControlledMissionPreflightResultStatus {
  switch (blocked) {
    case "archived_local":
      return "not_allowed";
    case "blocked_by_missing_review":
      return "blocked_by_missing_review";
    case "blocked_by_manual_decision":
      return "blocked_by_manual_decision";
    case "blocked_by_guard":
      return "blocked_by_guard";
    case "blocked_by_missing_information":
      return "blocked_by_missing_information";
    default:
      return "blocked_by_runtime_requirements";
  }
}

export function runLocalControlledMissionPreflight(
  missionId: string,
  options?: { now?: string }
): LocalControlledMissionPreflightResult {
  const now = options?.now ?? new Date().toISOString();
  const mission = getLocalControlledMissionById(missionId);
  if (!mission) {
    return buildControlledMissionPreflightResult("not_found", missionId, null, { reason: "Mission contrôlée locale introuvable.", now });
  }

  const checks = buildControlledMissionPreflightChecks(mission);
  const score = computeControlledMissionReadinessScore(checks);
  const eligibility = validateControlledMissionPreflightEligibility(mission);
  const warnings = checks.filter((c) => c.status === "warning").map((c) => c.detail);

  let preflightStatus: LocalControlledMissionPreflightStatus;
  let level: LocalControlledMissionReadinessLevel;
  let resultStatus: LocalControlledMissionPreflightResultStatus;
  let blockingReasons: string[] = [];

  if (!eligibility.eligible && eligibility.blocked_status) {
    preflightStatus = eligibility.blocked_status;
    level = eligibility.blocked_status === "blocked_by_missing_review" ? "needs_review" : "not_ready";
    resultStatus = mapBlockedToResultStatus(eligibility.blocked_status);
    blockingReasons = [eligibility.reason ?? "Preflight bloqué."];
  } else {
    const blockingFailed = checks.filter((c) => c.blocking && c.status === "fail");
    if (blockingFailed.length === 0) {
      preflightStatus = "ready_for_future_governed_execution";
      level = "future_execution_candidate";
      resultStatus = "ready_for_future_governed_execution";
    } else {
      preflightStatus = "blocked_by_runtime_requirements";
      level = "not_ready";
      resultStatus = "blocked_by_runtime_requirements";
      blockingReasons = blockingFailed.map((c) => c.detail);
    }
  }

  const newState: LocalControlledMissionPreflightState = sanitizeControlledMissionPreflightPayload({
    preflight_status: preflightStatus,
    readiness_score: score,
    readiness_level: level,
    checked_at: now,
    checks,
    blocking_reasons: blockingReasons,
    warnings,
    required_next_steps: [
      "Concevoir la persistance serveur gouvernée (PHASE 5.4).",
      "Concevoir l'exécution gouvernée (phase ultérieure).",
      "Aucune exécution n'est déclenchée dans cette phase.",
    ],
    runtime_requirements_snapshot: buildControlledMissionRuntimeRequirementsSnapshot(mission),
    guard_requirements_snapshot: buildControlledMissionGuardRequirementsSnapshot(mission),
    human_validation_snapshot: buildControlledMissionHumanValidationSnapshot(mission),
    local_only: true,
    no_execution_performed: true,
    runtime_execution_after_preflight: "disabled",
    server_persistence_after_preflight: "disabled",
  });

  // Stockage localStorage uniquement — invariants d'exécution re-forcés.
  const updated: LocalControlledMission = {
    ...mission,
    preflight_state: newState,
    updated_at: now,
    runtime_execution: "disabled",
    server_persistence: "disabled",
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    read_only: true,
  };
  const saved = upsertLocalControlledMission(updated, now);
  if (!saved.ok) {
    return buildControlledMissionPreflightResult("local_save_failed", missionId, null, { reason: saved.issues.join(" "), now });
  }
  return buildControlledMissionPreflightResult(resultStatus, missionId, newState, { reason: blockingReasons[0] ?? null, now });
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionPreflightState(mission: LocalControlledMission): string {
  const state = getControlledMissionPreflightState(mission);
  return [
    `[Preflight local] ${mission.title} — ${state.preflight_status} (${state.readiness_level})`,
    `  Readiness score : ${state.readiness_score}% · Checks : ${state.checks.length}`,
    `  ready = candidate pour future exécution gouvernée — JAMAIS exécution. Aucune action déclenchée.`,
    `  Mission non exécutée · runtime/server disabled · scale 80k non prouvé.`,
  ].join("\n");
}
