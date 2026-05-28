// B45 — POST /api/pierre/documents/preview
// Returns an HTML preview of a B45 rendered document. No PDF binary.
// Auth optional (anonymous preview allowed). No AI, no email, no live Supabase.

import { NextRequest, NextResponse } from "next/server";
import { buildPierreDocument } from "../../../../../lib/pierre/document-style/pierre-document-renderer";
import { buildPierreDocumentVerdict } from "../../../../../lib/pierre/document-style/pierre-document-quality";
import { stripTenantSpoofingFields } from "../../../../../lib/clonestore/document-style-kit/sanitize";
import { buildRedactedDocumentPreview } from "../../../../../lib/pierre/document-style/pierre-document-artifacts";

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

    const templateId = asString(body.template_id);
    if (!templateId) {
      return NextResponse.json(
        { ok: false, error: "template_id requis.", code: "TEMPLATE_ID_REQUIRED" },
        { status: 400, headers },
      );
    }

    // Strip tenant spoofing from variables and context
    const rawVariables = isObject(body.variables) ? body.variables : {};
    const safeVariables = stripTenantSpoofingFields(rawVariables as Record<string, unknown>);

    const userId = asString(body.user_id) ?? "preview_anonymous";

    // Mission context (optional)
    const missionContext = isObject(body.mission_context)
      ? {
          employee_name: asString(body.mission_context.employee_name),
          employee_id: asString(body.mission_context.employee_id),
          mission_id: asString(body.mission_context.mission_id),
          mission_title: asString(body.mission_context.mission_title),
          task_id: asString(body.mission_context.task_id),
          extra_variables: isObject(body.mission_context.extra_variables)
            ? stripTenantSpoofingFields(body.mission_context.extra_variables as Record<string, unknown>)
            : {},
        }
      : null;

    // Build document — full pipeline
    const buildResult = buildPierreDocument({
      templateId,
      variables: safeVariables,
      enterprise: null,
      pierre: null,
      userId,
      missionContext,
    });

    if (!buildResult.render_result) {
      return NextResponse.json(
        {
          ok: false,
          error: buildResult.verdict_message,
          code: "TEMPLATE_NOT_FOUND",
          errors: buildResult.errors,
        },
        { status: 404, headers },
      );
    }

    const render = buildResult.render_result;

    // Build quality verdict
    const verdict = buildResult.quality
      ? null
      : null;
    void verdict;

    const redactedPreview = buildRedactedDocumentPreview(render, 300);

    // For preview: return HTML + text + quality info. Never return PDF binary.
    return NextResponse.json(
      {
        ok: buildResult.ok,
        status: buildResult.status,
        verdict_message: buildResult.verdict_message,
        preview: {
          html: render.html,
          text: render.text,
          redacted_preview: redactedPreview,
          title: render.title,
          document_type: render.document_type,
          format: render.format,
        },
        quality: buildResult.quality
          ? {
              score: buildResult.quality.score,
              passed: buildResult.quality.passed,
              client_visible_safe: buildResult.quality.client_visible_safe,
              hard_fails: buildResult.quality.hard_fails.map((f) => f.message),
              warnings: buildResult.quality.warnings.map((w) => w.message),
            }
          : null,
        validation: {
          missing_variables: render.missing_variables,
          unresolved_tokens: render.unresolved_tokens,
          quality_score: render.quality_score,
          validation_requirement: render.validation_requirement,
          ready_for_export: buildResult.ready_for_export,
        },
        errors: buildResult.errors,
        meta: {
          template_id: templateId,
          document_id: render.document_id,
          generated_at: new Date().toISOString(),
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur de prévisualisation.";
    return jsonError(msg, 500, "PREVIEW_INTERNAL_ERROR");
  }
}
