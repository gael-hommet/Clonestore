import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlActionFromTask,
  buildMissionControlRunPlan,
  sortMissionControlActions,
  isMissionControlSafeToRun,
} from "../../../../../../lib/pierre/hr/mission-control";
import {
  executePierreTaskWithPersistence,
  type PierreExecutionPersistenceResult,
} from "../../../../../../lib/pierre/tasks/execute-task";

// ── Safety constants (redeclared here for route isolation) ─

const HARD_MAX_TASKS = 10;

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

type RunResult = {
  task_id: string;
  outcome: string;
  ok: boolean;
  error?: string;
};

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

async function tryInsertLog(
  supabaseAdmin: SupabaseClient,
  payload: {
    user_id: string;
    event_type: string;
    message: string;
    meta_json?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabaseAdmin.from("pierre_task_logs").insert({
      user_id: payload.user_id,
      agent_slug: "pierre",
      event_type: payload.event_type,
      message: payload.message,
      meta_json: payload.meta_json ?? null,
    });
  } catch (_e) {
    /* skip malformed row */
  }
}

// ── POST /api/pierre/use/dashboard/execute-safe ─────────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    // Parse body
    let body: Record<string, unknown> = {};
    try {
      const raw = await request.json();
      if (isObject(raw)) body = raw;
    } catch {
      /* empty body is fine */
    }

    const rawMax = typeof body.max === "number" ? body.max : parseInt(String(body.max ?? "5"), 10);
    const maxTasks = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), HARD_MAX_TASKS) : 5;

    const now = new Date();
    const tasks = await fetchTasks(supabaseAdmin, userId);

    // Build run plan (dry_run=false means we will actually execute)
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
    const runPlan = buildMissionControlRunPlan(sortedActions, maxTasks, false);

    if (runPlan.safe_task_ids.length === 0) {
      return NextResponse.json({
        ok: true,
        ran: [],
        errors: [],
        skipped: [],
        run_plan: runPlan,
        summary: "Aucune tâche sûre à exécuter.",
        meta: {
          canonical_route: "/api/pierre/use/mission-control/run-safe",
          compatibility_route: "/api/pierre/use/dashboard/execute-safe",
          userId,
          fetchedAt: now.toISOString(),
          tasks_loaded: tasks.length,
          max_tasks: maxTasks,
          hard_max_tasks: HARD_MAX_TASKS,
          safety_gate: "mission_control_safe_execution",
          ran_count: 0,
          error_count: 0,
          skipped_count: 0,
        },
      });
    }

    await tryInsertLog(supabaseAdmin, {
      user_id: userId,
      event_type: "dashboard_execute_safe_started",
      message: `Exécution sûre démarrée — ${runPlan.safe_task_ids.length} tâche(s) planifiée(s)`,
      meta_json: {
        safe_task_ids: runPlan.safe_task_ids,
        max_requested: maxTasks,
        actions_evaluated: actions.length,
      },
    });

    const ran: RunResult[] = [];
    const errors: RunResult[] = [];
    const skipped: Array<{ task_id: string; reason: string }> = [];

    for (const action of runPlan.safe_actions) {
      const taskId = action.task_id;
      if (!taskId) {
        skipped.push({ task_id: "unknown", reason: "Missing task_id on action" });
        continue;
      }

      // Final safety gate — re-verify at execution time
      const taskRow = tasks.find((t) => asString(t.id) === taskId);
      if (!taskRow || !isMissionControlSafeToRun(taskRow, now)) {
        skipped.push({ task_id: taskId, reason: "Tâche non sûre à exécuter au moment de l'envoi" });
        continue;
      }

      try {
        const result: PierreExecutionPersistenceResult =
          await executePierreTaskWithPersistence({
            supabaseAdmin,
            taskId,
            userId,
          });

        if (result.ok) {
          ran.push({ task_id: taskId, outcome: result.outcome, ok: true });
        } else {
          errors.push({
            task_id: taskId,
            outcome: result.outcome,
            ok: false,
            error: result.error ?? "Execution failed",
          });
        }
      } catch (execError) {
        const msg =
          execError instanceof Error
            ? execError.message
            : isObject(execError)
              ? (asString(execError.message) ?? "Unknown error")
              : "Unknown execution error";
        errors.push({ task_id: taskId, outcome: "failed", ok: false, error: msg });
      }
    }

    await tryInsertLog(supabaseAdmin, {
      user_id: userId,
      event_type: "dashboard_execute_safe_completed",
      message: `Exécution sûre terminée — ${ran.length} réussi(es), ${errors.length} échec(s), ${skipped.length} ignoré(es)`,
      meta_json: {
        ran_task_ids: ran.map((r) => r.task_id),
        error_task_ids: errors.map((e) => e.task_id),
        skipped_task_ids: skipped.map((s) => s.task_id),
        ran_count: ran.length,
        error_count: errors.length,
        skipped_count: skipped.length,
      },
    });

    const total = ran.length + errors.length + skipped.length;
    const summary =
      ran.length > 0
        ? `${ran.length}/${total} tâche(s) exécutée(s) avec succès. ${errors.length} erreur(s). ${skipped.length} ignorée(s).`
        : `Aucune tâche exécutée avec succès. ${errors.length} erreur(s). ${skipped.length} ignorée(s).`;

    return NextResponse.json({
      ok: true,
      ran,
      errors,
      skipped,
      run_plan: runPlan,
      summary,
      meta: {
        canonical_route: "/api/pierre/use/mission-control/run-safe",
        compatibility_route: "/api/pierre/use/dashboard/execute-safe",
        userId,
        fetchedAt: now.toISOString(),
        tasks_loaded: tasks.length,
        max_tasks: maxTasks,
        hard_max_tasks: HARD_MAX_TASKS,
        safety_gate: "mission_control_safe_execution",
        ran_count: ran.length,
        error_count: errors.length,
        skipped_count: skipped.length,
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
