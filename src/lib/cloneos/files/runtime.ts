// src/lib/cloneos/files/runtime.ts
// B34 — File intake runtime orchestrator.
// Pipeline: receive → validate → fingerprint → extract → classify → attach → trace.

import type {
  CloneFileRecord,
  FileSource,
  FileIntakeResult,
  FileExtractionStatus,
} from "./types";
import { getFileConfig, isFileDisabled } from "./config";
import { detectFileKind, guessMimeType } from "./mime";
import { validateFileSecurity, sanitizeFilename } from "./security";
import { computeChecksum, makeFileId, buildStoragePath } from "./fingerprint";
import { extractFileTextAsync } from "./extraction";
import { classifyHrFile } from "./classification";
import { buildFileAttachDecision } from "./attachment";
import {
  buildFileReceivedEvent,
  buildFileRejectedEvent,
  buildFileAcceptedEvent,
  buildFileExtractionStartedEvent,
  buildFileExtractedEvent,
  buildFileExtractionFailedEvent,
  buildFileClassifiedEvent,
  buildFileAttachedEvent,
  buildFileSensitiveDetectedEvent,
  buildFileBlockedEvent,
} from "./events";
import { getFileStorageProvider } from "./providers/mock";

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function processFileIntake(params: {
  filename: string;
  content: string | Buffer;
  mimeType?: string | null;
  sizeBytes: number;
  companyId: string;
  agentSlug: string;
  source: FileSource;
  uploadedByUserId?: string | null;
  channelIdentityId?: string | null;
  envelopeId?: string | null;
  relatedMissionId?: string | null;
  relatedTaskId?: string | null;
  relatedEmployeeId?: string | null;
  siteId?: string | null;
  hasEmployee?: boolean;
  hasMission?: boolean;
}): Promise<FileIntakeResult> {
  const config = getFileConfig();
  const now = new Date().toISOString();

  // 1. Disabled mode
  if (isFileDisabled()) {
    const stubFile = buildStubFileRecord(params, now, "rejected");
    return {
      ok: false,
      file: stubFile,
      extraction: null,
      classification: null,
      attach_decision: null,
      trace_events: [buildFileRejectedEvent(stubFile, "Intake désactivé (FILE_RUNTIME_MODE=disabled).")],
      blocked_reason: "Intake désactivé (FILE_RUNTIME_MODE=disabled).",
      warnings: [],
      error: null,
    };
  }

  // 2. Detect kind and MIME
  const mimeType = params.mimeType?.trim() || guessMimeType(params.filename);
  const kind = detectFileKind(params.filename, mimeType);

  // 3. Security validation
  const security = validateFileSecurity({
    filename: params.filename,
    mime_type: mimeType,
    size_bytes: params.sizeBytes,
    config,
  });

  if (!security.ok) {
    const stubFile = buildStubFileRecord(params, now, "rejected", mimeType);
    const trace = [
      buildFileReceivedEvent(stubFile),
      buildFileRejectedEvent(stubFile, security.errors.join("; ")),
    ];
    return {
      ok: false,
      file: stubFile,
      extraction: null,
      classification: null,
      attach_decision: null,
      trace_events: trace,
      blocked_reason: security.errors.join("; "),
      warnings: security.warnings,
      error: null,
    };
  }

  // 4. Build file record
  const safeFilename = sanitizeFilename(params.filename);
  const checksum = computeChecksum(params.content);
  const fileId = makeFileId(params.companyId, checksum, now);
  const storagePath = buildStoragePath(params.companyId, fileId, safeFilename);

  const fileRecord: CloneFileRecord = {
    id: fileId,
    company_id: params.companyId,
    agent_slug: params.agentSlug,
    source: params.source,
    kind,
    original_filename: params.filename,
    safe_filename: safeFilename,
    mime_type: mimeType,
    size_bytes: params.sizeBytes,
    storage_bucket: config.storage_bucket,
    storage_path: storagePath,
    checksum_sha256: checksum,
    status: "accepted",
    risk_level: security.risk_level,
    visibility: "internal",
    uploaded_by_user_id: params.uploadedByUserId ?? null,
    channel_identity_id: params.channelIdentityId ?? null,
    envelope_id: params.envelopeId ?? null,
    related_mission_id: params.relatedMissionId ?? null,
    related_task_id: params.relatedTaskId ?? null,
    related_employee_id: params.relatedEmployeeId ?? null,
    site_id: params.siteId ?? null,
    category: "other",
    title: null,
    extracted_text_preview: null,
    extraction_status: "pending",
    extraction_error: null,
    classification_confidence: 0,
    metadata: {},
    created_at: now,
    updated_at: now,
    archived_at: null,
  };

  const traceEvents = [
    buildFileReceivedEvent(fileRecord),
    buildFileAcceptedEvent(fileRecord, { warnings: security.warnings }),
  ];

  // 5. Store via provider (mock by default)
  const provider = getFileStorageProvider(config.runtime_mode);
  if (provider) {
    try {
      await provider.store({
        fileId,
        companyId: params.companyId,
        safeFilename,
        mimeType,
        content: params.content,
        storageBucket: config.storage_bucket,
      });
    } catch {
      // Non-fatal in mock mode — log warning and continue
    }
  }

  // 6. Extract text
  traceEvents.push(buildFileExtractionStartedEvent(fileRecord));

  const extraction = await extractFileTextAsync(kind, params.content, params.filename, config);
  const extractionStatus: FileExtractionStatus = extraction.ok ? "done" : "failed";

  fileRecord.extraction_status = extractionStatus;
  fileRecord.extracted_text_preview = extraction.preview;
  fileRecord.extraction_error = extraction.error;

  if (extraction.ok) {
    traceEvents.push(buildFileExtractedEvent(fileRecord, extraction));
  } else {
    traceEvents.push(buildFileExtractionFailedEvent(fileRecord, extraction.error ?? "Erreur inconnue."));
  }

  // 7. Classify
  const extractedText = config.log_extracted_text ? extraction.text : (extraction.preview ?? null);
  const classification = classifyHrFile({
    filename: params.filename,
    text: extractedText,
    hasEmployee: params.hasEmployee,
    hasMission: params.hasMission,
  });

  fileRecord.category = classification.category;
  fileRecord.risk_level = classification.risk_level;
  fileRecord.visibility = classification.visibility;
  fileRecord.classification_confidence = classification.confidence;
  fileRecord.status = "classified";

  traceEvents.push(buildFileClassifiedEvent(fileRecord, classification));

  // 8. Sensitive detection trace
  if (classification.risk_level === "sensitive" || classification.risk_level === "blocked") {
    traceEvents.push(buildFileSensitiveDetectedEvent(fileRecord, `Catégorie "${classification.category}" à risque "${classification.risk_level}".`));
  }

  // 9. Attach decision
  const attachDecision = buildFileAttachDecision({
    fileRecord,
    classification,
    missionId: params.relatedMissionId,
    taskId: params.relatedTaskId,
    employeeId: params.relatedEmployeeId,
  });

  if (attachDecision.action === "block_sensitive") {
    traceEvents.push(buildFileBlockedEvent(fileRecord, attachDecision.reason));
  } else {
    fileRecord.related_mission_id = attachDecision.related_mission_id ?? fileRecord.related_mission_id;
    fileRecord.related_task_id = attachDecision.related_task_id ?? fileRecord.related_task_id;
    fileRecord.related_employee_id = attachDecision.related_employee_id ?? fileRecord.related_employee_id;
    fileRecord.status = "ready";
    traceEvents.push(buildFileAttachedEvent(fileRecord, attachDecision));
  }

  return {
    ok: true,
    file: fileRecord,
    extraction,
    classification,
    attach_decision: attachDecision,
    trace_events: traceEvents,
    blocked_reason: null,
    warnings: [...security.warnings, ...extraction.warnings, ...classification.warnings],
    error: null,
  };
}

