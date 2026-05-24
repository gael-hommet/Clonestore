// src/lib/clonestore/documents/renderer.ts
// Premium document renderer for CloneStore — Bloc 27
// Pure: no async, no side effects, no Next.js, no Supabase. No throw.

import type {
  CloneDocumentTemplate,
  CloneDocumentRenderInput,
  CloneDocumentRenderResult,
  CloneDocumentMissingVariable,
  CloneDocumentValidationIssue,
  CloneDocumentFormat,
  CloneDocumentBlock,
  CloneDocumentRiskLevel,
  CloneDocumentValidationMode,
} from "./types";
import {
  isPlainObject,
  escapeHtml,
  renderDocumentVariables,
  clampDocumentQualityScore,
  requiresHumanValidationForDocument,
  getHighestDocumentRiskLevel,
  mergeDocumentVariables,
  safeDocumentText,
} from "./utils";

// ── Template validation ───────────────────────────────────────────────────────

export function validateCloneDocumentTemplate(template: unknown): {
  ok: boolean;
  template: CloneDocumentTemplate | null;
  issues: CloneDocumentValidationIssue[];
} {
  const issues: CloneDocumentValidationIssue[] = [];

  if (!isPlainObject(template)) {
    return {
      ok: false,
      template: null,
      issues: [{ level: "critical", code: "NOT_AN_OBJECT", label: "Template invalide", message: "Le template doit être un objet." }],
    };
  }

  const t = template as Record<string, unknown>;

  if (!t.id || typeof t.id !== "string" || !t.id.trim()) {
    issues.push({ level: "critical", code: "MISSING_ID", label: "ID manquant", message: "Le template doit avoir un id." });
  }
  if (!t.document_type || typeof t.document_type !== "string") {
    issues.push({ level: "critical", code: "MISSING_DOCUMENT_TYPE", label: "Type manquant", message: "Le template doit avoir un document_type." });
  }
  if (!t.title || typeof t.title !== "string") {
    issues.push({ level: "error", code: "MISSING_TITLE", label: "Titre manquant", message: "Le template doit avoir un titre." });
  }
  if (!Array.isArray(t.blocks)) {
    issues.push({ level: "error", code: "MISSING_BLOCKS", label: "Blocks manquants", message: "Le template doit avoir des blocks." });
  }
  if (!Array.isArray(t.variables)) {
    issues.push({ level: "error", code: "MISSING_VARIABLES", label: "Variables manquantes", message: "Le template doit avoir un tableau variables." });
  }

  const hasCritical = issues.some((i) => i.level === "critical");
  if (hasCritical) return { ok: false, template: null, issues };

  return { ok: true, template: t as unknown as CloneDocumentTemplate, issues };
}

// ── Variable validation ───────────────────────────────────────────────────────

export function validateCloneDocumentVariables(params: {
  template: CloneDocumentTemplate;
  variables: Record<string, unknown>;
}): {
  missing_variables: CloneDocumentMissingVariable[];
  issues: CloneDocumentValidationIssue[];
} {
  const { template, variables } = params;
  const missing: CloneDocumentMissingVariable[] = [];
  const issues: CloneDocumentValidationIssue[] = [];

  for (const v of template.variables ?? []) {
    const val = variables[v.key];
    const hasValue =
      val !== undefined &&
      val !== null &&
      (typeof val !== "string" || val.trim().length > 0);

    if (!hasValue) {
      if (v.required) {
        missing.push({
          key: v.key,
          label: v.label,
          required: true,
          reason: `Variable obligatoire "${v.label}" (${v.key}) manquante.`,
        });
        issues.push({
          level: "error",
          code: "MISSING_REQUIRED_VAR",
          label: "Variable obligatoire manquante",
          message: `La variable "${v.key}" est requise mais absente.`,
          variable_key: v.key,
        });
      } else {
        missing.push({
          key: v.key,
          label: v.label,
          required: false,
          reason: `Variable optionnelle "${v.label}" (${v.key}) non fournie. Valeur par défaut utilisée.`,
        });
      }
    }
  }

  return { missing_variables: missing, issues };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveVariables(
  input: CloneDocumentRenderInput,
): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  // Company profile
  if (isPlainObject(input.company_profile)) {
    const cp = input.company_profile;
    if (cp.name) base.company_name = cp.name;
    if (cp.company_name) base.company_name = cp.company_name;
    if (cp.legal_name) base.company_legal_name = cp.legal_name;
    if (cp.address) base.company_address = cp.address;
    if (cp.siret) base.siret = cp.siret;
    if (cp.default_signature) base.signature_block = cp.default_signature;
  }

  // Employee profile
  if (isPlainObject(input.employee_profile)) {
    const ep = input.employee_profile;
    if (ep.name || ep.full_name || ep.employee_name)
      base.employee_name = ep.name || ep.full_name || ep.employee_name;
    if (ep.email) base.employee_email = ep.email;
    if (ep.role || ep.position) base.position = ep.role || ep.position;
    if (ep.department) base.department = ep.department;
  }

  // Mission context
  if (isPlainObject(input.mission_context)) {
    const mc = input.mission_context;
    if (mc.id) base.mission_id = mc.id;
    if (mc.title) base.mission_title = mc.title;
  }

  // AI content — merge if object, treat as body if string
  if (typeof input.ai_content === "string" && input.ai_content.trim()) {
    base.ai_content = input.ai_content;
  } else if (isPlainObject(input.ai_content)) {
    for (const [k, v] of Object.entries(input.ai_content)) {
      if (base[k] === undefined) base[k] = v;
    }
  }

  // Template variables fallbacks
  for (const v of input.template.variables ?? []) {
    if (base[v.key] === undefined && v.fallback !== null) {
      base[v.key] = v.fallback;
    }
  }

  // Caller-supplied variables take highest priority
  return mergeDocumentVariables(base, input.variables ?? {});
}

