// src/app/api/pierre/use/document-templates/[templateId]/route.ts
// Bloc 27 — GET, PUT, PATCH, DELETE for a single document template
// Reads/writes ONLY reusable_rh_context_json.document_templates
// Never touches employees, memory_json, sends email, or executes tasks.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeCompanyDocumentTemplate,
  readCompanyDocumentTemplates,
  getCompanyDocumentTemplateById,
  upsertCompanyDocumentTemplate,
  deleteCompanyDocumentTemplate,
  buildCompanyTemplateStoragePatch,
} from "../../../../../../lib/clonestore/documents/company-templates";
import { getCloneDocumentTemplateById } from "../../../../../../lib/clonestore/documents/template-registry";

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

async function loadCompanyMemoryRow(
  admin: SupabaseClient,
  userId: string,
): Promise<{ id: string; reusable_rh_context_json: Record<string, unknown> } | null> {
  const { data, error } = await admin
    .from("pierre_company_memory")
    .select("id, reusable_rh_context_json")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw { status: 500, message: "Failed to load company memory.", code: "COMPANY_MEMORY_FETCH_FAILED", details: mapDbError(error) };
  if (!data) return null;

  return {
    id: String(data.id),
    reusable_rh_context_json: isObject(data.reusable_rh_context_json)
      ? (data.reusable_rh_context_json as Record<string, unknown>)
      : {},
  };
}

type RouteContext = { params: Promise<{ templateId: string }> };

// ── GET /api/pierre/use/document-templates/[templateId] ───────

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { templateId } = await ctx.params;
    if (!templateId) return jsonError("Template ID is required.", 400, { code: "TEMPLATE_ID_REQUIRED" });

    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    const row = await loadCompanyMemoryRow(admin, userId);
    const rh = row?.reusable_rh_context_json ?? {};

    // Check company templates first, then platform defaults
    const template =
      getCompanyDocumentTemplateById(rh, templateId) ??
      getCloneDocumentTemplateById(templateId);

    if (!template) return jsonError("Template not found.", 404, { code: "TEMPLATE_NOT_FOUND" });

    return NextResponse.json({ ok: true, template });
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

// ── PUT /api/pierre/use/document-templates/[templateId] ───────
// Full replace of a company template

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { templateId } = await ctx.params;
    if (!templateId) return jsonError("Template ID is required.", 400, { code: "TEMPLATE_ID_REQUIRED" });

    const body = await req.json().catch(() => null);
    if (!isObject(body)) return jsonError("Request body must be a JSON object.", 400, { code: "INVALID_BODY" });

    // Enforce ID consistency
    const bodyWithId = { ...body, id: templateId };

    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    const template = sanitizeCompanyDocumentTemplate(bodyWithId);
    if (!template) return jsonError("Invalid template data.", 422, { code: "INVALID_TEMPLATE" });

    template.scope = "company_custom";

    const row = await loadCompanyMemoryRow(admin, userId);
    const rh = row?.reusable_rh_context_json ?? {};
    const existing = readCompanyDocumentTemplates(rh);

    const updated = upsertCompanyDocumentTemplate({ existing, template });
    const patch = buildCompanyTemplateStoragePatch({ reusableRhContextJson: rh, templates: updated });

    if (row) {
      const { error } = await admin
        .from("pierre_company_memory")
        .update({ reusable_rh_context_json: patch, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw { status: 500, message: "Failed to save template.", code: "TEMPLATE_SAVE_FAILED", details: mapDbError(error) };
    } else {
      const { error } = await admin
        .from("pierre_company_memory")
        .insert({ user_id: userId, agent_slug: "pierre", reusable_rh_context_json: patch });
      if (error) throw { status: 500, message: "Failed to create company memory.", code: "COMPANY_MEMORY_CREATE_FAILED", details: mapDbError(error) };
    }

    return NextResponse.json({ ok: true, template, saved_at: new Date().toISOString() });
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

// ── PATCH /api/pierre/use/document-templates/[templateId] ─────
// Partial update of a company template (merges with existing)

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { templateId } = await ctx.params;
    if (!templateId) return jsonError("Template ID is required.", 400, { code: "TEMPLATE_ID_REQUIRED" });

    const body = await req.json().catch(() => null);
    if (!isObject(body)) return jsonError("Request body must be a JSON object.", 400, { code: "INVALID_BODY" });

    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    const row = await loadCompanyMemoryRow(admin, userId);
    const rh = row?.reusable_rh_context_json ?? {};

    // Find existing (company or platform)
    const existingCompany = getCompanyDocumentTemplateById(rh, templateId);
    const platformDefault = getCloneDocumentTemplateById(templateId);
    const base = existingCompany ?? platformDefault;

    if (!base) return jsonError("Template not found.", 404, { code: "TEMPLATE_NOT_FOUND" });

    // Merge patch onto base, then sanitize
    const merged = sanitizeCompanyDocumentTemplate({ ...base, ...body, id: templateId });
    if (!merged) return jsonError("Invalid patch data.", 422, { code: "INVALID_TEMPLATE" });

    merged.scope = "company_custom";

    const existing = readCompanyDocumentTemplates(rh);
    const updated = upsertCompanyDocumentTemplate({ existing, template: merged });
    const patch = buildCompanyTemplateStoragePatch({ reusableRhContextJson: rh, templates: updated });

    if (row) {
      const { error } = await admin
        .from("pierre_company_memory")
        .update({ reusable_rh_context_json: patch, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw { status: 500, message: "Failed to save template.", code: "TEMPLATE_SAVE_FAILED", details: mapDbError(error) };
    } else {
      const { error } = await admin
        .from("pierre_company_memory")
        .insert({ user_id: userId, agent_slug: "pierre", reusable_rh_context_json: patch });
      if (error) throw { status: 500, message: "Failed to create company memory.", code: "COMPANY_MEMORY_CREATE_FAILED", details: mapDbError(error) };
    }

    return NextResponse.json({ ok: true, template: merged, saved_at: new Date().toISOString() });
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

// ── DELETE /api/pierre/use/document-templates/[templateId] ────
// Remove a company template override (platform defaults cannot be deleted)

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const { templateId } = await ctx.params;
    if (!templateId) return jsonError("Template ID is required.", 400, { code: "TEMPLATE_ID_REQUIRED" });

    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    const row = await loadCompanyMemoryRow(admin, userId);
    if (!row) return jsonError("Template not found.", 404, { code: "TEMPLATE_NOT_FOUND" });

    const rh = row.reusable_rh_context_json;
    const existing = readCompanyDocumentTemplates(rh);
    const found = existing.find((t) => t.id === templateId);

    if (!found) {
      // Platform defaults cannot be deleted
      const isPlatform = getCloneDocumentTemplateById(templateId) !== null;
      if (isPlatform) {
        return jsonError("Platform default templates cannot be deleted. Use PUT/PATCH to override.", 403, { code: "PLATFORM_TEMPLATE_IMMUTABLE" });
      }
      return jsonError("Template not found.", 404, { code: "TEMPLATE_NOT_FOUND" });
    }

    const updated = deleteCompanyDocumentTemplate({ existing, templateId });
    const patch = buildCompanyTemplateStoragePatch({ reusableRhContextJson: rh, templates: updated });

    const { error } = await admin
      .from("pierre_company_memory")
      .update({ reusable_rh_context_json: patch, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", userId);

    if (error) throw { status: 500, message: "Failed to delete template.", code: "TEMPLATE_DELETE_FAILED", details: mapDbError(error) };

    return NextResponse.json({ ok: true, deleted_template_id: templateId, deleted_at: new Date().toISOString() });
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
