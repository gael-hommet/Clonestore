// TECH-10 — CloneVoice Readiness Layer — Snapshot
// Snapshot de l'état CloneVoice à un instant T.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceSnapshot,
  CloneVoiceReadinessReport,
  CloneVoiceStatus,
  CloneVoiceRuntimeStatus,
  CloneVoiceReadinessLevel,
} from "./clonevoice-types";
import { buildEmptyCloneVoiceSnapshot } from "./clonevoice-defaults";

// ── Snapshot depuis un readiness report ──────────────────────────────────────

/**
 * Construit un snapshot depuis un readiness report.
 */
export function buildCloneVoiceSnapshot(
  report: CloneVoiceReadinessReport,
): CloneVoiceSnapshot {
  const availableCapabilities = report.capabilities.filter((c) => c.available).length;
  const totalCapabilities = report.capabilities.length;

  return {
    status: report.status,
    runtime_status: report.runtime_status,
    readiness_level: report.readiness_level,
    readiness_score: report.readiness_score,
    production_enabled: false, // Toujours false
    sandbox_possible: report.sandbox_possible,
    live_audio_ready: false, // Toujours false
    missing_prerequisites: report.missing_prerequisites.map((p) => p.label),
    blockers: report.blockers,
    capabilities_available: availableCapabilities,
    capabilities_total: totalCapabilities,
    limitations_count: report.limitations.length,
    guardrails_count: report.guardrails.length,
    generated_at: new Date().toISOString(),
  };
}

// ── Comparaison de snapshots ──────────────────────────────────────────────────

export interface CloneVoiceSnapshotDiff {
  has_changes: boolean;
  status_changed: boolean;
  runtime_status_changed: boolean;
  readiness_level_changed: boolean;
  readiness_score_changed: boolean;
  score_delta: number;
  new_blockers: string[];
  resolved_blockers: string[];
  new_missing_prerequisites: string[];
  resolved_prerequisites: string[];
}

/**
 * Compare deux snapshots et retourne les différences.
 */
export function diffCloneVoiceSnapshots(
  previous: CloneVoiceSnapshot,
  current: CloneVoiceSnapshot,
): CloneVoiceSnapshotDiff {
  const statusChanged = previous.status !== current.status;
  const runtimeChanged = previous.runtime_status !== current.runtime_status;
  const readinessChanged = previous.readiness_level !== current.readiness_level;
  const scoreChanged = previous.readiness_score !== current.readiness_score;

  const newBlockers = current.blockers.filter(
    (b) => !previous.blockers.includes(b),
  );
  const resolvedBlockers = previous.blockers.filter(
    (b) => !current.blockers.includes(b),
  );

  const newMissing = current.missing_prerequisites.filter(
    (p) => !previous.missing_prerequisites.includes(p),
  );
  const resolvedMissing = previous.missing_prerequisites.filter(
    (p) => !current.missing_prerequisites.includes(p),
  );

  const hasChanges =
    statusChanged ||
    runtimeChanged ||
    readinessChanged ||
    scoreChanged ||
    newBlockers.length > 0 ||
    resolvedBlockers.length > 0;

  return {
    has_changes: hasChanges,
    status_changed: statusChanged,
    runtime_status_changed: runtimeChanged,
    readiness_level_changed: readinessChanged,
    readiness_score_changed: scoreChanged,
    score_delta: current.readiness_score - previous.readiness_score,
    new_blockers: newBlockers,
    resolved_blockers: resolvedBlockers,
    new_missing_prerequisites: newMissing,
    resolved_prerequisites: resolvedMissing,
  };
}

// ── Métriques et aggrégats ────────────────────────────────────────────────────

/**
 * Compte les snapshots par statut.
 */
export function countSnapshotsByStatus(
  snapshots: CloneVoiceSnapshot[],
): Record<CloneVoiceStatus, number> {
  const counts: Record<CloneVoiceStatus, number> = {
    disabled: 0,
    preparation: 0,
    sandbox: 0,
    roadmap: 0,
    production_ready: 0,
  };
  for (const s of snapshots) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Compte les snapshots par runtime status.
 */
export function countSnapshotsByRuntimeStatus(
  snapshots: CloneVoiceSnapshot[],
): Record<CloneVoiceRuntimeStatus, number> {
  const counts: Record<CloneVoiceRuntimeStatus, number> = {
    not_implemented: 0,
    mock_only: 0,
    partial: 0,
    ready: 0,
  };
  for (const s of snapshots) {
    counts[s.runtime_status] = (counts[s.runtime_status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Compte les snapshots par readiness level.
 */
export function countSnapshotsByReadinessLevel(
  snapshots: CloneVoiceSnapshot[],
): Record<CloneVoiceReadinessLevel, number> {
  const counts: Record<CloneVoiceReadinessLevel, number> = {
    not_ready: 0,
    partial_ready: 0,
    internal_ready: 0,
    production_ready: 0,
  };
  for (const s of snapshots) {
    counts[s.readiness_level] = (counts[s.readiness_level] ?? 0) + 1;
  }
  return counts;
}

/**
 * Calcule le score moyen de readiness.
 */
export function calculateAverageReadinessScore(
  snapshots: CloneVoiceSnapshot[],
): number {
  if (snapshots.length === 0) return 0;
  const total = snapshots.reduce((sum, s) => sum + s.readiness_score, 0);
  return Math.round(total / snapshots.length);
}

/**
 * Retourne les snapshots avec des blocages.
 */
export function listSnapshotsWithBlockers(
  snapshots: CloneVoiceSnapshot[],
): CloneVoiceSnapshot[] {
  return snapshots.filter((s) => s.blockers.length > 0);
}

/**
 * Retourne le snapshot le plus récent.
 */
export function getLatestSnapshot(
  snapshots: CloneVoiceSnapshot[],
): CloneVoiceSnapshot | undefined {
  if (snapshots.length === 0) return undefined;
  return [...snapshots].sort(
    (a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
  )[0];
}

/**
 * Retourne un snapshot vide si pas de données.
 */
export function getSnapshotOrEmpty(
  snapshots: CloneVoiceSnapshot[],
): CloneVoiceSnapshot {
  return getLatestSnapshot(snapshots) ?? buildEmptyCloneVoiceSnapshot();
}

/**
 * Résumé textuel d'un snapshot.
 */
export function summarizeSnapshot(snapshot: CloneVoiceSnapshot): string {
  const parts: string[] = [
    `Statut: ${snapshot.status}`,
    `Runtime: ${snapshot.runtime_status}`,
    `Readiness: ${snapshot.readiness_level} (${snapshot.readiness_score}/100)`,
    `Production: ${snapshot.production_enabled ? "OUI" : "NON"}`,
    `Sandbox: ${snapshot.sandbox_possible ? "OUI" : "NON"}`,
    `Capacités: ${snapshot.capabilities_available}/${snapshot.capabilities_total}`,
  ];

  if (snapshot.blockers.length > 0) {
    parts.push(`Blocages (${snapshot.blockers.length}): ${snapshot.blockers.join(", ")}`);
  }

  return parts.join(" | ");
}
