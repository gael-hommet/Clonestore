// B45 — HTML premium renderer with DocumentStyleKit
// Pure: no async, no Supabase, no Next.js, no side effects. No throw.

import type { DocumentStyleKit, DocumentRenderContext, DocumentTemplateSection } from "./types";
import { escapeHtml, stripUnsafeHtml, containsScriptTag, containsEventHandler } from "./sanitize";
import { resolveTemplateTokensHtml, findUnresolvedTokens } from "./tokens";

// ── CSS builder ───────────────────────────────────────────────────────────────

export function buildPremiumDocumentCss(styleKit: DocumentStyleKit): string {
  const { typography: ty, color_system: cs, page_layout: pl } = styleKit;
  const primary = escapeHtml(cs.primary_color_hex);
  const secondary = escapeHtml(cs.secondary_color_hex);
  const text = escapeHtml(cs.text_color_hex);
  const muted = escapeHtml(cs.muted_text_color_hex);
  const bg = escapeHtml(cs.background_color_hex);
  const surface = escapeHtml(cs.surface_color_hex);
  const border = escapeHtml(cs.border_color_hex);
  const font = escapeHtml(ty.primary_font_family);
  const fontSize = `${ty.base_font_size_px}px`;
  const titleSize = `${Math.round(ty.base_font_size_px * ty.title_scale)}px`;
  const lh = ty.line_height;
  const headingW = ty.heading_weight;
  const bodyW = ty.body_weight;
  const maxW = `${pl.max_content_width_px}px`;
  const sectionGap = `${pl.section_spacing_px}px`;
  const tableHeaderBg = escapeHtml(styleKit.tables.header_background_hex);
  const tableHeaderText = escapeHtml(styleKit.tables.header_text_hex);
  const tableBorder = escapeHtml(styleKit.tables.row_border_hex);
  const cellPad = `${styleKit.tables.cell_padding_px}px`;

  return `
body { font-family: ${font}; font-size: ${fontSize}; color: ${text}; background: ${bg}; margin: 0; padding: 0; font-weight: ${bodyW}; }
.b45-document { max-width: ${maxW}; margin: 0 auto; padding: 32px 40px; background: ${bg}; }
.b45-doc-header { border-bottom: 2px solid ${primary}; padding-bottom: 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
.b45-company-name { font-size: 11px; font-weight: ${headingW}; color: ${muted}; text-transform: uppercase; letter-spacing: 1px; }
.b45-doc-title-header { font-size: 13px; font-weight: ${headingW}; color: ${primary}; }
.b45-doc-footer { border-top: 1px solid ${border}; margin-top: 40px; padding-top: 14px; }
.b45-footer-text { font-size: 10px; color: ${muted}; margin: 2px 0; }
.b45-main-title { font-size: ${titleSize}; font-weight: ${headingW}; color: ${primary}; margin: 0 0 6px; letter-spacing: 0.3px; text-transform: uppercase; }
.b45-section-heading { font-size: ${Math.round(ty.base_font_size_px * 1.1)}px; font-weight: ${headingW}; color: ${primary}; margin: ${sectionGap} 0 10px; border-bottom: 1px solid ${border}; padding-bottom: 4px; }
.b45-paragraph { line-height: ${lh}; margin: 0 0 14px; color: ${text}; }
.b45-bullet-list, .b45-numbered-list { line-height: ${lh}; padding-left: 24px; margin: 0 0 14px; color: ${text}; }
.b45-bullet-list li, .b45-numbered-list li { margin-bottom: 4px; }
.b45-separator { border: none; border-top: 1px solid ${border}; margin: 22px 0; }
.b45-callout { background: ${surface}; border-left: 4px solid ${secondary}; border-radius: 4px; padding: 12px 16px; margin: 16px 0; }
.b45-callout p { margin: 0; color: ${text}; line-height: ${lh}; }
.b45-legal-notice { background: #fff8e1; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 16px; margin: 16px 0; }
.b45-legal-notice p { margin: 0; color: #7c5700; font-weight: 500; line-height: ${lh}; font-size: 11px; }
.b45-validation-notice { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px 16px; margin: 16px 0; }
.b45-validation-notice p { margin: 0; color: #856404; font-size: 11px; }
.b45-signature { margin-top: 28px; padding-top: 16px; border-top: 1px solid ${border}; }
.b45-signature p { color: ${text}; line-height: 1.8; margin: 0; white-space: pre-line; }
.b45-confidentiality { font-size: 10px; color: ${muted}; font-style: italic; margin-top: 8px; }
table { border-collapse: collapse; width: 100%; margin: 0 0 16px; }
th { background: ${tableHeaderBg}; color: ${tableHeaderText}; font-weight: ${headingW}; padding: ${cellPad}; text-align: left; }
td { border: 1px solid ${tableBorder}; padding: ${cellPad}; color: ${text}; line-height: ${lh}; }
tr:nth-child(even) td { background: ${surface}; }
  `.trim();
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderSection(
  section: DocumentTemplateSection,
  variables: Record<string, unknown>,
): string {
  const content = resolveTemplateTokensHtml(section.content_template, variables);

  if (!content.trim()) return "";

  switch (section.rendering_hint) {
    case "document_title":
      return `<h1 class="b45-main-title">${content.replace(/\n/g, "<br />")}</h1>`;

    case "document_header": {
      const lines = content.split("\n").filter(Boolean).map((l) => `<div class="b45-paragraph">${l}</div>`).join("");
      return `<div class="b45-doc-header-content">${lines}</div>`;
    }

    case "company_header":
      return ""; // Rendered separately in header bar

    case "main_body": {
      const paragraphs = content.split("\n\n").filter(Boolean);
      return paragraphs
        .map((p) => `<p class="b45-paragraph">${p.trim().replace(/\n/g, "<br />")}</p>`)
        .join("\n");
    }

    case "checklist": {
      const items = content.split("\n").filter(Boolean);
      const listItems = items.map((item) => `<li>${item}</li>`).join("");
      return `<ul class="b45-bullet-list">${listItems}</ul>`;
    }

    case "alert_list": {
      const items = content.split("\n").filter(Boolean);
      const listItems = items.map((item) => `<li>${item}</li>`).join("");
      return `<ul class="b45-bullet-list" style="color:#b91c1c;">${listItems}</ul>`;
    }

    case "table": {
      const rows = content.split("\n").filter(Boolean);
      if (rows.length === 0) return `<p class="b45-paragraph">${content.replace(/\n/g, "<br />")}</p>`;
      const tableRows = rows
        .map((row) => `<tr><td colspan="2">${row}</td></tr>`)
        .join("");
      return `<table><tbody>${tableRows}</tbody></table>`;
    }

    case "signature_block":
      return `<div class="b45-signature"><p>${content.replace(/\n/g, "<br />")}</p></div>`;

    case "legal_notice":
      return `<div class="b45-legal-notice"><p>${content.replace(/\n/g, "<br />")}</p></div>`;

    default: {
      // Default: render as paragraphs
      const paragraphs = content.split("\n\n").filter(Boolean);
      if (paragraphs.length > 1) {
        return paragraphs
          .map((p) => `<p class="b45-paragraph">${p.trim().replace(/\n/g, "<br />")}</p>`)
          .join("\n");
      }
      return `<p class="b45-paragraph">${content.replace(/\n/g, "<br />")}</p>`;
    }
  }
}

// ── Header bar ────────────────────────────────────────────────────────────────

function renderDocumentHeader(ctx: DocumentRenderContext): string {
  const { style_kit: sk, document_title, company_name } = ctx;
  if (!sk.header.enabled) return "";

  const companyPart = sk.header.show_company_name && company_name
    ? `<div class="b45-company-name">${escapeHtml(company_name)}</div>`
    : "";
  const titlePart = sk.header.show_document_title
    ? `<div class="b45-doc-title-header">${escapeHtml(document_title)}</div>`
    : "";
  const custom = sk.header.custom_html
    ? stripUnsafeHtml(sk.header.custom_html)
    : "";

  if (!companyPart && !titlePart && !custom) return "";

  return `<div class="b45-doc-header">${companyPart}${titlePart}${custom}</div>`;
}

// ── Footer bar ────────────────────────────────────────────────────────────────

function renderDocumentFooter(ctx: DocumentRenderContext): string {
  const { style_kit: sk, company_name } = ctx;
  if (!sk.footer.enabled) return "";

  const parts: string[] = [];
  if (sk.footer.show_company_legal_name && company_name) {
    parts.push(`<div class="b45-footer-text">${escapeHtml(company_name)}</div>`);
  }
  if (sk.footer.show_confidentiality_note) {
    parts.push(`<div class="b45-footer-text b45-confidentiality">${escapeHtml(sk.legal.confidentiality_notice)}</div>`);
  }
  if (sk.footer.show_generated_by) {
    parts.push(`<div class="b45-footer-text">Généré par Pierre — ${escapeHtml(ctx.generated_at.slice(0, 10))}</div>`);
  }
  const custom = sk.footer.custom_html ? stripUnsafeHtml(sk.footer.custom_html) : "";

  if (parts.length === 0 && !custom) return "";
  return `<div class="b45-doc-footer">${parts.join("")}${custom}</div>`;
}

// ── Validation notice ─────────────────────────────────────────────────────────

export function renderValidationNotice(requirement: string): string {
  const labels: Record<string, string> = {
    required: "Validation RH requise avant usage.",
    required_before_send: "Validation RH requise avant envoi.",
    required_before_export: "Validation RH requise avant export PDF.",
    blocked_without_human: "Document bloqué — validation humaine obligatoire.",
  };
  const msg = labels[requirement];
  if (!msg) return "";
  return `<div class="b45-validation-notice"><p>⚠️ ${escapeHtml(msg)}</p></div>`;
}

// ── Signature block ───────────────────────────────────────────────────────────

export function renderSignatureBlock(ctx: DocumentRenderContext): string {
  const sig = ctx.style_kit.signature;
  if (!sig.enabled) return "";

  const parts: string[] = [];
  if (sig.signature_template) {
    parts.push(escapeHtml(sig.signature_template).replace(/\n/g, "<br />"));
  } else {
    if (sig.default_signatory_name) parts.push(`<strong>${escapeHtml(sig.default_signatory_name)}</strong>`);
    if (sig.default_signatory_title) parts.push(escapeHtml(sig.default_signatory_title));
    if (sig.default_signatory_email) parts.push(`<a href="mailto:${escapeHtml(sig.default_signatory_email)}">${escapeHtml(sig.default_signatory_email)}</a>`);
  }

  if (parts.length === 0) return "";
  return `<div class="b45-signature"><p>${parts.join("<br />")}</p></div>`;
}

// ── Confidentiality notice ────────────────────────────────────────────────────

export function renderConfidentialityNotice(styleKit: DocumentStyleKit): string {
  const notice = styleKit.legal.confidentiality_notice;
  if (!notice) return "";
  return `<div class="b45-legal-notice"><p>${escapeHtml(notice)}</p></div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────

export interface HtmlRenderResult {
  html: string;
  text: string;
  unresolved_tokens: string[];
  missing_variables: string[];
  warnings: string[];
}

export function renderDocumentTemplateToHtml(ctx: DocumentRenderContext): HtmlRenderResult {
  try {
    const { style_kit: sk, template, variables } = ctx;
    const css = buildPremiumDocumentCss(sk);

    const headerHtml = renderDocumentHeader(ctx);
    const sectionParts: string[] = [];
    const allText: string[] = [];

    // Render title section (first section with document_title hint or first required section)
    const titleSection = template.sections.find((s) => s.rendering_hint === "document_title");
    if (!titleSection) {
      // Render document label as title
      sectionParts.push(`<h1 class="b45-main-title">${escapeHtml(template.label)}</h1>`);
      allText.push(template.label);
    }

    for (const section of template.sections.sort((a, b) => a.order - b.order)) {
      if (section.rendering_hint === "company_header") continue; // In header bar
      const rendered = renderSection(section, variables);
      if (rendered.trim()) {
        if (section.title && section.rendering_hint !== "document_title") {
          // Skip heading for signature/legal blocks
          if (!["signature_block", "legal_notice", "company_header"].includes(section.rendering_hint ?? "")) {
            sectionParts.push(`<h2 class="b45-section-heading">${escapeHtml(section.title)}</h2>`);
          }
        }
        sectionParts.push(rendered);
        allText.push(section.content_template);
      }
    }

    // Add validation notice for official/required docs
    const req = template.default_validation_requirement;
    if (["required", "required_before_send", "required_before_export", "blocked_without_human"].includes(req)) {
      sectionParts.push(renderValidationNotice(req));
    }

    // Explicit signature block from style kit if not already in sections
    const hasSigSection = template.sections.some((s) => s.rendering_hint === "signature_block");
    if (!hasSigSection && sk.signature.enabled) {
      sectionParts.push(renderSignatureBlock(ctx));
    }

    // Legal footer
    if (sk.legal.legal_footer_text) {
      sectionParts.push(`<div class="b45-legal-notice"><p>${escapeHtml(sk.legal.legal_footer_text)}</p></div>`);
    }

    const footerHtml = renderDocumentFooter(ctx);
    const bodyHtml = sectionParts.join("\n");

    // Check for unsafe content
    const warnings: string[] = [];
    if (containsScriptTag(bodyHtml)) warnings.push("Script tag detected in rendered output.");
    if (containsEventHandler(bodyHtml)) warnings.push("Event handler detected in rendered output.");

    const safeBodyHtml = stripUnsafeHtml(bodyHtml);

    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(ctx.document_title)}</title>
<style>
${css}
</style>
</head>
<body>
<div class="b45-document">
${headerHtml}
${safeBodyHtml}
${footerHtml}
</div>
</body>
</html>`.trim();

    const fullText = allText.join("\n\n");
    const unresolved_tokens = findUnresolvedTokens(fullText);

    // Detect missing required variables
    const missing_variables = template.required_variables.filter((key) => {
      const val = variables[key];
      return val === undefined || val === null || (typeof val === "string" && !val.trim());
    });

    if (unresolved_tokens.length > 0) {
      warnings.push(`${unresolved_tokens.length} token(s) non résolu(s) dans le rendu.`);
    }
    if (missing_variables.length > 0) {
      warnings.push(`${missing_variables.length} variable(s) requise(s) manquante(s).`);
    }

    return { html: fullHtml, text: fullText, unresolved_tokens, missing_variables, warnings };
  } catch {
    return {
      html: `<!DOCTYPE html><html><body><p>Erreur de rendu document.</p></body></html>`,
      text: "[Erreur de rendu]",
      unresolved_tokens: [],
      missing_variables: [],
      warnings: ["Erreur interne de rendu HTML."],
    };
  }
}

export function renderDocumentSection(
  section: DocumentTemplateSection,
  variables: Record<string, unknown>,
): string {
  return renderSection(section, variables);
}
