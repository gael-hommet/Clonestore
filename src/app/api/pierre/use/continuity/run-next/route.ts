import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { selectNextRunnableTasks } from "../../../../../../lib/pierre/hr/continuity";
import {
  executePierreTaskWithPersistence,
  type PierreExecutionPersistenceResult,
} from "../../../../../../lib/pierre/tasks/execute-task";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const DEFAULT_MAX_TASKS = 5;
const HARD_MAX_TASKS = 10;

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

function asInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
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

async function fetchRunnableCandidates(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string | null,
): Promise<DbRow[]> {
  let query = supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .in("status", ["ready", "retry"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  if (missionId) {
    query = query.eq("mission_id", missionId);
  }

  const { data, error } = await query;

  if (error) {
    throw {
      status: 500,
      message: "Unable to load runnable tasks.",
      code: "TASKS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

// ═══════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const bodyRaw = await request.json().catch(() => null);
    const missionId = isObject(bodyRaw) ? asString(bodyRaw.mission_id) : null;
    const maxRaw = isObject(bodyRaw) ? asInt(bodyRaw.max, DEFAULT_MAX_TASKS) : DEFAULT_MAX_TASKS;
    const max = Math.min(Math.max(1, maxRaw), HARD_MAX_TASKS);

    const now = new Date();
    const candidates = await fetchRunnableCandidates(supabaseAdmin, userId, missionId);
    const selected = selectNextRunnableTasks(candidates, { max, now });

    if (selected.length === 0) {
      return NextResponse.json({
        ok: true,
        ran: [],
        errors: [],
        skipped: [],
        meta: {
          userId,
          mission_id: missionId,
          candidates_found: candidates.length,
          selected_count: 0,
          triggered_at: now.toISOString(),
        },
      });
    }

    type RunResult = {
      task_id: string;
      outcome: string;
      ok: boolean;
      error?: string;
    };

    const ran: RunResult[] = [];
    const errors: RunResult[] = [];

    for (const task of selected) {
      const taskId = asString(task.id);
      if (!taskId) continue;

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

    return NextResponse.json({
      ok: true,
      ran,
      errors,
      skipped: [],
      meta: {
        userId,
        mission_id: missionId,
        candidates_found: candidates.length,
        selected_count: selected.length,
        ran_count: ran.length,
        error_count: errors.length,
        triggered_at: now.toISOString(),
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
