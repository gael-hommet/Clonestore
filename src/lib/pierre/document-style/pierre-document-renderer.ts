// B45 — Pierre document renderer
// Main entry point: buildPierreDocumentContext → renderPierreDocument.
// Pure: no async, no Supabase, no Next.js, no side effects. No throw.

import type { EnterpriseEmpreinte } from "../../clonestore/empreinte/types";
import type { PierreEmpreinte } from "../empreinte/types";
import type { DocumentRenderResult, DocumentRenderContext } from "../../clonestore/document-style-kit/types";
import { renderDocumentTemplateToHtml } from "../../clonestore/document-style-kit/html-renderer";
import { renderPdfReadyHtml, buildPdfExportContract } from "../../clonestore/document-style-kit/pdf-ready-renderer";
import { scoreRenderedDocumentQuality } from "../../clonestore/document-style-kit/quality-gates";
import { buildDocumentArtifactMetadata } from "../../clonestore/document-style-kit/artifact-metadata";
import { buildPierreDocumentContext, PIERRE_TEMPLATE_IDS } from "./pierre-document-context";
import type { PierreDocumentMissionContext, PierreDocumentBuildResult } from "./pierre-document-types";
import { findMissingVariables } from "../../clonestore/document-style-kit/tokens";

// ── Core render function ──────────────────────────────────────────────────────

export function renderPierreDocument(
  ctx: DocumentRenderContext,
): DocumentRenderResult {
  try {
    // Render HTML
    const htmlResult = renderDocumentTemplateToHtml(ctx);

    // Render PDF-ready HTML
    const pdfResult = renderPdfReadyHtml(ctx);

    // Score quality
    const quality = scoreRenderedDocumentQuality({
      ctx,
      html: htmlResult.html,
      text: htmlResult.text,
      unresolved_tokens: htmlResult.unresolved_tokens,
      missing_variables: htmlResult.missing_variables,
    });

    // Build artifact metadata
    const artifactMetadata = buildDocumentArtifactMetadata(ctx, {
      quality_score: quality.score,
      text: htmlResult.text,
    });

    const errors: string[] = [
      ...htmlResult.warnings.filter((w) => w.toLowerCase().includes("erreur")),
      ...quality.hard_fails.map((f) => f.message),
    ];
    const warnings = [
      ...htmlResult.warnings.filter((w) => !w.toLowerCase().includes("erreur")),
      ...quality.warnings.map((w) => w.message),
    ];

    return {
      ok: quality.passed && htmlResult.missing_variables.length === 0,
      document_id: artifactMetadata.id,
      title: ctx.document_title,
      document_type: ctx.template.document_type,
      format: ctx.template.output_format,
      html: htmlResult.html,
      text: htmlResult.text,
      pdf_ready_html: pdfResult.pdf_ready_html,
      missing_variables: htmlResult.missing_variables,
      unresolved_tokens: htmlResult.unresolved_tokens,
      quality_score: quality.score,
      validation_requirement: ctx.template.default_validation_requirement,
      artifact_metadata: artifactMetadata,
      warnings,
      errors,
    };
  } catch {
    const fallbackArtifact = buildDocumentArtifactMetadata(ctx, { quality_score: 0, text: "" });
    return {
      ok: false,
      document_id: fallbackArtifact.id,
      title: ctx.document_title,
      document_type: ctx.template.document_type,
      format: ctx.template.output_format,
      html: `<!DOCTYPE html><html><body><p>Erreur de rendu.</p></body></html>`,
      text: "[Erreur de rendu]",
      pdf_ready_html: `<!DOCTYPE html><html><body><p>Erreur PDF.</p></body></html>`,
      missing_variables: [],
      unresolved_tokens: [],
      quality_score: 0,
      validation_requirement: ctx.template.default_validation_requirement,
      artifact_metadata: fallbackArtifact,
      warnings: [],
      errors: ["Erreur interne de rendu Pierre document."],
    };
  }
}

// ── Render from template ID ───────────────────────────────────────────────────

export function renderPierreDocumentFromTemplateId(params: {
  templateId: string;
  variables: Record<string, unknown>;
  enterprise: EnterpriseEmpreinte | null;
  pierre: PierreEmpreinte | null;
  userId: string;
  missionContext?: PierreDocumentMissionContext | null;
}): DocumentRenderResult | null {
  const ctx = buildPierreDocumentContext({
    enterprise: params.enterprise,
    pierre: params.pierre,
    templateId: params.templateId,
    variables: params.variables,
    userId: params.userId,
    missionContext: params.missionContext,
  });
  if (!ctx) return null;
  return renderPierreDocument(ctx);
}

// ── Render PDF-ready ──────────────────────────────────────────────────────────

