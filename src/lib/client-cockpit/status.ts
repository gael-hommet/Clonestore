// src/lib/client-cockpit/status.ts
// P9.3 — Mapping CANONIQUE des statuts réels → vue humaine (libellé fr + tonalité + urgence).
//
// Exhaustif sur les énumérations réellement présentes dans les contrats existants
// (P9_3_OPERATIONAL_COCKPIT_ARCHITECTURE.md §4). Tout statut inconnu retombe sur
// une vue « neutre » humanisée — jamais d'erreur, jamais de statut inventé.

import type {
  CockpitArtifactStatus,
  CockpitMissionStatus,
  CockpitStatusView,
  CockpitTaskStatus,
  CockpitTone,
  CockpitUrgency,
  CockpitValidationStatus,
} from "./types";

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function humanize(raw: string): string {
  const s = norm(raw);
  if (!s) return "Inconnu";
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Missions ──────────────────────────────────────────────────────────────────

// Couvre l'ENSEMBLE des MissionStatus réels du runtime V1 (state-machine.ts) +
// alias legacy. Toute valeur inconnue → "unknown" neutre.
const MISSION_CANONICAL: Record<string, CockpitMissionStatus> = {
  draft: "draft",
  analyzing: "in_progress",
  awaiting_info: "understanding",
  missing_info: "understanding",
  planned: "in_progress",
  awaiting_validation: "awaiting_approval",
  awaiting_approval: "awaiting_approval",
  ready: "in_progress",
  queued: "in_progress",
  in_progress: "in_progress",
  active: "in_progress",
  scheduled: "in_progress",
  partially_completed: "in_progress",
  retry_scheduled: "in_progress",
  blocked: "blocked",
  failed: "blocked",
  escalated: "blocked",
  done: "done",
  completed: "done",
  archived: "done",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const MISSION_VIEW: Record<CockpitMissionStatus, { label: string; tone: CockpitTone; urgency: CockpitUrgency }> = {
  draft: { label: "Brouillon", tone: "neutral", urgency: "low" },
  understanding: { label: "Informations manquantes", tone: "warning", urgency: "high" },
  awaiting_approval: { label: "En attente de validation", tone: "warning", urgency: "high" },
  in_progress: { label: "En cours", tone: "progress", urgency: "normal" },
  blocked: { label: "Bloquée", tone: "danger", urgency: "critical" },
  done: { label: "Terminée", tone: "success", urgency: "low" },
  cancelled: { label: "Annulée", tone: "neutral", urgency: "low" },
  unknown: { label: "Inconnu", tone: "neutral", urgency: "normal" },
};

export function toMissionStatus(raw: string | null | undefined): CockpitMissionStatus {
  return MISSION_CANONICAL[norm(raw)] ?? "unknown";
}

export function missionStatusView(raw: string | null | undefined): CockpitStatusView {
  const canonical = toMissionStatus(raw);
  const v = MISSION_VIEW[canonical];
  return { canonical, label: v.label, tone: v.tone, urgency: v.urgency };
}

// ── Tâches ──────────────────────────────────────────────────────────────────

// Couvre l'ENSEMBLE des TaskStatus réels du runtime V1 (state-machine.ts) + alias.
const TASK_CANONICAL: Record<string, CockpitTaskStatus> = {
  draft: "draft",
  planned: "scheduled",
  awaiting_info: "queued",
  awaiting_validation: "awaiting_approval",
  awaiting_approval: "awaiting_approval",
  ready: "ready",
  scheduled: "scheduled",
  queued: "queued",
  pending: "queued",
  retry_scheduled: "queued",
  leased: "running",
  in_progress: "running",
  running: "running",
  blocked: "blocked",
  escalated: "blocked",
  succeeded: "completed",
  completed: "completed",
  done: "completed",
  archived: "completed",
  failed: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const TASK_VIEW: Record<CockpitTaskStatus, { label: string; tone: CockpitTone; urgency: CockpitUrgency }> = {
  draft: { label: "Brouillon", tone: "neutral", urgency: "low" },
  ready: { label: "Prête", tone: "info", urgency: "normal" },
  scheduled: { label: "Planifiée", tone: "info", urgency: "normal" },
  awaiting_approval: { label: "À valider", tone: "warning", urgency: "high" },
  queued: { label: "En file", tone: "progress", urgency: "normal" },
  running: { label: "En cours d'exécution", tone: "progress", urgency: "normal" },
  blocked: { label: "Bloquée", tone: "danger", urgency: "critical" },
  completed: { label: "Terminée", tone: "success", urgency: "low" },
  failed: { label: "Échouée", tone: "danger", urgency: "high" },
  cancelled: { label: "Annulée", tone: "neutral", urgency: "low" },
  unknown: { label: "Inconnu", tone: "neutral", urgency: "normal" },
};

export function toTaskStatus(raw: string | null | undefined): CockpitTaskStatus {
  return TASK_CANONICAL[norm(raw)] ?? "unknown";
}

export function taskStatusView(raw: string | null | undefined): CockpitStatusView {
  const canonical = toTaskStatus(raw);
  const v = TASK_VIEW[canonical];
  return { canonical, label: v.label, tone: v.tone, urgency: v.urgency };
}

// ── Validations ───────────────────────────────────────────────────────────────

const VALIDATION_CANONICAL: Record<string, CockpitValidationStatus> = {
  pending: "pending",
  awaiting_approval: "pending",
  approved: "approved",
  rejected: "rejected",
  refused: "rejected",
  request_changes: "changes_requested",
  changes_requested: "changes_requested",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const VALIDATION_VIEW: Record<CockpitValidationStatus, { label: string; tone: CockpitTone; urgency: CockpitUrgency }> = {
  pending: { label: "À décider", tone: "warning", urgency: "high" },
  approved: { label: "Approuvée", tone: "success", urgency: "low" },
  rejected: { label: "Refusée", tone: "neutral", urgency: "low" },
  changes_requested: { label: "Modifications demandées", tone: "info", urgency: "normal" },
  cancelled: { label: "Annulée", tone: "neutral", urgency: "low" },
  unknown: { label: "Inconnu", tone: "neutral", urgency: "normal" },
};

export function toValidationStatus(raw: string | null | undefined): CockpitValidationStatus {
  return VALIDATION_CANONICAL[norm(raw)] ?? "unknown";
}

export function validationStatusView(raw: string | null | undefined): CockpitStatusView {
  const canonical = toValidationStatus(raw);
  const v = VALIDATION_VIEW[canonical];
  return { canonical, label: v.label, tone: v.tone, urgency: v.urgency };
}

// ── Documents / livrables ───────────────────────────────────────────────────

const ARTIFACT_CANONICAL: Record<string, CockpitArtifactStatus> = {
  draft: "draft",
  generated: "draft",
  awaiting_validation: "awaiting_validation",
  awaiting_approval: "awaiting_validation",
  needs_review: "needs_review",
  blocked: "needs_review",
  validated: "validated",
  approved: "validated",
  good: "validated",
  excellent: "validated",
  signed: "signed",
  sent: "sent",
  delivered: "sent",
};

const ARTIFACT_VIEW: Record<CockpitArtifactStatus, { label: string; tone: CockpitTone; urgency: CockpitUrgency }> = {
  draft: { label: "Brouillon", tone: "neutral", urgency: "low" },
  awaiting_validation: { label: "À valider", tone: "warning", urgency: "high" },
  needs_review: { label: "À relire", tone: "warning", urgency: "high" },
  validated: { label: "Validé", tone: "success", urgency: "low" },
  signed: { label: "Signé", tone: "success", urgency: "low" },
  sent: { label: "Envoyé", tone: "success", urgency: "low" },
  unknown: { label: "Inconnu", tone: "neutral", urgency: "normal" },
};

export function toArtifactStatus(raw: string | null | undefined): CockpitArtifactStatus {
  return ARTIFACT_CANONICAL[norm(raw)] ?? "unknown";
}

export function artifactStatusView(raw: string | null | undefined): CockpitStatusView {
  const canonical = toArtifactStatus(raw);
  const v = ARTIFACT_VIEW[canonical];
  return { canonical, label: v.label, tone: v.tone, urgency: v.urgency };
}

// ── Risque (couleur HR + niveau DB) → tonalité / urgence ────────────────────

const RISK_TONE: Record<string, CockpitTone> = {
  green: "success", low: "success",
  orange: "warning", medium: "warning",
  red: "danger", high: "danger",
  black: "danger", critical: "danger",
};

const RISK_URGENCY: Record<string, CockpitUrgency> = {
  green: "low", low: "low",
  orange: "high", medium: "normal",
  red: "critical", high: "high",
  black: "critical", critical: "critical",
};

export function riskTone(raw: string | null | undefined): CockpitTone {
  return RISK_TONE[norm(raw)] ?? "neutral";
}
export function riskUrgency(raw: string | null | undefined): CockpitUrgency {
  return RISK_URGENCY[norm(raw)] ?? "normal";
}

const URGENCY_RANK: Record<CockpitUrgency, number> = { critical: 0, high: 1, normal: 2, low: 3 };
/** Tri stable par urgence décroissante (critical d'abord). */
export function compareUrgency(a: CockpitUrgency, b: CockpitUrgency): number {
  return URGENCY_RANK[a] - URGENCY_RANK[b];
}
/** L'urgence la plus forte entre deux. */
export function maxUrgency(a: CockpitUrgency, b: CockpitUrgency): CockpitUrgency {
  return URGENCY_RANK[a] <= URGENCY_RANK[b] ? a : b;
}

export { humanize };