function renderBlock(
  block: CloneDocumentBlock,
  resolvedVars: Record<string, unknown>,
  format: CloneDocumentFormat,
): string {
  const content = renderDocumentVariables(block.content, resolvedVars);

  if (format === "text" || format === "markdown") {
    switch (block.type) {
      case "header":
        return format === "markdown" ? `# ${content}` : content.toUpperCase();
      case "title":
        return format === "markdown" ? `## ${content}` : content;
      case "subtitle":
        return format === "markdown" ? `### ${content}` : content;
      case "separator":
        return format === "markdown" ? "---" : "──────────────────────────";
      case "bullet_list":
        return content
          .split("\n")
          .filter(Boolean)
          .map((line) => (format === "markdown" ? `- ${line}` : `  • ${line}`))
          .join("\n");
      case "numbered_list":
        return content
          .split("\n")
          .filter(Boolean)
          .map((line, i) => `${i + 1}. ${line}`)
          .join("\n");
      case "callout":
        return format === "markdown"
          ? `> **Note :** ${content.replace(/\n/g, "\n> ")}`
          : `[NOTE] ${content}`;
      case "legal_notice":
        return format === "markdown"
          ? `> ⚠️ ${content.replace(/\n/g, "\n> ")}`
          : `[IMPORTANT] ${content}`;
      default:
        return content;
    }
  }

  // HTML formats
  const escaped = escapeHtml(content);
  const withBreaks = escaped.replace(/\n/g, "<br />");

  switch (block.type) {
    case "header":
      return `<div class="cs-header-block"><h1 class="cs-main-title">${withBreaks}</h1></div>`;
    case "title":
      return `<h2 class="cs-section-heading">${withBreaks}</h2>`;
    case "subtitle":
      return `<h3 class="cs-subsection">${withBreaks}</h3>`;
    case "separator":
      return `<hr class="cs-separator" />`;
    case "bullet_list": {
      const items = content
        .split("\n")
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");
      return `<ul class="cs-bullet-list">${items}</ul>`;
    }
    case "numbered_list": {
      const items = content
        .split("\n")
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");
      return `<ol class="cs-numbered-list">${items}</ol>`;
    }
    case "callout":
      return `<div class="cs-callout"><p>${withBreaks}</p></div>`;
    case "legal_notice":
      return `<div class="cs-legal-notice"><p>${withBreaks}</p></div>`;
    case "signature":
      return `<div class="cs-signature"><p>${withBreaks}</p></div>`;
    case "footer":
      return `<div class="cs-footer-block"><p class="cs-footer-text">${withBreaks}</p></div>`;
    default:
      return `<p class="cs-paragraph">${withBreaks}</p>`;
  }
}

