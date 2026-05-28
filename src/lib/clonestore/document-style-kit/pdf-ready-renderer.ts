// B45 — PDF-ready renderer
// Produces PDF-ready HTML (with @page CSS) and a PdfExportContract.
// No binary PDF generation — compatible with future Playwright/Puppeteer/print-to-PDF.
// Pure: no async, no Supabase, no Next.js, no side effects. No throw.

import type {
  DocumentRenderContext,
  PdfExportContract,
  DocumentArtifactMetadata,
} from "./types";
import { renderDocumentTemplateToHtml } from "./html-renderer";
import { escapeHtml } from "./sanitize";

// ── PDF-ready CSS additions ───────────────────────────────────────────────────

function buildPdfPageCss(ctx: DocumentRenderContext): string {
  const { page_layout: pl } = ctx.style_kit;
  return `
@page {
  size: ${pl.page_size} ${pl.orientation};
  margin: ${pl.margin_top_mm}mm ${pl.margin_right_mm}mm ${pl.margin_bottom_mm}mm ${pl.margin_left_mm}mm;
}
@media print {
  body { font-size: 10.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .b45-document { padding: 0; max-width: 100%; }
  .b45-doc-footer { position: running(footer); }
  .b45-doc-header { page-break-after: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
  .b45-legal-notice, .b45-validation-notice { page-break-inside: avoid; }
  .b45-signature { page-break-inside: avoid; }
  table { page-break-inside: avoid; }
}
  `.trim();
}

// ── Build recommended filename ────────────────────────────────────────────────

function buildRecommendedFilename(ctx: DocumentRenderContext): string {
  const date = ctx.generated_at.slice(0, 10).replace(/-/g, "");
  const companySlug = (ctx.company_name ?? "document")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 20);
  const typeSlug = ctx.template.document_type
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 30);
  return `${companySlug}_${typeSlug}_${date}.pdf`;
}

// ── Estimate page count ───────────────────────────────────────────────────────

export function estimatePdfPageCount(html: string): number {
  // Rough estimation: average A4 page is ~3000 characters of text
  const textLength = html.replace(/<[^>]+>/g, "").length;
  return Math.max(1, Math.ceil(textLength / 3000));
}

// ── Validate PDF-ready HTML ───────────────────────────────────────────────────

export function validatePdfReadyHtml(html: string): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!html.includes("<!DOCTYPE html>")) reasons.push("Missing DOCTYPE");
  if (!html.includes("<html")) reasons.push("Missing <html> tag");
  if (!html.includes("@page")) reasons.push("Missing @page CSS for print");
  if (/<script\b/i.test(html)) reasons.push("Script tag found — unsafe for PDF");
  if (/\bon\w+\s*=/i.test(html)) reasons.push("Event handler found — unsafe for PDF");
  return { valid: reasons.length === 0, reasons };
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderPdfReadyHtml(ctx: DocumentRenderContext): {
  pdf_ready_html: string;
  text: string;
  unresolved_tokens: string[];
  missing_variables: string[];
  warnings: string[];
} {
  try {
    const htmlResult = renderDocumentTemplateToHtml(ctx);
    const pdfCss = buildPdfPageCss(ctx);

    // Inject @page CSS after the existing <style> block
    const pdf_ready_html = htmlResult.html.replace(
      "</style>",
      `${pdfCss}\n</style>`,
    );

    return {
      pdf_ready_html,
      text: htmlResult.text,
      unresolved_tokens: htmlResult.unresolved_tokens,
      missing_variables: htmlResult.missing_variables,
      warnings: htmlResult.warnings,
    };
  } catch {
    const fallback = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>@page { size: A4 portrait; margin: 20mm 18mm; }</style></head><body><p>Erreur de rendu PDF.</p></body></html>`;
    return {
      pdf_ready_html: fallback,
      text: "[Erreur de rendu PDF]",
      unresolved_tokens: [],
      missing_variables: [],
      warnings: ["Erreur interne de rendu PDF-ready."],
    };
  }
}

// ── Build PDF export contract ─────────────────────────────────────────────────

export function buildPdfExportContract(
  ctx: DocumentRenderContext,
  pdfResult: {
    pdf_ready_html: string;
    unresolved_tokens: string[];
    missing_variables: string[];
  },
  artifactMetadata: DocumentArtifactMetadata,
): PdfExportContract {
  const { page_layout: pl } = ctx.style_kit;
  const validation_required = [
    "required",
    "required_before_send",
    "required_before_export",
    "blocked_without_human",
  ].includes(ctx.template.default_validation_requirement);

  const ready_for_binary_pdf =
    pdfResult.unresolved_tokens.length === 0 &&
    pdfResult.missing_variables.length === 0 &&
    !validation_required;

  return {
    pdf_ready_html: pdfResult.pdf_ready_html,
    page_size: pl.page_size,
    orientation: pl.orientation,
    margin_top_mm: pl.margin_top_mm,
    margin_right_mm: pl.margin_right_mm,
    margin_bottom_mm: pl.margin_bottom_mm,
    margin_left_mm: pl.margin_left_mm,
    recommended_filename: buildRecommendedFilename(ctx),
    title: escapeHtml(ctx.document_title),
    document_type: ctx.template.document_type,
    validation_required,
    ready_for_binary_pdf,
    metadata: artifactMetadata,
    estimated_pages: estimatePdfPageCount(pdfResult.pdf_ready_html),
  };
}