// ── Stub builder for early-reject cases ──────────────────────────────────────

function buildStubFileRecord(
  params: { filename: string; content: string | Buffer; sizeBytes: number; companyId: string; agentSlug: string; source: FileSource; mimeType?: string | null },
  now: string,
  status: "rejected" | "received",
  mimeType?: string,
): CloneFileRecord {
  const safeFilename = sanitizeFilename(params.filename);
  const checksum = computeChecksum(params.content);
  const id = makeFileId(params.companyId, checksum, now);
  const resolvedMime = mimeType ?? params.mimeType ?? guessMimeType(params.filename);
  const kind = detectFileKind(params.filename, resolvedMime);

  return {
    id,
    company_id: params.companyId,
    agent_slug: params.agentSlug,
    source: params.source,
    kind,
    original_filename: params.filename,
    safe_filename: safeFilename,
    mime_type: resolvedMime,
    size_bytes: params.sizeBytes,
    storage_bucket: null,
    storage_path: null,
    checksum_sha256: checksum,
    status,
    risk_level: "blocked",
    visibility: "internal",
    uploaded_by_user_id: null,
    channel_identity_id: null,
    envelope_id: null,
    related_mission_id: null,
    related_task_id: null,
    related_employee_id: null,
    site_id: null,
    category: "other",
    title: null,
    extracted_text_preview: null,
    extraction_status: "pending",
    extraction_error: null,
    classification_confidence: 0,
    metadata: {},
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
}
