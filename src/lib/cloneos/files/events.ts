// src/lib/cloneos/files/events.ts
// B34 — File trace event builders. Pure, no async, no DB. Callers persist.

import type {
  CloneFileRecord,
  CloneFileEvent,
  FileEventType,
  FileExtractionResult,
  FileClassificationResult,
  FileAttachDecision,
} from "./types";
import { makeFileEventId } from "./fingerprint";

// ── Generic builder ───────────────────────────────────────────────────────────

export function buildFileEvent(params: {
  file_id: string;
  company_id: string;
  event_type: FileEventType;
  message: string;
  meta?: Record<string, unknown>;
}): CloneFileEvent {
  const ts = new Date().toISOString();
  return {
    id: makeFileEventId(params.file_id, params.event_type, ts),
    file_id: params.file_id,
    company_id: params.company_id,
    event_type: params.event_type,
    message: params.message,
    meta: params.meta ?? {},
    created_at: ts,
  };
}

// ── Named event factories ─────────────────────────────────────────────────────

export function buildFileReceivedEvent(file: CloneFileRecord, meta?: Record<string, unknown>): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_received",
    message: `Fichier reçu: "${file.original_filename}" (${file.kind}, ${Math.round(file.size_bytes / 1024)} Ko)`,
    meta: { kind: file.kind, source: file.source, size_bytes: file.size_bytes, ...meta },
  });
}

export function buildFileRejectedEvent(file: CloneFileRecord, reason: string, meta?: Record<string, unknown>): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_rejected",
    message: `Fichier rejeté: "${file.original_filename}" — ${reason}`,
    meta: { reason, kind: file.kind, ...meta },
  });
}

export function buildFileAcceptedEvent(file: CloneFileRecord, meta?: Record<string, unknown>): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_accepted",
    message: `Fichier accepté: "${file.original_filename}" — prêt pour extraction`,
    meta: { kind: file.kind, safe_filename: file.safe_filename, ...meta },
  });
}

export function buildFileExtractionStartedEvent(file: CloneFileRecord): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_extraction_started",
    message: `Extraction démarrée: "${file.safe_filename}" (${file.kind})`,
    meta: { kind: file.kind },
  });
}

export function buildFileExtractedEvent(
  file: CloneFileRecord,
  result: FileExtractionResult,
  meta?: Record<string, unknown>,
): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_extracted",
    message: `Extraction terminée: "${file.safe_filename}" — ${result.word_count ?? "?"} mots, ${result.page_count ?? "?"} pages`,
    meta: {
      word_count: result.word_count,
      page_count: result.page_count,
      table_count: result.table_count,
      warnings_count: result.warnings.length,
      ...meta,
    },
  });
}

export function buildFileExtractionFailedEvent(file: CloneFileRecord, error: string, meta?: Record<string, unknown>): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_extraction_failed",
    message: `Échec extraction: "${file.safe_filename}" — ${error}`,
    meta: { error, kind: file.kind, ...meta },
  });
}

export function buildFileClassifiedEvent(
  file: CloneFileRecord,
  classification: FileClassificationResult,
  meta?: Record<string, unknown>,
): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_classified",
    message: `Fichier classifié: "${file.safe_filename}" → catégorie "${classification.category}" (confiance: ${Math.round(classification.confidence * 100)}%)`,
    meta: {
      category: classification.category,
      confidence: classification.confidence,
      risk_level: classification.risk_level,
      visibility: classification.visibility,
      ...meta,
    },
  });
}

export function buildFileAttachedEvent(
  file: CloneFileRecord,
  decision: FileAttachDecision,
  meta?: Record<string, unknown>,
): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_attached",
    message: `Fichier rattaché: "${file.safe_filename}" → action "${decision.action}"`,
    meta: {
      action: decision.action,
      related_mission_id: decision.related_mission_id,
      related_task_id: decision.related_task_id,
      related_employee_id: decision.related_employee_id,
      approval_required: decision.approval_required,
      ...meta,
    },
  });
}

export function buildFileSensitiveDetectedEvent(
  file: CloneFileRecord,
  reason: string,
  meta?: Record<string, unknown>,
): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_sensitive_detected",
    message: `Contenu sensible détecté dans "${file.safe_filename}": ${reason}`,
    meta: { reason, category: file.category, risk_level: file.risk_level, ...meta },
  });
}

export function buildFileBlockedEvent(file: CloneFileRecord, reason: string, meta?: Record<string, unknown>): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_blocked",
    message: `Fichier bloqué: "${file.safe_filename}" — ${reason}`,
    meta: { reason, ...meta },
  });
}

export function buildFileArchivedEvent(file: CloneFileRecord, meta?: Record<string, unknown>): CloneFileEvent {
  return buildFileEvent({
    file_id: file.id,
    company_id: file.company_id,
    event_type: "file_archived",
    message: `Fichier archivé: "${file.safe_filename}"`,
    meta: { category: file.category, archived_at: file.archived_at, ...meta },
  });
}
