// src/lib/clonestore/runtime-integration/controlled-mission-local-review.ts
// PHASE 5.2 — Controlled Mission Local Review & Manual Validation (localStorage-first)
//
// Relecture et validation HUMAINE LOCALE des Controlled Missions (P5.1).
// L'approbation locale = « revue humaine terminée », JAMAIS une exécution.
// Aucun runtime, aucun serveur, aucun Pierre, aucune IA, aucun email/document.
// Aucun appel réseau. Pas de base de données. Pas d'import Pierre.

import type { LocalControlledMission } from "./controlled-mission-safe-apply-types";
import type {
  LocalControlledMissionReviewState,
  LocalControlledMissionReviewStatus,
  LocalControlledMissionReviewerRole,
  LocalControlledMissionReviewChecklistItem,
  LocalControlledMissionReviewTimelineItem,
  LocalControlledMissionReviewTimelineEvent,
  LocalControlledMissionReviewDecisionInput,
  LocalControlledMissionReviewResult,
  LocalControlledMissionReviewResultStatus,
} from "./controlled-mission-local-review-types";
import {
  getLocalControlledMissionById,
  upsertLocalControlledMission,
} from "./controlled-mission-local-storage";

// ── Sanitization locale (indépendante, pas d'import safe-apply) ───────────────

const REDACT_PATTERNS = ["sk_live_", "whsec_", "api_key", "service_role", "private_key", "secret_key", "bearer "];

export function sanitizeControlledMissionReviewText(text: string): string {
  if (!text || typeof text !== "string") return "";
  let out = text
    .replace(/<[^>]*>/g, " ")
    .replace(/<|>/g, " ")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
  const lower = out.toLowerCase();
  for (const p of REDACT_PATTERNS) {
    if (lower.includes(p)) out = out.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted]");
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 2000);
}

