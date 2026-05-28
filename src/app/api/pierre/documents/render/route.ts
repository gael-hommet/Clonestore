// B45 — POST /api/pierre/documents/render
// Full B45 document render pipeline with auth required.
// Returns DocumentRenderResult. Official docs return validation_required=true.
// No send, no external provider, no AI live calls.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildPierreDocument } from "../../../../../lib/pierre/document-style/pierre-document-renderer";
import { buildPierreDocumentVerdict } from "../../../../../lib/pierre/document-style/pierre-document-quality";
import { buildPierreDocumentArtifact } from "../../../../../lib/pierre/document-style/pierre-document-artifacts";
import { stripTenantSpoofingFields } from "../../../../../lib/clonestore/document-style-kit/sanitize";
import type { EnterpriseEmpreinte } from "../../../../../lib/clonestore/empreinte/types";
import type { PierreEmpreinte } from "../../../../../lib/pierre/empreinte/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function jsonError(message: string, status: number, code?: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    { status },
  );
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

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
    throw { status: 401, message: "Auth session manquante.", code: "AUTH_SESSION_MISSING" };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw { status: 401, message: "Authentification échouée.", code: "AUTH_INVALID" };
  }
  return data.user.id;
}

async function hasPierreAccess(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
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

// ── Empreinte loading ─────────────────────────────────────────────────────────

async function loadEnterpriseEmpreinte(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<EnterpriseEmpreinte | null> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_enterprise_empreinte")
      .select("empreinte_json")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!data || !isObject(data.empreinte_json)) return null;
    return data.empreinte_json as unknown as EnterpriseEmpreinte;
  } catch {
    return null;
  }
}

async function loadPierreEmpreinte(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<PierreEmpreinte | null> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_empreinte")
      .select("empreinte_json")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!data || !isObject(data.empreinte_json)) return null;
    return data.empreinte_json as unknown as PierreEmpreinte;
  } catch {
    return null;
  }
}

// ── POST /api/pierre/documents/render ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };

  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return NextResponse.json(
        { ok: false, error: "Accès Pierre requis.", code: "PIERRE_ACCESS_DENIED" },
        { status: 403, headers },
      );
    }

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

    // Strip tenant spoofing from variables
    const rawVariables = isObject(body.variables) ? body.variables : {};
    const safeVariables = stripTenantSpoofingFields(rawVariables as Record<string, unknown>);

    // Mission context (optional)
    const missionContext = isObject(body.mission_context)
      ? {
          employee_name: asString(body.mission_context.employee_name),
          employee_id: asString(body.mission_context.employee_id),
          mission_id: asString(body.mission_context.mission_id),
          mission_title: asString(body.mission_context.mission_title),
          task_id: asString(body.mission_context.task_id),
          extra_variables: isObject(body.mission_context.extra_variables)
            ? stripTenantSpoofingFields(
                body.mission_context.extra_variables as Record<string, unknown>,
              )
            : {},
        }
      : null;

    // Load B44 empreintes (best-effort, non-blocking)
    const [enterprise, pierre] = await Promise.all([
      loadEnterpriseEmpreinte(supabaseAdmin, userId),
      loadPierreEmpreinte(supabaseAdmin, userId),
    ]);

    // Build document
    const buildResult = buildPierreDocument({
      templateId,
      variables: safeVariables,
      enterprise,
      pierre,
      userId,
      missionContext,
    });

    if (!buildResult.render_result) {
      return NextResponse.json(
        {
          ok: false,
          error: buildResult.verdict_message,
          code: "RENDER_FAILED",
          errors: buildResult.errors,
        },
        { status: 422, headers },
      );
    }

    const render = buildResult.render_result;

    // Build quality verdict (for the response metadata)
    const verdict = buildResult.quality
      ? {
          score: buildResult.quality.score,
          passed: buildResult.quality.passed,
          client_visible_safe: buildResult.quality.client_visible_safe,
          hard_fails: buildResult.quality.hard_fails.map((f) => f.message),
          warnings: buildResult.quality.warnings.map((w) => w.message),
        }
      : null;

    // Build Pierre verdict for 5-area assessment
    // (only if ctx is recoverable — we use buildResult.quality already)

    // Artifact metadata
    const artifactMetadata = render.artifact_metadata;

    return NextResponse.json(
      {
        ok: buildResult.ok,
        status: buildResult.status,
        verdict_message: buildResult.verdict_message,
        ready_for_export: buildResult.ready_for_export,
        render: {
          document_id: render.document_id,
          title: render.title,
          document_type: render.document_type,
          format: render.format,
          html: render.html,
          text: render.text,
          pdf_ready_html: render.pdf_ready_html,
          missing_variables: render.missing_variables,
          unresolved_tokens: render.unresolved_tokens,
          quality_score: render.quality_score,
          validation_requirement: render.validation_requirement,
          warnings: render.warnings,
          errors: render.errors,
        },
        quality: verdict,
        artifact: artifactMetadata
          ? {
              id: artifactMetadata.id,
              title: artifactMetadata.title,
              document_type: artifactMetadata.document_type,
              format: artifactMetadata.format,
              official_document: artifactMetadata.official_document,
              validation_required: artifactMetadata.validation_required,
              quality_score: artifactMetadata.quality_score,
              style_kit_id: artifactMetadata.style_kit_id,
              template_id: artifactMetadata.template_id,
              created_at: artifactMetadata.created_at,
            }
          : null,
        errors: buildResult.errors,
        meta: {
          template_id: templateId,
          user_id: userId,
          enterprise_loaded: Boolean(enterprise),
          pierre_loaded: Boolean(pierre),
          generated_at: new Date().toISOString(),
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Requête échouée.",
        error.status as number,
        asString(error.code) ?? undefined,
      );
    }
    const msg = error instanceof Error ? error.message : "Erreur interne de rendu.";
    return jsonError(msg, 500, "RENDER_INTERNAL_ERROR");
  }
}
