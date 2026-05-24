import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  renderPremiumDocument,
  buildDefaultPremiumDocumentConfig,
  inferPremiumDocumentFamily,
  normalizePremiumDocumentVariables,
  type PierrePremiumDocumentChannel,
  type PierrePremiumDocumentTone,
} from "../../../../../../lib/pierre/documents/premium-document-system";

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
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

// ── Data fetching ──────────────────────────────────────────

async function loadCompanyMemory(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow | null> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json, memory_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

function findEmployeeById(
  rrhContext: Record<string, unknown> | null,
  employeeId: string,
): Record<string, unknown> | null {
  if (!rrhContext) return null;
  const employees = rrhContext.employees;
  if (!Array.isArray(employees)) return null;
  const found = employees.find((e) => {
    if (!isObject(e)) return false;
    return asString(e.id) === employeeId || asString(e.employee_id) === employeeId;
  });
  return isObject(found) ? found : null;
}

// ── POST /api/pierre/use/document/preview ─────────────────

export async function POST(request: NextRequest) {
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

    // Resolve family/channel/tone
    const familyHint = {
      family: body.family ?? null,
      doc_type: body.doc_type ?? null,
      type: body.doc_type ?? null,
      title: body.title ?? null,
      instructions: body.instructions ?? null,
    };
    const family = inferPremiumDocumentFamily(familyHint);

    const rawChannel = asString(body.channel);
    const validChannels: PierrePremiumDocumentChannel[] = ["document", "pdf", "email", "html", "internal_note"];
    const channel: PierrePremiumDocumentChannel = validChannels.includes(rawChannel as PierrePremiumDocumentChannel)
      ? (rawChannel as PierrePremiumDocumentChannel)
      : "document";

    const rawTone = asString(body.requested_tone);
    const validTones: PierrePremiumDocumentTone[] = ["neutral", "warm", "formal", "firm", "executive", "legal_careful", "human"];
    const requested_tone: PierrePremiumDocumentTone | null = validTones.includes(rawTone as PierrePremiumDocumentTone)
      ? (rawTone as PierrePremiumDocumentTone)
      : null;

    // Load company memory
    const memoryRow = await loadCompanyMemory(supabaseAdmin, userId);
    const rrhContext = isObject(memoryRow?.reusable_rh_context_json)
      ? (memoryRow.reusable_rh_context_json as Record<string, unknown>)
      : null;

    const config = buildDefaultPremiumDocumentConfig(
      rrhContext ?? (isObject(memoryRow) ? memoryRow : null),
    );

    // Load employee file if employee_id provided
    const employeeId = asString(body.employee_id);
    const employeeFile = employeeId ? findEmployeeById(rrhContext, employeeId) : null;

    // Variables
    const explicitVariables = normalizePremiumDocumentVariables(
      Array.isArray(body.variables) ? body.variables : [],
    );

    const premiumInput = {
      family,
      channel,
      title: asString(body.title) || null,
      raw_content:
        asString(body.raw_content) ||
        asString(body.text_content) ||
        asString(body.instructions) ||
        null,
      variables: explicitVariables,
      mission: isObject(body.mission) ? body.mission : (body.mission_id ? { id: body.mission_id } : null),
      task: isObject(body.task) ? body.task : (body.task_id ? { id: body.task_id } : null),
      employee_file: employeeFile,
      company_memory: rrhContext ?? (isObject(memoryRow) ? memoryRow : null),
      payload: isObject(body.payload) ? body.payload : null,
      requested_tone,
    };

    const result = renderPremiumDocument(premiumInput, config);

    return NextResponse.json({
      ok: true,
      preview: {
        title: result.rendered.title,
        plain_text: result.rendered.plain_text,
        html: result.rendered.html,
        pdf_filename: result.rendered.pdf_filename,
        email_subject: result.rendered.email_subject,
      },
      quality: result.quality,
      digest: result.digest,
      variables: result.variables,
      selected_template: result.selected_template
        ? {
            id: result.selected_template.id,
            name: result.selected_template.name,
            family: result.selected_template.family,
            channel: result.selected_template.channel,
            risk_level: result.selected_template.risk_level,
            approval_required: result.selected_template.approval_required,
          }
        : null,
      meta: {
        family,
        channel,
        userId,
        employee_id: employeeId,
        employee_loaded: Boolean(employeeFile),
        generated_at: result.rendered.metadata.generated_at,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code),
      });
    }
    const msg = error instanceof Error ? error.message : "Preview failed.";
    return jsonError(msg, 500);
  }
}
