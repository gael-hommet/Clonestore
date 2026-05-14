import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionContinuityInsight,
  buildContinuePlan,
} from "../../../../../../../lib/pierre/hr/continuity";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message: asString(error.message) || "Unexpected database error.",
      code: asString(error.code),
    };
  }
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

// ═══════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

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
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (candidate) return candidate;
      }
      if (isObject(parsed)) {
        const currentSession = isObject(parsed.currentSession)
          ? parsed.currentSession
          : null;
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
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
    };
  }

  return data.user.id;
}

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════

async function verifyMissionOwnership(
  supabaseAdmin: SupabaseClient,
  missionId: string,
  userId: string,
): Promise<DbRow> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select(
      "id, status, understanding_status, risk_level, approval_required, mission_summary, missing_info_json, brain_output_json, created_at, updated_at",
    )
    .eq("id", missionId)
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission.",
      code: "MISSION_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw { status: 404, message: "Mission not found.", code: "MISSION_NOT_FOUND" };
  }

  return data as DbRow;
}

async function fetchMissionTasks(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, created_at, updated_at",
    )
    .eq("mission_id", missionId)
    .order("priority", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load tasks.",
      code: "TASKS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

// ═══════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ missionId: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const missionId = asString(resolvedParams?.missionId);

    if (!missionId) {
      return jsonError("Mission id is required.", 400, { code: "MISSION_ID_REQUIRED" });
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const [mission, tasks] = await Promise.all([
      verifyMissionOwnership(supabaseAdmin, missionId, userId),
      fetchMissionTasks(supabaseAdmin, missionId),
    ]);

    const now = new Date();
    const insight = buildMissionContinuityInsight(mission, tasks, { now });
    const plan = buildContinuePlan(mission, tasks, { now });

    return NextResponse.json({
      ok: true,
      mission_id: missionId,
      insight,
      plan,
      meta: {
        missionId,
        userId,
        generatedAt: now.toISOString(),
        tasks_count: tasks.length,
        safe_to_run_count: plan.safe_to_run.length,
        requires_human_count: plan.requires_human.length,
        blocked_count: plan.blocked.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        {
          code: asString(error.code),
          details: isObject(error.details) ? error.details : null,
        },
      );
    }

    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
