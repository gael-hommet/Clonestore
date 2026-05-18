import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlActionFromTask,
  buildMissionControlRunPlan,
  sortMissionControlActions,
} from "../../../../../../lib/pierre/hr/mission-control";

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

// ── Helpers ────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
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

// ── Supabase ───────────────────────────────────────────────

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
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
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
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
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

async function fetchTasks(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, brain_output_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw { status: 500, message: "Unable to load tasks.", code: "TASKS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

// ── GET /api/pierre/use/dashboard/run-plan ─────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const url = new URL(request.url);
    const rawMax = parseInt(url.searchParams.get("max") ?? "5", 10);
    const maxTasks = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), 10) : 5;
    const dryRun = !asBool(url.searchParams.get("dry_run") === "false" ? false : true);

    const now = new Date();
    const tasks = await fetchTasks(supabaseAdmin, userId);

    // Build task actions (only non-terminal tasks)
    const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
    const actions = tasks
      .filter(isObject)
      .filter((t) => {
        const s = asString(t.status)?.toLowerCase() ?? "";
        return !TERMINAL_STATUSES.has(s);
      })
      .map((task) => {
        try {
          return buildMissionControlActionFromTask(task, now);
        } catch (_e) {
          /* skip malformed row */
          return null;
        }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const sortedActions = sortMissionControlActions(actions);
    const runPlan = buildMissionControlRunPlan(sortedActions, maxTasks, dryRun);

    return NextResponse.json({
      ok: true,
      run_plan: runPlan,
      meta: {
        canonical_route: "/api/pierre/use/mission-control/run-plan",
        compatibility_route: "/api/pierre/use/dashboard/run-plan",
        userId,
        fetchedAt: now.toISOString(),
        tasks_loaded: tasks.length,
        actions_evaluated: actions.length,
        max_tasks: maxTasks,
        dry_run: dryRun,
        hard_max_tasks: 10,
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
