// src/lib/cloneos/files/intake.ts
// B34 — File intake: initial record builder + validation + B33 channel bridge.

import type {
  CloneFileRecord,
  FileSource,
  FileKind,
  FileRiskLevel,
  FileVisibility,
  HrFileCategory,
  FileExtractionStatus,
} from "./types";
import type { MessageEnvelope, MessageEnvelopeAttachment } from "../channels/types";
import { sanitizeFilename } from "./security";
import { computeChecksum, makeFileId, buildStoragePath } from "./fingerprint";
import { detectFileKind, guessMimeType } from "./mime";

// ── File record builder ───────────────────────────────────────────────────────

export function buildCloneFileRecord(params: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  content: string | Buffer;
  companyId: string;
  agentSlug: string;
  source: FileSource;
  kind?: FileKind;
  riskLevel?: FileRiskLevel;
  visibility?: FileVisibility;
  category?: HrFileCategory;
  uploadedByUserId?: string | null;
  channelIdentityId?: string | null;
  envelopeId?: string | null;
  relatedMissionId?: string | null;
  relatedTaskId?: string | null;
  relatedEmployeeId?: string | null;
  siteId?: string | null;
  storageBucket?: string | null;
  metadata?: Record<string, unknown>;
}): CloneFileRecord {
  const now = new Date().toISOString();
  const safeFilename = sanitizeFilename(params.filename);
  const checksum = computeChecksum(params.content);
  const kind = params.kind ?? detectFileKind(params.filename, params.mimeType);
  const id = makeFileId(params.companyId, checksum, now);
  const storagePath = params.storageBucket
    ? buildStoragePath(params.companyId, id, safeFilename)
    : null;

  return {
    id,
    company_id: params.companyId,
    agent_slug: params.agentSlug,
    source: params.source,
    kind,
    original_filename: params.filename,
    safe_filename: safeFilename,
    mime_type: params.mimeType,
    size_bytes: params.sizeBytes,
    storage_bucket: params.storageBucket ?? null,
    storage_path: storagePath,
    checksum_sha256: checksum,
    status: "received",
    risk_level: params.riskLevel ?? "low",
    visibility: params.visibility ?? "internal",
    uploaded_by_user_id: params.uploadedByUserId ?? null,
    channel_identity_id: params.channelIdentityId ?? null,
    envelope_id: params.envelopeId ?? null,
    related_mission_id: params.relatedMissionId ?? null,
    related_task_id: params.relatedTaskId ?? null,
    related_employee_id: params.relatedEmployeeId ?? null,
    site_id: params.siteId ?? null,
    category: params.category ?? "other",
    title: null,
    extracted_text_preview: null,
    extraction_status: "pending" as FileExtractionStatus,
    extraction_error: null,
    classification_confidence: 0,
    metadata: params.metadata ?? {},
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
}

// ── B33 channel attachment bridge ─────────────────────────────────────────────

export function buildFileRecordFromChannelAttachment(
  envelope: MessageEnvelope,
  attachment: MessageEnvelopeAttachment,
): CloneFileRecord {
  const filename = attachment.filename ?? "attachment";
  const mimeType = attachment.content_type ?? "application/octet-stream";
  const sizeBytes = attachment.size_bytes ?? 0;

  // Use URL as pseudo-content for checksum (real content not yet downloaded)
  const pseudoContent = `${envelope.id}:${filename}:${mimeType}:${sizeBytes}`;

  return buildCloneFileRecord({
    filename,
    mimeType,
    sizeBytes,
    content: pseudoContent,
    companyId: envelope.company_id,
    agentSlug: envelope.agent_slug,
    source: "channel_attachment",
    channelIdentityId: envelope.channel_identity_id,
    envelopeId: envelope.id,
    relatedMissionId: envelope.related_mission_id,
    relatedTaskId: envelope.related_task_id,
    relatedEmployeeId: envelope.related_employee_id,
    metadata: {
      attachment_url: attachment.url,
      channel_kind: envelope.channel_kind,
      envelope_from: envelope.from,
    },
  });
}
