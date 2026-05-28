// B45 — Document artifact metadata
// Builds artifact metadata compatible with pierre/tasks/artifacts.ts and cockpit deliverables.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentArtifactMetadata, DocumentRenderContext, DocumentOutputFormat } from "./types";

let _counter = 0;

function generateDocumentId(ctx: DocumentRenderContext): string {
  _counter = (_counter + 1) % 100000;
  const ts = ctx.generated_at.replace(/[^0-9]/g, "").slice(0, 14);
  const typeSlug = ctx.template.document_type.replace(/[^a-z0-9]/g, "").slice(0, 10);
  return `doc_${typeSlug}_${ts}_${String(_counter).padStart(4, "0")}`;
}

function buildRedactedPreview(text: string, maxChars = 120): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)}…`;
}

// ── Build artifact metadata ───────────────────────────────────────────────────

export function buildDocumentArtifactMetadata(
  ctx: DocumentRenderContext,
  params: {
    quality_score: number;
    format?: DocumentOutputFormat;
    text?: string;
  },
): DocumentArtifactMetadata {
  const validation_required = [
    "required",
    "required_before_send",
    "required_before_export",
    "blocked_without_human",
  ].includes(ctx.template.default_validation_requirement);

  return {
    id: generateDocumentId(ctx),
    title: ctx.document_title,
    document_type: ctx.template.document_type,
    format: params.format ?? ctx.template.output_format,
    created_at: ctx.generated_at,
    user_id: ctx.style_kit.user_id,
    mission_id: ctx.mission_id,
    task_id: ctx.task_id,
    official_document: ctx.template.official_document,
    validation_required,
    quality_score: params.quality_score,
    style_kit_id: ctx.style_kit.id,
    template_id: ctx.template.id,
    redacted_preview: buildRedactedPreview(params.text ?? ctx.document_title),
  };
}

// ── Map to cockpit deliverable format ─────────────────────────────────────────

export interface CockpitDeliverable {
  id: string;
  type: string;
  title: string;
  status: "generated" | "pending_validation" | "validated" | "blocked";
  format: string;
  risk_level: string;
  requires_human_validation: boolean;
  generated_at: string;
  mission_id: string | null;
  task_id: string | null;
  preview: string;
}

export function mapArtifactToCockpitDeliverable(
  metadata: DocumentArtifactMetadata,
  riskLevel: string,
): CockpitDeliverable {
  const status = metadata.validation_required
    ? "pending_validation"
    : metadata.quality_score >= 80
    ? "generated"
    : "generated";

  return {
    id: metadata.id,
    type: metadata.document_type,
    title: metadata.title,
    status,
    format: metadata.format,
    risk_level: riskLevel,
    requires_human_validation: metadata.validation_required,
    generated_at: metadata.created_at,
    mission_id: metadata.mission_id,
    task_id: metadata.task_id,
    preview: metadata.redacted_preview,
  };
}

// ── Map to task artifact format ───────────────────────────────────────────────

export interface TaskArtifactRecord {
  kind: string;
  status: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export function mapDocumentArtifactToTaskRecord(
  metadata: DocumentArtifactMetadata,
  html: string,
): TaskArtifactRecord {
  return {
    kind: "document",
    status: metadata.validation_required ? "pending" : "generated",
    title: metadata.title,
    content: html.slice(0, 10000), // Cap for storage
    metadata: {
      document_id: metadata.id,
      document_type: metadata.document_type,
      format: metadata.format,
      official_document: metadata.official_document,
      validation_required: metadata.validation_required,
      quality_score: metadata.quality_score,
      style_kit_id: metadata.style_kit_id,
      template_id: metadata.template_id,
    },
  };
}
