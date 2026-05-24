// src/app/api/pierre/use/document-templates/preview/route.ts
// Bloc 27 — POST preview: render a document template without saving
// READ-ONLY: no DB writes, no email, no task execution, no mission creation.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildAllAvailableTemplates,
} from "../../../../../../lib/clonestore/documents/company-templates";
import {
  renderCloneDocument,
  validateCloneDocumentTemplate,
} from "../../../../../../lib/clonestore/documents/renderer";
import { getCloneDocumentTemplateById } from "../../../../../../lib/clonestore/documents/template-registry";
import type { CloneDocumentFormat } from "../../../../../../lib/clonestore/documents/types";

// ── Helpers ───────────────────────────────────────────────────

type JsonErrorExtra = { code?: string | null; details?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ?? {}) },
    { status },
  );
}

function mapDbError(error: unknown) {
  if (isObject(error))
    return { message: asString(error.message) || "Database error.", code: asString(error.code) };
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Database error.", code: null };
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tryBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

async function authenticate(req: NextRequest, admin: SupabaseClient): Promise<string> {
  const token = tryBearerToken(req);
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user)
    throw { status: 401, message: "Unable to authenticate.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function loadCompanyMemoryRh(
  admin: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from("pierre_company_memory")
    .select("reusable_rh_context_json")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw { status: 500, message: "Failed to load company memory.", code: "COMPANY_MEMORY_FETCH_FAILED", details: mapDbError(error) };
  if (!data) return {};

  return isObject(data.reusable_rh_context_json)
    ? (data.reusable_rh_context_json as Record<string, unknown>)
    : {};
}

const VALID_FORMATS = new Set(["text", "markdown", "html", "pdf_ready_html"]);

// ── POST /api/pierre/use/document-templates/preview ───────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!isObject(body)) return jsonError("Request body must be a JSON object.", 400, { code: "INVALID_BODY" });

    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    // Resolve template
    let template = null;

    if (isObject(body["template"])) {
      // Inline template provided in body
      const validation = validateCloneDocumentTemplate(body["template"]);
      if (!validation.ok || !validation.template) {
        return jsonError("Invalid template definition.", 422, {
          code: "INVALID_TEMPLATE",
          details: validation.issues,
        });
      }
      template = validation.template;
    } else if (typeof body["template_id"] === "string") {
      // Look up by ID — company override first, then platform default
      const rh = await loadCompanyMemoryRh(admin, userId);
      const all = buildAllAvailableTemplates(rh);
      template = all.find((t) => t.id === body["template_id"]) ?? getCloneDocumentTemplateById(body["template_id"]);
      if (!template) return jsonError("Template not found.", 404, { code: "TEMPLATE_NOT_FOUND" });
    } else {
      return jsonError("Provide either 'template_id' or 'template' in the request body.", 400, { code: "TEMPLATE_REQUIRED" });
    }

    const variables = isObject(body["variables"]) ? (body["variables"] as Record<string, unknown>) : {};
    const format: CloneDocumentFormat =
      typeof body["format"] === "string" && VALID_FORMATS.has(body["format"])
        ? (body["format"] as CloneDocumentFormat)
        : template.default_format;

    const company_profile = isObject(body["company_profile"])
      ? (body["company_profile"] as Record<string, unknown>)
      : null;
    const employee_profile = isObject(body["employee_profile"])
      ? (body["employee_profile"] as Record<string, unknown>)
      : null;
    const mission_context = isObject(body["mission_context"])
      ? (body["mission_context"] as Record<string, unknown>)
      : null;

    // ai_content accepted as object or string — but AI is never required
    const ai_content =
      isObject(body["ai_content"])
        ? (body["ai_content"] as Record<string, unknown>)
        : typeof body["ai_content"] === "string"
        ? body["ai_content"]
        : null;

    const result = renderCloneDocument({
      template,
      variables,
      format,
      company_profile,
      employee_profile,
      mission_context,
      ai_content,
    });

    // Strip pdf_ready_html from response if format wasn't requested (reduce payload)
    const response: Record<string, unknown> = {
      ok: result.ok,
      template_id: result.template_id,
      document_type: result.document_type,
      format: result.format,
      title: result.title,
      missing_variables: result.missing_variables,
      validation_issues: result.validation_issues,
      risk_level: result.risk_level,
      validation_mode: result.validation_mode,
      requires_human_validation: result.requires_human_validation,
      quality_score: result.quality_score,
      warnings: result.warnings,
      previewed_at: new Date().toISOString(),
    };

    if (format === "text") response["content_text"] = result.content_text;
    else if (format === "markdown") response["content_markdown"] = result.content_markdown;
    else if (format === "html") response["content_html"] = result.content_html;
    else if (format === "pdf_ready_html") response["content_pdf_ready_html"] = result.content_pdf_ready_html;
    else response["content_html"] = result.content_html;

    return NextResponse.json(response);
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status, {
        code: asString(error.code),
        details: error.details ?? null,
      });
    }
    const e = mapDbError(error);
    return jsonError(e.message, 500, { code: e.code });
  }
}