function buildPremiumCss(template: CloneDocumentTemplate): string {
  const t = template.theme;
  const primary = escapeHtml(t.primary_color || "#1a1a2e");
  const accent = escapeHtml(t.accent_color || "#4f6ef2");
  const text = escapeHtml(t.text_color || "#1a1a1a");
  const bg = escapeHtml(t.background_color || "#ffffff");
  const font = escapeHtml(t.font_family || "'Segoe UI', Arial, sans-serif");
  const radius = escapeHtml(t.border_radius || "4px");
  const density = t.density === "compact" ? "16px 24px" : t.density === "spacious" ? "48px 64px" : "32px 48px";

  return `
    body { font-family: ${font}; font-size: 13px; color: ${text}; background: ${bg}; margin: 0; padding: 0; }
    .cs-document { max-width: 820px; margin: 0 auto; padding: ${density}; background: ${bg}; }
    .cs-doc-header { border-bottom: 2px solid ${primary}; padding-bottom: 16px; margin-bottom: 28px; }
    .cs-doc-footer { border-top: 1px solid #e0e0e0; margin-top: 32px; padding-top: 12px; }
    .cs-main-title { font-size: 22px; font-weight: 700; color: ${primary}; margin: 0 0 4px; letter-spacing: 0.3px; }
    .cs-section-heading { font-size: 15px; font-weight: 600; color: ${primary}; margin: 24px 0 8px; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; }
    .cs-subsection { font-size: 13px; font-weight: 600; color: ${accent}; margin: 16px 0 6px; }
    .cs-paragraph { line-height: 1.75; margin: 0 0 14px; color: ${text}; }
    .cs-bullet-list, .cs-numbered-list { line-height: 1.75; padding-left: 24px; margin: 0 0 14px; color: ${text}; }
    .cs-bullet-list li, .cs-numbered-list li { margin-bottom: 4px; }
    .cs-separator { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }
    .cs-callout { background: #f0f4ff; border-left: 4px solid ${accent}; border-radius: ${radius}; padding: 12px 16px; margin: 16px 0; }
    .cs-callout p { margin: 0; color: ${text}; line-height: 1.6; }
    .cs-legal-notice { background: #fff8e1; border-left: 4px solid #f59e0b; border-radius: ${radius}; padding: 12px 16px; margin: 16px 0; }
    .cs-legal-notice p { margin: 0; color: #7c5700; font-weight: 500; line-height: 1.6; }
    .cs-signature { border-top: 1px solid #e0e0e0; margin-top: 24px; padding-top: 16px; }
    .cs-signature p { color: ${text}; line-height: 1.8; margin: 0; }
    .cs-footer-block { }
    .cs-footer-text { font-size: 11px; color: #888; margin: 0; }
    .cs-header-block { margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 14px; }
    th, td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
    th { background: ${primary}; color: #fff; font-weight: 600; }
  `.trim();
}

