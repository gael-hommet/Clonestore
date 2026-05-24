// src/app/api/pierre/use/document-templates/route.ts
// Bloc 27 — GET (list) and POST (create) document templates
// Reads/writes ONLY reusable_rh_context_json.document_templates
// Never touches employees, memory_json, or sends email/tasks.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizeCompanyDocumentTemplate,
  buildAllAvailableTemplates,
  readCompanyDocumentTemplates,
  upsertCompanyDocumentTemplate,
  buildCompanyTemplateStoragePatch,
} from "../../../../../lib/clonestore/documents/company-templates";

// ── Types ─────────────────────────────────────────────────────

type JsonErrorExtra = { code?: string | null; details?: unknown };

// ── Helpers ───────────────────────────────────────────────────

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

// ── GET /api/pierre/use/document-templates ────────────────────
// Returns merged list: platform defaults + company overrides

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    const row = await loadCompanyMemoryRow(admin, userId);
    const rh = row?.reusable_rh_context_json ?? {};
    const all = buildAllAvailableTemplates(rh);

    const scope = req.nextUrl.searchParams.get("scope");
    const documentType = req.nextUrl.searchParams.get("document_type");
    const audience = req.nextUrl.searchParams.get("audience");

    let filtered = all;
    if (scope) filtered = filtered.filter((t) => t.scope === scope);
    if (documentType) filtered = filtered.filter((t) => t.document_type === documentType);
    if (audience) filtered = filtered.filter((t) => t.audience === audience);

    return NextResponse.json({
      ok: true,
      templates: filtered,
      total: filtered.length,
      company_has_templates: row !== null,
      fetched_at: new Date().toISOString(),
    });
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

// ── POST /api/pierre/use/document-templates ───────────────────
// Create or replace a company template (stored in reusable_rh_context_json.document_templates)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!isObject(body)) return jsonError("Request body must be a JSON object.", 400, { code: "INVALID_BODY" });

    const admin = createAdminClient();
    const userId = await authenticate(req, admin);

    const template = sanitizeCompanyDocumentTemplate(body);
    if (!template) return jsonError("Invalid template: id, document_type, and title are required.", 422, { code: "INVALID_TEMPLATE" });

    // Force company_custom scope for user-created templates
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

    return NextResponse.json({ ok: true, template, saved_at: new Date().toISOString() }, { status: 201 });
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
