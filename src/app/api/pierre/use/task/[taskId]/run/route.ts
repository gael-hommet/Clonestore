import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildPierreTaskClaimPatch } from "@/lib/pierre/tasks/claim";
import { processPierreTask } from "@/lib/pierre/queue/process-task";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

type RunTaskBody = {
  workerId?: string | null;
  force?: boolean;
  lockMinutes?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedObject(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return isObject(value) ? value : null;
}

function getNestedString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  return asString(source[key]);
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();

  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of cookies) {
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
        const currentSession = getNestedObject(parsed, "currentSession");
        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(currentSession, "access_token");

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
): Promise<AuthenticatedContext> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw {
      status: 401,
      message: "Auth session missing.",
      code: "AUTH_SESSION_MISSING",
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
      details: error?.message || null,
    };
  }

  return {
    userId: data.user.id,
    accessToken,
  };
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error_description) ||
        "Unexpected database error.",
      code: asString(error.code),
      details: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
      details: null,
    };
  }

  return {
    message: "Unexpected database error.",
    code: null,
    details: null,
  };
}

function normalizeBody(raw: unknown): RunTaskBody {
  if (!isObject(raw)) {
    return {
      workerId: null,
      force: false,
      lockMinutes: undefined,
    };
  }

  return {
    workerId: asString(raw.workerId),
    force: asBoolean(raw.force) ?? false,
    lockMinutes: asNumber(raw.lockMinutes) ?? undefined,
  };
}

async function loadOwnedTask(
  supabaseAdmin: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<DbRow> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      `
      *,
      pierre_missions!inner (
        id,
        user_id
      )
    `,
    )
    .eq("id", taskId)
    .eq("pierre_missions.user_id", userId)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load task.",
      code: "TASK_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw {
      status: 404,
      message: "Task not found.",
      code: "TASK_NOT_FOUND",
    };
  }

  return data as DbRow;
}

function buildPersistenceAdapter(supabaseAdmin: SupabaseClient) {
  return {
    updateTask: async (taskId: string, patch: Record<string, unknown>) => {
      const { error } = await supabaseAdmin
        .from("pierre_tasks")
        .update(patch)
        .eq("id", taskId);

      if (error) {
        throw new Error(`Unable to update task: ${error.message}`);
      }
    },
    insertTaskLog: async (entry: {
      mission_id?: string | null;
      task_id?: string | null;
      level: "info" | "warning" | "error";
      event: string;
      message: string;
      payload?: Record<string, unknown> | null;
    }) => {
      const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
        mission_id: entry.mission_id ?? null,
        task_id: entry.task_id ?? null,
        level: entry.level,
        event: entry.event,
        message: entry.message,
        payload: entry.payload ?? null,
      });

      if (error) {
        throw new Error(`Unable to insert task log: ${error.message}`);
      }
    },
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const taskId = asString(resolvedParams?.taskId);

    if (!taskId) {
      return jsonError("Task id is required.", 400, {
        code: "TASK_ID_REQUIRED",
      });
    }

    const body = normalizeBody(await request.json().catch(() => null));
    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);
    const task = await loadOwnedTask(supabaseAdmin, taskId, auth.userId);

    const workerId = body.workerId || `manual-api-${auth.userId}`;
    const now = new Date();

    const claimPatch = buildPierreTaskClaimPatch({
      task: task as never,
      workerId,
      now,
      lockMinutes: body.lockMinutes,
      force: body.force,
    });

    if (!claimPatch.allowed) {
      return jsonError(claimPatch.reason, 409, {
        code: claimPatch.conflict_code,
      });
    }

    const persistence = buildPersistenceAdapter(supabaseAdmin);

    await persistence.updateTask(taskId, claimPatch.patch);
    await persistence.insertTaskLog({
      mission_id: asString(task.mission_id),
      task_id: taskId,
      level: "info",
      event: "task_claimed_manual_run",
      message: claimPatch.reason,
      payload: {
        worker_id: workerId,
      },
    });

    const result = await processPierreTask({
      task: {
        ...(task as DbRow),
        ...(claimPatch.patch as DbRow),
      } as never,
      workerId,
      persistence,
      now,
    });

    return NextResponse.json({
      ok: result.ok,
      result,
      meta: {
        taskId,
        workerId,
        fetchedAt: now.toISOString(),
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        {
          code: asString(error.code),
          details: error.details ?? null,
        },
      );
    }

    const mapped = mapDbError(error);

    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}