function buildHtmlWrapper(
  bodyHtml: string,
  template: CloneDocumentTemplate,
  resolvedVars: Record<string, unknown>,
  isPdfReady: boolean,
): string {
  const title = escapeHtml(
    renderDocumentVariables(template.title, resolvedVars),
  );
  const css = buildPremiumCss(template);
  const lang = "fr";

  const signatureHtml = template.signature
    ? (() => {
        const sig = template.signature;
        const parts: string[] = [];
        if (sig.name) parts.push(`<strong>${escapeHtml(sig.name)}</strong>`);
        if (sig.role) parts.push(escapeHtml(sig.role));
        if (sig.company) parts.push(escapeHtml(sig.company));
        if (sig.email) parts.push(`<a href="mailto:${escapeHtml(sig.email)}">${escapeHtml(sig.email)}</a>`);
        if (sig.phone) parts.push(escapeHtml(sig.phone));
        const sigBody = parts.join("<br />");
        const footer = sig.legal_footer ? `<p class="cs-footer-text" style="margin-top:8px;font-size:11px;color:#777;">${escapeHtml(sig.legal_footer)}</p>` : "";
        return `<div class="cs-doc-footer">${sigBody ? `<p>${sigBody}</p>` : ""}${footer}</div>`;
      })()
    : "";

  if (isPdfReady) {
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
${css}
@page { margin: 20mm 18mm; }
@media print { body { font-size: 11pt; } .cs-document { padding: 0; } }
</style>
</head>
<body>
<div class="cs-document">
${bodyHtml}
${signatureHtml}
</div>
</body>
</html>`.trim();
  }

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
<div class="cs-document">
${bodyHtml}
${signatureHtml}
</div>
</body>
</html>`.trim();
}

// ── Render functions ──────────────────────────────────────────────────────────

export function renderCloneDocumentToText(input: CloneDocumentRenderInput): string {
  try {
    const resolved = resolveVariables(input);
    const blocks = (input.template.blocks ?? []).filter(
      (b) => !b.optional || resolved[b.id] !== undefined || b.content.trim(),
    );
    const parts: string[] = [input.template.title.toUpperCase()];
    parts.push("─".repeat(40));

    for (const block of blocks) {
      const rendered = renderBlock(block, resolved, "text");
      if (rendered.trim()) {
        parts.push(rendered);
      }
    }

    if (input.template.signature?.legal_footer) {
      parts.push("─".repeat(40));
      parts.push(input.template.signature.legal_footer);
    }

    return parts.filter(Boolean).join("\n\n");
  } catch {
    return `[Erreur de rendu — ${safeDocumentText(input.template?.title)}]`;
  }
}

export function renderCloneDocumentToMarkdown(input: CloneDocumentRenderInput): string {
  try {
    const resolved = resolveVariables(input);
    const blocks = input.template.blocks ?? [];
    const parts: string[] = [`# ${input.template.title}`];
    parts.push("");

    for (const block of blocks) {
      const rendered = renderBlock(block, resolved, "markdown");
      if (rendered.trim()) {
        parts.push(rendered);
        parts.push("");
      }
    }

    if (input.template.signature?.legal_footer) {
      parts.push("---");
      parts.push(`*${input.template.signature.legal_footer}*`);
    }

    return parts.join("\n");
  } catch {
    return `# ${safeDocumentText(input.template?.title)}\n\n[Erreur de rendu]`;
  }
}

export function renderCloneDocumentToHtml(input: CloneDocumentRenderInput): string {
  try {
    const resolved = resolveVariables(input);
    const blocks = input.template.blocks ?? [];
    const bodyParts: string[] = [];

    for (const block of blocks) {
      const rendered = renderBlock(block, resolved, "html");
      if (rendered.trim()) bodyParts.push(rendered);
    }

    const bodyHtml = bodyParts.join("\n");
    return buildHtmlWrapper(bodyHtml, input.template, resolved, false);
  } catch {
    return `<html><body><p>Erreur de rendu document.</p></body></html>`;
  }
}

export function renderCloneDocumentToPdfReadyHtml(input: CloneDocumentRenderInput): string {
  try {
    const resolved = resolveVariables(input);
    const blocks = input.template.blocks ?? [];
    const bodyParts: string[] = [];

    for (const block of blocks) {
      const rendered = renderBlock(block, resolved, "pdf_ready_html");
      if (rendered.trim()) bodyParts.push(rendered);
    }

    const bodyHtml = bodyParts.join("\n");
    return buildHtmlWrapper(bodyHtml, input.template, resolved, true);
  } catch {
    return `<!DOCTYPE html><html><body><p>Erreur de rendu PDF.</p></body></html>`;
  }
}

// ── Quality scoring ───────────────────────────────────────────────────────────

function computeQualityScore(
  missing: CloneDocumentMissingVariable[],
  issues: CloneDocumentValidationIssue[],
  contentLength: number,
): number {
  let score = 100;

  const missingRequired = missing.filter((m) => m.required).length;
  const missingOptional = missing.filter((m) => !m.required).length;
  const criticalIssues = issues.filter((i) => i.level === "critical").length;
  const errorIssues = issues.filter((i) => i.level === "error").length;
  const warningIssues = issues.filter((i) => i.level === "warning").length;

  score -= missingRequired * 12;
  score -= missingOptional * 3;
  score -= criticalIssues * 25;
  score -= errorIssues * 10;
  score -= warningIssues * 3;

  if (contentLength < 50) score -= 30;
  else if (contentLength < 150) score -= 15;
  else if (contentLength < 300) score -= 5;

  return clampDocumentQualityScore(score);
}

// ── Main render function ──────────────────────────────────────────────────────

export function renderCloneDocument(
  input: CloneDocumentRenderInput,
): CloneDocumentRenderResult {
  try {
    const { template, format } = input;
    const outputFormat: CloneDocumentFormat = format ?? template.default_format ?? "html";

    const validationResult = validateCloneDocumentTemplate(template);
    if (!validationResult.ok || !validationResult.template) {
      return {
        ok: false,
        template_id: String((template as Record<string, unknown>)?.id ?? "unknown"),
        document_type: String((template as Record<string, unknown>)?.document_type ?? "unknown"),
        format: outputFormat,
        title: String((template as Record<string, unknown>)?.title ?? "Document"),
        content_text: "",
        content_markdown: "",
        content_html: "<p>Template invalide.</p>",
        content_pdf_ready_html: "<!DOCTYPE html><html><body><p>Template invalide.</p></body></html>",
        missing_variables: [],
        validation_issues: validationResult.issues,
        risk_level: "critical",
        validation_mode: "human_only",
        requires_human_validation: true,
        quality_score: 0,
        warnings: ["Template invalide — rendu impossible."],
      };
    }

    const resolved = resolveVariables(input);
    const { missing_variables, issues: varIssues } = validateCloneDocumentVariables({
      template,
      variables: resolved,
    });

    // Render all formats
    const content_text = renderCloneDocumentToText(input);
    const content_markdown = renderCloneDocumentToMarkdown(input);
    const content_html = renderCloneDocumentToHtml(input);
    const content_pdf_ready_html = renderCloneDocumentToPdfReadyHtml(input);

    // Risk level from template blocks + content analysis
    const blockRisks = (template.blocks ?? []).map((b) => b.risk_level);
    const effectiveRisk = getHighestDocumentRiskLevel([template.risk_level, ...blockRisks]);

    const allIssues = [...varIssues];

    // Check for "no content" pattern
    const remainingPlaceholders = (content_text.match(/\{\{/g) ?? []).length;
    if (remainingPlaceholders > 5) {
      allIssues.push({
        level: "warning",
        code: "MANY_UNREPLACED_VARS",
        label: "Variables non substituées",
        message: `${remainingPlaceholders} variable(s) n'ont pas été remplacées dans le document.`,
      });
    }

    const missingRequired = missing_variables.filter((m) => m.required).length;
    const criticalIssues = allIssues.filter((i) => i.level === "critical").length;
    const validationMode: CloneDocumentValidationMode = template.validation_mode;

    const requires_human_validation = requiresHumanValidationForDocument({
      risk_level: effectiveRisk,
      validation_mode: validationMode,
      missing_required_variables: missingRequired,
      critical_issues: criticalIssues,
    });

    const quality_score = computeQualityScore(
      missing_variables,
      allIssues,
      content_text.length,
    );

    const warnings: string[] = [];
    if (missingRequired > 0) warnings.push(`${missingRequired} variable(s) obligatoire(s) manquante(s).`);
    if (requires_human_validation) warnings.push("Ce document requiert une validation humaine avant utilisation.");
    if (effectiveRisk === "critical") warnings.push("Risque critique détecté — traitement par professionnel RH obligatoire.");

    return {
      ok: criticalIssues === 0 && missingRequired === 0,
      template_id: template.id,
      document_type: template.document_type,
      format: outputFormat,
      title: renderDocumentVariables(template.title, resolved),
      content_text,
      content_markdown,
      content_html,
      content_pdf_ready_html,
      missing_variables,
      validation_issues: allIssues,
      risk_level: effectiveRisk,
      validation_mode: validationMode,
      requires_human_validation,
      quality_score,
      warnings,
    };
  } catch {
    return {
      ok: false,
      template_id: String((input.template as Record<string, unknown>)?.id ?? "unknown"),
      document_type: String((input.template as Record<string, unknown>)?.document_type ?? "unknown"),
      format: input.format ?? "html",
      title: String((input.template as Record<string, unknown>)?.title ?? "Document"),
      content_text: "[Erreur de rendu]",
      content_markdown: "[Erreur de rendu]",
      content_html: "<p>Erreur interne de rendu.</p>",
      content_pdf_ready_html: "<!DOCTYPE html><html><body><p>Erreur interne de rendu.</p></body></html>",
      missing_variables: [],
      validation_issues: [{ level: "critical", code: "RENDER_ERROR", label: "Erreur de rendu", message: "Une erreur interne est survenue lors du rendu." }],
      risk_level: "critical",
      validation_mode: "human_only",
      requires_human_validation: true,
      quality_score: 0,
      warnings: ["Erreur interne de rendu."],
    };
  }
}
