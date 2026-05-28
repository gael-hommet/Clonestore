// B45 — Pierre document artifact builder
// Bridges B45 render results to B40 cockpit deliverables and B42 workflow artifacts.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentRenderResult, DocumentArtifactMetadata } from "../../clonestore/document-style-kit/types";
import type { DocumentRenderContext } from "../../clonestore/document-style-kit/types";
import {
  buildDocumentArtifactMetadata,
  mapArtifactToCockpitDeliverable,
  mapDocumentArtifactToTaskRecord,
  type CockpitDeliverable,
  type TaskArtifactRecord,
} from "../../clonestore/document-style-kit/artifact-metadata";

// ── Build Pierre document artifact ────────────────────────────────────────────

export function buildPierreDocumentArtifact(
  result: DocumentRenderResult,
  ctx: DocumentRenderContext,
): {
  metadata: DocumentArtifactMetadata;
  cockpit_deliverable: CockpitDeliverable;
  task_record: TaskArtifactRecord;
} {
  const metadata = buildDocumentArtifactMetadata(ctx, {
    quality_score: result.quality_score,
    text: result.text,
    format: result.format,
  });

  const cockpit_deliverable = mapArtifactToCockpitDeliverable(
    metadata,
    ctx.template.risk_level,
  );

  const task_record = mapDocumentArtifactToTaskRecord(metadata, result.html);

  return { metadata, cockpit_deliverable, task_record };
}

// ── Build redacted preview ────────────────────────────────────────────────────

export function buildRedactedDocumentPreview(
  result: DocumentRenderResult,
  maxChars = 200,
): string {
  const text = result.text.replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

// ── Map render result to task artifact ───────────────────────────────────────

export function mapDocumentRenderResultToTaskArtifact(
  result: DocumentRenderResult,
  ctx: DocumentRenderContext,
): TaskArtifactRecord {
  const metadata = buildDocumentArtifactMetadata(ctx, {
    quality_score: result.quality_score,
    text: result.text,
  });
  return mapDocumentArtifactToTaskRecord(metadata, result.html);
}
