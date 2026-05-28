// B45 — POST /api/pierre/documents/validate
// Validates a B45 template + variables + style kit. No auth required.
// Pure: no AI, no email, no live Supabase. Cache: no-store.

import { NextRequest, NextResponse } from "next/server";
import { getB45TemplateById } from "../../../../../lib/clonestore/document-style-kit/template-registry";
import { validateDocumentTemplate } from "../../../../../lib/clonestore/document-style-kit/template-validation";
import { validateDocumentStyleKit } from "../../../../../lib/clonestore/document-style-kit/style-kit-validation";
import { createDefaultDocumentStyleKit } from "../../../../../lib/clonestore/document-style-kit/defaults";
import { normalizeDocumentStyleKit } from "../../../../../lib/clonestore/document-style-kit/style-kit-normalizer";
import { findMissingVariables, findUnresolvedTokens, extractTemplateTokens, resolveTemplateTokens } from "../../../../../lib/clonestore/document-style-kit/tokens";
import { stripTenantSpoofingFields, sanitizeStyleKitInput } from "../../../../../lib/clonestore/document-style-kit/sanitize";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: message, ...(code ? { code } : {}) }, { status });
}

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Corps JSON invalide.", code: "INVALID_JSON_BODY" },
        { status: 400, headers },
      );
    }

    const body = isObject(rawBody) ? rawBody : {};

    // Read template ID
    const templateId = asString(body.template_id);
    if (!templateId) {
      return NextResponse.json(
        { ok: false, error: "template_id requis.", code: "TEMPLATE_ID_REQUIRED" },
        { status: 400, headers },
      );
    }

    // Resolve template
    const template = getB45TemplateById(templateId);
    if (!template) {
      return NextResponse.json(
        { ok: false, error: `Template "${templateId}" introuvable.`, code: "TEMPLATE_NOT_FOUND" },
        { status: 404, headers },
      );
    }

    // Validate template itself
    const templateValidation = validateDocumentTemplate(template);

    // Read variables (strip tenant spoofing)
    const rawVariables = isObject(body.variables) ? body.variables : {};
    const safeVariables = stripTenantSpoofingFields(rawVariables as Record<string, unknown>);

    // Compute missing / unresolved variables
    const allTokens = template.sections.flatMap((s) =>
      extractTemplateTokens(s.content_template),
    );
    const missingRequired = findMissingVariables(template.required_variables, safeVariables);
    const allContent = template.sections.map((s) => resolveTemplateTokens(s.content_template, safeVariables)).join(" ");
    const unresolvedTokens = findUnresolvedTokens(allContent);

    // Build or validate style kit if provided
    let styleKitResult: { valid: boolean; issues: string[] } = { valid: true, issues: [] };
    if (isObject(body.style_kit)) {
      const rawKit = sanitizeStyleKitInput(body.style_kit);
      const userId = asString(body.user_id) ?? "anonymous";
      const normalized = normalizeDocumentStyleKit(rawKit, userId);
      const kitValidation = validateDocumentStyleKit(normalized);
      styleKitResult = {
        valid: kitValidation.valid,
        issues: kitValidation.issues.map((i) => i.message),
      };
    }

    // Build default kit to check activation
    const defaultKit = createDefaultDocumentStyleKit({ user_id: "validate" });
    const defaultKitValidation = validateDocumentStyleKit(defaultKit);

    const issues: string[] = [
      ...templateValidation.issues.filter((i) => i.severity === "error").map((i) => i.message),
      ...missingRequired.map((v) => `Variable requise manquante : ${v}`),
      ...styleKitResult.issues,
    ];
    const warnings: string[] = [
      ...unresolvedTokens.map((t) => `Token non résolu : {{${t}}}`),
    ];

    const can_generate = issues.length === 0;
    const needs_style_kit = !defaultKitValidation.valid;
    const official_document = template.official_document ?? false;
    const requires_validation = official_document || ["required_before_export", "blocked_without_human", "required_before_send"].includes(template.default_validation_requirement);

    return NextResponse.json(
      {
        ok: true,
        can_generate,
        template: {
          id: template.id,
          label: template.label,
          document_type: template.document_type,
          category: template.category,
          risk_level: template.risk_level,
          official_document,
          requires_validation,
          required_variables: template.required_variables,
          optional_variables: template.optional_variables,
          output_format: template.output_format,
        },
        validation: {
          template_valid: templateValidation.valid,
          missing_required_variables: missingRequired,
          unresolved_tokens: unresolvedTokens,
          style_kit_valid: styleKitResult.valid,
          issues,
          warnings,
        },
        meta: {
          all_tokens: allTokens,
          sections_count: template.sections.length,
          needs_style_kit,
          generated_at: new Date().toISOString(),
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur interne de validation.";
    return jsonError(msg, 500, "VALIDATE_INTERNAL_ERROR");
  }
}