export function sanitizeControlledMissionReviewPayload(
  input: LocalControlledMissionReviewDecisionInput
): LocalControlledMissionReviewDecisionInput {
  return {
    ...input,
    reviewer_note: input.reviewer_note ? sanitizeControlledMissionReviewText(input.reviewer_note) : input.reviewer_note,
    reason: input.reason ? sanitizeControlledMissionReviewText(input.reason) : input.reason,
    required_changes: input.required_changes ? input.required_changes.map((c) => sanitizeControlledMissionReviewText(c)).filter(Boolean) : input.required_changes,
  };
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export function buildControlledMissionReviewChecklist(
  mission: LocalControlledMission
): LocalControlledMissionReviewChecklistItem[] {
  const notBlocked = mission.status !== "blocked_by_guard" && mission.status !== "blocked_by_missing_information";
  return [
    { id: "objective_clear", label: "Objectif clair", checked: Boolean(mission.summary?.trim()), required: true },
    { id: "employee_identified", label: "Employé IA concerné identifié", checked: Boolean(mission.employee_id), required: true },
    { id: "data_sufficient", label: "Données suffisantes", checked: mission.blocked_reasons.length === 0, required: true },
    { id: "risk_acceptable", label: "Risque acceptable", checked: mission.risk_level !== "blocked", required: true },
    { id: "human_validation_understood", label: "Validation humaine requise comprise", checked: true, required: true },
    { id: "no_unvalidated_sensitive_action", label: "Aucune action sensible non validée", checked: notBlocked, required: true },
    { id: "steps_reviewed", label: "Étapes relues", checked: mission.steps.length > 0, required: false },
    { id: "expected_result_clear", label: "Résultat attendu clair", checked: Boolean(mission.title?.trim()), required: true },
    { id: "no_auto_execution_expected", label: "Aucune exécution automatique attendue", checked: true, required: true },
  ];
}

function computeValidationScore(checklist: LocalControlledMissionReviewChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const checked = checklist.filter((c) => c.checked).length;
  return Math.round((checked / checklist.length) * 100);
}

// ── État de review (défaut / accès) ───────────────────────────────────────────

export function buildDefaultControlledMissionReviewState(
  mission: LocalControlledMission
): LocalControlledMissionReviewState {
  const checklist = buildControlledMissionReviewChecklist(mission);
  return {
    review_status: "not_reviewed",
    reviewer_role: "reviewer",
    reviewer_note: "",
    reviewed_at: null,
    decision_reason: "",
    required_changes: [],
    checklist,
    validation_score: computeValidationScore(checklist),
    timeline: [],
    local_approval_only: true,
    runtime_execution_after_approval: "disabled",
    server_persistence_after_approval: "disabled",
  };
}

export function getControlledMissionReviewState(
  mission: LocalControlledMission
): LocalControlledMissionReviewState {
  return mission.review_state ?? buildDefaultControlledMissionReviewState(mission);
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function appendTimeline(
  state: LocalControlledMissionReviewState,
  event: LocalControlledMissionReviewTimelineEvent,
  label: string,
  detail: string,
  now: string,
  role: LocalControlledMissionReviewerRole
): LocalControlledMissionReviewTimelineItem[] {
  const item: LocalControlledMissionReviewTimelineItem = {
    id: `rev_${event}_${state.timeline.length}`,
    event,
    label,
    detail,
    created_at: now,
    reviewer_role: role,
    local_only: true,
    execution_enabled: false,
  };
  return [...state.timeline, item];
}

// ── Result builder ────────────────────────────────────────────────────────────

export function buildControlledMissionLocalReviewResult(
  status: LocalControlledMissionReviewResultStatus,
  missionId: string,
  reviewState: LocalControlledMissionReviewState | null,
  extra?: { reason?: string; warnings?: string[]; now?: string }
): LocalControlledMissionReviewResult {
  const okStatuses: LocalControlledMissionReviewResultStatus[] = [
    "review_started", "approved_local", "already_approved", "changes_requested", "blocked_local", "archived_local",
  ];
  return {
    ok: okStatuses.includes(status),
    status,
    mission_id: missionId,
    review_state: reviewState,
    reason: extra?.reason ?? null,
    warnings: extra?.warnings ?? [
      "Approbation locale uniquement · Aucune exécution.",
      "Cette validation ne lance pas Pierre.",
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

// ── Validation de décision ────────────────────────────────────────────────────

export function validateControlledMissionLocalReviewDecision(
  input: LocalControlledMissionReviewDecisionInput
): { valid: boolean; reason: string | null } {
  const known = ["start_review", "approve_local", "request_changes", "block_local", "archive_local"];
  if (!input || !known.includes(input.decision)) return { valid: false, reason: "Décision inconnue." };
  if (input.decision === "request_changes" && (!input.required_changes || input.required_changes.filter(Boolean).length === 0)) {
    return { valid: false, reason: "Modifications requises non précisées." };
  }
  if (input.decision === "block_local" && !input.reason?.trim()) {
    return { valid: false, reason: "Raison de blocage requise." };
  }
  return { valid: true, reason: null };
}

// ── Helper de persistance (load → mutate → upsert) ────────────────────────────

function persistReviewState(
  mission: LocalControlledMission,
  newState: LocalControlledMissionReviewState,
  now: string,
  alsoArchiveMission = false
): { ok: boolean; issues: string[] } {
  const updated: LocalControlledMission = {
    ...mission,
    review_state: newState,
    updated_at: now,
    // Statut mission archivé uniquement si demandé. Invariants re-forcés.
    status: alsoArchiveMission ? "archived_local" : mission.status,
    execution_status: alsoArchiveMission ? "not_executable" : mission.execution_status,
    server_persistence: "disabled",
    runtime_execution: "disabled",
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    read_only: true,
  };
  return upsertLocalControlledMission(updated, now);
}

// ── Décisions ─────────────────────────────────────────────────────────────────

export function startLocalControlledMissionReview(
  missionId: string,
  options?: { reviewer_role?: LocalControlledMissionReviewerRole; now?: string }
): LocalControlledMissionReviewResult {
  const now = options?.now ?? new Date().toISOString();
  const role = options?.reviewer_role ?? "reviewer";
  const mission = getLocalControlledMissionById(missionId);
  if (!mission) return buildControlledMissionLocalReviewResult("not_found", missionId, null, { reason: "Mission contrôlée locale introuvable.", now });

  const current = getControlledMissionReviewState(mission);
  if (current.review_status === "archived_local" || mission.status === "archived_local") {
    return buildControlledMissionLocalReviewResult("not_allowed", missionId, current, { reason: "Mission archivée — revue impossible.", now });
  }

  const checklist = buildControlledMissionReviewChecklist(mission);
  const newStatus: LocalControlledMissionReviewStatus = "in_review";
  const newState: LocalControlledMissionReviewState = {
    ...current,
    review_status: newStatus,
    reviewer_role: role,
    checklist,
    validation_score: computeValidationScore(checklist),
    timeline: appendTimeline(current, "review_started", "Revue démarrée (locale)", "Mission relue localement. Aucune exécution.", now, role),
  };
  const saved = persistReviewState(mission, newState, now);
  if (!saved.ok) return buildControlledMissionLocalReviewResult("local_save_failed", missionId, null, { reason: saved.issues.join(" "), now });
  return buildControlledMissionLocalReviewResult("review_started", missionId, newState, { now });
}

export function approveLocalControlledMission(
  missionId: string,
  reviewerNote?: string,
  options?: { reviewer_role?: LocalControlledMissionReviewerRole; now?: string }
): LocalControlledMissionReviewResult {
  const now = options?.now ?? new Date().toISOString();
  const role = options?.reviewer_role ?? "reviewer";
  const mission = getLocalControlledMissionById(missionId);
  if (!mission) return buildControlledMissionLocalReviewResult("not_found", missionId, null, { reason: "Mission introuvable.", now });

  const current = getControlledMissionReviewState(mission);
  if (current.review_status === "archived_local" || mission.status === "archived_local") {
    return buildControlledMissionLocalReviewResult("not_allowed", missionId, current, { reason: "Mission archivée — approbation impossible.", now });
  }
  // Mission bloquée par CloneGuard / informations manquantes → blocage local forcé.
  if (mission.status === "blocked_by_guard" || mission.status === "blocked_by_missing_information") {
    const reason = "Approbation impossible : mission bloquée (CloneGuard / informations manquantes).";
    const blockedState: LocalControlledMissionReviewState = {
      ...current,
      review_status: "blocked_local",
      reviewer_role: role,
      decision_reason: reason,
      timeline: appendTimeline(current, "local_blocked", "Blocage local", reason, now, role),
    };
    persistReviewState(mission, blockedState, now);
    return buildControlledMissionLocalReviewResult("not_allowed", missionId, blockedState, { reason, now });
  }
  // Idempotence : déjà approuvée localement → aucun doublon.
  if (current.review_status === "approved_local") {
    return buildControlledMissionLocalReviewResult("already_approved", missionId, current, { now });
  }

  const checklist = buildControlledMissionReviewChecklist(mission);
  const newState: LocalControlledMissionReviewState = {
    ...current,
    review_status: "approved_local",
    reviewer_role: role,
    reviewer_note: sanitizeControlledMissionReviewText(reviewerNote ?? "Revue humaine locale terminée."),
    reviewed_at: now,
    checklist,
    validation_score: computeValidationScore(checklist),
    timeline: appendTimeline(current, "local_approved", "Mission approuvée localement", "Revue humaine terminée. La mission n'a pas été exécutée.", now, role),
    // Invariants littéraux re-forcés.
    local_approval_only: true,
    runtime_execution_after_approval: "disabled",
    server_persistence_after_approval: "disabled",
  };
  const saved = persistReviewState(mission, newState, now);
  if (!saved.ok) return buildControlledMissionLocalReviewResult("local_save_failed", missionId, null, { reason: saved.issues.join(" "), now });
  return buildControlledMissionLocalReviewResult("approved_local", missionId, newState, { now });
}

export function requestChangesForLocalControlledMission(
  missionId: string,
  requiredChanges: string[],
  reviewerNote?: string,
  options?: { reviewer_role?: LocalControlledMissionReviewerRole; now?: string }
): LocalControlledMissionReviewResult {
  const now = options?.now ?? new Date().toISOString();
  const role = options?.reviewer_role ?? "reviewer";
  const check = validateControlledMissionLocalReviewDecision({ decision: "request_changes", required_changes: requiredChanges });
  if (!check.valid) return buildControlledMissionLocalReviewResult("invalid_input", missionId, null, { reason: check.reason ?? "Entrée invalide.", now });

  const mission = getLocalControlledMissionById(missionId);
  if (!mission) return buildControlledMissionLocalReviewResult("not_found", missionId, null, { reason: "Mission introuvable.", now });
  const current = getControlledMissionReviewState(mission);
  if (current.review_status === "archived_local" || mission.status === "archived_local") {
    return buildControlledMissionLocalReviewResult("not_allowed", missionId, current, { reason: "Mission archivée.", now });
  }

  const sanitizedChanges = requiredChanges.map((c) => sanitizeControlledMissionReviewText(c)).filter(Boolean);
  const newState: LocalControlledMissionReviewState = {
    ...current,
    review_status: "changes_requested",
    reviewer_role: role,
    reviewer_note: sanitizeControlledMissionReviewText(reviewerNote ?? ""),
    required_changes: sanitizedChanges,
    timeline: appendTimeline(current, "changes_requested", "Modifications demandées (locale)", "Modifications demandées localement. Aucune exécution.", now, role),
  };
  const saved = persistReviewState(mission, newState, now);
  if (!saved.ok) return buildControlledMissionLocalReviewResult("local_save_failed", missionId, null, { reason: saved.issues.join(" "), now });
  return buildControlledMissionLocalReviewResult("changes_requested", missionId, newState, { now });
}

export function blockLocalControlledMission(
  missionId: string,
  reason: string,
  reviewerNote?: string,
  options?: { reviewer_role?: LocalControlledMissionReviewerRole; now?: string }
): LocalControlledMissionReviewResult {
  const now = options?.now ?? new Date().toISOString();
  const role = options?.reviewer_role ?? "reviewer";
  const check = validateControlledMissionLocalReviewDecision({ decision: "block_local", reason });
  if (!check.valid) return buildControlledMissionLocalReviewResult("invalid_input", missionId, null, { reason: check.reason ?? "Entrée invalide.", now });

  const mission = getLocalControlledMissionById(missionId);
  if (!mission) return buildControlledMissionLocalReviewResult("not_found", missionId, null, { reason: "Mission introuvable.", now });
  const current = getControlledMissionReviewState(mission);
  if (current.review_status === "archived_local" || mission.status === "archived_local") {
    return buildControlledMissionLocalReviewResult("not_allowed", missionId, current, { reason: "Mission archivée.", now });
  }

  const newState: LocalControlledMissionReviewState = {
    ...current,
    review_status: "blocked_local",
    reviewer_role: role,
    reviewer_note: sanitizeControlledMissionReviewText(reviewerNote ?? ""),
    decision_reason: sanitizeControlledMissionReviewText(reason),
    timeline: appendTimeline(current, "local_blocked", "Bloquée localement", "Mission bloquée localement après revue. Aucune exécution.", now, role),
  };
  const saved = persistReviewState(mission, newState, now);
  if (!saved.ok) return buildControlledMissionLocalReviewResult("local_save_failed", missionId, null, { reason: saved.issues.join(" "), now });
  return buildControlledMissionLocalReviewResult("blocked_local", missionId, newState, { now });
}

export function archiveReviewedLocalControlledMission(
  missionId: string,
  options?: { reviewer_role?: LocalControlledMissionReviewerRole; now?: string }
): LocalControlledMissionReviewResult {
  const now = options?.now ?? new Date().toISOString();
  const role = options?.reviewer_role ?? "reviewer";
  const mission = getLocalControlledMissionById(missionId);
  if (!mission) return buildControlledMissionLocalReviewResult("not_found", missionId, null, { reason: "Mission introuvable.", now });
  const current = getControlledMissionReviewState(mission);

  const newState: LocalControlledMissionReviewState = {
    ...current,
    review_status: "archived_local",
    reviewer_role: role,
    timeline: appendTimeline(current, "archived_local", "Archivée localement", "Mission contrôlée locale archivée. Aucune exécution.", now, role),
  };
  const saved = persistReviewState(mission, newState, now, true);
  if (!saved.ok) return buildControlledMissionLocalReviewResult("local_save_failed", missionId, null, { reason: saved.issues.join(" "), now });
  return buildControlledMissionLocalReviewResult("archived_local", missionId, newState, { now });
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionReviewState(mission: LocalControlledMission): string {
  const state = getControlledMissionReviewState(mission);
  return [
    `[Review locale] ${mission.title} — ${state.review_status}`,
    `  Validation score : ${state.validation_score}% · Décisions : ${state.timeline.length}`,
    `  Approbation locale uniquement · Aucune exécution · runtime/server disabled.`,
    `  Mission non exécutée · Aucun appel Pierre / IA · préparée pour phase ultérieure.`,
  ].join("\n");
}
