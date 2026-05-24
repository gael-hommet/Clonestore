import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildDefaultPremiumDocumentConfig,
} from "../../../../../../lib/pierre/documents/premium-document-system";

// ── Types ──────────────────────────────────────────────────

type JsonErrorExtra = { code?: string | null; details?: unknown };

// ── Helpers ────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

// ── Supabase ───────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Auth ───────────────────────────────────────────────────

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.includes("auth-token")) continue;
    const raw = cookie.value;
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const candidate = parsed.find(
          (item): item is string => typeof item === "string" && item.split(".").length === 3,
        );
        if (candidate) return candidate;
      }
      if (isObject(parsed)) {
        const currentSession = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const candidate =
          asString(parsed.access_token) ||
          (currentSession ? asString(currentSession.access_token) : null);
        if (candidate) return candidate;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }
  return null;
}

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const accessToken = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  }
  return data.user.id;
}

async function hasPierreAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// ── Data helpers ───────────────────────────────────────────

async function loadMemoryRow(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<{ id: string | null; rrhContext: Record<string, unknown> }> {
  const { data } = await supabaseAdmin
    .from("pierre_company_memory")
    .select("id, reusable_rh_context_json")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .limit(1)
    .maybeSingle();

  if (!data) return { id: null, rrhContext: {} };

  const rrhContext = isObject(data.reusable_rh_context_json)
    ? (data.reusable_rh_context_json as Record<string, unknown>)
    : {};

  return { id: asString(data.id), rrhContext };
}

// ── GET /api/pierre/use/document/config ────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const { rrhContext } = await loadMemoryRow(supabaseAdmin, userId);
    const config = buildDefaultPremiumDocumentConfig(rrhContext);

    return NextResponse.json({
      ok: true,
      config,
      document_system: isObject(rrhContext.document_system) ? rrhContext.document_system : null,
      meta: {
        userId,
        fetchedAt: new Date().toISOString(),
        has_custom_templates: config.custom_templates.length > 0,
        has_branding: Boolean(config.branding.company_name),
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code),
      });
    }
    const msg = error instanceof Error ? error.message : "Config load failed.";
    return jsonError(msg, 500);
  }
}

// ── PUT /api/pierre/use/document/config ────────────────────

export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError("Corps JSON invalide.", 400, { code: "INVALID_JSON_BODY" });
    }

    const body = isObject(rawBody) ? rawBody : {};

    // Accept either a `document_system` wrapper or the config fields directly
    const documentSystemPayload = isObject(body.document_system) ? body.document_system : body;

    // Load current state — preserve employees and other keys
    const { id: rowId, rrhContext } = await loadMemoryRow(supabaseAdmin, userId);

    // Merge document_system only — never touch employees
    const updatedContext: Record<string, unknown> = {
      ...rrhContext,
      document_system: {
        ...(isObject(rrhContext.document_system) ? rrhContext.document_system : {}),
        ...documentSystemPayload,
      },
    };

    // Safety: ensure employees are preserved from original context
    if (rrhContext.employees !== undefined) {
      updatedContext.employees = rrhContext.employees;
    }

    if (rowId) {
      // Update existing row
      const { error } = await supabaseAdmin
        .from("pierre_company_memory")
        .update({ reusable_rh_context_json: updatedContext, updated_at: new Date().toISOString() })
        .eq("id", rowId)
        .eq("user_id", userId)
        .eq("agent_slug", "pierre");

      if (error) {
        throw { status: 500, message: "Unable to save config.", code: "CONFIG_SAVE_FAILED", details: error };
      }
    } else {
      // Insert new row
      const { error } = await supabaseAdmin
        .from("pierre_company_memory")
        .insert({
          user_id: userId,
          agent_slug: "pierre",
          reusable_rh_context_json: updatedContext,
          memory_json: {},
        });

      if (error) {
        throw { status: 500, message: "Unable to create config.", code: "CONFIG_CREATE_FAILED", details: error };
      }
    }

    const config = buildDefaultPremiumDocumentConfig(updatedContext);

    return NextResponse.json({
      ok: true,
      config,
      document_system: isObject(updatedContext.document_system) ? updatedContext.document_system : null,
      meta: {
        userId,
        savedAt: new Date().toISOString(),
        has_custom_templates: config.custom_templates.length > 0,
        has_branding: Boolean(config.branding.company_name),
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code),
        details: isObject((error as Record<string, unknown>).details)
          ? (error as Record<string, unknown>).details
          : null,
      });
    }
    const msg = error instanceof Error ? error.message : "Config save failed.";
    return jsonError(msg, 500);
  }
}
