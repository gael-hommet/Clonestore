// TECH-10 — CloneVoice Readiness Layer — Storage
// Stockage in-memory pour les transcripts et commandes CloneVoice.
// Pas de Supabase. Pas de persistance. Tests et sandbox uniquement.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneVoiceTranscriptDraft,
  CloneVoiceCommandDraft,
  CloneVoiceReadinessReport,
  CloneVoiceSnapshot,
} from "./clonevoice-types";

// ── Store in-memory ───────────────────────────────────────────────────────────

const transcriptStore = new Map<string, CloneVoiceTranscriptDraft>();
const commandStore = new Map<string, CloneVoiceCommandDraft>();
const reportStore = new Map<string, CloneVoiceReadinessReport>();
const snapshotStore: CloneVoiceSnapshot[] = [];

// ── Transcript Store ──────────────────────────────────────────────────────────

/**
 * Sauvegarde un transcript en mémoire.
 */
export function saveTranscriptDraft(transcript: CloneVoiceTranscriptDraft): void {
  transcriptStore.set(transcript.draft_id, transcript);
}

/**
 * Récupère un transcript par ID.
 */
export function getTranscriptDraft(
  draftId: string,
): CloneVoiceTranscriptDraft | undefined {
  return transcriptStore.get(draftId);
}

/**
 * Liste les transcripts d'une entreprise.
 */
export function listTranscriptDrafts(
  companyId: string,
): CloneVoiceTranscriptDraft[] {
  return Array.from(transcriptStore.values()).filter(
    (t) => t.company_id === companyId,
  );
}

/**
 * Liste les transcripts nécessitant revue humaine.
 */
export function listTranscriptsDraftsPendingReview(
  companyId?: string,
): CloneVoiceTranscriptDraft[] {
  return Array.from(transcriptStore.values()).filter(
    (t) =>
      t.requires_human_review &&
      t.status !== "rejected" &&
      (!companyId || t.company_id === companyId),
  );
}

// ── Command Store ─────────────────────────────────────────────────────────────

/**
 * Sauvegarde un command draft en mémoire.
 */
export function saveCommandDraft(commandDraft: CloneVoiceCommandDraft): void {
  commandStore.set(commandDraft.command_draft_id, commandDraft);
}

/**
 * Récupère un command draft par ID.
 */
export function getCommandDraft(
  commandDraftId: string,
): CloneVoiceCommandDraft | undefined {
  return commandStore.get(commandDraftId);
}

/**
 * Liste les command drafts d'une entreprise.
 */
export function listCommandDrafts(companyId: string): CloneVoiceCommandDraft[] {
  return Array.from(commandStore.values()).filter(
    (c) => c.company_id === companyId,
  );
}

/**
 * Liste les command drafts prêts pour CloneOS.
 */
export function listCommandDraftsReadyForCloneOS(
  companyId?: string,
): CloneVoiceCommandDraft[] {
  return Array.from(commandStore.values()).filter(
    (c) =>
      c.can_proceed_to_cloneos &&
      c.blocked_reasons.length === 0 &&
      (!companyId || c.company_id === companyId),
  );
}

// ── Report Store ──────────────────────────────────────────────────────────────

/**
 * Sauvegarde un readiness report en mémoire (indexé par company_id).
 */
export function saveReadinessReport(
  companyId: string,
  report: CloneVoiceReadinessReport,
): void {
  reportStore.set(companyId, report);
}

/**
 * Récupère le dernier readiness report d'une entreprise.
 */
export function getReadinessReport(
  companyId: string,
): CloneVoiceReadinessReport | undefined {
  return reportStore.get(companyId);
}

// ── Snapshot Store ────────────────────────────────────────────────────────────

/**
 * Sauvegarde un snapshot.
 */
export function saveSnapshot(snapshot: CloneVoiceSnapshot): void {
  snapshotStore.push(snapshot);
}

/**
 * Retourne tous les snapshots.
 */
export function listSnapshots(): CloneVoiceSnapshot[] {
  return [...snapshotStore];
}

/**
 * Retourne le dernier snapshot.
 */
export function getLatestSnapshotFromStore(): CloneVoiceSnapshot | undefined {
  if (snapshotStore.length === 0) return undefined;
  return snapshotStore[snapshotStore.length - 1];
}

// ── Serialisation ─────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /sk_(live|test)_[a-zA-Z0-9]+/g,
  /whsec_[a-zA-Z0-9]+/g,
  /OPENAI_API_KEY[=:\s]+\S+/g,
  /ANTHROPIC_API_KEY[=:\s]+\S+/g,
];

/**
 * Serialise un transcript en JSON en redactant les tokens sensibles.
 */
export function serializeTranscriptDraft(
  transcript: CloneVoiceTranscriptDraft,
): string {
  let json = JSON.stringify(transcript, null, 2);
  for (const pattern of SENSITIVE_PATTERNS) {
    json = json.replace(pattern, "[REDACTED]");
  }
  return json;
}

/**
 * Serialise un readiness report en JSON en redactant les tokens sensibles.
 */
export function serializeReadinessReport(
  report: CloneVoiceReadinessReport,
): string {
  let json = JSON.stringify(report, null, 2);
  for (const pattern of SENSITIVE_PATTERNS) {
    json = json.replace(pattern, "[REDACTED]");
  }
  return json;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

/**
 * Vide tous les stores (tests uniquement).
 */
export function clearCloneVoiceStore(): void {
  transcriptStore.clear();
  commandStore.clear();
  reportStore.clear();
  snapshotStore.length = 0;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * Retourne des statistiques sur le store.
 */
export function getCloneVoiceStoreStats(): {
  transcripts_count: number;
  commands_count: number;
  reports_count: number;
  snapshots_count: number;
  pending_review_count: number;
  ready_for_cloneos_count: number;
} {
  return {
    transcripts_count: transcriptStore.size,
    commands_count: commandStore.size,
    reports_count: reportStore.size,
    snapshots_count: snapshotStore.length,
    pending_review_count: listTranscriptsDraftsPendingReview().length,
    ready_for_cloneos_count: listCommandDraftsReadyForCloneOS().length,
  };
}
