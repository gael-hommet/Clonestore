import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildContinuityDashboard } from "../../../../../lib/pierre/hr/continuity";

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

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════

async function fetchActiveMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select(
      "id, status, understanding_status, risk_level, approval_required, mission_summary, missing_info_json, brain_output_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .not("status", "in", '("cancelled")')
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw {
      status: 500,
      message: "Unable to load missions.",
      code: "MISSIONS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchTasksForMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionIds: string[],
): Promise<DbRow[]> {
  if (missionIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .in("mission_id", missionIds)
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
// GET HANDLER
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const missions = await fetchActiveMissions(supabaseAdmin, userId);

    const missionIds = missions
      .map((m) => asString(m.id))
      .filter((id): id is string => id !== null);

    const tasks = await fetchTasksForMissions(supabaseAdmin, userId, missionIds);

    // Group tasks by mission_id
    const tasksByMissionId: Record<string, DbRow[]> = {};
    for (const task of tasks) {
      const mId = asString(task.mission_id);
      if (!mId) continue;
      if (!tasksByMissionId[mId]) tasksByMissionId[mId] = [];
      tasksByMissionId[mId].push(task);
    }

    const now = new Date();
    const dashboard = buildContinuityDashboard(
      userId,
      missions,
      tasksByMissionId,
      { now },
    );

    return NextResponse.json({
      ok: true,
      dashboard,
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
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