export function renderPierrePdfReadyDocument(params: {
  templateId: string;
  variables: Record<string, unknown>;
  enterprise: EnterpriseEmpreinte | null;
  pierre: PierreEmpreinte | null;
  userId: string;
  missionContext?: PierreDocumentMissionContext | null;
}) {
  const ctx = buildPierreDocumentContext({
    enterprise: params.enterprise,
    pierre: params.pierre,
    templateId: params.templateId,
    variables: params.variables,
    userId: params.userId,
    missionContext: params.missionContext,
  });
  if (!ctx) return null;

  const pdfResult = renderPdfReadyHtml(ctx);
  const artifactMetadata = buildDocumentArtifactMetadata(ctx, {
    quality_score: 80,
    format: "pdf_ready_html",
    text: pdfResult.text,
  });

  return buildPdfExportContract(ctx, pdfResult, artifactMetadata);
}

// ── Validate before export ────────────────────────────────────────────────────

export function validatePierreDocumentBeforeExport(
  result: DocumentRenderResult,
): {
  can_export: boolean;
  blocking_reasons: string[];
} {
  const blocking_reasons: string[] = [];

  if (!result.ok) blocking_reasons.push("Le rendu a échoué.");
  if (result.missing_variables.length > 0) {
    blocking_reasons.push(`Variables requises manquantes : ${result.missing_variables.join(", ")}`);
  }
  if (result.unresolved_tokens.length > 0) {
    blocking_reasons.push(`Tokens non résolus : ${result.unresolved_tokens.join(", ")}`);
  }
  if (result.quality_score < 50) {
    blocking_reasons.push(`Qualité insuffisante (score: ${result.quality_score}/100).`);
  }
  if (["required_before_export", "blocked_without_human"].includes(result.validation_requirement)) {
    blocking_reasons.push("Validation humaine requise avant export.");
  }

  return { can_export: blocking_reasons.length === 0, blocking_reasons };
}

// ── Full build pipeline ───────────────────────────────────────────────────────

export function buildPierreDocument(params: {
  templateId: string;
  variables: Record<string, unknown>;
  enterprise: EnterpriseEmpreinte | null;
  pierre: PierreEmpreinte | null;
  userId: string;
  missionContext?: PierreDocumentMissionContext | null;
}): PierreDocumentBuildResult {
  try {
    const ctx = buildPierreDocumentContext({
      enterprise: params.enterprise,
      pierre: params.pierre,
      templateId: params.templateId,
      variables: params.variables,
      userId: params.userId,
      missionContext: params.missionContext,
    });

    if (!ctx) {
      return {
        ok: false,
        render_result: null,
        quality: null,
        status: "blocked",
        verdict_message: `Template "${params.templateId}" introuvable dans le registre B45.`,
        ready_for_export: false,
        errors: [`Template "${params.templateId}" inconnu.`],
      };
    }

    // Check missing required variables before rendering
    const missingVars = findMissingVariables(ctx.template.required_variables, ctx.variables);
    if (missingVars.length > 0 && ctx.template.official_document) {
      return {
        ok: false,
        render_result: null,
        quality: null,
        status: "blocked",
        verdict_message: `Document officiel bloqué : variables manquantes — ${missingVars.join(", ")}`,
        ready_for_export: false,
        errors: [`Variables requises manquantes : ${missingVars.join(", ")}`],
      };
    }

    const renderResult = renderPierreDocument(ctx);
    const quality = scoreRenderedDocumentQuality({
      ctx,
      html: renderResult.html,
      text: renderResult.text,
      unresolved_tokens: renderResult.unresolved_tokens,
      missing_variables: renderResult.missing_variables,
    });

    const exportCheck = validatePierreDocumentBeforeExport(renderResult);

    let status: PierreDocumentBuildResult["status"];
    if (!renderResult.ok) status = "blocked";
    else if (["required", "required_before_send", "required_before_export", "blocked_without_human"].includes(renderResult.validation_requirement)) {
      status = "pending_validation";
    } else {
      status = "ready";
    }

    const verdictMessage = quality.passed
      ? `Document "${ctx.document_title}" généré avec succès (qualité: ${quality.score}/100).`
      : `Document "${ctx.document_title}" généré avec ${quality.hard_fails.length} problème(s) critique(s).`;

    return {
      ok: renderResult.ok && quality.client_visible_safe,
      render_result: renderResult,
      quality,
      status,
      verdict_message: verdictMessage,
      ready_for_export: exportCheck.can_export,
      errors: [...renderResult.errors, ...exportCheck.blocking_reasons],
    };
  } catch {
    return {
      ok: false,
      render_result: null,
      quality: null,
      status: "blocked",
      verdict_message: "Erreur interne lors de la génération du document.",
      ready_for_export: false,
      errors: ["Erreur interne build Pierre document."],
    };
  }
}

// Export convenience constants
export { PIERRE_TEMPLATE_IDS };
