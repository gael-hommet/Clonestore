import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  evaluatePierreCloneGuard,
  buildCloneGuardPreview,
  summarizeCloneGuardEvaluation,
  type PierreCloneGuardContext,
} from "../../../../../../lib/pierre/hr/cloneguard";

// ── Helpers ────────────────────────────────────────────────

type JsonErrorExtra = { code?: string | null; details?: unknown };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function mapDbError(error: unknown) {
  if (isObject(error)) return { message: asString(error.message) || "Unexpected database error.", code: asString(error.code) };
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

// ── Supabase ───────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Auth ───────────────────────────────────────────────────

function tryReadBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
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
        const c = parsed.find((i): i is string => typeof i === "string" && i.split(".").length === 3);
        if (c) return c;
      }
      if (isObject(parsed)) {
        const cs = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const c = asString(parsed.access_token) || (cs ? asString(cs.access_token) : null);
        if (c) return c;
      }
    } catch { if (raw.split(".").length === 3) return raw; }
  }
  return null;
}

async function authenticateRequest(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<string> {
  const token = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function hasPierreAccess(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.from("orders").select("id").eq("user_id", userId).eq("agent_slug", "pierre").eq("status", "active").limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

// ── Context builder (shared logic) ────────────────────────

function buildContextFromBody(body: Record<string, unknown>, now: string): PierreCloneGuardContext {
  const task = isObject(body.task) ? body.task : null;
  const mission = isObject(body.mission) ? body.mission : null;
  const employeeFile = isObject(body.employee_file) ? body.employee_file : null;

  const textParts: string[] = [];
  if (typeof body.input === "string") textParts.push(body.input);
  if (task && typeof task.title === "string") textParts.push(task.title);
  if (task && typeof task.description === "string") textParts.push(task.description);
  if (mission && typeof mission.mission_summary === "string") textParts.push(mission.mission_summary);

  const riskHint =
    asString(task?.risk_level) ??
    asString(mission?.risk_level) ??
    asString(employeeFile?.risk_level) ??
    null;

  return {
    task_type: asString(task?.type) ?? asString(body.action_kind),
    task_title: asString(task?.title),
    task_description: asString(task?.description),
    payload_json: isObject(task?.payload_json) ? (task.payload_json as Record<string, unknown>) : null,
    approval_required:
      task?.approval_required === true ||
      task?.approval_required === "true" ||
      mission?.approval_required === true,
    domain: asString(body.domain) ?? asString(mission?.intent) ?? asString(mission?.domain),
    risk_level_hint: riskHint,
    text_corpus: textParts.join(" ") || null,
    now,
  };
}

// ── POST /api/pierre/use/cloneguard/preview ───────────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    let body: Record<string, unknown> = {};
    try {
      const raw = await request.json();
      if (isObject(raw)) body = raw;
    } catch { /* empty body — defaults apply */ }

    const now = new Date().toISOString();
    const cgCtx = buildContextFromBody(body, now);
    const evaluation = evaluatePierreCloneGuard(cgCtx);
    const preview = buildCloneGuardPreview(evaluation);
    const summary = summarizeCloneGuardEvaluation(evaluation);

    // No DB write for preview — pure evaluation only
    return NextResponse.json({
      ok: true,
      preview,
      summary,
      meta: {
        userId,
        evaluatedAt: now,
        route: "/api/pierre/use/cloneguard/preview",
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code),
        details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
